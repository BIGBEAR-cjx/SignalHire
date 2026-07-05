export type ClientPortalMetricSummary = {
  candidates: number;
  contacted: number;
  replied: number;
  interested: number;
  interview_ready: number;
  confirmed: number;
};

export type ClientPortalAccessGrant = {
  viewer_email: string;
  reason: string;
  method: string;
  matched: string;
};

export type ClientPortalWorkspaceView = {
  locale: "zh" | "en";
  viewer: { email: string };
  summary: {
    authorized_projects: number;
    interview_ready: number;
    this_week_replies: number;
    latest_activity: string;
  };
  latest_activity: string;
  recent_weekly_archives: unknown[];
  interview_ready_queue: unknown[];
  projects: Array<{
    id: string;
    name: string;
    brief: string;
    status: string;
    updated_at: string;
    candidates_total: number;
    access_reason: string;
    access: ClientPortalAccessGrant | null;
    metrics: ClientPortalMetricSummary;
    latest_activity: string;
    risks: string[];
    next_actions: string[];
    interview_ready_queue: unknown[];
    latest_weekly_archive: unknown | null;
  }>;
};

export type ClientPortalProjectView = {
  locale: "zh" | "en";
  authorized: boolean;
  access_reason: string;
  access: ClientPortalAccessGrant;
  tabs: string[];
  project: {
    id: string;
    name: string;
    brief: string;
    status: string;
    updated_at: string;
    candidates_total: number;
    access_reason: string;
    access: ClientPortalAccessGrant | null;
  };
  summary: ClientPortalMetricSummary & { latest_activity: string };
  overview: {
    risks: string[];
    next_actions: string[];
    latest_weekly_archive: unknown | null;
    latest_report: unknown | null;
  };
  interview_ready_queue: unknown[];
  weekly_archives: unknown[];
  reports: Array<{ id: string; label: string; summary: string; status: string; updated_at: string; href: string }>;
  feedback_history: unknown[];
};

export function filterClientPortalAuthorizedProjects(projects?: unknown[], viewer?: unknown): Array<Record<string, unknown>>;
export function verifyClientPortalProjectAccess(project?: unknown, viewer?: unknown): { allowed: boolean; reason: string; policy?: unknown };
export function buildClientPortalWorkspaceView(input?: Record<string, unknown>): ClientPortalWorkspaceView;
export function buildClientPortalProjectView(input?: Record<string, unknown>): ClientPortalProjectView;
