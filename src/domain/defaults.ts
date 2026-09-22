import type { Settings } from "./types";

export const DEFAULT_SETTINGS: Settings = {
  team: ["Cloud Support", "Fusion Apps Lead", "Billing Operations", "Customer Success", "Platform Engineering", "Account Owner"],
  routing: {
    risk: { owner: "Cloud Support", priority: "High", keywords: ["blocked", "urgent", "sla", "production", "outage", "down", "escalate"] },
    approval: { owner: "Fusion Apps Lead", priority: "Medium", keywords: ["approve", "approval", "scope", "estimate", "sign-off", "change request"] },
    billing: { owner: "Billing Operations", priority: "High", keywords: ["payment", "invoice", "billing", "renewal", "refund", "charge"] },
    support: { owner: "Customer Success", priority: "Low", keywords: ["onboarding", "access", "question", "how do i", "training"] },
  },
  slaHours: { High: 4, Medium: 24, Low: 72 },
  notifications: { dailyDigest: true, slackAlerts: true, overdueEmail: false },
};
