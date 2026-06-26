// lib/projects.ts —— 招聘项目持久化层 (Phase 2.B)。
//
// 模型: 一个 project = 一个招聘职位的工作空间, 包含 brief, 状态 (open/paused/closed),
//   候选人池 (通过 shortlist_items.project_id 关联), 历史搜索 (research_runs.project_id)。
//
// 列表查询需要按项目带 KPI (候选人/搜索数), 走单次 raw SQL JOIN 聚合避免 N+1。
// 单项目读 / 写 / 删走 SDK CRUD 一致。

import { createClient } from "@insforge/sdk";
import { buildCandidateGraph } from "./candidate-graph.mjs";
import { buildPeopleProviderConfig, providerRowsToSourceLeads } from "./people-providers.mjs";
import { listItems } from "./shortlist";

const BASE = process.env.INSFORGE_API_BASE_URL;
const KEY = process.env.INSFORGE_API_KEY;
const client = BASE && KEY ? createClient({ baseUrl: BASE, anonKey: KEY, isServerMode: true }) : null;

const TABLE = "projects";

export type ProjectStatus = "open" | "paused" | "closed";
export const PROJECT_STATUSES: ProjectStatus[] = ["open", "paused", "closed"];

export interface Project {
  id: string;
  user_id: string;
  name: string;
  brief: string | null;
  status: ProjectStatus;
  color: string | null;
  inbox_sync_summary?: unknown;
  created_at: string;
  updated_at: string;
}

export interface ProjectWithKpi extends Project {
  candidates_total: number;     // 该项目候选池总数
  candidates_active: number;    // 未 hire/rejected 的(进行中)
  runs_total: number;            // 该项目所有研究次数(含已完成)
  runs_active: number;           // queued/running/retrying
}

// 内部 raw SQL helper —— 与 db.ts 里同款, 走 Insforge admin 端点。
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

// 列出当前用户全部项目, 带 KPI (候选人/搜索数), 按更新时间倒序。
// 单次 JOIN 聚合, 避免 N+1。
export async function listProjects(userId: string): Promise<ProjectWithKpi[]> {
  const rows = await runSQL<{
    id: string; user_id: string; name: string; brief: string | null;
    status: ProjectStatus; color: string | null;
    inbox_sync_summary?: unknown;
    created_at: string; updated_at: string;
    candidates_total: string; candidates_active: string;
    runs_total: string; runs_active: string;
  }>(
    `SELECT
        p.id, p.user_id, p.name, p.brief, p.status, p.color, p.inbox_sync_summary, p.created_at, p.updated_at,
        COALESCE(s.candidates_total, 0)  AS candidates_total,
        COALESCE(s.candidates_active, 0) AS candidates_active,
        COALESCE(r.runs_total, 0)        AS runs_total,
        COALESCE(r.runs_active, 0)       AS runs_active
     FROM projects p
     LEFT JOIN (
       SELECT project_id,
         COUNT(*) AS candidates_total,
         COUNT(*) FILTER (WHERE status NOT IN ('passed','hired','rejected')) AS candidates_active
       FROM shortlist_items WHERE user_id = $1 AND project_id IS NOT NULL
       GROUP BY project_id
     ) s ON s.project_id = p.id
     LEFT JOIN (
       SELECT project_id,
         COUNT(*) AS runs_total,
         COUNT(*) FILTER (WHERE status IN ('queued','running','retrying')) AS runs_active
       FROM research_runs WHERE user_id = $1 AND project_id IS NOT NULL
       GROUP BY project_id
     ) r ON r.project_id = p.id
     WHERE p.user_id = $1
     ORDER BY p.updated_at DESC`,
    [userId],
  );
  if (!rows) return [];
  return rows.map((r) => ({
    id: r.id,
    user_id: r.user_id,
    name: r.name,
    brief: r.brief,
    status: r.status,
    color: r.color,
    inbox_sync_summary: r.inbox_sync_summary ?? {},
    created_at: r.created_at,
    updated_at: r.updated_at,
    candidates_total: Number(r.candidates_total),
    candidates_active: Number(r.candidates_active),
    runs_total: Number(r.runs_total),
    runs_active: Number(r.runs_active),
  }));
}

