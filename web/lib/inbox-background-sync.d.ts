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

export type ProjectInboxSyncSummary = {
  source: string;
  ok: boolean;
  last_attempted_at: string;
  last_synced_at: string;
  scanned: number;
  synced: number;
  skipped_reason: string;
  error_count: number;
  errors: Array<{ error: string }>;
};

export function selectBackgroundInboxSyncProjects(input?: {
  outreachThreads?: Array<Record<string, unknown>>;
  maxProjects?: number;
  maxThreadsPerProject?: number;
}): BackgroundInboxSyncProject[];

export function buildProjectInboxSyncSummary(input?: {
  result?: Record<string, unknown>;
  now?: Date;
  source?: string;
}): ProjectInboxSyncSummary;

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
  projectError?: string;
  recordProjectSyncSummary?: (input: {
    userId: string;
    projectId: string;
    summary: ProjectInboxSyncSummary;
  }) => Promise<unknown>;
  syncProject?: (input: { userId: string; projectId: string; maxThreads: number }) => Promise<Record<string, unknown>>;
}): Promise<BackgroundInboxSyncSummary>;

export function backgroundInboxSync(input?: {
  maxProjects?: number;
  maxThreadsPerProject?: number;
  now?: Date;
  listProjects?: (input: { maxProjects: number; maxThreadsPerProject: number }) => Promise<BackgroundInboxSyncProject[]>;
  recordProjectSyncSummary?: (input: {
    userId: string;
    projectId: string;
    summary: ProjectInboxSyncSummary;
  }) => Promise<unknown>;
  syncProject?: (input: { userId: string; projectId: string; maxThreads: number }) => Promise<Record<string, unknown>>;
}): Promise<BackgroundInboxSyncSummary>;
