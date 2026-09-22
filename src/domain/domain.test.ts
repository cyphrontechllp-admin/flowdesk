import { describe, expect, it } from "vitest";
import { requestsToCsv, csvCell } from "./csv";
import { DEFAULT_SETTINGS } from "./defaults";
import { isDueToday, isOverdue, summarize, throughput } from "./metrics";
import { buildSeedRequests } from "./seed";
import { hasKeyword, triage } from "./triage";
import * as t from "./transitions";
import { isValidRequest, sanitizeRequests, sanitizeSettings } from "./validate";

const NOW = new Date("2026-03-10T12:00:00Z").getTime();
const seed = () => buildSeedRequests(NOW);

describe("triage", () => {
  it("matches whole words only, so Slack and translation are not SLA", () => {
    expect(hasKeyword("Slack alert about a translation bug", "sla")).toBe(false);
    expect(hasKeyword("We will miss the SLA today", "sla")).toBe(true);
  });

  it("routes billing language to billing and lifts urgent wording to High", () => {
    const result = triage({ type: "Client onboarding", details: "The renewal payment failed, please fix urgent" });
    expect(result.queue).toBe("billing");
    expect(result.owner).toBe("Billing Operations");
    expect(result.priority).toBe("High");
    expect(result.reasons).toContain("Matched “payment”");
  });

  it("falls back to the request type when the text has no keywords", () => {
    expect(triage({ type: "Scope approval", details: "hello" }).queue).toBe("approval");
    expect(triage({ type: "Client onboarding", details: "hello" }).queue).toBe("support");
  });

  it("uses edited routing settings", () => {
    const settings = structuredClone(DEFAULT_SETTINGS);
    settings.routing.support.owner = "Platform Engineering";
    expect(triage({ type: "Client onboarding", details: "hello" }, settings).owner).toBe("Platform Engineering");
  });
});

describe("csv", () => {
  it("neutralises spreadsheet formulas and escapes quotes", () => {
    expect(csvCell("=HYPERLINK(x)")).toBe(`"'=HYPERLINK(x)"`);
    expect(csvCell('say "hi"')).toBe(`"say ""hi"""`);
  });

  it("writes a header plus one row per request", () => {
    expect(requestsToCsv(seed()).split("\r\n")).toHaveLength(seed().length + 1);
  });
});

describe("metrics", () => {
  it("counts open, overdue and closed work from real due dates", () => {
    const requests = seed();
    const summary = summarize(requests, NOW);
    expect(summary.open).toBe(requests.filter((r) => r.status !== "Resolved").length);
    expect(summary.overdue).toBe(1); // FD-1054 is one hour late
    expect(requests.find((r) => r.id === "FD-1054") && isOverdue(requests.find((r) => r.id === "FD-1054")!, NOW)).toBe(true);
    expect(isDueToday(requests.find((r) => r.id === "FD-1042")!, NOW)).toBe(true);
    expect(summary.byQueue.reduce((n, q) => n + q.count, 0)).toBe(summary.open);
  });

  it("builds a 7 day trend that includes closed work", () => {
    const days = throughput(seed(), 7, NOW);
    expect(days).toHaveLength(7);
    expect(days.reduce((n, d) => n + d.closed, 0)).toBeGreaterThan(0);
  });
});

describe("transitions", () => {
  const requests = seed();
  const base = requests.find((r) => r.id === "FD-1047")!;

  it("creates the next sequential id with an SLA due time", () => {
    const created = t.createRequest({ client: "  Acme  ", type: "Billing event", source: "Email", details: "invoice dispute" }, requests, DEFAULT_SETTINGS, "Sam", NOW);
    expect(created.id).toBe("FD-1060");
    expect(created.client).toBe("Acme");
    expect(created.queue).toBe("billing");
    expect(new Date(created.dueAt).getTime() - NOW).toBe(DEFAULT_SETTINGS.slaHours.High * 36e5);
  });

  it("assigns an owner and records it in the trail", () => {
    const next = t.assignOwner(base, "Customer Success", "Sam", NOW);
    expect(next.owner).toBe("Customer Success");
    expect(next.status).toBe("Routed");
    expect(next.history[0]?.text).toContain("Customer Success");
  });

  it("refuses to close without a note and never re-routes a closed request", () => {
    expect(t.resolve(base, "   ", "Sam", NOW)).toBe(base);
    const closed = t.resolve(base, "Estimate approved", "Sam", NOW);
    expect(closed.status).toBe("Resolved");
    expect(closed.resolvedAt).toBeDefined();
    expect(t.assignOwner(closed, "Account Owner", "Sam", NOW)).toBe(closed);
    expect(t.reopen(closed, "Sam", NOW).status).toBe("Needs owner");
  });

  it("recomputes the due time when priority changes", () => {
    const next = t.changePriority(base, "High", DEFAULT_SETTINGS, "Sam", NOW);
    expect(new Date(next.dueAt).getTime() - new Date(base.createdAt).getTime()).toBe(DEFAULT_SETTINGS.slaHours.High * 36e5);
  });
});

describe("stored data validation", () => {
  it("turns damaged settings into usable ones instead of crashing", () => {
    for (const bad of [null, "x", [], {}, { team: [], routing: { risk: {}, approval: null }, slaHours: { High: "4" } }, { routing: { risk: { keywords: null } } }]) {
      const s = sanitizeSettings(bad);
      expect(s.team.length).toBeGreaterThan(0);
      for (const q of ["risk", "approval", "billing", "support"] as const) {
        expect(s.routing[q].keywords.length).toBeGreaterThan(0);
        expect(s.team).toContain(s.routing[q].owner);
      }
      expect(() => triage({ type: "Billing event", details: "invoice" }, s)).not.toThrow();
    }
  });

  it("keeps valid custom settings and repairs only the broken parts", () => {
    const s = sanitizeSettings({ team: ["A", "B"], routing: { risk: { owner: "B", priority: "Low", keywords: ["Boom"] } }, slaHours: { High: 2, Medium: 0 } });
    expect(s.routing.risk).toEqual({ owner: "B", priority: "Low", keywords: ["boom"] });
    expect(s.slaHours).toEqual({ High: 2, Medium: DEFAULT_SETTINGS.slaHours.Medium, Low: DEFAULT_SETTINGS.slaHours.Low });
    expect(s.routing.billing.owner).toBe("A");
  });

  it("drops malformed requests and keeps good ones", () => {
    const good = seed()[0]!;
    const list = sanitizeRequests([good, { ...good, queue: "nope" }, { ...good, dueAt: "not a date" }, { id: "x" }, null, 5]);
    expect(list).toEqual([good]);
    expect(isValidRequest({ ...good, history: [{}] })).toBe(false);
  });
});
