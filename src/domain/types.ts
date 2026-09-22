export const QUEUES = ["risk", "approval", "billing", "support"] as const;
export type Queue = (typeof QUEUES)[number];

export const PRIORITIES = ["High", "Medium", "Low"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const REQUEST_TYPES = ["Support escalation", "Scope approval", "Billing event", "Client onboarding"] as const;
export type RequestType = (typeof REQUEST_TYPES)[number];

export const SOURCES = ["Service request", "CRM note", "Email", "Billing event", "Form intake"] as const;
export type Source = (typeof SOURCES)[number];

export const STATUSES = ["Needs triage", "Needs owner", "Awaiting approval", "Ready to assign", "Review required", "Routed", "Resolved"] as const;
export type Status = (typeof STATUSES)[number];

export interface EvidenceItem {
  source: string;
  at: string; // ISO
  text: string;
}

export interface ActivityItem {
  id: string;
  at: string; // ISO
  actor: string;
  text: string;
}

export interface HandoffRequest {
  id: string;
  client: string;
  title: string;
  type: RequestType;
  source: Source;
  queue: Queue;
  owner: string;
  priority: Priority;
  status: Status;
  details: string;
  summary: string;
  nextStep: string;
  signals: string[];
  evidence: EvidenceItem[];
  history: ActivityItem[];
  createdAt: string; // ISO
  dueAt: string; // ISO
  resolvedAt?: string; // ISO
}

export interface QueueRule {
  owner: string;
  priority: Priority;
  keywords: string[];
}

export interface Settings {
  team: string[];
  routing: Record<Queue, QueueRule>;
  slaHours: Record<Priority, number>;
  notifications: { dailyDigest: boolean; slackAlerts: boolean; overdueEmail: boolean };
}

export interface Session {
  name: string;
  email: string;
  workspace: string;
}

export type ThemePref = "system" | "light" | "dark";

export const QUEUE_LABEL: Record<Queue, string> = {
  risk: "Risk",
  approval: "Approval",
  billing: "Billing",
  support: "Support",
};