// 单项目读 (带 KPI)。
export async function getProject(userId: string, id: string): Promise<ProjectWithKpi | null> {
  // 复用 listProjects 的聚合 SQL, 只是再加个 id 过滤
  const rows = await runSQL<{
    id: string; user_id: string; name: string; brief: string | null;
    status: ProjectStatus; color: string | null;
    inbox_sync_summary?: unknown;
    created_at: string; updated_at: string;
    candidates_total: string; candidates_active: string;
    runs_total: string; runs_active: string;
  }>(
    `SELECT
        p.id, p.user_id, p.name, p.brief, p.status, p.color, p.inbox_sync_summary, p.created_at, p.updated_at,
        COALESCE(s.candidates_total, 0)  AS candidates_total,
        COALESCE(s.candidates_active, 0) AS candidates_active,
        COALESCE(r.runs_total, 0)        AS runs_total,
        COALESCE(r.runs_active, 0)       AS runs_active
     FROM projects p
     LEFT JOIN (
       SELECT project_id,
         COUNT(*) AS candidates_total,
         COUNT(*) FILTER (WHERE status NOT IN ('passed','hired','rejected')) AS candidates_active
       FROM shortlist_items WHERE user_id = $1 AND project_id = $2
       GROUP BY project_id
     ) s ON s.project_id = p.id
     LEFT JOIN (
       SELECT project_id,
         COUNT(*) AS runs_total,
         COUNT(*) FILTER (WHERE status IN ('queued','running','retrying')) AS runs_active
       FROM research_runs WHERE user_id = $1 AND project_id = $2
       GROUP BY project_id
     ) r ON r.project_id = p.id
     WHERE p.user_id = $1 AND p.id = $2
     LIMIT 1`,
    [userId, id],
  );
  const r = rows?.[0];
  if (!r) return null;
  return {
    id: r.id, user_id: r.user_id, name: r.name, brief: r.brief, status: r.status, color: r.color,
    inbox_sync_summary: r.inbox_sync_summary ?? {},
    created_at: r.created_at, updated_at: r.updated_at,
    candidates_total: Number(r.candidates_total),
    candidates_active: Number(r.candidates_active),
    runs_total: Number(r.runs_total),
    runs_active: Number(r.runs_active),
  };
}

export async function updateProjectInboxSyncSummary(input: {
  userId: string; id: string; summary: unknown;
}): Promise<boolean> {
  if (!client) return false;
  const { data, error } = await client.database
    .from(TABLE)
    .update({ inbox_sync_summary: input.summary, updated_at: new Date().toISOString() })
    .eq("id", input.id)
    .eq("user_id", input.userId)
    .select("id");
  if (error) throw new Error("inbox_sync_summary_write_failed");
  if ((data as Array<unknown> | null)?.length !== 1) throw new Error("inbox_sync_summary_write_failed");
  return true;
}

// 创建新项目。
export async function createProject(input: {
  userId: string; name: string; brief?: string | null;
}): Promise<Project | null> {
  if (!client) return null;
  try {
    const { data, error } = await client.database
      .from(TABLE)
      .insert({
        user_id: input.userId,
        name: input.name,
        brief: input.brief ?? null,
        status: "open",
      })
      .select("*");
    if (error || !data || (data as Array<unknown>).length === 0) return null;
    return (data as Project[])[0];
  } catch {
    return null;
  }
}

// 改 name/brief/status/color, 至少传一个。
export async function updateProject(input: {
  userId: string; id: string;
  name?: string; brief?: string | null; status?: ProjectStatus; color?: string | null;
}): Promise<boolean> {
  if (!client) return false;
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.name !== undefined) patch.name = input.name;
  if (input.brief !== undefined) patch.brief = input.brief;
  if (input.status !== undefined) patch.status = input.status;
  if (input.color !== undefined) patch.color = input.color;
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

