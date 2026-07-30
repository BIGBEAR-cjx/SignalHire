export type ClientReportFeedback = {
  sentiment: "ready_to_interview" | "needs_more_candidates" | "needs_stronger_evidence" | "not_a_fit";
  reviewer: string;
  note: string;
};

export function normalizeClientReportFeedback(input?: unknown): ClientReportFeedback | null;

export function normalizeClientFeedback(input?: unknown, context?: {
  actorEmail?: unknown;
  reportId?: unknown;
}): {
  sentiment: ClientReportFeedback["sentiment"];
  note: string;
  actor: string;
  report_id: string;
} | null;

export function buildClientReportFeedbackEvent(input?: {
  feedback?: unknown;
  reportHref?: string;
  now?: Date | string;
}): {
  event_type: "manager_feedback";
  action_type: "client_delivery_feedback";
  action_status: "succeeded";
  detail: string;
  at: string;
} | null;

export function handleClientPortalFeedbackPost(input?: {
  req?: Request;
  projectId?: string;
  dependencies?: Record<string, unknown>;
}): Promise<Response>;
