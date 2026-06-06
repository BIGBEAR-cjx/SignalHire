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
import { createHash } from "node:crypto";
import {
  DEFAULT_MAX_ATTEMPTS,
  RUN_STATUSES,
  STALE_AFTER_MS,
  buildCancelUpdate,
  buildRetryUpdate,
  describeJobStatus,
  isStaleRunningJob,
} from "./job-state.mjs";
import { buildFeedbackOptimizedSearchInput, mergeBackfillResult } from "./talent-profile.mjs";
import { mergeSearchFeedbackIntoResult } from "./research-loop.mjs";

const BASE = process.env.INSFORGE_API_BASE_URL;
const KEY = process.env.INSFORGE_API_KEY; // 服务端 access key, 绝不进 NEXT_PUBLIC

// 只在配了凭证时建 client; 否则全程降级 (本地没配 / Insforge 没接也不影响 app)。
// 注: 服务端写库的鉴权字段在拿到真实凭证联调时定 (anonKey vs Authorization header),
//     若 anonKey 不足以写, 改成 createClient({ baseUrl, headers:{ Authorization:`Bearer ${KEY}` } })。
const client =
  BASE && KEY ? createClient({ baseUrl: BASE, anonKey: KEY, isServerMode: true }) : null;

// PostgREST 没法做 FILTER 聚合, 走 Insforge 自带的 raw SQL admin 端点 (参数化, 安全)。
// 仅用于聚合/dashboard 类只读查询; 写操作仍走 SDK 以保持一致。
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

const TABLE = "research_runs";
const MAX_CACHE_KEY_LENGTH = 240;
const MAX_FLAT_KEY_LENGTH = 220;
const MAX_QUERY_TEXT_LENGTH = 240;
const MAX_LABEL_LENGTH = 80;