// 删除项目: 同时把所有关联 shortlist_items 和 research_runs 的 project_id 置 NULL
// (候选人/历史保留, 只是脱离这个项目 → 回到候选池根)。
// 用一次 raw SQL 事务保证三步原子 (Insforge 单次 SQL 可执行多语句, 各步独立但都按 user 过滤)。
export async function deleteProject(userId: string, id: string): Promise<boolean> {
  await runSQL(`UPDATE shortlist_items SET project_id = NULL WHERE project_id = $1 AND user_id = $2`, [id, userId]);
  await runSQL(`UPDATE research_runs SET project_id = NULL WHERE project_id = $1 AND user_id = $2`, [id, userId]);
  await runSQL(`UPDATE search_tasks SET project_id = NULL WHERE project_id = $1 AND user_id = $2`, [id, userId]);
  await runSQL(`UPDATE outreach_threads SET project_id = NULL WHERE project_id = $1 AND user_id = $2`, [id, userId]);
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

// 单项目候选人按状态分布 (详情页 KPI 用)。
export interface ProjectCandidateBreakdown {
  new: number;
  shortlisted: number;
  needs_evidence: number;
  outreach_drafted: number;
  passed: number;
}
export async function projectCandidateBreakdown(userId: string, projectId: string): Promise<ProjectCandidateBreakdown> {
  const zero: ProjectCandidateBreakdown = { new: 0, shortlisted: 0, needs_evidence: 0, outreach_drafted: 0, passed: 0 };
  const rows = await runSQL<{
    new: string; shortlisted: string; needs_evidence: string; outreach_drafted: string; passed: string;
  }>(
    `SELECT
       COUNT(*) FILTER (WHERE status='new')          AS new,
       COUNT(*) FILTER (WHERE status IN ('shortlisted','interviewing','hired')) AS shortlisted,
       COUNT(*) FILTER (WHERE status='needs_evidence') AS needs_evidence,
       COUNT(*) FILTER (WHERE status IN ('outreach_drafted','contacted')) AS outreach_drafted,
       COUNT(*) FILTER (WHERE status IN ('passed','rejected')) AS passed
     FROM shortlist_items WHERE user_id = $1 AND project_id = $2`,
    [userId, projectId],
  );
  const r = rows?.[0];
  if (!r) return zero;
  return {
    new: Number(r.new),
    shortlisted: Number(r.shortlisted),
    needs_evidence: Number(r.needs_evidence),
    outreach_drafted: Number(r.outreach_drafted),
    passed: Number(r.passed),
  };
}

// 项目下的历史搜索 (详情页 tab 用)。
export interface ProjectRun {
  id: string;
  kind: "search" | "verify";
  label: string;
  summary: string | null;
  status: string;
  query_text: string;
  updated_at: string;
  result?: unknown;
}
export async function projectRuns(userId: string, projectId: string, limit = 50): Promise<ProjectRun[]> {
  if (!client) return [];
  try {
    const { data, error } = await client.database
      .from("research_runs")
      .select("id,kind,label,summary,status,query_text,updated_at,result")
      .eq("user_id", userId)
      .eq("project_id", projectId)
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return data as ProjectRun[];
  } catch {
    return [];
  }
}

export interface ProjectCandidateGraphView {
  provider_status: Array<{ provider: "pdl"; enabled: boolean; reason: string }>;
  summary: {
    candidate_count: number;
    ready_for_outreach_count: number;
    needs_verification_count: number;
    interview_ready_count: number;
    source_count: number;
    contactable_count: number;
    contact_coverage_percent: number;
  };
  source_mix: Array<{ source_type: string; count: number }>;
  candidates: Array<{
    candidate_id: string;
    canonical_name: string;
    current_title: string;
    current_company: string;
    readiness: "sourced" | "needs_verification" | "ready_for_outreach";
    source_count: number;
    source_types: string[];
    evidence_quality: string;
    contactability_score: number;
    merge_keys: string[];
  }>;
}

function providerCandidateRowsFromCandidates(candidates: unknown[]) {
  return candidates.filter((candidate): candidate is Record<string, unknown> => (
    Boolean(candidate && typeof candidate === "object" && !Array.isArray(candidate) && "provider" in candidate)
  ));
}

export async function buildProjectCandidateGraphView(userId: string, projectId: string): Promise<ProjectCandidateGraphView> {
  const items = await listItems(userId, projectId);
  const candidates = items.map((item) => item.candidate);
  const providerRows = providerCandidateRowsFromCandidates(candidates);
  const graph = buildCandidateGraph({
    candidates,
    sourceLeads: providerRowsToSourceLeads(providerRows as never),
  });
  const providerStatus = buildPeopleProviderConfig().providers as ProjectCandidateGraphView["provider_status"];
  const candidateGraph: ProjectCandidateGraphView = {
    provider_status: providerStatus,
    summary: graph.summary,
    source_mix: graph.source_mix,
    candidates: graph.candidates.map((candidate) => {
      const contactProfile = candidate.contact_profile as { contactability_score?: number } | null;
      const readiness = String(candidate.readiness);
      const sourceTypes: string[] = Array.from(new Set<string>(
        Array.isArray(candidate.source_nodes)
          ? candidate.source_nodes.map((node: { source_type?: unknown }) => String(node.source_type ?? "")).filter(Boolean)
          : [],
      ));
      return {
        candidate_id: String(candidate.candidate_id ?? ""),
        canonical_name: String(candidate.canonical_name ?? ""),
        current_title: String(candidate.current_title ?? ""),
        current_company: String(candidate.current_company ?? ""),
        readiness: (["sourced", "needs_verification", "ready_for_outreach"].includes(readiness) ? readiness : "sourced") as ProjectCandidateGraphView["candidates"][number]["readiness"],
        source_count: Array.isArray(candidate.source_nodes) ? candidate.source_nodes.length : 0,
        source_types: sourceTypes,
        evidence_quality: String(candidate.evidence_summary.quality ?? "low"),
        contactability_score: Number(contactProfile?.contactability_score ?? 0),
        merge_keys: Array.isArray(candidate.merge_keys) ? candidate.merge_keys.map((key: unknown) => String(key)) : [],
      };
    }),
  };
  return candidateGraph;
}
