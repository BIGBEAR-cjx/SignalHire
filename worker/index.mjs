// worker/index.mjs —— SignalHire 异步研究 worker。
// 跑在 Insforge Compute (长时容器, 无请求超时) 或任意能跑 Node 的地方 (Railway 等)。
// 职责: 轮询 research_runs 里 queued/retrying 的任务 → 认领 → 跑 MiroMind 深度研究(4-10分钟)
//        → 期间把进度写回该行 → 跑完写 result + status='done'(或 retrying/error)。
//
// 环境变量: INSFORGE_API_BASE_URL, INSFORGE_API_KEY, MIROMIND_API_KEY/BASE_URL/MODEL, WORKER_CONCURRENCY(可选, 最大3)
// 本地跑: node --env-file=../web/.env.local index.mjs   (或自备 .env)

import { createServer } from "node:http";
import { createClient } from "@insforge/sdk";
import { streamResearch, parseJson, normalizeResult, searchPrompt, verifyPrompt } from "./lib.mjs";
import { buildOpenEvidenceLeadRowsForRun, runOpenEvidenceSourcePrecheck } from "./open-evidence-sources.mjs";
import { fillWorkerPool, normalizeWorkerConcurrency, waitForWorkerPool } from "./pool.mjs";
import { buildCandidateEvidenceSourceRowsForRun, buildCandidateProfileRowsForRun } from "./talent-profile.mjs";
import {
  buildRunFailureUpdate,
  buildRunStartUpdate,
  buildStaleRecoveryUpdate,
  isStaleRunningJob,
  maxAttempts,
} from "./job-state.mjs";

// 极简健康端口: 满足 Compute/Render 等"需要监听端口"的平台 (worker 本身是轮询, 不靠 HTTP)。
const PORT = process.env.PORT || 8080;
createServer((_req, res) => { res.writeHead(200, { "content-type": "text/plain" }); res.end("signalhire-worker ok\n"); })
  .listen(PORT, () => console.log(`health server on :${PORT}`));

const BASE = process.env.INSFORGE_API_BASE_URL;
const KEY = process.env.INSFORGE_API_KEY;
if (!BASE || !KEY) {
  console.error("缺少 INSFORGE_API_BASE_URL / INSFORGE_API_KEY");
  process.exit(1);
}
const db = createClient({ baseUrl: BASE, anonKey: KEY, isServerMode: true }).database;
const TABLE = "research_runs";
const CANDIDATE_PROFILE_TABLE = "candidate_profiles";
const CANDIDATE_EVIDENCE_SOURCE_TABLE = "candidate_evidence_sources";
const OPEN_EVIDENCE_LEAD_TABLE = "open_evidence_leads";
const POLL_MS = 4000; // 没任务时的轮询间隔
const PROGRESS_MS = 3000; // 进度写库节流
const MAX_CONCURRENT_JOBS = normalizeWorkerConcurrency(process.env.WORKER_CONCURRENCY);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 恢复卡在 running 太久的任务, 避免 worker 崩溃后永远转圈。
async function recoverStaleRunning() {
  const { data } = await db.from(TABLE)
    .select("id,status,attempt_count,max_attempts,locked_at,started_at,updated_at,progress")
    .eq("status", "running")
    .order("updated_at", { ascending: true })
    .limit(10);
  const stale = (data ?? []).filter((row) => isStaleRunningJob(row));
  for (const row of stale) {
    const { data: upd } = await db.from(TABLE)
      .update(buildStaleRecoveryUpdate(row))
      .eq("id", row.id)
      .eq("status", "running")
      .select("id");
    if (upd && upd.length > 0) {
      console.warn(`[${new Date().toISOString()}] 恢复超时任务 ${row.id}, 重新排队重试`);
    }
  }
}

