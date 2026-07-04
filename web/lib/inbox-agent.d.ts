export type InboxClassification = "interested" | "ask_for_details" | "not_interested" | "later" | "out_of_office" | "bounced" | "needs_human_reply" | "no_reply_follow_up";

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
  saved_scheduling_draft?: string;
  action_status?: "pending" | "draft_saved" | "slot_held" | "confirmed" | "rescheduled" | "canceled" | "scheduled" | "interview_ready" | "stopped" | "reviewed" | "sent" | string;
  calendar_availability?: {
    status?: string;
    slots_count?: number;
    last_checked_at?: string;
    slots?: Array<{ start: string; end: string; label: string }>;
  } | null;
  interview_event?: {
    status?: string;
    starts_at?: string;
    ends_at?: string;
    label?: string;
    calendar_event_id?: string;
  } | null;
};

export type InboxQueueView = {
  summary: { total: number; interested: number; needs_human_reply: number; needs_scheduling?: number; confirmed?: number; canceled?: number; due_follow_up?: number };
  items: InboxQueueItem[];
  interested_candidates: Array<InboxQueueItem & {
    readiness: "needs_scheduling" | "interview_ready";
    recommended_next_step: string;
    saved_scheduling_draft?: string;
    scheduling_packet?: {
      candidate_summary: string;
      reply_excerpt: string;
      strongest_evidence?: string[];
      risk_flags?: string[];
      unverified_claims?: string[];
      claim_status_summary: string;
      handoff_title: string;
      hiring_manager_note: string;
      verified_summary: string;
      risk_summary: string;
      candidate_reply: string;
      suggested_scheduling_message: string;
      interview_questions: string[];
    };
  }>;
};

export function classifyInboxReply(input?: { text?: string; candidateName?: string; roleBrief?: string }): {
  classification: InboxClassification;
  classification_reason: string;
  last_message_excerpt: string;
  suggested_reply: string;
};
export function shouldStopFollowUp(classification: string): boolean;
export function mergeInboxThreadsWithDueFollowUps(input?: { inboxThreads?: unknown[]; outreachThreads?: unknown[]; now?: Date }): unknown[];
export function buildInboxQueue(input?: { threads?: unknown[] }): InboxQueueView;
