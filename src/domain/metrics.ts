import { PRIORITIES, QUEUES, type HandoffRequest, type Priority, type Queue } from "./types";

export const isOpen = (request: HandoffRequest) => request.status !== "Resolved";

export const isOverdue = (request: HandoffRequest, now = Date.now()) => isOpen(request) && new Date(request.dueAt).getTime() < now;

export function isDueToday(request: HandoffRequest, now = Date.now()) {
  if (!isOpen(request)) return false;
  const due = new Date(request.dueAt);
  return due.toDateString() === new Date(now).toDateString() && due.getTime() >= now;
}

function countBy<T extends string>(requests: HandoffRequest[], keys: readonly T[], pick: (r: HandoffRequest) => string) {
  return keys.map((key) => ({ key, count: requests.filter((r) => pick(r) === key).length }));
}

function tally(values: string[]) {
  return [...values.reduce((map, value) => map.set(value, (map.get(value) ?? 0) + 1), new Map<string, number>())];
}

export function summarize(requests: HandoffRequest[], now = Date.now()) {
  const open = requests.filter(isOpen);
  const weekAgo = now - 7 * 864e5;
  return {
    open: open.length,
    overdue: open.filter((r) => isOverdue(r, now)).length,
    dueToday: open.filter((r) => isDueToday(r, now)).length,
    awaitingDecision: open.filter((r) => r.status === "Awaiting approval").length,
    closedThisWeek: requests.filter((r) => r.resolvedAt && new Date(r.resolvedAt).getTime() >= weekAgo).length,
    byQueue: countBy<Queue>(open, QUEUES, (r) => r.queue),
    byPriority: countBy<Priority>(open, PRIORITIES, (r) => r.priority),
    byOwner: tally(open.map((r) => r.owner))
      .map(([owner, count]) => ({ owner, count }))
      .sort((a, b) => b.count - a.count || a.owner.localeCompare(b.owner)),
    byStatus: tally(requests.map((r) => r.status))
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count),
  };
}

/** Created vs closed per day for the last `days` days, oldest first. */
export function throughput(requests: HandoffRequest[], days = 7, now = Date.now()) {
  const dayKey = (t: number) => new Date(t).toDateString();
  return Array.from({ length: days }, (_, i) => {
    const t = now - (days - 1 - i) * 864e5;
    const key = dayKey(t);
    return {
      date: new Date(t),
      created: requests.filter((r) => dayKey(new Date(r.createdAt).getTime()) === key).length,
      closed: requests.filter((r) => r.resolvedAt && dayKey(new Date(r.resolvedAt).getTime()) === key).length,
    };
  });
}

const PRIORITY_RANK: Record<Priority, number> = { High: 0, Medium: 1, Low: 2 };

export const SORTS = {
  due: { label: "Due soonest", fn: (a: HandoffRequest, b: HandoffRequest) => a.dueAt.localeCompare(b.dueAt) },
  priority: { label: "Priority", fn: (a: HandoffRequest, b: HandoffRequest) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.dueAt.localeCompare(b.dueAt) },
  newest: { label: "Newest", fn: (a: HandoffRequest, b: HandoffRequest) => b.createdAt.localeCompare(a.createdAt) },
} as const;

export type SortKey = keyof typeof SORTS;
