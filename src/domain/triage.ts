import { DEFAULT_SETTINGS } from "./defaults";
import { QUEUES, type Priority, type Queue, type RequestType, type Settings } from "./types";

export interface TriageInput {
  type: RequestType;
  details: string;
}

export interface TriageResult {
  queue: Queue;
  priority: Priority;
  owner: string;
  reasons: string[];
}

const TYPE_QUEUE: Record<RequestType, Queue> = {
  "Support escalation": "risk",
  "Scope approval": "approval",
  "Billing event": "billing",
  "Client onboarding": "support",
};

// Words that lift any request to High regardless of its queue's default priority.
const URGENT = ["urgent", "asap", "outage", "blocked", "production", "sla"];

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Whole-word, case-insensitive match so "sla" does not fire on "Slack" or "translation". */
export function hasKeyword(text: string, keyword: string) {
  const k = keyword.trim();
  return k.length > 0 && new RegExp(`(^|[^a-z0-9])${escapeRegExp(k)}($|[^a-z0-9])`, "i").test(text);
}

/**
 * Rule-based routing. The request type gives its queue a one point head start; each keyword hit adds one point, so two keywords outweigh the type.
 * Ties resolve in QUEUES order, so the more urgent queue wins.
 */
export function triage({ type, details }: TriageInput, settings: Settings = DEFAULT_SETTINGS): TriageResult {
  let best: Queue = TYPE_QUEUE[type];
  let bestScore = -1;
  let reasons: string[] = [];

  for (const queue of QUEUES) {
    const hits = settings.routing[queue].keywords.filter((keyword) => hasKeyword(details, keyword));
    const score = hits.length + (TYPE_QUEUE[type] === queue ? 1 : 0);
    if (score > bestScore) {
      best = queue;
      bestScore = score;
      reasons = hits;
    }
  }

  const rule = settings.routing[best];
  const urgent = URGENT.filter((word) => hasKeyword(details, word));
  const priority: Priority = urgent.length ? "High" : rule.priority;
  const explanation = [`Request type: ${type}`, ...reasons.map((word) => `Matched “${word}”`)];
  if (urgent.length && rule.priority !== "High") explanation.push(`Urgent wording raised priority (${urgent.join(", ")})`);

  return { queue: best, priority, owner: rule.owner, reasons: explanation };
}

export function nextStepFor(queue: Queue, owner: string): string {
  return {
    risk: `${owner} should own the first reply and get technical context before the response window closes.`,
    approval: `${owner} should record the decision owner, estimate, and delivery impact before work starts.`,
    billing: `${owner} should check account risk before any automated billing message goes out.`,
    support: `${owner} should confirm the missing input and name the person responsible for follow-up.`,
  }[queue];
}

export function signalsFor(queue: Queue): string[] {
  return {
    risk: ["Response window", "Customer blocked"],
    approval: ["Decision owner", "Delivery impact"],
    billing: ["Payment state", "Account-owner check"],
    support: ["Missing input", "Named follow-up"],
  }[queue];
}
