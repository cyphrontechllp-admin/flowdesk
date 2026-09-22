import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "../api/client";
import type { IntakeInput } from "../domain/transitions";
import type { HandoffRequest, Priority, Session, Settings } from "../domain/types";
import { useToast } from "./toast";

type Phase = "booting" | "signed-out" | "loading" | "ready" | "error";

interface AppContextValue {
  phase: Phase;
  error: string;
  session: Session | null;
  requests: HandoffRequest[];
  settings: Settings | null;
  signIn: (input: { email: string; workspace: string }) => Promise<void>;
  signOut: () => Promise<void>;
  reload: () => Promise<void>;
  createRequest: (input: IntakeInput) => Promise<HandoffRequest | null>;
  assignOwner: (id: string, owner: string) => Promise<void>;
  changePriority: (id: string, priority: Priority) => Promise<void>;
  addNote: (id: string, note: string) => Promise<void>;
  resolve: (id: string, note: string) => Promise<void>;
  reopen: (id: string) => Promise<void>;
  saveSettings: (settings: Settings) => Promise<boolean>;
  resetDemoData: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error("useApp must be used inside <AppProvider>");
  return value;
}

const messageOf = (error: unknown) => (error instanceof Error ? error.message : "Something went wrong. Please try again.");

export function AppProvider({ children }: { children: ReactNode }) {
  const notify = useToast();
  const [phase, setPhase] = useState<Phase>("booting");
  const [error, setError] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [requests, setRequests] = useState<HandoffRequest[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);

  const load = useCallback(async () => {
    setPhase("loading");
    try {
      const [list, config] = await Promise.all([api.listRequests(), api.getSettings()]);
      setRequests(list);
      setSettings(config);
      setPhase("ready");
    } catch (e) {
      setError(messageOf(e));
      setPhase("error");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    api.getSession().then((existing) => {
      if (cancelled) return;
      setSession(existing);
      if (existing) void load();
      else setPhase("signed-out");
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const replace = useCallback((updated: HandoffRequest) => {
    setRequests((current) => current.map((r) => (r.id === updated.id ? updated : r)));
  }, []);

  /** Run a mutation, then merge its result. Failures become toasts instead of unhandled rejections. */
  const mutate = useCallback(
    async (job: () => Promise<HandoffRequest>, success: string) => {
      try {
        replace(await job());
        notify(success);
      } catch (e) {
        notify(messageOf(e), "error");
      }
    },
    [notify, replace],
  );

  const actor = session?.name ?? "Operator";

  const value = useMemo<AppContextValue>(
    () => ({
      phase,
      error,
      session,
      requests,
      settings,
      reload: load,
      async signIn(input) {
        const next = await api.signIn(input);
        setSession(next);
        await load();
      },
      async signOut() {
        await api.signOut();
        setSession(null);
        setRequests([]);
        setSettings(null);
        setPhase("signed-out");
      },
      async createRequest(input) {
        try {
          const created = await api.createRequest(input, actor);
          setRequests((current) => [created, ...current]);
          notify(`${created.id} added to the ${created.queue} queue.`);
          return created;
        } catch (e) {
          notify(messageOf(e), "error");
          return null;
        }
      },
      assignOwner: (id, owner) => mutate(() => api.assignOwner(id, owner, actor), `Assigned to ${owner}.`),
      changePriority: (id, priority) => mutate(() => api.changePriority(id, priority, actor), `Priority set to ${priority}.`),
      addNote: (id, note) => mutate(() => api.addNote(id, note, actor), "Note added."),
      resolve: (id, note) => mutate(() => api.resolve(id, note, actor), `${id} closed.`),
      reopen: (id) => mutate(() => api.reopen(id, actor), `${id} reopened.`),
      async saveSettings(next) {
        try {
          setSettings(await api.saveSettings(next));
          notify("Settings saved.");
          return true;
        } catch (e) {
          notify(messageOf(e), "error");
          return false;
        }
      },
      async resetDemoData() {
        try {
          setRequests(await api.resetDemoData());
          setSettings(await api.getSettings());
          notify("Demo data reset.", "info");
        } catch (e) {
          notify(messageOf(e), "error");
        }
      },
    }),
    [phase, error, session, requests, settings, load, mutate, notify, actor],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
