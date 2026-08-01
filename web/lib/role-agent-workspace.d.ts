export type RoleAgentWorkspaceActionType =
  | "run_sourcing"
  | "review_preview_leads"
  | "resolve_contacts"
  | "approve_or_send_outreach"
  | "retry_failed_outreach"
  | "follow_up"
  | "refresh_live_signals"
  | "review_interested_candidates";

export type RoleAgentInboxPipelineStepType =
  | "stop_sequence"
  | "follow_up"
  | "reply_with_details";

export type RoleAgentInboxPipelineAction =
  | "stop"
  | "save_follow_up_draft"
  | "reply"
  | "schedule"
  | string;

export type RoleAgentInboxPipelineItem = {
  id: string;
  candidate_name: string;
  detail: string;
  cta: string;
  status: string;
  updated_at: string;
  action: RoleAgentInboxPipelineAction;
  action_target_id: string;
  can_apply: boolean;
  handoff: null | {
    title: string;
    candidate_reply: string;
    manager_note: string;
  };
  calendar_status: null | {
    status: string;
    slots_count: number;
    last_checked_at: string;
  };
  scheduling_state: {
    status: "needs_scheduling" | "draft_saved" | "slot_held" | "rescheduled" | "interview_ready" | "confirmed" | "canceled" | "needs_recovery" | "waiting_on_candidate" | "waiting_on_manager" | "aligning_times" | "ready_to_confirm" | string;
    label: string;
    event: null | {
      status: string;
      starts_at: string;
      calendar_event_id: string;
    };
  };
  negotiation_state: null | {
    status: string;
    label: string;
    candidate_windows: Array<{ starts_at: string; ends_at: string; label: string }>;
    manager_windows: Array<{ starts_at: string; ends_at: string; label: string }>;
    proposed_slot: null | { starts_at: string; ends_at: string; label: string };
    updated_at: string;
  };
  activity_timeline: Array<{
    type: "interested_reply" | "scheduling_draft_saved" | "time_negotiation" | "slot_held" | "interview_confirmed" | "interview_rescheduled" | "interview_canceled" | string;
    at: string;
    label: string;
    detail: string;
    status: string;
  }>;
  recovery_next_step: string;
  message_history: {
    summary: {
      outbound: number;
      inbound: number;
      system: number;
      total: number;
    };
    messages: Array<{
      id: string;
      direction: "outbound" | "inbound" | "system" | string;
      status: string;
      subject: string;
      body: string;
      at: string;
      source: string;
    }>;
  };
};