// 认领一个排队/待重试任务: 取最老任务, 原子置 running。返回任务行或 null。
async function claimByStatus(status) {
  const { data } = await db.from(TABLE)
    .select("id,kind,query_text,progress,attempt_count,max_attempts,user_id,project_id,search_task_id")
    .eq("status", status)
    .order("created_at", { ascending: true })
    .limit(1);
  const job = data?.[0];
  if (!job) return null;
  const nextAttempt = Number(job.attempt_count ?? 0) + 1;
  const max = maxAttempts(job);
  if (nextAttempt > max) {
    await db.from(TABLE).update({
      status: "error",
      error: "已达到最大重试次数",
      last_error: "已达到最大重试次数",
      updated_at: new Date().toISOString(),
    }).eq("id", job.id).eq("status", status).select("id");
    return null;
  }
  // 原子认领: 仅当仍是目标状态时置 running
  const { data: claimed } = await db.from(TABLE)
    .update({ ...buildRunStartUpdate(), attempt_count: nextAttempt, max_attempts: max })
    .eq("id", job.id).eq("status", status)
    .select("id");
  if (!claimed || claimed.length === 0) return null; // 被别人抢了
  return { ...job, attempt_count: nextAttempt, max_attempts: max };
}

async function claimNext() {
  await recoverStaleRunning();
  return (await claimByStatus("queued")) ?? (await claimByStatus("retrying"));
}

function summarize(kind, data) {
  if (kind === "search") {
    const candidates = Array.isArray(data?.candidates) ? data.candidates : [];
    const top = candidates.slice(0, 3).map((c) => `${c?.name ?? "候选人"} ${c?.match_score ?? 0}`).join(", ");
    return `${candidates.length} 位 AI 候选人${top ? ` · ${top}` : ""}`;
  }
  const claims = Array.isArray(data?.claims) ? data.claims : [];
  const contra = claims.filter((c) => c?.verdict === "contradicted").length;
  return `可信度 ${data?.overall_trust ?? "?"}${contra ? ` · ${contra} 矛盾` : ""}`;
}

async function upsertCandidateProfilesForRun({ userId, sourceRunId, observedAt, result }) {
  const rows = buildCandidateProfileRowsForRun({ userId, sourceRunId, observedAt, result });
  if (rows.length === 0) return 0;
  try {
    const { error } = await db.from(CANDIDATE_PROFILE_TABLE).upsert(rows, { onConflict: "cache_key" });
    if (error) {
      console.warn(`[${new Date().toISOString()}] 候选人缓存写入失败: ${error.message || error}`);
      return 0;
    }
    return rows.length;
  } catch (e) {
    console.warn(`[${new Date().toISOString()}] 候选人缓存写入失败: ${e?.message || e}`);
    return 0;
  }
}

async function upsertCandidateEvidenceSourcesForRun({ userId, sourceRunId, observedAt, result }) {
  const rows = buildCandidateEvidenceSourceRowsForRun({ userId, sourceRunId, observedAt, result });
  if (rows.length === 0) return 0;
  try {
    const { error } = await db.from(CANDIDATE_EVIDENCE_SOURCE_TABLE).upsert(rows, { onConflict: "cache_key" });
    if (error) {
      console.warn(`[${new Date().toISOString()}] 候选人证据来源写入失败: ${error.message || error}`);
      return 0;
    }
    return rows.length;
  } catch (e) {
    console.warn(`[${new Date().toISOString()}] 候选人证据来源写入失败: ${e?.message || e}`);
    return 0;
  }
}

async function upsertOpenEvidenceLeadsForRun({ userId, sourceRunId, queryText, observedAt, leads }) {
  const rows = buildOpenEvidenceLeadRowsForRun({ userId, sourceRunId, queryText, observedAt, leads });
  if (rows.length === 0) return 0;
  try {
    const { error } = await db.from(OPEN_EVIDENCE_LEAD_TABLE).upsert(rows, { onConflict: "cache_key" });
    if (error) {
      console.warn(`[${new Date().toISOString()}] 开放证据预检线索写入失败: ${error.message || error}`);
      return 0;
    }
    return rows.length;
  } catch (e) {
    console.warn(`[${new Date().toISOString()}] 开放证据预检线索写入失败: ${e?.message || e}`);
    return 0;
  }
}

