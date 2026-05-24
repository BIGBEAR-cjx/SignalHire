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

// 精确 flat_key 查找 (模糊匹配只留给 cache.ts 的 2 个静态头牌, 避免库变大后误命中)。
// 返回 {id, result} —— id 用于生成可分享报告链接 /r/[id]。
export async function findRun(kind: RunKind, flatKey: string): Promise<{ id: string; result: unknown } | null> {
  if (!client) return null;
  try {
    const { data, error } = await client.database
      .from(TABLE)
      .select("id,result")
      .eq("cache_key", cacheKey(kind, flatKey))
      .limit(1);
    if (error || !data || data.length === 0) return null;
    const row = data[0] as { id: string; result?: unknown };
    return { id: row.id, result: row.result ?? null };
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

// 历史面板: 最近的运行 (按更新时间倒序)。
export async function recentRuns(limit = 20): Promise<RecentRun[]> {
  if (!client) return [];
  try {
    const { data, error } = await client.database
      .from(TABLE)
      .select("kind,label,summary,query_text,updated_at")
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return data as RecentRun[];
  } catch {
    return [];
  }
}