export type RoleAgentWorkspaceView = {
  status: "active" | "paused" | "review_required";
  goals_configured: boolean;
  goals: {
    contacted: number;
    replied: number;
    interested: number;
    interview_ready: number;
  };
  counts: {
    candidates: number;
    preview_leads: number;
    contacted: number;
    replied: number;
    interested: number;
    interview_ready: number;
  };
  health: {
    candidate_gap: boolean;
    contact_gap: boolean;
    reply_gap: boolean;
    interview_gap: boolean;
    blocked_actions: string[];
  };
  next_actions: Array<{
    type: RoleAgentWorkspaceActionType;
    label: string;
    reason: string;
    affected_count: number;
    cta: string;
    blocked_reason?: string;
  }>;
  why_now: Array<{
    candidate_id: string;
    candidate_name: string;
    score: number;
    why_now: string;
    signals: string[];
    signal_sources: string[];
    signal_contract: Array<{
      type: "candidate_activity" | "profile_freshness" | "company_hiring" | "tech_stack" | "recent_content" | string;
      source: string;
      label: string;
      confidence: "high" | "medium" | "low" | "unknown";
      freshness: "fresh" | "stale" | "expired" | string;
      at: string;
      expires_at: string;
      source_url: string;
    }>;
    contact_timing: {
      urgency: "now" | "this_week" | "later";
      score: number;
      reason: string;
    };
    next_best_action: RoleAgentWorkspaceActionType;
    updated_at: string;
  }>;
  signal_refresh: {
    status: "idle" | "due" | "blocked" | string;
    provider_status: "not_configured" | "ready" | string;
    due_count: number;
    stale_count: number;
    expired_count: number;
    summary: string;
    targets: Array<{
      candidate_id: string;
      candidate_name: string;
      status: "stale" | "expired" | string;
      stale_count: number;
      expired_count: number;
      last_signal_at: string;
      refresh_reason: string;
      github_login: string;
    }>;
    last_run: null | {
      run_id: string;
      action_type: RoleAgentWorkspaceActionType | string;
      workflow_step: string;
      status: string;
      detail: string;
      targets: Array<{ id: string; candidate_name: string }>;
      result: Record<string, unknown>;
      failed_items: Array<{ id: string; candidate_name: string; error: string }>;
      retryable: boolean;
      guardrail: string;
      started_at: string;
      finished_at: string;
      updated_at: string;
    };
  };
  autopilot_path: {
    status: "idle" | "ready" | "needs_recovery";
    summary: string;
    recoverable_count: number;
    workflow: {
      mode: "manual_all" | "auto_follow_up_only" | string;
      next_step: string;
      blocked_count: number;
      summary: string;
      steps: Array<{
        type: "resolve_contacts" | "approve_drafts" | "send_first_email" | "retry_failures" | "follow_up";
        label: string;
        count: number;
        status: "done" | "ready" | "blocked";
        can_auto_execute: boolean;
        guardrail: string;
        targets: Array<{
          id: string;
          candidate_name: string;
        }>;
      }>;
    };
    stages: Array<{
      type: "resolve_contacts" | "approve_drafts" | "send_first_email" | "retry_failures" | "follow_up";
      label: string;
      count: number;
      cta: string;
      status: "done" | "ready" | "blocked";
      auto_eligible_count?: number;
    }>;
  };
  autopilot_recovery: {
    summary: string;
    counts: {
      contacts_resolved: number;
      drafts_saved: number;
      sent: number;
      failed: number;
    };
    last_run: null | {
      action_type: RoleAgentWorkspaceActionType;
      status: string;
      detail: string;
      at: string;
    };
    runs: Array<{
      run_id: string;
      action_type: RoleAgentWorkspaceActionType | string;
      workflow_step: string;
      status: string;
      detail: string;
      targets: Array<{ id: string; candidate_name: string }>;
      result: Record<string, string | number | boolean>;
      failed_items: Array<{ id: string; candidate_name: string; error: string }>;
      retryable: boolean;
      guardrail: string;
      started_at: string;
      finished_at: string;
      updated_at: string;
    }>;
    execution_log: Array<{
      action_type: RoleAgentWorkspaceActionType | string;
      status: string;
      detail: string;
      targets: Array<{ id: string; candidate_name: string }>;
      result: Record<string, unknown>;
      failed_items: Array<{ id: string; candidate_name: string; error: string }>;
      retryable: boolean;
      at: string;
    }>;
    retryable_items: Array<{
      action_type: RoleAgentWorkspaceActionType | string;
      candidate_name: string;
      error: string;
      at: string;
    }>;
    history: Array<{
      type: "contact_resolved" | "draft_saved" | "first_email_sent" | "send_failed";
      at: string;
      candidate_name: string;
      label: string;
      status: string;
    }>;
  };
  inbox_pipeline: {
    summary: {
      interested: number;
      scheduling: number;
      interview_ready: number;
      confirmed: number;
      canceled: number;
      needs_recovery: number;
      waiting_on_candidate: number;
      waiting_on_manager: number;
      ready_to_confirm: number;
      needs_reply: number;
      due_follow_up: number;
      stop_sequence: number;
    };
    interested_queue: RoleAgentInboxPipelineItem[];
    interview_ready_queue: RoleAgentInboxPipelineItem[];
    next_steps: Array<RoleAgentInboxPipelineItem & { type: RoleAgentInboxPipelineStepType }>;
  };
  delivery_summary: null | {
    title: string;
    brief_summary: string;
    metrics: {
      candidates: number;
      strong_evidence: number;
      ready_for_outreach: number;
      needs_scheduling: number;
    };
    weekly_progress: {
      window_label: string;
      metrics: {
        new_candidates: number;
        contacted: number;
        replied: number;
        interview_ready: number;
        confirmed: number;
      };
    };
    client_delivery_loop: {
      title: string;
      window_label: string;
      metrics: Array<{
        key: "new_candidates" | "contacted" | "replied" | "interview_ready" | "confirmed";
        label: string;
        value: number;
      }>;
      risks: string[];
      next_steps: string[];
    };
    source_mix: Array<{ label: string; count: number }>;
    risks: string[];
    next_actions: string[];
  };
  client_feedback_audit: {
    count: number;
    latest: Array<{
      sentiment: string;
      reviewer: string;
      note: string;
      report_href: string;
      at: string;
    }>;
    history: Array<{
      sentiment: string;
      reviewer: string;
      note: string;
      report_href: string;
      at: string;
    }>;
  };
  client_delivery_audit: {
    summary: string;
    counts: {
      report_views: number;
      feedback: number;
    };
    latest_report_href: string;
    timeline: Array<{
      type: "report_view" | "feedback" | string;
      label: string;
      actor: string;
      report_href: string;
      detail: string;
      at: string;
    }>;
  };
  activity: Array<{
    at: string;
    label: string;
    context: string;
    status: string;
  }>;
};

export function buildRoleAgentWorkspaceView(input?: {
  role?: unknown;
  settings?: unknown;
  leadPreview?: unknown;
  candidateGraph?: unknown;
  outreachQueue?: unknown;
  sequenceAnalytics?: unknown;
  inboxQueue?: unknown;
  smartReport?: unknown;
  roleAgentMetrics?: unknown;
  clientDeliveryAuditEvents?: unknown[];
  searchTasks?: unknown[];
  latestRun?: unknown;
  activityLimit?: number;
  now?: string;
  locale?: "zh" | "en" | string;
}): RoleAgentWorkspaceView;
