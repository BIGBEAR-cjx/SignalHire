// worker/index.mjs —— SignalHire 异步研究 worker。
// 跑在 Insforge Compute (长时容器, 无请求超时) 或任意能跑 Node 的地方 (Railway 等)。
// 职责: 轮询 research_runs 里 queued/retrying 的任务 → 认领 → 跑 MiroMind 深度研究(4-10分钟)
//        → 期间把进度写回该行 → 跑完写 result + status='done'(或 retrying/error)。
//
// 环境变量: INSFORGE_API_BASE_URL, INSFORGE_API_KEY, MIROMIND_API_KEY/BASE_URL/MODEL
// 本地跑: node --env-file=../web/.env.local index.mjs   (或自备 .env)

import { createServer } from "node:http";
import { createClient } from "@insforge/sdk";
import { streamResearch, parseJson, normalizeResult, searchPrompt, verifyPrompt } from "./lib.mjs";
import { buildOpenEvidenceLeadRowsForRun, runOpenEvidenceSourcePrecheck } from "./open-evidence-sources.mjs";
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
    .select("id,kind,query_text,progress,attempt_count,max_attempts,user_id")
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

async function runOpenEvidencePrecheck(queryText) {
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
  const openEvidenceLeads = job.kind === "search" ? await runOpenEvidencePrecheck(queryText) : [];
  if (job.kind === "search") {
    await upsertOpenEvidenceLeadsForRun({
      userId: job.user_id,
      sourceRunId: job.id,
      queryText,
      observedAt: new Date().toISOString(),
      leads: openEvidenceLeads,
    });
  }
  const prompt = job.kind === "search" ? searchPrompt(queryText, platformLanguage, candidateHints, openEvidenceLeads) : verifyPrompt(queryText, platformLanguage);

  const recent = [];
  let lastWrite = 0;
  const onStep = (kind, info, searches, fetches) => {
    if (info) { recent.push({ kind, info: String(info).slice(0, 120) }); if (recent.length > 8) recent.shift(); }
    const now = Date.now();
    if (now - lastWrite > PROGRESS_MS) {
      lastWrite = now;
      // 节流写进度, 失败忽略 (不影响主研究)
      db.from(TABLE).update({ progress: { searches, fetches, recent }, updated_at: new Date().toISOString() })
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
    const data = normalizeResult(parseJson(out.content));
    if (!data) throw new Error("模型输出不是干净 JSON");
    const finishedAt = new Date().toISOString();
    const doneRow = {
      result: data,
      stats: { searches: out.searches, fetches: out.fetches },
      summary: summarize(job.kind, data),
      progress: { searches: out.searches, fetches: out.fetches, recent },
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

console.log(`SignalHire worker 启动, 轮询 ${TABLE} (每 ${POLL_MS}ms)…`);
for (;;) {
  try {
    const job = await claimNext();
    if (job) await runJob(job);
    else await sleep(POLL_MS);
  } catch (e) {
    console.error("轮询出错:", e?.message || e);
    await sleep(POLL_MS);
  }
}
