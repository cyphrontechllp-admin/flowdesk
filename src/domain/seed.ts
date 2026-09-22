import type { ActivityItem, EvidenceItem, HandoffRequest, Priority, Queue, RequestType, Source, Status } from "./types";
import { nextStepFor, signalsFor } from "./triage";

const HOUR = 36e5;

interface SeedRow {
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
  nextStep?: string;
  signals?: string[];
  evidence: [string, number, string][]; // source, hours ago, text
  history: [string, number, string][]; // actor, hours ago, text
  createdHoursAgo: number;
  dueInHours: number; // negative = overdue
  resolvedHoursAgo?: number;
}

const ROWS: SeedRow[] = [
  {
    id: "FD-1042", client: "Northstar CRM rollout", title: "SSO group mapping blocking pilot tenant", type: "Support escalation", source: "Service request",
    queue: "risk", owner: "Cloud Support", priority: "High", status: "Needs triage", createdHoursAgo: 5, dueInHours: 3,
    details: "Pilot rollout is blocked because two admin groups are not mapping into the tenant after SSO setup.",
    summary: "Two admin groups are not mapping into the pilot tenant after SSO setup. The response target closes before the implementation call.",
    nextStep: "Cloud Support owns the first response. Platform Engineering should confirm the group-mapping rule before the update goes out.",
    signals: ["Response target before implementation call", "SSO group mapping blocked"],
    evidence: [["Service request", 5, "Implementation owner reported missing admin access for two groups."], ["Access log", 4.8, "Group claim reached tenant but did not match the configured role rule."]],
    history: [["FlowDesk", 4.7, "Flagged response window and suggested Cloud Support ownership."]],
  },
  {
    id: "FD-1047", client: "Meridian ERP account", title: "Revenue export added after delivery sign-off", type: "Scope approval", source: "CRM note",
    queue: "approval", owner: "Fusion Apps Lead", priority: "Medium", status: "Awaiting approval", createdHoursAgo: 28, dueInHours: 20,
    details: "The customer approved the service workflow but requested an additional revenue export. The request affects scope and should be approved before development starts.",
    summary: "The workflow direction is approved, but the revenue export changes delivery scope before build starts.",
    nextStep: "Fusion Apps Lead should send a change note with estimate, decision owner, and delivery impact.",
    signals: ["Post-approval scope change", "Estimate required"],
    evidence: [["CRM note", 28, "Scope marked approved before revenue export request was added."], ["Email", 26, "Customer requested revenue export before development starts."]],
    history: [["FlowDesk", 25.5, "Moved request into approval queue pending estimate."]],
  },
  {
    id: "FD-1051", client: "Cedar Health tenant", title: "Tenant access missing for implementation kickoff", type: "Client onboarding", source: "Form intake",
    queue: "support", owner: "Customer Success", priority: "Low", status: "Ready to assign", createdHoursAgo: 52, dueInHours: 60,
    details: "New client intake is complete except for domain access. Brand files and stakeholder details are available.",
    summary: "Stakeholders and implementation notes are ready. Tenant access is the only missing piece before kickoff.",
    nextStep: "Customer Success should request tenant access today and confirm the kickoff owner.",
    signals: ["Tenant access missing", "Kickoff can proceed after access"],
    evidence: [["Form intake", 52, "Stakeholders and implementation notes attached; tenant access unchecked."], ["CRM note", 50, "Kickoff scheduled for Friday afternoon."]],
    history: [["FlowDesk", 50, "Marked implementation ready except for tenant access."]],
  },
  {
    id: "FD-1054", client: "Summit billing account", title: "Failed renewal charge during open incident", type: "Billing event", source: "Billing event",
    queue: "billing", owner: "Billing Operations", priority: "High", status: "Review required", createdHoursAgo: 7, dueInHours: -1,
    details: "Payment failed on a renewal account with an open priority ticket. Account owner should be notified before automated dunning continues.",
    summary: "The renewal charge failed while a priority support ticket is still open. Automated follow-up would land badly without account-owner context.",
    nextStep: "Billing Operations should pause dunning and ask the account owner whether this is renewal risk or a payment-method issue.",
    signals: ["Renewal charge failed", "Priority ticket still open"],
    evidence: [["Billing event", 7, "Renewal charge failed for default payment method."], ["Service request", 6.8, "Priority support ticket still open on the same account."]],
    history: [["FlowDesk", 6.6, "Held automated billing follow-up pending account-owner review."]],
  },
  {
    id: "FD-1056", client: "Harbor Logistics", title: "Webhook retries flooding the alerts channel", type: "Support escalation", source: "Email",
    queue: "risk", owner: "Platform Engineering", priority: "Medium", status: "Routed", createdHoursAgo: 14, dueInHours: 10,
    details: "Retry storms from the delivery webhook are filling the shared alerts channel and hiding real incidents.",
    summary: "Webhook retries are noisy enough that the on-call team is missing genuine alerts.",
    evidence: [["Email", 14, "On-call lead asked for a retry cap on the delivery webhook."]],
    history: [["Operator", 12, "Assigned owner to Platform Engineering."], ["FlowDesk", 14, "Created from Email and suggested Cloud Support."]],
  },
  {
    id: "FD-1058", client: "Alder & Finch", title: "Change request for quarterly reporting pack", type: "Scope approval", source: "Email",
    queue: "approval", owner: "Account Owner", priority: "Medium", status: "Awaiting approval", createdHoursAgo: 9, dueInHours: 40,
    details: "Client wants two extra dashboards in the quarterly pack and asked for an estimate.",
    summary: "Two extra dashboards are requested for the quarterly pack; an estimate is needed before commitment.",
    evidence: [["Email", 9, "Client asked for two extra dashboards and an estimate."]],
    history: [["FlowDesk", 9, "Moved request into approval queue pending estimate."]],
  },
  {
    id: "FD-1059", client: "Brightwater Clinics", title: "Invoice dispute on March onboarding fee", type: "Billing event", source: "CRM note",
    queue: "billing", owner: "Billing Operations", priority: "Medium", status: "Needs owner", createdHoursAgo: 3, dueInHours: 21,
    details: "Customer says the onboarding fee was invoiced twice and requested a refund.",
    summary: "A duplicate onboarding invoice is disputed and the customer has asked for a refund.",
    evidence: [["CRM note", 3, "Account manager logged a duplicate-invoice complaint."]],
    history: [["FlowDesk", 3, "Created from CRM note and suggested Billing Operations."]],
  },
  // Closed history so reports have a trend to show.
  { id: "FD-1031", client: "Orion Freight", title: "Portal login loop after password reset", type: "Support escalation", source: "Service request", queue: "risk", owner: "Cloud Support", priority: "High", status: "Resolved", createdHoursAgo: 150, dueInHours: -146, resolvedHoursAgo: 148, details: "Users loop back to login after a reset.", summary: "Password reset left sessions in a redirect loop.", evidence: [["Service request", 150, "Three users reported the login loop."]], history: [["Operator", 148, "Closed handoff: Cleared stale session cookie rule and confirmed with the client."]] },
  { id: "FD-1034", client: "Kestrel Foods", title: "Add regional tax line to invoices", type: "Scope approval", source: "CRM note", queue: "approval", owner: "Fusion Apps Lead", priority: "Medium", status: "Resolved", createdHoursAgo: 130, dueInHours: -106, resolvedHoursAgo: 118, details: "Scope change for regional tax lines.", summary: "Regional tax line requested after sign-off.", evidence: [["CRM note", 130, "Client asked for a regional tax line."]], history: [["Operator", 118, "Closed handoff: Estimate approved, added to sprint 14."]] },
  { id: "FD-1036", client: "Lumen Retail", title: "Card update link expired before renewal", type: "Billing event", source: "Billing event", queue: "billing", owner: "Billing Operations", priority: "High", status: "Resolved", createdHoursAgo: 100, dueInHours: -96, resolvedHoursAgo: 95, details: "Renewal at risk because the card-update link expired.", summary: "Card update link expired ahead of renewal.", evidence: [["Billing event", 100, "Payment failed; update link expired."]], history: [["Operator", 95, "Closed handoff: New link sent, payment collected."]] },
  { id: "FD-1038", client: "Pine Ridge Dental", title: "Kickoff needs named stakeholder", type: "Client onboarding", source: "Form intake", queue: "support", owner: "Customer Success", priority: "Low", status: "Resolved", createdHoursAgo: 90, dueInHours: -20, resolvedHoursAgo: 70, details: "Stakeholder missing from intake.", summary: "Kickoff blocked on a stakeholder name.", evidence: [["Form intake", 90, "Stakeholder field left blank."]], history: [["Operator", 70, "Closed handoff: Stakeholder confirmed, kickoff booked."]] },
  { id: "FD-1040", client: "Vale Insurance", title: "Reporting API timing out for large exports", type: "Support escalation", source: "Email", queue: "risk", owner: "Platform Engineering", priority: "High", status: "Resolved", createdHoursAgo: 60, dueInHours: -56, resolvedHoursAgo: 52, details: "Large exports time out in production.", summary: "Exports above 50k rows time out.", evidence: [["Email", 60, "Client reported timeouts on large exports."]], history: [["Operator", 52, "Closed handoff: Pagination enabled and export verified."]] },
  { id: "FD-1044", client: "Northwind Legal", title: "Second signer added to engagement letter", type: "Scope approval", source: "CRM note", queue: "approval", owner: "Account Owner", priority: "Medium", status: "Resolved", createdHoursAgo: 40, dueInHours: -16, resolvedHoursAgo: 30, details: "Additional signer requested.", summary: "Engagement letter needs a second signer.", evidence: [["CRM note", 40, "Client added a second signer."]], history: [["Operator", 30, "Closed handoff: Letter reissued and signed."]] },
  { id: "FD-1049", client: "Redwood Studio", title: "Refund for cancelled add-on", type: "Billing event", source: "Email", queue: "billing", owner: "Billing Operations", priority: "Medium", status: "Resolved", createdHoursAgo: 22, dueInHours: 2, resolvedHoursAgo: 8, details: "Add-on cancelled within the grace period.", summary: "Refund requested for a cancelled add-on.", evidence: [["Email", 22, "Client requested a refund within the grace period."]], history: [["Operator", 8, "Closed handoff: Refund issued."]] },
];

export function buildSeedRequests(now = Date.now()): HandoffRequest[] {
  const iso = (hoursAgo: number) => new Date(now - hoursAgo * HOUR).toISOString();
  return ROWS.map((row) => {
    const evidence: EvidenceItem[] = row.evidence.map(([source, ago, text]) => ({ source, at: iso(ago), text }));
    const history: ActivityItem[] = row.history.map(([actor, ago, text], i) => ({ id: `${row.id}-h${i}`, at: iso(ago), actor, text }));
    return {
      id: row.id,
      client: row.client,
      title: row.title,
      type: row.type,
      source: row.source,
      queue: row.queue,
      owner: row.owner,
      priority: row.priority,
      status: row.status,
      details: row.details,
      summary: row.summary,
      nextStep: row.status === "Resolved" ? "Closed with account note recorded." : (row.nextStep ?? nextStepFor(row.queue, row.owner)),
      signals: row.signals ?? signalsFor(row.queue),
      evidence,
      history,
      createdAt: iso(row.createdHoursAgo),
      dueAt: new Date(now + row.dueInHours * HOUR).toISOString(),
      resolvedAt: row.resolvedHoursAgo === undefined ? undefined : iso(row.resolvedHoursAgo),
    } satisfies HandoffRequest;
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
