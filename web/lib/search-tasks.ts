import { createClient } from "@insforge/sdk";
import { findCachedCandidateProfilesForSearch } from "./db";
import { insforgeAdmin } from "./insforge-admin.mjs";
import {
  buildNextRunAt,
  nextRunAfterPatch,
  normalizeSearchTaskInput,
} from "./search-tasks.mjs";
import { startMonitorRun as startMonitorRunCore } from "./talent-monitor-run.mjs";
import { buildMonitorView, sanitizeMonitorErrorSummary } from "./talent-monitor-view.mjs";

export { buildMonitorView };

const BASE = process.env.INSFORGE_API_BASE_URL;
const KEY = process.env.INSFORGE_API_KEY;
const client = BASE && KEY ? createClient({ baseUrl: BASE, anonKey: KEY, isServerMode: true }) : null;
const monitorClient = insforgeAdmin;
const TABLE = "search_tasks";

export type SearchTaskFrequency = "manual" | "daily" | "weekly";
export type SearchTaskStatus = "active" | "paused";

export interface SearchTask {
  id: string;
  user_id: string;
  project_id: string | null;
  name: string;
  brief: string;
  frequency: SearchTaskFrequency;
  status: SearchTaskStatus;
  candidate_batch_size: 5 | 10 | 20;
  timezone: string;
  schedule_time: string;
  monthly_credit_limit: number;
  monthly_credit_used: number;
  monthly_credit_reserved: number;
  notification_enabled: boolean;
  pause_reason: string | null;
  last_run_status: string | null;
  last_run_at: string | null;
  next_run_at: string | null;
  created_at: string;
  updated_at: string;
  run_summary?: {
    last_status: string;
    last_run_at: string | null;
    new_candidates: number;
    updated_candidates: number;
    discovery_items?: Array<{
      candidate_index: number;
      cache_key?: string;
      name: string;
      discovery_state: string;
      evidence_updated: boolean;
    }>;
  };
  runs?: MonitorRun[];
}

export type MonitorRun = {
  id: string;
  status: string;
  research_run_id: string | null;
  started_at: string | null;
  finished_at: string | null;
  requested_count: number;
  returned_count: number;
  new_candidates: number;
  updated_candidates: number;
  seen_candidates: number;
  skipped_candidates: number;
  credits_reserved: number;
  credits_consumed: number;
  credits_released: number;
  stop_reason: string | null;
  error_summary: string | null;
  config_snapshot: Record<string, unknown>;
};

type MonitorStartRun = Pick<MonitorRun, "id" | "status" | "research_run_id">;

export type MonitorStartResult = {
  status: "queued" | "paused" | "blocked";
  reason?: string;
  duplicate?: boolean;
  run?: MonitorStartRun;
  jobId?: string;
  linked?: boolean;
  enqueued: boolean;
};

export async function ensureSearchTaskProjectAccess(userId: string, projectId?: string | null): Promise<boolean> {
  if (!projectId) return true;
  if (!client) return false;
  try {
    const { data, error } = await client.database
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .eq("user_id", userId)
      .limit(1);
    return !error && Boolean(data && data.length > 0);
  } catch {
    return false;
  }
}

async function runSQL<T = Record<string, unknown>>(query: string, params: unknown[] = []): Promise<T[] | null> {
  if (!BASE || !KEY) return null;
  try {
    const r = await fetch(`${BASE}/api/database/advance/rawsql`, {
      method: "POST",
      headers: { "x-api-key": KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ query, params }),
    });
    if (!r.ok) return null;
    const j = await r.json();
    return (j.rows ?? []) as T[];
  } catch {
    return null;
  }
}

