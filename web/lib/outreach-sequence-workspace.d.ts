export type OutreachSequenceWorkspaceStep = {
  step: number;
  subject: string;
  body_preview: string;
  evidence_refs: string[];
  delay_days?: number;
  send_mode: string;
  state: "ready" | "blocked" | "sent" | "review";
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
