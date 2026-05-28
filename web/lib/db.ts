// lib/db.ts —— Insforge 持久化层 (仅服务端)。
// 作用: 把完成过的研究存进 DB, 让重复查询秒出, 并支撑"搜索历史"面板。
//
// 铁律: DB 只是增强, 绝不能成为单点故障。
// 所有调用都 try/catch, 任何失败 (没配凭证 / key 过期 / 限额 / 网络) 一律静默降级:
//   findRun → null, recentRuns → [], saveRun → no-op。
// 核心流程 (静态缓存 + 实时研究) 永远照常工作; demo 头牌走静态缓存, 不依赖 DB。
//
// API 形态: Insforge 的 database.from() 是 Supabase PostgREST 构建器,
//   .select().eq().order().limit() / .insert() / .upsert(...,{onConflict}) → {data,error}。

import { createClient } from "@insforge/sdk";
import { DEFAULT_MAX_ATTEMPTS, buildRetryUpdate, describeJobStatus } from "./job-state.mjs";

const BASE = process.env.INSFORGE_API_BASE_URL;
const KEY = process.env.INSFORGE_API_KEY; // 服务端 access key, 绝不进 NEXT_PUBLIC

// 只在配了凭证时建 client; 否则全程降级 (本地没配 / Insforge 没接也不影响 app)。
// 注: 服务端写库的鉴权字段在拿到真实凭证联调时定 (anonKey vs Authorization header),
//     若 anonKey 不足以写, 改成 createClient({ baseUrl, headers:{ Authorization:`Bearer ${KEY}` } })。
const client =
  BASE && KEY ? createClient({ baseUrl: BASE, anonKey: KEY, isServerMode: true }) : null;

const TABLE = "research_runs";

// 单列唯一键 (Insforge 不支持复合唯一约束), 用于 upsert 去重。
const cacheKey = (kind: string, flatKey: string) => `${kind}:${flatKey}`;

export type RunKind = "search" | "verify";

export interface SaveRunInput {
  kind: RunKind;
  flatKey: string;
  queryText: string;
  label: string;
  summary: string;
  result: unknown;
  stats: unknown;
}

export interface RecentRun {
  kind: RunKind;
  label: string;
  summary: string;
  query_text: string;
  updated_at: string;
}

export interface RunStatus {
  status: string;
  progress: unknown;
  result: unknown;
  error: string | null;
  last_error: string | null;
  attempt_count: number;
  max_attempts: number;
  locked_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  updated_at: string | null;
  status_view: {
    phase: "queued" | "running" | "retrying" | "done" | "error";
    label: string;
    detail: string;
    canRetry: boolean;
  };
}

// 精确 flat_key 查找 (模糊匹配只留给 cache.ts 的 2 个静态头牌, 避免库变大后误命中)。
// 返回 {id, result} —— id 用于生成可分享报告链接 /r/[id]。
export async function findRun(kind: RunKind, flatKey: string): Promise<{ id: string; result: unknown } | null> {
  if (!client) return null;
  try {
    const { data, error } = await client.database
      .from(TABLE)
      .select("id,result,status")
      .eq("cache_key", cacheKey(kind, flatKey))
      .eq("status", "done")
      .limit(1);
    if (error || !data || data.length === 0) return null;
    const row = data[0] as { id: string; result?: unknown; status?: string };
    if (!row.result) return null;
    return { id: row.id, result: row.result };
  } catch {
    return null;
  }
}

// 只取 id (静态缓存命中时, 为已 seed 的同 key 行拿分享链接 id)。
export async function findRunId(kind: RunKind, flatKey: string): Promise<string | null> {
  if (!client) return null;
  try {
    const { data, error } = await client.database
      .from(TABLE).select("id").eq("cache_key", cacheKey(kind, flatKey)).limit(1);
    if (error || !data || data.length === 0) return null;
    return (data[0] as { id: string }).id ?? null;
  } catch {
    return null;
  }
}

// 按 id 取整行 (可分享报告页 /r/[id] 用)。
export async function getRunById(id: string): Promise<{
  kind: RunKind; query_text: string; label: string; summary: string;
  result: unknown; stats: unknown; updated_at: string;
} | null> {
  if (!client) return null;
  try {
    const { data, error } = await client.database
      .from(TABLE)
      .select("kind,query_text,label,summary,result,stats,updated_at")
      .eq("id", id)
      .limit(1);
    if (error || !data || data.length === 0) return null;
    return data[0] as never;
  } catch {
    return null;
  }
}

