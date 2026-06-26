export type GmailSyncSummary = {
  ok: boolean;
  connected: boolean;
  can_read_inbox: boolean;
  synced: number;
  scanned: number;
  skipped_reason: string;
  last_synced_at: string;
  errors: Array<{ outreach_thread_id: string; error: string }>;
};

export function buildSyncStatusPatch(input?: {
  thread?: Record<string, unknown>;
  classification?: string;
  suggestedReply?: string;
  now?: Date;
}): Record<string, unknown>;

export function syncGmailInboxForProjectCore(input?: {
  userId?: string;
  projectId?: string;
  roleBrief?: string;
  getGmailConnectionStatus: (userId: string) => Promise<Record<string, unknown>>;
  listRoleRelatedOutreachThreads: (input: { userId: string; projectId: string }) => Promise<Array<Record<string, unknown>>>;
  getGmailThreadMessages: (input: { userId: string; threadId: string }) => Promise<Array<Record<string, unknown>>>;
  saveInboxThread: (input: Record<string, unknown>) => Promise<unknown>;
  updateOutreachThread: (input: Record<string, unknown>) => Promise<unknown>;
  maxThreads?: number;
  now?: Date;
}): Promise<GmailSyncSummary>;
