import type { RoleAgentMetricEvent } from "./role-agent-metrics";

export type ClientDeliveryAuditEvent = {
  user_id: string;
  project_id: string;
  event_type: "report_view" | "feedback";
  action_type: string;
  report_href: string;
  actor: string;
  sentiment: string;
  note: string;
  detail: string;
  event_at: string;
};

export function buildClientDeliveryAuditEvent(input?: {
  userId?: string | null;
  projectId?: string | null;
  event?: RoleAgentMetricEvent | null;
}): ClientDeliveryAuditEvent | null;
