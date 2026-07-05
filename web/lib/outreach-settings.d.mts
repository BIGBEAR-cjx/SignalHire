export type RoleOutreachSettings = {
  auto_follow_up_only: boolean;
  follow_up_interval_days: 7;
  client_visible_digest: boolean;
  client_delivery_visibility: {
    delivery_loop: boolean;
    smart_report: boolean;
    candidate_details: boolean;
    feedback_form: boolean;
  };
  client_delivery_access: {
    mode: "token_only" | "token_or_customer_account";
    allowed_emails: string[];
    allowed_domains: string[];
    invites: Array<{
      email: string;
      status: "active" | "revoked" | "expired";
      invited_at: string;
      last_sent_at: string;
      expires_at: string;
      revoked_at: string;
    }>;
  };
  agent_status: "active" | "paused";
  approval_mode: "manual_all" | "auto_follow_up_only";
  capacity_goal_configured: boolean;
  capacity_goal: {
    contacted: number;
    replied: number;
    interested: number;
    interview_ready: number;
  };
};

export type OutreachSequenceMessageForSendCheck = {
  step?: number;
  send_mode?: string;
  approved?: boolean;
};

export type OutreachThreadForSendCheck = {
  status?: string;
};

export function buildRoleOutreachSettings(source?: unknown): RoleOutreachSettings;

export function canAutoSendFollowUp(input?: {
  settings?: unknown;
  message?: OutreachSequenceMessageForSendCheck;
  thread?: OutreachThreadForSendCheck;
}): boolean;
