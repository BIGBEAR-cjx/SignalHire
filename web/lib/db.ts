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
export async function findRun(kind: RunKind, flatKey: string): Promise<unknown | null> {
  if (!client) return null;
  try {
    const { data, error } = await client.database
      .from(TABLE)
      .select("result")
      .eq("kind", kind)
      .eq("flat_key", flatKey)
      .limit(1);
    if (error || !data || data.length === 0) return null;
    return (data[0] as { result?: unknown }).result ?? null;
  } catch {
    return null;
  }
}

// upsert: (kind, flat_key) 唯一, 重复查询只更新不新增行。
export async function saveRun(row: SaveRunInput): Promise<void> {
  if (!client) return;
  try {
    await client.database.from(TABLE).upsert(
      {
        kind: row.kind,
        flat_key: row.flatKey,
        query_text: row.queryText,
        label: row.label,
        summary: row.summary,
        result: row.result,
        stats: row.stats,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "kind,flat_key" },
    );
  } catch {
    // 静默: 写库失败不能影响给用户返回结果
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