function shortHash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function truncateText(value: string, maxLength: number): string {
  const clean = String(value ?? "").trim();
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function compactKey(value: string, maxLength: number): string {
  const clean = String(value ?? "").trim();
  if (clean.length <= maxLength) return clean;
  const hash = shortHash(clean);
  const prefix = clean.slice(0, Math.max(0, maxLength - hash.length - 1)).trimEnd();
  return `${prefix}:${hash}`;
}

// Build DB-safe fields before touching research_runs. Some Insforge string columns are
// varchar-sized, so long user briefs must not become oversized cache/flat/query fields.
//
// 多租户: cacheKey 加入 userId 短哈希, 避免不同用户搜同样 brief 时 upsert 互相覆盖。
// 老数据 (NULL user_id 被回填到管理员账号) 保留 legacy cacheKey, 不会被新查询命中, 仅在历史里可见。
export function buildRunStorageFields(input: {
  kind: RunKind;
  flatKey: string;
  queryText: string;
  label: string;
  userId?: string | null;
  platformLanguage?: string | null;
}) {
  const flatKey = compactKey(input.flatKey, MAX_FLAT_KEY_LENGTH);
  const userPart = input.userId ? `:${shortHash(input.userId).slice(0, 8)}` : "";
  return {
    cacheKey: compactKey(`${input.kind}${userPart}:${input.flatKey}`, MAX_CACHE_KEY_LENGTH),
    flatKey,
    queryText: truncateText(input.queryText, MAX_QUERY_TEXT_LENGTH),
    label: truncateText(input.label, MAX_LABEL_LENGTH),
    queuedProgress: { original_query: input.queryText, platform_language: input.platformLanguage ?? null },
  };
}

// 单列唯一键 (Insforge 不支持复合唯一约束), 用于 upsert 去重。
const cacheKey = (kind: RunKind, flatKey: string, userId?: string | null) => buildRunStorageFields({
  kind,
  flatKey,
  queryText: "",
  label: "",
  userId,
}).cacheKey;

function dateMs(value: string | null | undefined): number | null {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function ageMs(row: { created_at?: string | null; updated_at?: string | null }, now: Date) {
  const basis = dateMs(row.updated_at) ?? dateMs(row.created_at);
  return basis === null ? null : Math.max(0, now.getTime() - basis);
}

export type RunKind = "search" | "verify";
type SearchFeedbackInput = {
  precision?: string;
  satisfaction?: string;
  issue?: string;
  focus?: string;
};

export interface SaveRunInput {
  kind: RunKind;
  flatKey: string;
  queryText: string;
  label: string;
  summary: string;
  result: unknown;
  stats: unknown;
  userId: string; // 多租户: 必须知道写给谁
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
    phase: "queued" | "running" | "retrying" | "done" | "error" | "canceled";
    label: string;
    detail: string;
    canRetry: boolean;
  };
}

export interface WorkerHealthJob {
  id: string;
  kind: RunKind;
  status: string;
  label: string;
  created_at: string | null;
  updated_at: string | null;
  locked_at: string | null;
  started_at: string | null;
  attempt_count: number;
  max_attempts: number;
  age_ms: number | null;
}

export interface WorkerHealth {
  ok: boolean;
  checked_at: string;
  stale_after_ms: number;
  reason: string | null;
  queue: {
    queued: number;
    retrying: number;
    running: number;
  };
  stale_jobs: WorkerHealthJob[];
  recent_done: {
    id: string;
    kind: RunKind;
    label: string;
    finished_at: string | null;
    updated_at: string | null;
  } | null;
}

export interface MergeBackfillRunsResult {
  runId: string;
  result: unknown;
  mergeSummary: unknown;
  updated_at: string | null;
}

export interface SaveSearchFeedbackResult {
  runId: string;
  result: unknown;
  feedback: unknown;
  optimizedInput: string;
  updated_at: string | null;
}

function normalizeHealthJob(row: {
  id?: string;
  kind?: RunKind;
  status?: string;
  label?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  locked_at?: string | null;
  started_at?: string | null;
  attempt_count?: number | null;
  max_attempts?: number | null;
}, now: Date): WorkerHealthJob {
  return {
    id: row.id ?? "",
    kind: row.kind ?? "search",
    status: row.status ?? RUN_STATUSES.QUEUED,
    label: row.label ?? "",
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
    locked_at: row.locked_at ?? null,
    started_at: row.started_at ?? null,
    attempt_count: row.attempt_count ?? 0,
    max_attempts: row.max_attempts ?? DEFAULT_MAX_ATTEMPTS,
    age_ms: ageMs(row, now),
  };
}

// 精确 flat_key 查找 (模糊匹配只留给 cache.ts 的 2 个静态头牌, 避免库变大后误命中)。
// 返回 {id, result} —— id 用于生成可分享报告链接 /r/[id]。
// 多租户: 按当前用户的 cacheKey 查 (cacheKey 已包含 userId 短哈希)。
export async function findRun(kind: RunKind, flatKey: string, userId: string): Promise<{ id: string; result: unknown } | null> {
  if (!client) return null;
  try {
    const { data, error } = await client.database
      .from(TABLE)
      .select("id,result,status,user_id")
      .eq("cache_key", cacheKey(kind, flatKey, userId))
      .eq("status", "done")
      .eq("user_id", userId)
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
// 多租户: 也按当前用户过滤; 静态 demo 用户(管理员账号) 名下若已 seed 同 key 则返其 id。
export async function findRunId(kind: RunKind, flatKey: string, userId: string): Promise<string | null> {
  if (!client) return null;
  try {
    const { data, error } = await client.database
      .from(TABLE).select("id")
      .eq("cache_key", cacheKey(kind, flatKey, userId))
      .eq("user_id", userId)
      .limit(1);
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
// 多租户: row.userId 必填; cacheKey 已包含 userId 短哈希避免跨用户覆盖。
export async function saveRun(row: SaveRunInput): Promise<string | null> {
  if (!client) return null;
  const storage = buildRunStorageFields(row);
  try {
    await client.database.from(TABLE).upsert(
      {
        cache_key: storage.cacheKey,
        kind: row.kind,
        flat_key: storage.flatKey,
        query_text: storage.queryText,
        label: storage.label,
        summary: row.summary,
        result: row.result,
        stats: row.stats,
        status: "done",
        user_id: row.userId,
        error: null,
        last_error: null,
        progress: null,
        locked_at: null,
        finished_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "cache_key" },
    );
    return await findRunId(row.kind, row.flatKey, row.userId);
  } catch {
    // 静默: 写库失败不能影响给用户返回结果
    return null;
  }
}

// 入队一个异步任务 (实时查询缓存未命中时): 插 status='queued' 行, 返回 id 供前端轮询。
// worker (Insforge Compute) 会认领并跑完, 写回 result + status='done' —— worker 不动 user_id/project_id。
// projectId 可选 (在某项目上下文里搜 → 自动归项目, 否则 null)。
export async function enqueue(input: {
  kind: RunKind; flatKey: string; queryText: string; label: string; userId: string;
  projectId?: string | null;
  platformLanguage?: string | null;
}): Promise<string | null> {
  if (!client) return null;
  const storage = buildRunStorageFields(input);
  try {
    const row: Record<string, unknown> = {
      cache_key: storage.cacheKey, kind: input.kind, flat_key: storage.flatKey,
      query_text: storage.queryText, label: storage.label,
      summary: "研究中…", result: null, stats: null,
      status: "queued",
      user_id: input.userId,
      error: null, last_error: null, progress: storage.queuedProgress,
      attempt_count: 0, max_attempts: DEFAULT_MAX_ATTEMPTS,
      locked_at: null, started_at: null, finished_at: null,
      updated_at: new Date().toISOString(),
    };
    if (input.projectId !== undefined) row.project_id = input.projectId;
    await client.database.from(TABLE).upsert(row, { onConflict: "cache_key" });
    return await findRunId(input.kind, input.flatKey, input.userId);
  } catch {
    return null;
  }
}

// 前端轮询: 按 id 取任务状态/进度/结果。
// 多租户: 必须传 userId, 不属于该用户的 row 当作不存在 (返 null)。
export async function getStatus(id: string, userId: string, locale?: string): Promise<RunStatus | null> {
  if (!client) return null;
  try {
    const { data, error } = await client.database
      .from(TABLE)
      .select("status,progress,result,error,last_error,attempt_count,max_attempts,locked_at,started_at,finished_at,updated_at,user_id")
      .eq("id", id)
      .eq("user_id", userId)
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
    return { ...normalized, status_view: describeJobStatus(normalized, locale) as RunStatus["status_view"] };
  } catch {
    return null;
  }
}

async function getDoneSearchRunForUser(id: string, userId: string): Promise<{
  id: string;
  summary: string | null;
  result: unknown;
} | null> {
  if (!client) return null;
  const { data, error } = await client.database
    .from(TABLE)
    .select("id,summary,result")
    .eq("id", id)
    .eq("user_id", userId)
    .eq("kind", "search")
    .eq("status", "done")
    .limit(1);
  if (error || !data || data.length === 0) return null;
  const row = data[0] as { id: string; summary?: string | null; result?: unknown };
  if (!row.result) return null;
  return { id: row.id, summary: row.summary ?? null, result: row.result };
}

// 把一个已完成的补搜 search run 合并回原始 search run。
// 多租户: 两条 run 都必须属于当前 userId；失败时返回 null，由 API 暴露成 404/503。
export async function mergeBackfillRuns(input: {
  originalRunId: string;
  backfillRunId: string;
  userId: string;
}): Promise<MergeBackfillRunsResult | null> {
  if (!client) return null;
  try {
    const [original, backfill] = await Promise.all([
      getDoneSearchRunForUser(input.originalRunId, input.userId),
      getDoneSearchRunForUser(input.backfillRunId, input.userId),
    ]);
    if (!original || !backfill) return null;

    const merged = mergeBackfillResult({
      originalResult: original.result,
      backfillResult: backfill.result,
    });
    const mergeSummary = merged.backfill_merge.summary;
    const updatedAt = new Date().toISOString();
    const { data, error } = await client.database
      .from(TABLE)
      .update({
        result: merged,
        summary: original.summary || mergeSummary.summary,
        updated_at: updatedAt,
      })
      .eq("id", input.originalRunId)
      .eq("user_id", input.userId)
      .eq("kind", "search")
      .eq("status", "done")
      .select("id,result,updated_at")
      .limit(1);
    if (error || !data || data.length === 0) return null;
    const row = data[0] as { id: string; result?: unknown; updated_at?: string | null };
    return {
      runId: row.id,
      result: row.result ?? merged,
      mergeSummary,
      updated_at: row.updated_at ?? updatedAt,
    };
  } catch {
    return null;
  }
}

// 将用户对某一轮 shortlist 的选择题反馈写回该 search run 的 result。
// 不新增 DB 列，避免迁移阻塞；后续如需分析可从 result.search_feedback 迁移到独立表。
export async function saveSearchFeedback(input: {
  runId: string;
  userId: string;
  feedback: SearchFeedbackInput;
}): Promise<SaveSearchFeedbackResult | null> {
  if (!client) return null;
  try {
    const current = await getDoneSearchRunForUser(input.runId, input.userId);
    if (!current) return null;

    const optimizedInput = buildFeedbackOptimizedSearchInput({
      result: current.result,
      feedback: input.feedback,
    });
    const updatedAt = new Date().toISOString();
    const merged = mergeSearchFeedbackIntoResult({
      result: current.result,
      feedback: input.feedback,
      optimizedInput,
      createdAt: updatedAt,
    });

    const { data, error } = await client.database
      .from(TABLE)
      .update({
        result: merged,
        updated_at: updatedAt,
      })
      .eq("id", input.runId)
      .eq("user_id", input.userId)
      .eq("kind", "search")
      .eq("status", "done")
      .select("id,result,updated_at")
      .limit(1);
    if (error || !data || data.length === 0) return null;
    const row = data[0] as { id: string; result?: unknown; updated_at?: string | null };
    const result = row.result ?? merged;
    const feedback = result && typeof result === "object" && !Array.isArray(result)
      ? (result as { search_feedback?: unknown }).search_feedback
      : merged.search_feedback;
    return {
      runId: row.id,
      result,
      feedback,
      optimizedInput,
      updated_at: row.updated_at ?? updatedAt,
    };
  } catch {
    return null;
  }
}

// 手动重试失败任务: 只允许 error 行重新入队。返回最新状态供前端继续轮询。
// 多租户: 不属于该用户的行不允许 retry。
export async function retryRun(id: string, userId: string, locale?: string): Promise<RunStatus | null> {
  if (!client) return null;
  try {
    const current = await getStatus(id, userId, locale);
    if (!current || current.status !== "error") return current;
    const { data, error } = await client.database
      .from(TABLE)
      .update(buildRetryUpdate())
      .eq("id", id)
      .eq("user_id", userId)
      .eq("status", "error")
      .select("id");
    if (error || !data || data.length === 0) return null;
    return await getStatus(id, userId, locale);
  } catch {
    return null;
  }
}

// 用户停止任务: queued/running/retrying 都标记为 canceled。worker 后续写库带 status=running 条件, 不会覆盖已取消行。
// 多租户: 不属于该用户的行不允许 cancel。
export async function cancelRun(id: string, userId: string): Promise<RunStatus | null> {
  if (!client) return null;
  try {
    const current = await getStatus(id, userId);
    if (!current) return null;
    if (!["queued", "running", "retrying"].includes(current.status)) return current;
    const { data, error } = await client.database
      .from(TABLE)
      .update(buildCancelUpdate())
      .eq("id", id)
      .eq("user_id", userId)
      .in("status", ["queued", "running", "retrying"])
      .select("id");
    if (error || !data || data.length === 0) return null;
    return await getStatus(id, userId);
  } catch {
    return null;
  }
}

// 历史面板: 最近的运行 (按更新时间倒序)。只显示已完成的 (status=done)。
// 多租户: 必须传 userId, 只返该用户的。
export async function recentRuns(userId: string, limit = 20): Promise<RecentRun[]> {
  if (!client) return [];
  try {
    const { data, error } = await client.database
      .from(TABLE)
      .select("kind,label,summary,query_text,updated_at")
      .eq("status", "done")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return data as RecentRun[];
  } catch {
    return [];
  }
}

async function healthRows(status: string): Promise<WorkerHealthJob[]> {
  if (!client) return [];
  const now = new Date();
  const { data, error } = await client.database
    .from(TABLE)
    .select("id,kind,status,label,created_at,updated_at,locked_at,started_at,attempt_count,max_attempts")
    .eq("status", status)
    .order("updated_at", { ascending: true })
    .limit(50);
  if (error || !data) throw error ?? new Error(`failed to read ${status} jobs`);
  return (data as Array<Parameters<typeof normalizeHealthJob>[0]>).map((row) => normalizeHealthJob(row, now));
}

// Worker health is stricter than product read paths: failures should surface to cron/ops.
export async function workerHealth(): Promise<WorkerHealth> {
  const checkedAt = new Date();
  if (!client) {
    return {
      ok: false,
      checked_at: checkedAt.toISOString(),
      stale_after_ms: STALE_AFTER_MS,
      reason: "Insforge credentials are not configured",
      queue: { queued: 0, retrying: 0, running: 0 },
      stale_jobs: [],
      recent_done: null,
    };
  }

  try {
    const [queued, retrying, running, doneRows] = await Promise.all([
      healthRows(RUN_STATUSES.QUEUED),
      healthRows(RUN_STATUSES.RETRYING),
      healthRows(RUN_STATUSES.RUNNING),
      client.database
        .from(TABLE)
        .select("id,kind,label,finished_at,updated_at")
        .eq("status", RUN_STATUSES.DONE)
        .order("updated_at", { ascending: false })
        .limit(1),
    ]);

    const staleQueued = queued.filter((row) => (row.age_ms ?? 0) > STALE_AFTER_MS);
    const staleRetrying = retrying.filter((row) => (row.age_ms ?? 0) > STALE_AFTER_MS);
    const staleRunning = running.filter((row) => isStaleRunningJob(row, checkedAt, STALE_AFTER_MS));
    const staleJobs = [...staleQueued, ...staleRetrying, ...staleRunning];
    if (doneRows.error) throw doneRows.error;
    const recent = doneRows.data?.[0] as
      | { id: string; kind: RunKind; label: string; finished_at?: string | null; updated_at?: string | null }
      | undefined;

    return {
      ok: staleJobs.length === 0,
      checked_at: checkedAt.toISOString(),
      stale_after_ms: STALE_AFTER_MS,
      reason: staleJobs.length === 0 ? null : `${staleJobs.length} job(s) stale past worker threshold`,
      queue: {
        queued: queued.length,
        retrying: retrying.length,
        running: running.length,
      },
      stale_jobs: staleJobs,
      recent_done: recent
        ? {
            id: recent.id,
            kind: recent.kind,
            label: recent.label,
            finished_at: recent.finished_at ?? null,
            updated_at: recent.updated_at ?? null,
          }
        : null,
    };
  } catch (e) {
    return {
      ok: false,
      checked_at: checkedAt.toISOString(),
      stale_after_ms: STALE_AFTER_MS,
      reason: (e as Error).message || "Worker health check failed",
      queue: { queued: 0, retrying: 0, running: 0 },
      stale_jobs: [],
      recent_done: null,
    };
  }
}

// ───────── 控制台总览 (Phase 1.4) ─────────

export interface OverviewKpi {
  searches_this_month: number;
  verifies_total: number;
  shortlist_total: number;
  red_flags_total: number;
  projects_open: number;  // 进行中招聘项目数
}

export interface ActiveJob {
  id: string;
  kind: RunKind;
  label: string;
  status: string;
  updated_at: string | null;
}

// 一次性聚合 4 个 KPI: 本月搜人 / 总核验 / 总收藏 / 总红旗 (verify 中 overall_trust=low)。
// 失败一律返 0 (静默降级, dashboard 不能因 DB 抖动整页报错)。
export async function overviewStats(userId: string): Promise<OverviewKpi> {
  const zero: OverviewKpi = { searches_this_month: 0, verifies_total: 0, shortlist_total: 0, red_flags_total: 0, projects_open: 0 };
  if (!client) return zero;
  const [runs, shortlist, projects] = await Promise.all([
    runSQL<{ searches_this_month: string; verifies_total: string; red_flags_total: string }>(
      `SELECT
        COUNT(*) FILTER (WHERE kind='search' AND status='done' AND created_at >= date_trunc('month', now())) AS searches_this_month,
        COUNT(*) FILTER (WHERE kind='verify' AND status='done')                                              AS verifies_total,
        COUNT(*) FILTER (WHERE kind='verify' AND status='done' AND result->>'overall_trust' = 'low')         AS red_flags_total
       FROM research_runs WHERE user_id = $1`,
      [userId],
    ),
    runSQL<{ n: string }>(`SELECT COUNT(*) AS n FROM shortlist_items WHERE user_id = $1`, [userId]),
    runSQL<{ n: string }>(`SELECT COUNT(*) AS n FROM projects WHERE user_id = $1 AND status='open'`, [userId]),
  ]);
  const r = runs?.[0];
  const s = shortlist?.[0];
  const p = projects?.[0];
  return {
    searches_this_month: Number(r?.searches_this_month ?? 0),
    verifies_total: Number(r?.verifies_total ?? 0),
    shortlist_total: Number(s?.n ?? 0),
    red_flags_total: Number(r?.red_flags_total ?? 0),
    projects_open: Number(p?.n ?? 0),
  };
}

// 进行中的任务 (queued / running / retrying)。dashboard 实时性参考用。
export async function activeJobs(userId: string, limit = 10): Promise<ActiveJob[]> {
  if (!client) return [];
  try {
    const { data, error } = await client.database
      .from(TABLE)
      .select("id,kind,label,status,updated_at")
      .eq("user_id", userId)
      .in("status", ["queued", "running", "retrying"])
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return data as ActiveJob[];
  } catch {
    return [];
  }
}
