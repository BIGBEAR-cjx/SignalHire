export type BackgroundInboxSyncProject = {
  userId: string;
  projectId: string;
  threadCount: number;
};

export type BackgroundInboxSyncSummary = {
  ok: boolean;
  ran_at: string;
  projects_scanned: number;
  threads_scanned: number;
  replies_synced: number;
  skipped: Array<{ user_id: string; project_id: string; reason: string }>;
  errors: Array<{ user_id: string; project_id: string; error: string }>;
};

export function selectBackgroundInboxSyncProjects(input?: {
  outreachThreads?: Array<Record<string, unknown>>;
  maxProjects?: number;
  maxThreadsPerProject?: number;
}): BackgroundInboxSyncProject[];

export function listBackgroundInboxSyncProjects(input?: {
  maxProjects?: number;
  maxThreadsPerProject?: number;
  queryLimit?: number;
}): Promise<BackgroundInboxSyncProject[]>;

export function runBackgroundInboxSync(input?: {
  projects?: BackgroundInboxSyncProject[];
  maxProjects?: number;
  maxThreadsPerProject?: number;
  now?: Date;
  syncProject?: (input: { userId: string; projectId: string; maxThreads: number }) => Promise<Record<string, unknown>>;
}): Promise<BackgroundInboxSyncSummary>;

export function backgroundInboxSync(input?: {
  maxProjects?: number;
  maxThreadsPerProject?: number;
  now?: Date;
  listProjects?: (input: { maxProjects: number; maxThreadsPerProject: number }) => Promise<BackgroundInboxSyncProject[]>;
  syncProject?: (input: { userId: string; projectId: string; maxThreads: number }) => Promise<Record<string, unknown>>;
}): Promise<BackgroundInboxSyncSummary>;
