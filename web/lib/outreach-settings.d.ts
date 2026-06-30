export type RoleOutreachSettings = {
  auto_follow_up_only: boolean;
  follow_up_interval_days: 7;
  client_visible_digest: boolean;
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
