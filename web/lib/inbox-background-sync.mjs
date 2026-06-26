import { createClient } from "@insforge/sdk";

const BASE = process.env.INSFORGE_API_BASE_URL;
const KEY = process.env.INSFORGE_API_KEY;
const client = BASE && KEY ? createClient({ baseUrl: BASE, anonKey: KEY, isServerMode: true }) : null;

const ACTIVE_STATUSES = new Set([
  "sent",
  "replied",
  "needs_reply",
  "follow_up_later",
  "follow_up_scheduled",
  "follow_up_due",
]);
const STOPPED_STATUSES = new Set(["stopped", "bounced", "rejected", "hired"]);

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isActiveGmailOutreachThread(thread) {
  const userId = cleanString(thread?.user_id);
  const projectId = cleanString(thread?.project_id);
  const gmailThreadId = cleanString(thread?.gmail_thread_id);
  const status = cleanString(thread?.status);
  return Boolean(
    userId &&
    projectId &&
    gmailThreadId &&
    ACTIVE_STATUSES.has(status) &&
    !STOPPED_STATUSES.has(status),
  );
}

export function selectBackgroundInboxSyncProjects({
  outreachThreads = [],
  maxProjects = 10,
  maxThreadsPerProject = 20,
} = {}) {
  const grouped = new Map();
  for (const thread of outreachThreads) {
    if (!isActiveGmailOutreachThread(thread)) continue;
    const userId = cleanString(thread.user_id);
    const projectId = cleanString(thread.project_id);
    const key = `${userId}:${projectId}`;
    const current = grouped.get(key) ?? { userId, projectId, threadCount: 0 };
    if (current.threadCount < maxThreadsPerProject) current.threadCount += 1;
    grouped.set(key, current);
  }
  return [...grouped.values()].slice(0, maxProjects);
}

export async function listBackgroundInboxSyncProjects({
  maxProjects = 10,
  maxThreadsPerProject = 20,
  queryLimit = maxProjects * maxThreadsPerProject * 3,
} = {}) {
  if (!client) throw new Error("inbox_sync_db_not_configured");
  try {
    const { data, error } = await client.database
      .from("outreach_threads")
      .select("id,user_id,project_id,gmail_thread_id,status,updated_at")
      .in("status", [...ACTIVE_STATUSES])
      .not("gmail_thread_id", "is", null)
      .order("updated_at", { ascending: false })
      .limit(queryLimit);
    if (error || !data) throw new Error("inbox_sync_project_query_failed");
    return selectBackgroundInboxSyncProjects({ outreachThreads: data, maxProjects, maxThreadsPerProject });
  } catch {
    throw new Error("inbox_sync_project_query_failed");
  }
}

export async function runBackgroundInboxSync({
  projects = [],
  maxProjects = 10,
  maxThreadsPerProject = 20,
  now = new Date(),
  projectError = "",
  recordProjectSyncSummary = async () => {},
  syncProject = async () => {
    throw new Error("sync_project_dependency_missing");
  },
} = {}) {
  const ranAt = now.toISOString();
  const summary = {
    ok: true,
    ran_at: ranAt,
    projects_scanned: 0,
    threads_scanned: 0,
    replies_synced: 0,
    skipped: [],
    errors: [],
  };
  if (projectError) {
    summary.ok = false;
    summary.errors.push({ user_id: "", project_id: "", error: cleanString(projectError) });
    return summary;
  }
  for (const project of projects.slice(0, maxProjects)) {
    summary.projects_scanned += 1;
    try {
      const result = await syncProject({
        userId: project.userId,
        projectId: project.projectId,
        maxThreads: maxThreadsPerProject,
      });
      try {
        await recordProjectSyncSummary({
          userId: project.userId,
          projectId: project.projectId,
          summary: buildProjectInboxSyncSummary({ result, now, source: "background" }),
        });
      } catch (error) {
        summary.ok = false;
        summary.errors.push({
          user_id: project.userId,
          project_id: project.projectId,
          error: error instanceof Error ? error.message : "inbox_sync_summary_write_failed",
        });
      }
      summary.threads_scanned += Number(result?.scanned ?? 0) || 0;
      summary.replies_synced += Number(result?.synced ?? 0) || 0;
      if (result?.skipped_reason) {
        summary.skipped.push({
          user_id: project.userId,
          project_id: project.projectId,
          reason: cleanString(result.skipped_reason),
        });
      }
      if (Array.isArray(result?.errors) && result.errors.length > 0) {
        summary.ok = false;
        for (const error of result.errors) {
          summary.errors.push({
            user_id: project.userId,
            project_id: project.projectId,
            error: cleanString(error?.error) || "sync_failed",
          });
        }
      }
    } catch (error) {
      try {
        await recordProjectSyncSummary({
          userId: project.userId,
          projectId: project.projectId,
          summary: buildProjectInboxSyncSummary({
            now,
            source: "background",
            result: {
              ok: false,
              scanned: 0,
              synced: 0,
              skipped_reason: "",
              errors: [{ error: error instanceof Error ? error.message : "sync_failed" }],
            },
          }),
        });
      } catch {}
      summary.ok = false;
      summary.errors.push({
        user_id: project.userId,
        project_id: project.projectId,
        error: error instanceof Error ? error.message : "sync_failed",
      });
    }
  }
  return summary;
}

export function buildProjectInboxSyncSummary({ result = {}, now = new Date(), source = "background" } = {}) {
  const errors = Array.isArray(result?.errors)
    ? result.errors.map((error) => ({ error: cleanString(error?.error) || "sync_failed" })).filter((error) => error.error)
    : [];
  const skippedReason = cleanString(result?.skipped_reason || result?.skipped);
  return {
    source,
    ok: errors.length === 0,
    last_attempted_at: now.toISOString(),
    last_synced_at: cleanString(result?.last_synced_at) || now.toISOString(),
    scanned: Number(result?.scanned ?? 0) || 0,
    synced: Number(result?.synced ?? 0) || 0,
    skipped_reason: skippedReason,
    error_count: errors.length,
    errors,
  };
}

export async function backgroundInboxSync({
  maxProjects = 10,
  maxThreadsPerProject = 20,
  now = new Date(),
  listProjects = listBackgroundInboxSyncProjects,
  syncProject,
  recordProjectSyncSummary,
} = {}) {
  let projects = [];
  let projectError = "";
  try {
    projects = await listProjects({ maxProjects, maxThreadsPerProject });
  } catch (error) {
    projectError = error instanceof Error ? error.message : "inbox_sync_project_query_failed";
  }
  return runBackgroundInboxSync({
    projects,
    projectError,
    maxProjects,
    maxThreadsPerProject,
    now,
    syncProject,
    recordProjectSyncSummary,
  });
}