function mapTask(row: Record<string, unknown>): SearchTask {
  return {
    id: String(row.id ?? ""),
    user_id: String(row.user_id ?? ""),
    project_id: row.project_id ? String(row.project_id) : null,
    name: String(row.name ?? ""),
    brief: String(row.brief ?? ""),
    frequency: (row.frequency === "daily" || row.frequency === "weekly" ? row.frequency : "manual") as SearchTaskFrequency,
    status: (row.status === "paused" ? "paused" : "active") as SearchTaskStatus,
    candidate_batch_size: row.candidate_batch_size === 5 || row.candidate_batch_size === 20 ? row.candidate_batch_size : 10,
    timezone: typeof row.timezone === "string" && row.timezone ? row.timezone : "UTC",
    schedule_time: typeof row.schedule_time === "string" && row.schedule_time ? row.schedule_time.slice(0, 5) : "09:00",
    monthly_credit_limit: Math.max(0, Number(row.monthly_credit_limit ?? 20) || 0),
    monthly_credit_used: Math.max(0, Number(row.monthly_credit_used ?? 0) || 0),
    monthly_credit_reserved: Math.max(0, Number(row.monthly_credit_reserved ?? 0) || 0),
    notification_enabled: row.notification_enabled === true,
    pause_reason: typeof row.pause_reason === "string" && row.pause_reason ? row.pause_reason : null,
    last_run_status: typeof row.last_run_status === "string" && row.last_run_status ? row.last_run_status : null,
    last_run_at: row.last_run_at ? String(row.last_run_at) : null,
    next_run_at: row.next_run_at ? String(row.next_run_at) : null,
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

function nonNegativeInteger(value: unknown): number {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : 0;
}

function mapMonitorRun(row: Record<string, unknown>): MonitorRun {
  const snapshot = row.config_snapshot && typeof row.config_snapshot === "object" && !Array.isArray(row.config_snapshot)
    ? row.config_snapshot as Record<string, unknown>
    : {};
  return {
    id: String(row.id ?? ""),
    status: typeof row.status === "string" ? row.status : "unknown",
    research_run_id: typeof row.research_run_id === "string" ? row.research_run_id : null,
    started_at: row.started_at ? String(row.started_at) : null,
    finished_at: row.finished_at ? String(row.finished_at) : null,
    requested_count: nonNegativeInteger(row.requested_count),
    returned_count: nonNegativeInteger(row.returned_count),
    new_candidates: nonNegativeInteger(row.new_candidates),
    updated_candidates: nonNegativeInteger(row.updated_candidates),
    seen_candidates: nonNegativeInteger(row.seen_candidates),
    skipped_candidates: nonNegativeInteger(row.skipped_candidates),
    credits_reserved: nonNegativeInteger(row.credits_reserved),
    credits_consumed: nonNegativeInteger(row.credits_consumed),
    credits_released: nonNegativeInteger(row.credits_released),
    stop_reason: typeof row.stop_reason === "string" && row.stop_reason ? row.stop_reason : null,
    error_summary: sanitizeMonitorErrorSummary(row.error_summary),
    config_snapshot: snapshot,
  };
}

async function listMonitorRuns(userId: string, taskIds: string[]): Promise<Map<string, MonitorRun[]>> {
  const result = new Map<string, MonitorRun[]>();
  if (taskIds.length === 0) return result;
  const rows = await runSQL<Record<string, unknown>>(
    `SELECT * FROM (
       SELECT r.id, r.search_task_id, r.research_run_id, r.status, r.started_at, r.finished_at,
         r.requested_count, r.returned_count, r.new_candidates, r.updated_candidates,
         r.seen_candidates, r.skipped_candidates, r.credits_reserved, r.credits_consumed,
         r.credits_released, r.stop_reason, r.error_summary, r.config_snapshot,
         row_number() OVER (PARTITION BY r.search_task_id ORDER BY r.updated_at DESC) AS history_rank
       FROM public.search_task_runs r
       WHERE r.user_id = $1 AND r.search_task_id = ANY($2::uuid[])
     ) history
     WHERE history_rank <= 10
     ORDER BY search_task_id, history_rank`,
    [userId, taskIds],
  );
  for (const row of rows ?? []) {
    const taskId = typeof row.search_task_id === "string" ? row.search_task_id : "";
    if (!taskId) continue;
    const runs = result.get(taskId) ?? [];
    runs.push(mapMonitorRun(row));
    result.set(taskId, runs);
  }
  return result;
}

function discoveryItemsFromResult(value: unknown): NonNullable<SearchTask["run_summary"]>["discovery_items"] {
  if (!value || typeof value !== "object") return [];
  const taskDiscovery = (value as { task_discovery?: unknown }).task_discovery;
  if (!taskDiscovery || typeof taskDiscovery !== "object") return [];
  const items = (taskDiscovery as { items?: unknown }).items;
  if (!Array.isArray(items)) return [];
  return items.slice(0, 6).map((item, index) => {
    const row = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    return {
      candidate_index: Number(row.candidate_index ?? index),
      cache_key: typeof row.cache_key === "string" ? row.cache_key : undefined,
      name: typeof row.name === "string" ? row.name : "Unknown candidate",
      discovery_state: typeof row.discovery_state === "string" ? row.discovery_state : "new_candidate",
      evidence_updated: Boolean(row.evidence_updated),
    };
  });
}

export async function listSearchTasks(input: { userId: string; projectId?: string | null }): Promise<SearchTask[]> {
  const rows = await runSQL<Record<string, unknown>>(
    `SELECT
       t.*,
       lr.status AS last_status,
       lr.updated_at AS last_run_updated_at,
       lr.result AS last_result,
       COALESCE(rs.new_candidates, 0) AS new_candidates,
       COALESCE(rs.updated_candidates, 0) AS updated_candidates
     FROM search_tasks t
     LEFT JOIN LATERAL (
       SELECT status, updated_at, result FROM research_runs r
       WHERE r.search_task_id = t.id AND r.user_id = $1
       ORDER BY r.updated_at DESC LIMIT 1
     ) lr ON true
     LEFT JOIN (
       SELECT search_task_id,
         SUM(COALESCE((result->'task_discovery'->'summary'->>'new_candidates')::int, 0)) AS new_candidates,
         SUM(COALESCE((result->'task_discovery'->'summary'->>'updated_candidates')::int, 0)) AS updated_candidates
       FROM research_runs
       WHERE user_id = $1 AND search_task_id IS NOT NULL AND status = 'done'
       GROUP BY search_task_id
     ) rs ON rs.search_task_id = t.id
     WHERE t.user_id = $1
       AND ($2::uuid IS NULL OR t.project_id = $2::uuid)
     ORDER BY t.updated_at DESC`,
    [input.userId, input.projectId ?? null],
  );
  if (!rows) return [];
  const tasks = rows.map((row) => ({
    ...mapTask(row),
    run_summary: {
      last_status: String(row.last_status ?? "idle"),
      last_run_at: row.last_run_updated_at ? String(row.last_run_updated_at) : null,
      new_candidates: Number(row.new_candidates ?? 0),
      updated_candidates: Number(row.updated_candidates ?? 0),
      discovery_items: discoveryItemsFromResult(row.last_result),
    },
  }));
  const runsByTask = await listMonitorRuns(input.userId, tasks.map((task) => task.id));
  return tasks.map((task) => ({ ...task, runs: runsByTask.get(task.id) ?? [] }));
}

export async function getSearchTask(userId: string, id: string): Promise<SearchTask | null> {
  if (!client) return null;
  try {
    const { data, error } = await client.database
      .from(TABLE)
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .limit(1);
    if (error || !data || data.length === 0) return null;
    const task = mapTask(data[0] as Record<string, unknown>);
    const runs = await listMonitorRuns(userId, [task.id]);
    return { ...task, runs: runs.get(task.id) ?? [] };
  } catch {
    return null;
  }
}

export async function createSearchTask(input: {
  userId: string;
  projectId?: string | null;
  name?: string;
  brief: string;
  frequency?: string;
  status?: string;
  candidate_batch_size?: number;
  timezone?: string;
  schedule_time?: string;
  monthly_credit_limit?: number;
  notification_enabled?: boolean;
  pause_reason?: string | null;
}): Promise<SearchTask | null> {
  if (!client) return null;
  if (!(await ensureSearchTaskProjectAccess(input.userId, input.projectId))) return null;
  const normalized = normalizeSearchTaskInput(input);
  if (!normalized.brief) return null;
  const now = new Date();
  try {
    const { data, error } = await client.database
      .from(TABLE)
      .insert({
        user_id: input.userId,
        project_id: input.projectId ?? null,
        name: normalized.name,
        brief: normalized.brief,
        frequency: normalized.frequency,
        status: normalized.status,
        candidate_batch_size: normalized.candidate_batch_size,
        timezone: normalized.timezone,
        schedule_time: normalized.schedule_time,
        monthly_credit_limit: normalized.monthly_credit_limit,
        notification_enabled: normalized.notification_enabled,
        pause_reason: normalized.pause_reason,
        next_run_at: normalized.status === "active" ? buildNextRunAt({
          frequency: normalized.frequency,
          timezone: normalized.timezone,
          scheduleTime: normalized.schedule_time,
          now,
        }) : null,
      })
      .select("*");
    if (error || !data || data.length === 0) return null;
    return mapTask(data[0] as Record<string, unknown>);
  } catch {
    return null;
  }
}

export async function updateSearchTask(input: {
  userId: string;
  id: string;
  name?: string;
  brief?: string;
  frequency?: string;
  status?: string;
  candidate_batch_size?: number;
  timezone?: string;
  schedule_time?: string;
  monthly_credit_limit?: number;
  notification_enabled?: boolean;
  pause_reason?: string | null;
}): Promise<SearchTask | null> {
  if (!client) return null;
  const existing = await getSearchTask(input.userId, input.id);
  if (!existing) return null;
  const normalized = normalizeSearchTaskInput({
    name: input.name ?? existing.name,
    brief: input.brief ?? existing.brief,
    frequency: input.frequency ?? existing.frequency,
    status: input.status ?? existing.status,
    candidate_batch_size: input.candidate_batch_size ?? existing.candidate_batch_size,
    timezone: input.timezone ?? existing.timezone,
    schedule_time: input.schedule_time ?? existing.schedule_time,
    monthly_credit_limit: input.monthly_credit_limit ?? existing.monthly_credit_limit,
    notification_enabled: input.notification_enabled ?? existing.notification_enabled,
    pause_reason: Object.hasOwn(input, "pause_reason") ? input.pause_reason : existing.pause_reason,
  });
  const now = new Date();
  const patch = {
    name: normalized.name,
    brief: normalized.brief,
    frequency: normalized.frequency,
    status: normalized.status,
    candidate_batch_size: normalized.candidate_batch_size,
    timezone: normalized.timezone,
    schedule_time: normalized.schedule_time,
    monthly_credit_limit: normalized.monthly_credit_limit,
    notification_enabled: normalized.notification_enabled,
    pause_reason: normalized.pause_reason,
    next_run_at: nextRunAfterPatch(existing, normalized, now),
    updated_at: now.toISOString(),
  };
  try {
    const { data, error } = await client.database
      .from(TABLE)
      .update(patch)
      .eq("id", input.id)
      .eq("user_id", input.userId)
      .select("*");
    if (error || !data || data.length === 0) return null;
    return mapTask(data[0] as Record<string, unknown>);
  } catch {
    return null;
  }
}

function firstRow(value: unknown): Record<string, unknown> | null {
  const row = Array.isArray(value) ? value[0] : value;
  return row && typeof row === "object" && !Array.isArray(row) ? row as Record<string, unknown> : null;
}

function monitorRunFromRow(row: Record<string, unknown> | null): MonitorStartRun | null {
  if (!row || typeof row.monitor_run_id !== "string" || !row.monitor_run_id) return null;
  return {
    id: row.monitor_run_id,
    status: typeof row.run_status === "string" ? row.run_status : "pending",
    research_run_id: typeof row.research_run_id === "string" ? row.research_run_id : null,
  };
}

async function monitorRpc(name: string, args: Record<string, unknown>): Promise<unknown> {
  if (!monitorClient) throw new Error("Talent Monitor admin client is not configured");
  const { data, error } = await monitorClient.database.rpc(name, args);
  if (error) throw new Error("Talent Monitor admin RPC rejected the request");
  return data;
}

export async function startMonitorRun(input: { userId: string; id: string }): Promise<MonitorStartResult> {
  const task = await getSearchTask(input.userId, input.id);
  if (!task) return { status: "blocked", reason: "monitor_not_found", enqueued: false };
  return (await startMonitorRunCore(task, {
    projectIsActive: async (monitor: SearchTask) => ensureSearchTaskProjectAccess(monitor.user_id, monitor.project_id),
    createRunId: () => crypto.randomUUID(),
    createResearchRunId: () => crypto.randomUUID(),
    buildResearchPayload: async (monitor: SearchTask) => ({
      candidateHints: await findCachedCandidateProfilesForSearch({ userId: monitor.user_id, query: monitor.brief, limit: 8 }),
    }),
    startAtomic: async ({ task: monitor, monitorRunId, researchRunId, payload }: {
      task: SearchTask;
      monitorRunId: string;
      researchRunId: string;
      payload: { candidateHints: unknown[] };
    }) => {
      const row = firstRow(await monitorRpc("start_monitor_run", {
        p_user_id: monitor.user_id,
        p_search_task_id: monitor.id,
        p_monitor_run_id: monitorRunId,
        p_research_run_id: researchRunId,
        p_candidate_hints: payload.candidateHints,
        p_platform_language: "Chinese (Simplified)",
      }));
      const run = monitorRunFromRow(row);
      return {
        state: typeof row?.run_status === "string" ? row.run_status : "blocked",
        duplicate: row?.is_duplicate === true,
        reason: typeof row?.pause_reason === "string" ? row.pause_reason : undefined,
        run,
        researchRunId: run?.research_run_id ?? null,
      };
    },
    activateAtomic: async ({ task: monitor, monitorRunId, researchRunId, nextRunAt }: {
      task: SearchTask;
      monitorRunId: string;
      researchRunId: string;
      nextRunAt: string | null;
    }) => {
      const result = await monitorRpc("activate_monitor_run", {
        p_user_id: monitor.user_id,
        p_monitor_run_id: monitorRunId,
        p_research_run_id: researchRunId,
        p_next_run_at: nextRunAt,
      });
      const row = firstRow(result);
      const state = typeof result === "string" ? result : row?.activate_monitor_run;
      return { state: typeof state === "string" ? state : "blocked" };
    },
  })) as MonitorStartResult;
}

async function reconcileStalledMonitorRuns() {
  const result = await monitorRpc("reconcile_stalled_monitor_runs", {
    p_before: new Date(Date.now() - 15 * 60_000).toISOString(),
  });
  const row = firstRow(result);
  const count = typeof result === "number" ? result : row?.reconcile_stalled_monitor_runs;
  return Number.isInteger(count) && Number(count) >= 0 ? Number(count) : 0;
}

export async function runSearchTaskNow(input: { userId: string; id: string }): Promise<{ jobId: string | null; task: SearchTask; duplicate?: boolean } | null> {
  const task = await getSearchTask(input.userId, input.id);
  if (!task) return null;
  const started = await startMonitorRun(input);
  if (started.status !== "queued") return null;
  if (!started.jobId && !started.duplicate) return null;
  return { jobId: started.jobId ?? started.run?.research_run_id ?? null, task, duplicate: started.duplicate };
}

export async function enqueueDueSearchTasks(limit = 10): Promise<{ queued: number; job_ids: string[]; reconciled: number }> {
  const reconciled = await reconcileStalledMonitorRuns();
  const due = await runSQL<{ id: string; user_id: string }>(
    `SELECT t.id, t.user_id
     FROM search_tasks t
     WHERE t.status = 'active'
       AND t.frequency IN ('daily','weekly')
       AND t.next_run_at IS NOT NULL
       AND t.next_run_at <= now()
       AND NOT EXISTS (
         SELECT 1 FROM research_runs r
         WHERE r.search_task_id = t.id AND r.status IN ('queued','running','retrying')
       )
     ORDER BY t.next_run_at ASC
     LIMIT $1`,
    [limit],
  );
  const jobIds: string[] = [];
  for (const row of due ?? []) {
    const queued = await startMonitorRun({ userId: row.user_id, id: row.id });
    if (queued.jobId) jobIds.push(queued.jobId);
  }
  return { queued: jobIds.length, job_ids: jobIds, reconciled };
}
