/**
 * Anything read back from storage (or, later, a server) is untrusted: old versions, manual edits and
 * partial writes all happen. These guards make bad data degrade to defaults instead of crashing a page.
 */
import { DEFAULT_SETTINGS } from "./defaults";
import { PRIORITIES, QUEUES, REQUEST_TYPES, SOURCES, STATUSES, type HandoffRequest, type Settings } from "./types";

type Bag = Record<string, unknown>;
const isBag = (value: unknown): value is Bag => typeof value === "object" && value !== null && !Array.isArray(value);
const isText = (value: unknown): value is string => typeof value === "string";
const isDate = (value: unknown): value is string => isText(value) && !Number.isNaN(Date.parse(value));
const oneOf = <T extends string>(list: readonly T[], value: unknown): value is T => list.includes(value as T);
const cleanStrings = (value: unknown): string[] => (Array.isArray(value) ? value.filter(isText).map((v) => v.trim()).filter(Boolean) : []);

export function isValidRequest(item: unknown): item is HandoffRequest {
  if (!isBag(item)) return false;
  return (
    isText(item.id) && isText(item.client) && isText(item.title) && isText(item.owner) && isText(item.details) && isText(item.summary) && isText(item.nextStep) &&
    oneOf(REQUEST_TYPES, item.type) && oneOf(SOURCES, item.source) && oneOf(QUEUES, item.queue) && oneOf(PRIORITIES, item.priority) && oneOf(STATUSES, item.status) &&
    isDate(item.createdAt) && isDate(item.dueAt) && (item.resolvedAt === undefined || isDate(item.resolvedAt)) &&
    Array.isArray(item.signals) && item.signals.every(isText) &&
    Array.isArray(item.evidence) && item.evidence.every((e) => isBag(e) && isText(e.source) && isDate(e.at) && isText(e.text)) &&
    Array.isArray(item.history) && item.history.every((h) => isBag(h) && isText(h.id) && isDate(h.at) && isText(h.actor) && isText(h.text))
  );
}

/** Keep the requests that are well formed and drop the rest. */
export function sanitizeRequests(value: unknown): HandoffRequest[] {
  return Array.isArray(value) ? value.filter(isValidRequest) : [];
}

/** Always returns usable settings: every missing or invalid field falls back to its default. */
export function sanitizeSettings(raw: unknown, base: Settings = DEFAULT_SETTINGS): Settings {
  const r: Bag = isBag(raw) ? raw : {};
  const routingRaw: Bag = isBag(r.routing) ? r.routing : {};
  const slaRaw: Bag = isBag(r.slaHours) ? r.slaHours : {};
  const notesRaw: Bag = isBag(r.notifications) ? r.notifications : {};

  const team = [...new Set(cleanStrings(r.team))];
  const finalTeam = team.length ? team : [...base.team];

  const routing = Object.fromEntries(
    QUEUES.map((queue) => {
      const rule: Bag = isBag(routingRaw[queue]) ? routingRaw[queue] : {};
      const fallbackOwner = finalTeam.includes(base.routing[queue].owner) ? base.routing[queue].owner : finalTeam[0]!;
      const keywords = [...new Set(cleanStrings(rule.keywords).map((k) => k.toLowerCase()))];
      return [
        queue,
        {
          owner: isText(rule.owner) && finalTeam.includes(rule.owner) ? rule.owner : fallbackOwner,
          priority: oneOf(PRIORITIES, rule.priority) ? rule.priority : base.routing[queue].priority,
          keywords: keywords.length ? keywords : [...base.routing[queue].keywords],
        },
      ];
    }),
  ) as Settings["routing"];

  const slaHours = Object.fromEntries(
    PRIORITIES.map((p) => [p, typeof slaRaw[p] === "number" && Number.isInteger(slaRaw[p]) && slaRaw[p] >= 1 && slaRaw[p] <= 720 ? slaRaw[p] : base.slaHours[p]]),
  ) as Settings["slaHours"];

  const notifications = Object.fromEntries(
    (Object.keys(base.notifications) as (keyof Settings["notifications"])[]).map((key) => [key, typeof notesRaw[key] === "boolean" ? notesRaw[key] : base.notifications[key]]),
  ) as Settings["notifications"];

  return { team: finalTeam, routing, slaHours, notifications };
}
