import { createClient } from "@insforge/sdk";
import { enqueue, findCachedCandidateProfilesForSearch } from "./db";
import {
  buildNextRunAt,
  buildSearchTaskRunLabel,
  normalizeSearchTaskInput,
  summarizeTaskRuns,
} from "./search-tasks.mjs";

const BASE = process.env.INSFORGE_API_BASE_URL;
const KEY = process.env.INSFORGE_API_KEY;
const client = BASE && KEY ? createClient({ baseUrl: BASE, anonKey: KEY, isServerMode: true }) : null;
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
        next_run_at: normalized.status === "active" ? buildNextRunAt({ frequency: normalized.frequency, now }) : null,
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
}): Promise<SearchTask | null> {
  if (!client) return null;
  const existing = await getSearchTask(input.userId, input.id);
  if (!existing) return null;
  const normalized = normalizeSearchTaskInput({
    name: input.name ?? existing.name,
    brief: input.brief ?? existing.brief,
    frequency: input.frequency ?? existing.frequency,
    status: input.status ?? existing.status,
  });
  const now = new Date();
  const patch = {
    name: normalized.name,
    brief: normalized.brief,
    frequency: normalized.frequency,
    status: normalized.status,
    next_run_at: normalized.status === "active" ? buildNextRunAt({ frequency: normalized.frequency, now }) : null,
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

export async function runSearchTaskNow(input: { userId: string; id: string }): Promise<{ jobId: string; task: SearchTask } | null> {
  const task = await getSearchTask(input.userId, input.id);
  if (!task || task.status !== "active") return null;
  const rows = await runSQL<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM research_runs WHERE user_id = $1 AND search_task_id = $2`,
    [input.userId, input.id],
  );
  const sequence = Number(rows?.[0]?.count ?? 0) + 1;
  const flatKey = `search-task:${task.id}:run:${sequence}:${task.brief}`;
  const cachedCandidateHints = await findCachedCandidateProfilesForSearch({ userId: input.userId, query: task.brief, limit: 8 });
  const jobId = await enqueue({
    kind: "search",
    flatKey,
    queryText: task.brief,
    label: buildSearchTaskRunLabel({ taskName: task.name, sequence }),
    userId: input.userId,
    projectId: task.project_id,
    searchTaskId: task.id,
    platformLanguage: "Chinese (Simplified)",
    cachedCandidateHints,
  });
  if (!jobId) return null;
  const now = new Date();
  const nextRunAt = task.frequency === "manual" ? null : buildNextRunAt({ frequency: task.frequency, now });
  await client?.database.from(TABLE).update({
    last_run_at: now.toISOString(),
    next_run_at: nextRunAt,
    updated_at: now.toISOString(),
  }).eq("id", task.id).eq("user_id", input.userId);
  return { jobId, task: { ...task, last_run_at: now.toISOString(), next_run_at: nextRunAt } };
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
    const queued = await runSearchTaskNow({ userId: row.user_id, id: row.id });
    if (queued?.jobId) jobIds.push(queued.jobId);
  }
  return { queued: jobIds.length, job_ids: jobIds };
}