function formatOpenEvidenceProviderStats(providerStats = {}) {
  return Object.entries(providerStats)
    .map(([provider, stat]) => {
      const status = stat?.status || stat?.error || "unknown";
      return `${provider}:status=${status},attempts=${stat?.attempts ?? 0},leads=${stat?.lead_count ?? 0},ms=${stat?.duration_ms ?? 0}`;
    })
    .join(" | ");
}

function openEvidenceMaxQueries() {
  const value = Number(process.env.OPEN_EVIDENCE_MAX_QUERIES ?? 4);
  if (!Number.isFinite(value)) return 4;
  return Math.max(1, Math.min(8, Math.round(value)));
}

function envFlag(value) {
  return /^(1|true|yes|on)$/i.test(cleanString(value));
}

function boundedEnvInt(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function maigretProviderOptions() {
  return {
    enabled: envFlag(process.env.MAIGRET_ENABLED),
    command: process.env.MAIGRET_COMMAND || "maigret",
    maxAliases: boundedEnvInt(process.env.MAIGRET_MAX_ALIASES, 3, 1, 5),
    timeoutMs: boundedEnvInt(process.env.MAIGRET_TIMEOUT_MS, 90000, 5000, 180000),
    topSites: boundedEnvInt(process.env.MAIGRET_TOP_SITES, 200, 20, 500),
    tags: process.env.MAIGRET_TAGS || "coding,global,us",
    excludeTags: process.env.MAIGRET_EXCLUDE_TAGS || "dating,nsfw,porn",
  };
}

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function cleanStringArray(value, limit = 20) {
  return Array.isArray(value) ? value.map(cleanString).filter(Boolean).slice(0, limit) : [];
}

function normalizeCount(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n));
}

