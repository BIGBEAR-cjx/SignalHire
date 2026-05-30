// lib/shortlist.ts —— 候选池持久化层。
//
// 模型: 一个 shortlist_item = 一个候选人快照 (TalentCandidate / Candidate 二者皆可),
// 归属当前 user, 来自某次搜索 (source_run_id 软引用 research_runs)。
//
// dedup_key 防重: 同一个 user + 同一次 search + 同一个 candidate_index 只能存一行。
// 用 user 切换收藏开关时, 命中 dedup_key → upsert 更新 (或直接报告已在), 不会建重复。
//
// status 状态机 (简单线性, v1 不可配):
//   new → contacted → interviewing → hired / rejected
// 备注 (notes) 自由文本。

import { createClient } from "@insforge/sdk";

const BASE = process.env.INSFORGE_API_BASE_URL;
const KEY = process.env.INSFORGE_API_KEY;
const client = BASE && KEY ? createClient({ baseUrl: BASE, anonKey: KEY, isServerMode: true }) : null;

const TABLE = "shortlist_items";

export type ShortlistStatus = "new" | "contacted" | "interviewing" | "hired" | "rejected";
export const STATUSES: ShortlistStatus[] = ["new", "contacted", "interviewing", "hired", "rejected"];

export interface ShortlistItem {
  id: string;
  user_id: string;
  source_run_id: string | null;
  candidate: unknown;
  status: ShortlistStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// 端到端 dedup key: 同一 user 在同一 source_run 里同一 index 视为同一候选人。
// 单列 UNIQUE, 因为 Insforge 不支持复合 unique 约束。
function makeDedupKey(userId: string, sourceRunId: string | null, candidateIndex: number): string {
  return `${userId}:${sourceRunId ?? "external"}:${candidateIndex}`;
}

// 列出当前用户的全部候选池, 最近更新优先。
export async function listItems(userId: string): Promise<ShortlistItem[]> {
  if (!client) return [];
  try {
    const { data, error } = await client.database
      .from(TABLE)
      .select("id,user_id,source_run_id,candidate,status,notes,created_at,updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(500);
    if (error || !data) return [];
    return data as ShortlistItem[];
  } catch {
    return [];
  }
}

// 列当前用户在某次 search 下已收藏的 candidate_index 集合 (用于 UI 高亮)。
export async function listIndicesForRun(userId: string, sourceRunId: string): Promise<number[]> {
  if (!client) return [];
  try {
    const { data, error } = await client.database
      .from(TABLE)
      .select("dedup_key")
      .eq("user_id", userId)
      .eq("source_run_id", sourceRunId);
    if (error || !data) return [];
    const out: number[] = [];
    for (const r of data as Array<{ dedup_key: string }>) {
      const idx = Number(r.dedup_key.split(":").pop());
      if (Number.isFinite(idx)) out.push(idx);
    }
    return out;
  } catch {
    return [];
  }
}

// 收藏: upsert by dedup_key, 返回行 id。已存在则只更新 candidate 快照 + updated_at, status/notes 不动。
export async function addItem(input: {
  userId: string;
  sourceRunId: string | null;
  candidateIndex: number;
  candidate: unknown;
}): Promise<string | null> {
  if (!client) return null;
  const dedup_key = makeDedupKey(input.userId, input.sourceRunId, input.candidateIndex);
  try {
    await client.database.from(TABLE).upsert(
      {
        user_id: input.userId,
        dedup_key,
        source_run_id: input.sourceRunId,
        candidate: input.candidate,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "dedup_key" },
    );
    const { data } = await client.database
      .from(TABLE)
      .select("id")
      .eq("dedup_key", dedup_key)
      .limit(1);
    return (data as Array<{ id: string }> | null)?.[0]?.id ?? null;
  } catch {
    return null;
  }
}

// 改状态/备注。两个字段都可选, 都为 undefined 当 no-op。
export async function updateItem(input: {
  userId: string;
  id: string;
  status?: ShortlistStatus;
  notes?: string | null;
}): Promise<boolean> {
  if (!client) return false;
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.status !== undefined) patch.status = input.status;
  if (input.notes !== undefined) patch.notes = input.notes;
  try {
    const { data, error } = await client.database
      .from(TABLE)
      .update(patch)
      .eq("id", input.id)
      .eq("user_id", input.userId)
      .select("id");
    if (error) return false;
    return (data as Array<unknown> | null)?.length === 1;
  } catch {
    return false;
  }
}

// 删除收藏。必须属于当前用户。
export async function deleteItem(userId: string, id: string): Promise<boolean> {
  if (!client) return false;
  try {
    const { data, error } = await client.database
      .from(TABLE)
      .delete()
      .eq("id", id)
      .eq("user_id", userId)
      .select("id");
    if (error) return false;
    return (data as Array<unknown> | null)?.length === 1;
  } catch {
    return false;
  }
}

// 按 run 删一组 (撤销整次搜索的收藏, 暂未使用, 留着)。
export async function deleteByDedupKey(userId: string, dedupKey: string): Promise<boolean> {
  if (!client) return false;
  try {
    const { data, error } = await client.database
      .from(TABLE)
      .delete()
      .eq("user_id", userId)
      .eq("dedup_key", dedupKey)
      .select("id");
    if (error) return false;
    return (data as Array<unknown> | null)?.length === 1;
  } catch {
    return false;
  }
}

// 暴露 dedup key 计算给 API 路由用 (取消收藏时按 sourceRunId+index 反查)
export function dedupKeyFor(userId: string, sourceRunId: string | null, candidateIndex: number): string {
  return makeDedupKey(userId, sourceRunId, candidateIndex);
}
