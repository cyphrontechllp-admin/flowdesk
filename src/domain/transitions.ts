import { nextStepFor, signalsFor, triage } from "./triage";
import type { ActivityItem, HandoffRequest, Priority, RequestType, Settings, Source, Status } from "./types";

export interface IntakeInput {
  client: string;
  type: RequestType;
  source: Source;
  details: string;
  owner?: string; // optional override of the suggested owner
}

const uid = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`);

function activity(actor: string, text: string, now: number): ActivityItem {
  return { id: uid(), at: new Date(now).toISOString(), actor, text };
}

export function nextRequestId(requests: HandoffRequest[]): string {
  const highest = requests.reduce((max, r) => Math.max(max, Number(r.id.replace(/\D/g, "")) || 0), 1000);
  return `FD-${highest + 1}`;
}

export function createRequest(input: IntakeInput, requests: HandoffRequest[], settings: Settings, actor: string, now = Date.now()): HandoffRequest {
  const result = triage(input, settings);
  const owner = input.owner || result.owner;
  const details = input.details.trim().replace(/\s+/g, " ");
  const short = details.length > 180 ? `${details.slice(0, 177)}…` : details;
  const status: Status = result.queue === "approval" ? "Awaiting approval" : "Needs owner";
  const at = new Date(now).toISOString();

  return {
    id: nextRequestId(requests),
    client: input.client.trim(),
    title: input.type,
    type: input.type,
    source: input.source,
    queue: result.queue,
    owner,
    priority: result.priority,
    status,
    details,
    summary: `${input.client.trim()} sent this through ${input.source}. ${short}`,
    nextStep: nextStepFor(result.queue, owner),
    signals: signalsFor(result.queue),
    evidence: [{ source: input.source, at, text: short }],
    history: [activity("FlowDesk", `Logged by ${actor} from ${input.source} and assigned to ${owner}.`, now)],
    createdAt: at,
    dueAt: new Date(now + settings.slaHours[result.priority] * 36e5).toISOString(),
  };
}

export function assignOwner(request: HandoffRequest, owner: string, actor: string, now = Date.now()): HandoffRequest {
  if (request.status === "Resolved" || owner === request.owner) return request;
  return {
    ...request,
    owner,
    status: "Routed",
    nextStep: nextStepFor(request.queue, owner),
    history: [activity(actor, `Assigned owner to ${owner}.`, now), ...request.history],
  };
}

export function changePriority(request: HandoffRequest, priority: Priority, settings: Settings, actor: string, now = Date.now()): HandoffRequest {
  if (request.status === "Resolved" || priority === request.priority) return request;
  return {
    ...request,
    priority,
    dueAt: new Date(new Date(request.createdAt).getTime() + settings.slaHours[priority] * 36e5).toISOString(),
    history: [activity(actor, `Changed priority from ${request.priority} to ${priority}.`, now), ...request.history],
  };
}

export function addNote(request: HandoffRequest, note: string, actor: string, now = Date.now()): HandoffRequest {
  const text = note.trim();
  if (!text) return request;
  return { ...request, history: [activity(actor, text, now), ...request.history] };
}

export function resolve(request: HandoffRequest, note: string, actor: string, now = Date.now()): HandoffRequest {
  const text = note.trim();
  if (request.status === "Resolved" || !text) return request;
  return {
    ...request,
    status: "Resolved",
    resolvedAt: new Date(now).toISOString(),
    nextStep: "Closed with account note recorded.",
    history: [activity(actor, `Closed handoff: ${text}`, now), ...request.history],
  };
}

export function reopen(request: HandoffRequest, actor: string, now = Date.now()): HandoffRequest {
  if (request.status !== "Resolved") return request;
  return {
    ...request,
    status: "Needs owner",
    resolvedAt: undefined,
    nextStep: nextStepFor(request.queue, request.owner),
    history: [activity(actor, "Reopened handoff.", now), ...request.history],
  };
}