function clampScore(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function evidenceUrls(candidate) {
  return candidateEvidenceUrls(candidate);
}

function evidenceSourceTypes(candidate) {
  const types = new Set();
  for (const claim of Array.isArray(candidate?.claims) ? candidate.claims : []) {
    for (const evidence of Array.isArray(claim?.evidence) ? claim.evidence : []) {
      const type = cleanString(evidence?.source_type);
      if (type) types.add(type);
    }
  }
  return [...types];
}

function independentSourceCount(candidate) {
  const hosts = new Set();
  for (const url of evidenceUrls(candidate)) {
    try { hosts.add(new URL(url).hostname.replace(/^www\./, "")); }
    catch { hosts.add(url); }
  }
  return hosts.size || evidenceSourceTypes(candidate).length;
}

function candidateRoleText(candidate) {
  return [candidate?.current_role, candidate?.current_company].map(cleanString).filter(Boolean).join(" / ") || cleanString(candidate?.headline);
}

function executionTraceFromProgress(strategy, recent, searches, fetches) {
  const channelTrace = (Array.isArray(strategy?.channels) ? strategy.channels : []).map((channel, index) => {
    const sourceTypes = cleanStringArray(channel?.source_types, 3);
    const sourceType = sourceTypes[0] || "other";
    const query = cleanStringArray(channel?.query_variants, 1)[0] || cleanString(channel?.label);
    return {
      trace_id: `strategy-${index + 1}-${cleanString(channel?.key) || sourceType}`,
      tool: cleanString(channel?.label) || sourceType,
      source_type: sourceType,
      coverage_group: cleanString(channel?.coverage_group) || "practice",
      query,
      status: searches > 0 || fetches > 0 ? "running" : "planned",
      candidates_found: 0,
      evidence_found: 0,
      duration_ms: 0,
      note: cleanString(channel?.reason),
    };
  });
  const recentTrace = (Array.isArray(recent) ? recent : []).slice(-8).map((item, index) => {
    const detail = cleanString(item?.info);
    return {
      trace_id: `live-${index + 1}-${item?.kind || "step"}`,
      tool: item?.kind === "fetch" ? "fetch_url_content" : "web_search",
      source_type: item?.kind === "fetch" ? "source" : "search",
      coverage_group: "practice",
      query: detail,
      status: "completed",
      candidates_found: 0,
      evidence_found: item?.kind === "fetch" ? 1 : 0,
      duration_ms: 0,
      note: detail,
    };
  });
  return [...channelTrace, ...recentTrace].slice(0, 24);
}

function finalExecutionTrace(result, strategy, recent, searches, fetches) {
  const jobs = Array.isArray(result?.source_execution?.jobs) ? result.source_execution.jobs : [];
  if (jobs.length > 0) {
    return jobs.map((job, index) => {
      const sourceType = cleanString(job?.source_type) || "other";
      return {
        trace_id: cleanString(job?.job_id) || `source-${index + 1}-${sourceType}`,
        tool: sourceType,
        source_type: sourceType,
        coverage_group: cleanString(job?.coverage_group) || "practice",
        query: cleanString(job?.query),
        status: cleanString(job?.status) || "planned",
        candidates_found: cleanStringArray(job?.candidate_leads, 20).length,
        evidence_found: normalizeCount(job?.evidence_found) || normalizeCount(job?.urls_found),
        duration_ms: 0,
        note: cleanString(job?.next_action) || cleanString(job?.error),
      };
    }).slice(0, 24);
  }
  return executionTraceFromProgress(strategy, recent, searches, fetches);
}

function candidateSubmissionEvents(result) {
  const candidates = Array.isArray(result?.candidates) ? result.candidates : [];
  return candidates.map((candidate, index) => {
    const sourceTypes = evidenceSourceTypes(candidate);
    return {
      row_id: `candidate-${index + 1}`,
      candidate_index: index,
      name: cleanString(candidate?.name) || "Unknown candidate",
      role: candidateRoleText(candidate),
      source: sourceTypes[0] || "search",
      match_score: clampScore(candidate?.match_score),
      evidence_quality: cleanString(candidate?.evidence_audit?.overall_evidence_quality) || "medium",
      independent_sources: independentSourceCount(candidate),
      reason: cleanStringArray(candidate?.strongest_signals, 1)[0] || cleanString(candidate?.summary) || cleanString(candidate?.headline),
      status: "submitted",
    };
  });
}

function candidateClusterKey(candidate) {
  const score = clampScore(candidate?.match_score);
  const quality = cleanString(candidate?.evidence_audit?.overall_evidence_quality) || "medium";
  const sources = independentSourceCount(candidate);
  if (score >= 75 && quality === "high" && sources >= 2) return "high_confidence";
  if (quality === "low" || sources < 2 || cleanStringArray(candidate?.uncertainties, 4).length > 0) return "needs_verification";
  if (score >= 60) return "adjacent_pool";
  return "lower_confidence";
}

function deliveryClusters(result, platformLanguage) {
  const zh = platformLanguage !== "English";
  const meta = {
    high_confidence: [zh ? "高置信候选人" : "High-confidence matches", zh ? "优先审阅并起草外联。" : "Review first and draft outreach."],
    needs_verification: [zh ? "需要补证据" : "Needs verification", zh ? "先补证据，再决定是否触达。" : "Backfill evidence before outreach."],
    adjacent_pool: [zh ? "相邻人才池" : "Adjacent pool", zh ? "作为下一轮搜索种子。" : "Use as next-round search seeds."],
    lower_confidence: [zh ? "低置信线索" : "Lower-confidence leads", zh ? "暂不优先推进，作为反馈样本。" : "Keep as feedback before prioritizing."],
  };
  const candidates = Array.isArray(result?.candidates) ? result.candidates : [];
  return Object.keys(meta).map((key) => {
    const candidate_indices = candidates
      .map((candidate, index) => ({ candidate, index }))
      .filter((item) => candidateClusterKey(item.candidate) === key)
      .map((item) => item.index);
    return {
      key,
      label: meta[key][0],
      candidate_indices,
      rationale: meta[key][0],
      next_action: meta[key][1],
    };
  }).filter((cluster) => cluster.candidate_indices.length > 0);
}

function sourceMixFromResult(result) {
  if (Array.isArray(result?.evidence_graph?.source_mix) && result.evidence_graph.source_mix.length > 0) {
    return result.evidence_graph.source_mix.map((item) => ({
      source_type: cleanString(item?.source_type) || "other",
      count: normalizeCount(item?.count),
    })).filter((item) => item.source_type);
  }
  const counts = new Map();
  for (const candidate of Array.isArray(result?.candidates) ? result.candidates : []) {
    for (const type of evidenceSourceTypes(candidate)) counts.set(type, (counts.get(type) ?? 0) + 1);
  }
  return [...counts.entries()].map(([source_type, count]) => ({ source_type, count }));
}

function queryTerms(queryText) {
  const terms = cleanString(queryText)
    .split(/[，,、/|；;：:\s\n]+/g)
    .map((term) => term.trim())
    .filter((term) => term.length >= 2 && term.length <= 32)
    .filter((term) => !/^(岗位|职责|要求|负责|候选人|经验|以上|不限|远程|薪资|工作|search|find|with|and|or|the|for)$/i.test(term));
  return [...new Set(terms)].slice(0, 8);
}

function fallbackQuery(queryText, suffix) {
  const terms = queryTerms(queryText);
  return `${terms.length ? terms.join(" ") : cleanString(queryText) || "AI talent"} ${suffix}`.trim();
}

function buildFallbackAgentSearchStrategy(queryText, platformLanguage) {
  const zh = platformLanguage !== "English";
  const channels = [
    ["people-profile", zh ? "人才档案 / 公开履历" : "People profiles", "work_history", ["profile", "company"], ["LinkedIn profile current role", "company team public profile"], zh ? "核验角色、公司和职业轨迹。" : "Verify role, company, and career trajectory."],
    ["open-source", zh ? "开源与项目实践" : "Open-source practice", "practice", ["code", "project"], ["site:github.com repository contributor", "project demo builder"], zh ? "找到工程实现证据。" : "Find implementation evidence."],
    ["research", zh ? "研究与 benchmark" : "Research and benchmarks", "research", ["paper", "benchmark"], ["site:arxiv.org OR site:openreview.net", "site:paperswithcode.com benchmark"], zh ? "核验研究和 benchmark 产出。" : "Check research and benchmark work."],
    ["public-voice", zh ? "公开表达" : "Public voice", "public_voice", ["blog", "talk"], ["blog talk podcast interview", "conference webinar article"], zh ? "核验公开表达和影响力。" : "Verify public judgment and influence."],
    ["adjacent-pool", zh ? "相邻人才池" : "Adjacent talent pools", "practice", ["community", "profile"], ["adjacent founder builder operator", "community contributor"], zh ? "扩展相邻候选池。" : "Expand adjacent candidate pools."],
  ].map(([key, label, coverage_group, source_types, suffixes, reason]) => ({
    key,
    label,
    coverage_group,
    source_types,
    query_variants: suffixes.map((suffix) => fallbackQuery(queryText, suffix)),
    reason,
  }));
  return {
    summary: zh ? `先按 ${channels.length} 条证据路线多渠道搜人，再排序。` : `Plan multi-channel sourcing across ${channels.length} evidence routes before ranking.`,
    channels,
    target_segments: [
      { key: "primary-fit", label: zh ? "精准匹配" : "Primary matches", reason: zh ? "直接满足岗位核心条件。" : "Directly satisfies the core brief." },
      { key: "evidence-strong", label: zh ? "证据强候选人" : "Evidence-strong candidates", reason: zh ? "具备多源公开证据。" : "Has multiple independent public sources." },
      { key: "adjacent-transferable", label: zh ? "相邻可迁移人才" : "Adjacent transferable pool", reason: zh ? "精准匹配不足时补充验证。" : "Useful when exact matches are scarce." },
    ],
    evidence_priorities: [
      zh ? "没有具体 URL 的 claim 不能标记为 verified。" : "Do not mark claims verified without concrete URLs.",
      zh ? "单一来源候选人必须保留在待核验分组。" : "Keep single-source candidates in verification buckets.",
    ],
  };
}

function attachAgentExecutionLayer({ result, strategy, recent, searches, fetches, durationMs, platformLanguage }) {
  if (!isPlainObject(result)) return result;
  const trace = finalExecutionTrace(result, strategy, recent, searches, fetches);
  const submissions = candidateSubmissionEvents(result);
  return {
    ...result,
    agent_execution: {
      ...(isPlainObject(result.agent_execution) ? result.agent_execution : {}),
      search_strategy: strategy,
      execution_trace: trace,
      candidate_submission_events: submissions,
      delivery_clusters: deliveryClusters(result, platformLanguage),
      telemetry: {
        duration_ms: normalizeCount(durationMs),
        search_count: normalizeCount(searches),
        fetch_count: normalizeCount(fetches),
        tool_count: trace.length,
        submitted_count: submissions.length,
        source_mix: sourceMixFromResult(result),
      },
    },
  };
}

function candidateEvidenceUrls(candidate) {
  const urls = new Set();
  for (const claim of Array.isArray(candidate?.claims) ? candidate.claims : []) {
    for (const evidence of Array.isArray(claim?.evidence) ? claim.evidence : []) {
      const url = cleanString(evidence?.url);
      if (url) urls.add(url);
    }
  }
  return [...urls];
}

function candidateDiscoveryKey(candidate) {
  const name = cleanString(candidate?.name).toLowerCase();
  const company = cleanString(candidate?.current_company).toLowerCase();
  const role = cleanString(candidate?.current_role).toLowerCase();
  return [name, company, role].filter(Boolean).join(":") || name;
}

async function knownCandidateProfiles(userId) {
  try {
    const { data, error } = await db.from(CANDIDATE_PROFILE_TABLE)
      .select("cache_key,name,current_role,current_company,evidence_urls")
      .eq("user_id", userId)
      .order("last_seen_at", { ascending: false })
      .limit(500);
    if (error || !data) return [];
    return data;
  } catch {
    return [];
  }
}

async function attachTaskDiscovery({ userId, result }) {
  if (!result || typeof result !== "object" || !Array.isArray(result.candidates)) return result;
  const known = await knownCandidateProfiles(userId);
  const knownByKey = new Map();
  const knownByBareName = new Map();
  for (const profile of known) {
    const key = candidateDiscoveryKey(profile);
    const name = cleanString(profile?.name).toLowerCase();
    if (key) knownByKey.set(key, profile);
    if (name && !cleanString(profile?.current_company) && !cleanString(profile?.current_role)) {
      knownByBareName.set(name, profile);
    }
  }
  const items = result.candidates.map((candidate, index) => {
    const candidateHasIdentityContext = Boolean(cleanString(candidate?.current_company) || cleanString(candidate?.current_role));
    const profile = knownByKey.get(candidateDiscoveryKey(candidate)) ?? (candidateHasIdentityContext ? null : knownByBareName.get(cleanString(candidate?.name).toLowerCase())) ?? null;
    const urls = candidateEvidenceUrls(candidate);
    const knownUrls = new Set(Array.isArray(profile?.evidence_urls) ? profile.evidence_urls : []);
    const evidenceUpdated = Boolean(profile && urls.some((url) => !knownUrls.has(url)));
    return {
      candidate_index: index,
      cache_key: candidateDiscoveryKey(candidate),
      name: cleanString(candidate?.name) || "Unknown candidate",
      discovery_state: profile ? "seen_before" : "new_candidate",
      evidence_updated: evidenceUpdated,
      evidence_urls: urls,
    };
  });
  result.task_discovery = {
    summary: {
      new_candidates: items.filter((item) => item.discovery_state === "new_candidate").length,
      seen_candidates: items.filter((item) => item.discovery_state === "seen_before").length,
      updated_candidates: items.filter((item) => item.evidence_updated).length,
    },
    items,
  };
  return result;
}

async function runOpenEvidencePrecheck(queryText, searchStrategy = null) {
  try {
    const result = await runOpenEvidenceSourcePrecheck(queryText, {
      apiKeys: {
        github: process.env.GITHUB_TOKEN || process.env.GITHUB_API_KEY,
        semantic_scholar: process.env.SEMANTIC_SCHOLAR_API_KEY,
        openalex: process.env.OPENALEX_API_KEY,
        huggingface: process.env.HF_TOKEN || process.env.HUGGINGFACE_TOKEN,
        anysearch: process.env.ANYSEARCH_API_KEY,
      },
      maxQueries: openEvidenceMaxQueries(),
      searchStrategy,
      maigret: maigretProviderOptions(),
    });
    const stats = formatOpenEvidenceProviderStats(result.provider_stats);
    if (stats) console.log(`[${new Date().toISOString()}] 开放证据预检统计: ${stats}`);
    if (result.errors.length > 0) {
      console.warn(`[${new Date().toISOString()}] 开放证据预检部分失败: ${JSON.stringify(result.errors).slice(0, 500)}`);
    }
    return result.leads;
  } catch (e) {
    console.warn(`[${new Date().toISOString()}] 开放证据预检失败: ${e?.message || e}`);
    return [];
  }
}

async function runJob(job) {
  console.log(`[${new Date().toISOString()}] 认领任务 ${job.id} (${job.kind})`);
  const queryText = typeof job.progress?.original_query === "string" ? job.progress.original_query : job.query_text;
  const platformLanguage = typeof job.progress?.platform_language === "string" ? job.progress.platform_language : undefined;
  const candidateHints = Array.isArray(job.progress?.candidate_profile_hints) ? job.progress.candidate_profile_hints : [];
  const agentExecutionProgress = isPlainObject(job.progress?.agent_execution) ? job.progress.agent_execution : {};
  const agentSearchStrategy = isPlainObject(agentExecutionProgress.search_strategy)
    ? agentExecutionProgress.search_strategy
    : buildFallbackAgentSearchStrategy(queryText, platformLanguage);
  const openEvidenceLeads = job.kind === "search" ? await runOpenEvidencePrecheck(queryText, agentSearchStrategy) : [];
  if (job.kind === "search") {
    await upsertOpenEvidenceLeadsForRun({
      userId: job.user_id,
      sourceRunId: job.id,
      queryText,
      observedAt: new Date().toISOString(),
      leads: openEvidenceLeads,
    });
  }
  const prompt = job.kind === "search" ? searchPrompt(queryText, platformLanguage, candidateHints, openEvidenceLeads, agentSearchStrategy) : verifyPrompt(queryText, platformLanguage);

  const recent = [];
  let lastWrite = 0;
  const startedAtMs = Date.now();
  const onStep = (kind, info, searches, fetches) => {
    if (info) { recent.push({ kind, info: String(info).slice(0, 120) }); if (recent.length > 8) recent.shift(); }
    const now = Date.now();
    if (now - lastWrite > PROGRESS_MS) {
      lastWrite = now;
      // 节流写进度, 失败忽略 (不影响主研究)
      db.from(TABLE).update({
        progress: {
          searches,
          fetches,
          recent,
          agent_execution: {
            search_strategy: agentSearchStrategy,
            execution_trace: executionTraceFromProgress(agentSearchStrategy, recent, searches, fetches),
          },
        },
        updated_at: new Date().toISOString(),
      })
        .eq("id", job.id).eq("status", "running").then(() => {}, () => {});
    }
  };

  try {
    // 带重试: MiroMind 长连接偶发被网络掐断(terminated), 重试整次研究。
    let out, lastErr;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try { out = await streamResearch(prompt, onStep); break; }
      catch (e) {
        lastErr = e;
        console.error(`[${new Date().toISOString()}] ${job.id} 第${attempt}次失败: ${e?.message || e}${attempt < 3 ? ", 重试" : ""}`);
      }
    }
    if (!out) throw lastErr ?? new Error();
    let data = normalizeResult(parseJson(out.content));
    if (!data) throw new Error("模型输出不是干净 JSON");
    const finishedAt = new Date().toISOString();
    if (job.kind === "search" && job.search_task_id) {
      await attachTaskDiscovery({ userId: job.user_id, result: data });
    }
    if (job.kind === "search") {
      data = attachAgentExecutionLayer({
        result: data,
        strategy: agentSearchStrategy,
        recent,
        searches: out.searches,
        fetches: out.fetches,
        durationMs: Date.now() - startedAtMs,
        platformLanguage,
      });
      await db.from(TABLE).update({
        progress: {
          searches: out.searches,
          fetches: out.fetches,
          recent,
          agent_execution: data.agent_execution,
        },
        updated_at: finishedAt,
      }).eq("id", job.id).eq("status", "running").then(() => {}, () => {});
    }
    const doneRow = {
      result: data,
      stats: { searches: out.searches, fetches: out.fetches, duration_ms: Date.now() - startedAtMs },
      summary: summarize(job.kind, data),
      progress: { searches: out.searches, fetches: out.fetches, recent, agent_execution: data?.agent_execution ?? agentExecutionProgress },
      status: "done",
      error: null,
      last_error: null,
      locked_at: null,
      finished_at: finishedAt,
      updated_at: finishedAt,
    };
    // 关键写库: 用 .select() 确认真的更新了行, 没成功就重试 (代理偶发会黑洞掉 PATCH 却返回 OK)。
    let saved = false;
    for (let i = 0; i < 4 && !saved; i++) {
      try {
        const { data: upd, error: e } = await db.from(TABLE).update(doneRow).eq("id", job.id).eq("status", "running").select("id");
        if (!e && upd && upd.length > 0) { saved = true; break; }
        console.error(`[${new Date().toISOString()}] ${job.id} 结果写库重试 ${i + 1}: ${e?.message || "0 行受影响"}`);
      } catch (er) {
        console.error(`[${new Date().toISOString()}] ${job.id} 结果写库重试 ${i + 1}: ${er?.message || er}`);
      }
      await sleep(2000);
    }
    if (!saved) throw new Error("结果写库失败 (多次重试未成功)");
    if (job.kind === "search") {
      await upsertCandidateProfilesForRun({
        userId: job.user_id,
        sourceRunId: job.id,
        observedAt: finishedAt,
        result: data,
      });
      await upsertCandidateEvidenceSourcesForRun({
        userId: job.user_id,
        sourceRunId: job.id,
        observedAt: finishedAt,
        result: data,
      });
    }
    console.log(`[${new Date().toISOString()}] 完成 ${job.id}: 搜索 ${out.searches} 抓取 ${out.fetches}`);
  } catch (e) {
    // 标记失败或待重试 (await + try, 确保不把任务孤儿在 running)。
    const failureRow = buildRunFailureUpdate({
      attemptCount: Number(job.attempt_count ?? 1),
      maxAttempts: maxAttempts(job),
      error: e,
      locale: platformLanguage,
    });
    for (let i = 0; i < 3; i++) {
      try {
        const { data: upd } = await db.from(TABLE).update(failureRow).eq("id", job.id).eq("status", "running").select("id");
        if (upd && upd.length > 0) break;
      } catch {}
      await sleep(1500);
    }
    console.error(`[${new Date().toISOString()}] 任务 ${job.id} ${failureRow.status === "retrying" ? "等待重试" : "失败"}:`, failureRow.last_error);
  }
}

const activeJobs = new Set();

console.log(`SignalHire worker 启动, 轮询 ${TABLE} (每 ${POLL_MS}ms, 最多 ${MAX_CONCURRENT_JOBS} 个并发任务)…`);
for (;;) {
  try {
    await fillWorkerPool({
      activeJobs,
      maxConcurrentJobs: MAX_CONCURRENT_JOBS,
      claimNext,
      runJob,
      onError: (e) => console.error("任务运行出错:", e?.message || e),
    });
    await waitForWorkerPool({ activeJobs, sleep, pollMs: POLL_MS });
  } catch (e) {
    console.error("轮询出错:", e?.message || e);
    await sleep(POLL_MS);
  }
}
