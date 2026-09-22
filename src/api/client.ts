/**
 * Mock backend. Everything is stored in localStorage and every call is async with a little
 * simulated latency, so swapping this file for real HTTP calls is the only change a backend needs.
 */
import { buildSeedRequests } from "../domain/seed";
import * as t from "../domain/transitions";
import type { HandoffRequest, Priority, Session, Settings, ThemePref } from "../domain/types";
import { sanitizeRequests, sanitizeSettings } from "../domain/validate";

const KEYS = {
  requests: "flowdesk.requests.v1",
  settings: "flowdesk.settings.v1",
  session: "flowdesk.session.v1",
  prefs: "flowdesk.prefs",
} as const;

let latency = 140;
/** Tests set this to 0. */
export function setLatency(ms: number) {
  latency = ms;
}
const wait = () => (latency ? new Promise<void>((resolve) => setTimeout(resolve, latency)) : Promise.resolve());

function read<T>(key: string, fallback: () => T, valid: (value: unknown) => boolean): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const value = JSON.parse(raw);
      if (valid(value)) return value as T;
    }
  } catch {
    /* fall through to the fallback */
  }
  return fallback();
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    throw new Error("Your browser blocked local storage, so changes cannot be saved.");
  }
}

function loadRequests(): HandoffRequest[] {
  const stored = read<HandoffRequest[]>(
    KEYS.requests,
    () => {
      // Persist the seed on first use so its timestamps stay stable between calls.
      const seed = buildSeedRequests();
      try {
        write(KEYS.requests, seed);
      } catch {
        /* storage blocked: the seed is rebuilt per call */
      }
      return seed;
    },
    () => true,
  );
  const valid = sanitizeRequests(stored);
  return valid.length ? valid : buildSeedRequests();
}

async function mutate(id: string, change: (request: HandoffRequest) => HandoffRequest): Promise<HandoffRequest> {
  await wait();
  const requests = loadRequests();
  const current = requests.find((r) => r.id === id);
  if (!current) throw new Error(`Request ${id} no longer exists.`);
  const updated = change(current);
  write(KEYS.requests, requests.map((r) => (r.id === id ? updated : r)));
  return updated;
}

export const api = {
  // Session
  async getSession(): Promise<Session | null> {
    return read<Session | null>(KEYS.session, () => null, (v) => { const s = v as Partial<Session> | null; return !!s && typeof s.email === "string" && typeof s.name === "string" && typeof s.workspace === "string"; });
  },
  async signIn(input: { email: string; workspace: string }): Promise<Session> {
    await wait();
    const name = input.email.split("@")[0]!.replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    const session: Session = { name, email: input.email.trim(), workspace: input.workspace.trim() };
    write(KEYS.session, session);
    return session;
  },
  async signOut(): Promise<void> {
    localStorage.removeItem(KEYS.session);
  },

  // Requests
  async listRequests(): Promise<HandoffRequest[]> {
    await wait();
    return loadRequests();
  },
  async createRequest(input: t.IntakeInput, actor: string): Promise<HandoffRequest> {
    await wait();
    const requests = loadRequests();
    const created = t.createRequest(input, requests, await api.getSettings(), actor);
    write(KEYS.requests, [created, ...requests]);
    return created;
  },
  assignOwner: (id: string, owner: string, actor: string) => mutate(id, (r) => t.assignOwner(r, owner, actor)),
  addNote: (id: string, note: string, actor: string) => mutate(id, (r) => t.addNote(r, note, actor)),
  resolve: (id: string, note: string, actor: string) => mutate(id, (r) => t.resolve(r, note, actor)),
  reopen: (id: string, actor: string) => mutate(id, (r) => t.reopen(r, actor)),
  async changePriority(id: string, priority: Priority, actor: string): Promise<HandoffRequest> {
    const settings = await api.getSettings();
    return mutate(id, (r) => t.changePriority(r, priority, settings, actor));
  },

  // Settings
  async getSettings(): Promise<Settings> {
    return sanitizeSettings(read<unknown>(KEYS.settings, () => null, () => true));
  },
  async saveSettings(settings: Settings): Promise<Settings> {
    await wait();
    write(KEYS.settings, settings);
    return settings;
  },

  // Demo data
  async resetDemoData(): Promise<HandoffRequest[]> {
    await wait();
    localStorage.removeItem(KEYS.requests);
    localStorage.removeItem(KEYS.settings);
    return loadRequests();
  },
};

/** Wipes every FlowDesk key. Used by the crash screen when saved data cannot be recovered. */
export function clearAllLocalData() {
  try {
    Object.values(KEYS).forEach((key) => localStorage.removeItem(key));
  } catch {
    /* nothing more we can do */
  }
}

// Theme preference lives outside the "backend": it is a per-browser setting and is read before first paint.
export function loadTheme(): ThemePref {
  try {
    const theme = JSON.parse(localStorage.getItem(KEYS.prefs) || "{}").theme;
    return theme === "light" || theme === "dark" ? theme : "system";
  } catch {
    return "system";
  }
}

export function saveTheme(theme: ThemePref) {
  try {
    localStorage.setItem(KEYS.prefs, JSON.stringify({ theme }));
  } catch {
    /* preference simply will not persist */
  }
}
