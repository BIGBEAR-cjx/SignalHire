import { createClient } from "@insforge/sdk";
import { enqueue, findCachedCandidateProfilesForSearch } from "./db";
import { credits } from "./credits";
import {
  buildNextRunAt,
  buildSearchTaskRunLabel,
  nextRunAfterPatch,
  normalizeSearchTaskInput,
} from "./search-tasks.mjs";
import { startMonitorRun as startMonitorRunCore } from "./talent-monitor-run.mjs";

const BASE = process.env.INSFORGE_API_BASE_URL;
const KEY = process.env.INSFORGE_API_KEY;
const CREDITS_SERVICE_ROLE_KEY = process.env.INSFORGE_CREDITS_SERVICE_ROLE_KEY;
const client = BASE && KEY ? createClient({ baseUrl: BASE, anonKey: KEY, isServerMode: true }) : null;
const monitorClient = BASE && CREDITS_SERVICE_ROLE_KEY
  ? createClient({ baseUrl: BASE, anonKey: CREDITS_SERVICE_ROLE_KEY, isServerMode: true })
  : null;
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
}

type MonitorRun = {
  id: string;
  status: string;
  researchRunId?: string | null;
};

export type MonitorStartResult = {
  status: "queued" | "paused" | "blocked";
  reason?: string;
  duplicate?: boolean;
  run?: MonitorRun;
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
  return rows.map((row) => ({
    ...mapTask(row),
    run_summary: {
      last_status: String(row.last_status ?? "idle"),
      last_run_at: row.last_run_updated_at ? String(row.last_run_updated_at) : null,
      new_candidates: Number(row.new_candidates ?? 0),
      updated_candidates: Number(row.updated_candidates ?? 0),
      discovery_items: discoveryItemsFromResult(row.last_result),
    },
  }));
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
    return mapTask(data[0] as Record<string, unknown>);
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

function monitorRunFromRow(row: Record<string, unknown> | null): MonitorRun | null {
  if (!row || typeof row.run_id !== "string" || !row.run_id) return null;
  return { id: row.run_id, status: typeof row.run_status === "string" ? row.run_status : "queued" };
}

async function monitorRpc(name: string, args: Record<string, unknown>): Promise<unknown> {
  if (!monitorClient) throw new Error("Talent Monitor service role is not configured");
  const { data, error } = await monitorClient.database.rpc(name, args);
  if (error) throw new Error("Talent Monitor service RPC rejected the request");
  return data;
}

async function findActiveMonitorRun(task: SearchTask): Promise<MonitorRun | null> {
  if (!monitorClient) return null;
  const { data, error } = await monitorClient.database
    .from("search_task_runs")
    .select("id,status,user_id,research_run_id")
    .eq("search_task_id", task.id)
    .eq("user_id", task.user_id)
    .in("status", ["queued", "running"])
    .order("created_at", { ascending: true })
    .limit(1);
  if (error || !data || data.length === 0) return null;
  const row = data[0] as Record<string, unknown>;
  if (row.user_id !== task.user_id || typeof row.id !== "string") return null;
  return {
    id: row.id,
    status: typeof row.status === "string" ? row.status : "queued",
    researchRunId: typeof row.research_run_id === "string" ? row.research_run_id : null,
  };
}

async function setMonitorPause(task: SearchTask, reason: string) {
  if (!client) throw new Error("Talent Monitor storage is not configured");
  const { error } = await client.database.from(TABLE).update({
    status: "paused",
    pause_reason: reason,
    updated_at: new Date().toISOString(),
  }).eq("id", task.id).eq("user_id", task.user_id);
  if (error) throw new Error("Talent Monitor pause was not persisted");
}

async function markMonitorQueued(task: SearchTask) {
  if (!client) throw new Error("Talent Monitor storage is not configured");
  const now = new Date();
  const nextRunAt = task.frequency === "manual" ? null : buildNextRunAt({
    frequency: task.frequency,
    timezone: task.timezone,
    scheduleTime: task.schedule_time,
    now,
  });
  const { error } = await client.database.from(TABLE).update({
    last_run_at: now.toISOString(),
    last_run_status: "queued",
    pause_reason: null,
    next_run_at: nextRunAt,
    updated_at: now.toISOString(),
  }).eq("id", task.id).eq("user_id", task.user_id);
  if (error) throw new Error("Talent Monitor queue state was not persisted");
}

async function enqueueMonitorResearchRun(task: SearchTask, run: MonitorRun): Promise<string | null> {
  const cachedCandidateHints = await findCachedCandidateProfilesForSearch({ userId: task.user_id, query: task.brief, limit: 8 });
  return enqueue({
    kind: "search",
    flatKey: `monitor-run:${run.id}:${task.brief}`,
    queryText: task.brief,
    label: buildSearchTaskRunLabel({ taskName: task.name }),
    userId: task.user_id,
    projectId: task.project_id,
    searchTaskId: task.id,
    platformLanguage: "Chinese (Simplified)",
    cachedCandidateHints,
  });
}

export async function startMonitorRun(input: { userId: string; id: string }): Promise<MonitorStartResult> {
  const task = await getSearchTask(input.userId, input.id);
  if (!task) return { status: "blocked", reason: "monitor_not_found", enqueued: false };
  return (await startMonitorRunCore(task, {
    projectIsActive: async (monitor: SearchTask) => ensureSearchTaskProjectAccess(monitor.user_id, monitor.project_id),
    findActiveRun: findActiveMonitorRun,
    createRunId: () => crypto.randomUUID(),
    reserveCredits: credits.reserve,
    releaseCredits: credits.release,
    createRun: async ({ task: monitor, runId, creditReservationId, creditsReserved, configSnapshot }: {
      task: SearchTask;
      runId: string;
      creditReservationId: string;
      creditsReserved: number;
      configSnapshot: Record<string, unknown>;
    }) => {
      const row = firstRow(await monitorRpc("create_monitor_run", {
        p_user_id: monitor.user_id,
        p_search_task_id: monitor.id,
        p_run_id: runId,
        p_credit_reservation_id: creditReservationId,
        p_credits_reserved: creditsReserved,
        p_config_snapshot: configSnapshot,
      }));
      if (row?.is_duplicate === true) return { duplicate: true, run: await findActiveMonitorRun(monitor) ?? monitorRunFromRow(row) };
      if (typeof row?.pause_reason === "string" && row.pause_reason) return { paused: true, reason: row.pause_reason };
      return { run: monitorRunFromRow(row) };
    },
    enqueue: ({ task: monitor, run }: { task: SearchTask; run: MonitorRun }) => enqueueMonitorResearchRun(monitor, run),
    linkResearchRun: async ({ runId, researchRunId }: { runId: string; researchRunId: string }) => {
      const result = await monitorRpc("link_monitor_research_run", {
        p_run_id: runId,
        p_research_run_id: researchRunId,
      });
      const row = firstRow(result);
      return result === true || row?.link_monitor_research_run === true;
    },
    abortRun: async ({ runId, researchRunId, idempotencyKey }: { runId: string; researchRunId: string | null; idempotencyKey: string }) => {
      const result = await monitorRpc("abort_monitor_run", {
        p_run_id: runId,
        p_release_idempotency_key: idempotencyKey,
        p_research_run_id: researchRunId,
      });
      const row = firstRow(result);
      return result === true || row?.abort_monitor_run === true;
    },
    pauseTask: setMonitorPause,
    markQueued: markMonitorQueued,
  })) as MonitorStartResult;
}

export async function runSearchTaskNow(input: { userId: string; id: string }): Promise<{ jobId: string | null; task: SearchTask; duplicate?: boolean } | null> {
  const task = await getSearchTask(input.userId, input.id);
  if (!task) return null;
  const started = await startMonitorRun(input);
  if (started.status !== "queued") return null;
  if (!started.jobId && !started.duplicate) return null;
  return { jobId: started.jobId ?? started.run?.researchRunId ?? null, task, duplicate: started.duplicate };
}

export async function enqueueDueSearchTasks(limit = 10): Promise<{ queued: number; job_ids: string[] }> {
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
  return { queued: jobIds.length, job_ids: jobIds };
}
