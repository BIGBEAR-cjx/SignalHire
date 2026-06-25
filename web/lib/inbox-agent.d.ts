export type InboxClassification = "interested" | "ask_for_details" | "not_interested" | "later" | "out_of_office" | "bounced" | "needs_human_reply";

export type InboxQueueItem = {
  id: string;
  candidate_name: string;
  classification: InboxClassification | string;
  classification_reason: string;
  last_message_excerpt: string;
  suggested_reply: string;
  updated_at: string;
  gmail_thread_id?: string;
  outreach_thread_id?: string;
};

export type InboxQueueView = {
  summary: { total: number; interested: number; needs_human_reply: number };
  items: InboxQueueItem[];
  interested_candidates: Array<InboxQueueItem & {
    readiness: "needs_scheduling";
    recommended_next_step: string;
  }>;
};

export function classifyInboxReply(input?: { text?: string; candidateName?: string; roleBrief?: string }): {
  classification: InboxClassification;
  classification_reason: string;
  last_message_excerpt: string;
  suggested_reply: string;
};
export function shouldStopFollowUp(classification: string): boolean;
export function buildInboxQueue(input?: { threads?: unknown[] }): InboxQueueView;