// upsert: cache_key 唯一, 重复查询只更新不新增行。返回该行 id (供分享链接)。
export async function saveRun(row: SaveRunInput): Promise<string | null> {
  if (!client) return null;
  const ck = cacheKey(row.kind, row.flatKey);
  try {
    await client.database.from(TABLE).upsert(
      {
        cache_key: ck,
        kind: row.kind,
        flat_key: row.flatKey,
        query_text: row.queryText,
        label: row.label,
        summary: row.summary,
        result: row.result,
        stats: row.stats,
        status: "done",
        error: null,
        last_error: null,
        progress: null,
        locked_at: null,
        finished_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "cache_key" },
    );
    return await findRunId(row.kind, row.flatKey);
  } catch {
    // 静默: 写库失败不能影响给用户返回结果
    return null;
  }
}

// 入队一个异步任务 (实时查询缓存未命中时): 插 status='queued' 行, 返回 id 供前端轮询。
// worker (Insforge Compute) 会认领并跑完, 写回 result + status='done'。
export async function enqueue(input: {
  kind: RunKind; flatKey: string; queryText: string; label: string;
}): Promise<string | null> {
  if (!client) return null;
  const ck = cacheKey(input.kind, input.flatKey);
  try {
    await client.database.from(TABLE).upsert(
      {
        cache_key: ck, kind: input.kind, flat_key: input.flatKey,
        query_text: input.queryText, label: input.label,
        summary: "研究中…", result: null, stats: null,
        status: "queued", error: null, last_error: null, progress: null,
        attempt_count: 0, max_attempts: DEFAULT_MAX_ATTEMPTS,
        locked_at: null, started_at: null, finished_at: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "cache_key" },
    );
    return await findRunId(input.kind, input.flatKey);
  } catch {
    return null;
  }
}

// 前端轮询: 按 id 取任务状态/进度/结果。
export async function getStatus(id: string): Promise<RunStatus | null> {
  if (!client) return null;
  try {
    const { data, error } = await client.database
      .from(TABLE)
      .select("status,progress,result,error,last_error,attempt_count,max_attempts,locked_at,started_at,finished_at,updated_at")
      .eq("id", id)
      .limit(1);
    if (error || !data || data.length === 0) return null;
    const r = data[0] as {
      status?: string; progress?: unknown; result?: unknown; error?: string | null;
      last_error?: string | null; attempt_count?: number | null; max_attempts?: number | null;
      locked_at?: string | null; started_at?: string | null; finished_at?: string | null;
      updated_at?: string | null;
    };
    const normalized = {
      status: r.status ?? "done",
      progress: r.progress ?? null,
      result: r.result ?? null,
      error: r.error ?? null,
      last_error: r.last_error ?? null,
      attempt_count: r.attempt_count ?? 0,
      max_attempts: r.max_attempts ?? DEFAULT_MAX_ATTEMPTS,
      locked_at: r.locked_at ?? null,
      started_at: r.started_at ?? null,
      finished_at: r.finished_at ?? null,
      updated_at: r.updated_at ?? null,
    };
    return { ...normalized, status_view: describeJobStatus(normalized) as RunStatus["status_view"] };
  } catch {
    return null;
  }
}

// 手动重试失败任务: 只允许 error 行重新入队。返回最新状态供前端继续轮询。
export async function retryRun(id: string): Promise<RunStatus | null> {
  if (!client) return null;
  try {
    const current = await getStatus(id);
    if (!current || current.status !== "error") return current;
    const { data, error } = await client.database
      .from(TABLE)
      .update(buildRetryUpdate())
      .eq("id", id)
      .eq("status", "error")
      .select("id");
    if (error || !data || data.length === 0) return null;
    return await getStatus(id);
  } catch {
    return null;
  }
}

// 历史面板: 最近的运行 (按更新时间倒序)。只显示已完成的 (status=done)。
export async function recentRuns(limit = 20): Promise<RecentRun[]> {
  if (!client) return [];
  try {
    const { data, error } = await client.database
      .from(TABLE)
      .select("kind,label,summary,query_text,updated_at")
      .eq("status", "done")
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return data as RecentRun[];
  } catch {
    return [];
  }
}
