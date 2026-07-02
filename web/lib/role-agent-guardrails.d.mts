export type RoleAgentApprovalMode = {
  mode: "manual_all" | "auto_follow_up_only";
  label: string;
  first_email_manual: true;
  auto_follow_up_only: boolean;
  high_confidence_auto_send_blocked: boolean;
};

export type RoleAgentGuardrailReason = {
  code: string;
  label: string;
  count: number;
};

export type RoleAgentGuardrailTask = {
  id: string;
  label: string;
  source: "sequence_analytics" | "evidence_gaps" | "capacity" | "guardrails";
};

export type RoleAgentActivityLogEntry = {
  id: string;
  candidate: string;
  status: string;
  label: string;
  detail: string;
  occurred_at: string;
};

export type RoleAgentGuardrailsView = {
  panel_title: "Role Agent Guardrails";
  role_id: string;
  status: "draft" | "active" | "paused" | "review_required";
  approval_mode: RoleAgentApprovalMode;
  capacity_summary: {
    goal: number | null;
    capacity_goal: {
      contacted: number;
      replied: number;
      interested: number;
      interview_ready: number;
    };
    contacted: number;
    replied: number;
    interested: number;
    interview_ready: number;
    remaining_by_stage: {
      contacted: number;
      replied: number;
      interested: number;
      interview_ready: number;
    };
    remaining_to_goal: number | null;
    pressure: "not_set" | "met" | "on_track" | "needs_pipeline";
  };
  current_counts: {
    contacted: number;
    replied: number;
    interested: number;
    interview_ready: number;
  };
  next_tasks: RoleAgentGuardrailTask[];
  blocked_automation_reasons: RoleAgentGuardrailReason[];
  activity_log: RoleAgentActivityLogEntry[];
  sequence_analytics: unknown;
  controlled_workflow_copy: string;
};

export function buildRoleAgentGuardrailsView(input?: {
  role?: unknown;
  roleId?: string;
  settings?: unknown;
  threads?: unknown[];
  sequenceAnalytics?: unknown;
  capacityGoal?: number | string | {
    contacted?: number | string | null;
    replied?: number | string | null;
    interested?: number | string | null;
    interview_ready?: number | string | null;
  } | null;
  activityLimit?: number;
  now?: Date | string;
  locale?: "zh" | "en" | string;
}): RoleAgentGuardrailsView;
