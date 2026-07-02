export type OutreachSequenceAuditEvent = {
  action: "saved" | "reviewed" | "skipped";
  at: string;
  summary: string;
};

export type OutreachSequenceMessage = {
  step: 1 | 2 | 3;
  subject: string;
  body: string;
  send_mode: "manual_approval_required" | "draft_for_review";
  evidence_refs?: string[];
  evidence_hooks?: string[];
  delay_days?: number;
  approved?: boolean;
  skipped?: boolean;
  reviewed_at?: string;
  audit_events?: OutreachSequenceAuditEvent[];
};

export type OutreachSequenceWorkspaceStep = {
  step: number;
  subject: string;
  body_preview: string;
  evidence_refs: string[];
  delay_days?: number;
  send_mode: string;
  approved: boolean;
  reviewed: boolean;
  skipped: boolean;
  audit_events: OutreachSequenceAuditEvent[];
  state: "ready" | "blocked" | "sent" | "review" | "skipped";
  auto_sendable: boolean;
};

export type OutreachSequenceWorkspaceItem = {
  id: string;
  candidate_name: string;
  status: string;
  queue_state: string;
  current_step: number;
  next_action: "approve draft" | "send first email" | "review follow-up" | "resolve contact" | "stop sequence";
  block_reasons: string[];
  sendable_contact: boolean;
  evidence_refs: string[];
  evidence_ref_count: number;
  steps: OutreachSequenceWorkspaceStep[];
};

export type OutreachSequenceWorkspace = {
  settings: {
    auto_follow_up_only: boolean;
    follow_up_interval_days: 7;
    client_visible_digest: boolean;
    agent_status: "active" | "paused";
    approval_mode: "manual_all" | "auto_follow_up_only";
    capacity_goal: {
      contacted: number;
      replied: number;
      interested: number;
      interview_ready: number;
    };
  };
  summary: {
    total: number;
    ready: number;
    review: number;
    blocked: number;
  };
  queue_summary: Record<string, unknown>;
  role_context: {
    digest: unknown;
    sequence_analytics: unknown;
  };
  items: OutreachSequenceWorkspaceItem[];
};

export function buildOutreachSequenceWorkspaceItem(input?: {
  item?: Record<string, unknown>;
  settings?: unknown;
}): OutreachSequenceWorkspaceItem;

export function buildOutreachSequenceWorkspace(input?: {
  queue?: { summary?: Record<string, unknown>; items?: unknown[] };
  settings?: unknown;
  digest?: unknown;
  sequenceAnalytics?: unknown;
}): OutreachSequenceWorkspace;

export function normalizeOutreachSequenceMessages(value?: unknown): OutreachSequenceMessage[];

export function patchOutreachSequenceStep(sequenceMessages?: unknown, patch?: {
  step?: number;
  subject?: unknown;
  body?: unknown;
  reviewed?: boolean;
  skipped?: boolean;
  audit_summary?: unknown;
  now?: Date | string;
}): OutreachSequenceMessage[];
