// worker/index.mjs —— SignalHire 异步研究 worker。
// 跑在 Insforge Compute (长时容器, 无请求超时) 或任意能跑 Node 的地方 (Railway 等)。
// 职责: 轮询 research_runs 里 status='queued' 的任务 → 认领 → 跑 MiroMind 深度研究(4-10分钟)
//        → 期间把进度写回该行 → 跑完写 result + status='done'(或 'error')。
//
// 环境变量: INSFORGE_API_BASE_URL, INSFORGE_API_KEY, MIROMIND_API_KEY/BASE_URL/MODEL
// 本地跑: node --env-file=../web/.env.local index.mjs   (或自备 .env)

import { createClient } from "@insforge/sdk";
import { streamResearch, parseJson, normalizeResult, searchPrompt, verifyPrompt } from "./lib.mjs";

const BASE = process.env.INSFORGE_API_BASE_URL;
const KEY = process.env.INSFORGE_API_KEY;
if (!BASE || !KEY) {
  console.error("缺少 INSFORGE_API_BASE_URL / INSFORGE_API_KEY");
  process.exit(1);
}
const db = createClient({ baseUrl: BASE, anonKey: KEY, isServerMode: true }).database;
const TABLE = "research_runs";
const POLL_MS = 4000; // 没任务时的轮询间隔
const PROGRESS_MS = 3000; // 进度写库节流

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 认领一个排队任务: 取最老的 queued, 原子置 running。返回任务行或 null。
async function claimNext() {
  const { data } = await db.from(TABLE)
    .select("id,kind,query_text")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(1);
  const job = data?.[0];
  if (!job) return null;
  // 原子认领: 仅当仍是 queued 时置 running
  const { data: claimed } = await db.from(TABLE)
    .update({ status: "running", updated_at: new Date().toISOString() })
    .eq("id", job.id).eq("status", "queued")
    .select("id");
  if (!claimed || claimed.length === 0) return null; // 被别人抢了
  return job;
}

function summarize(kind, data) {
  if (kind === "search") {
    const n = Array.isArray(data?.candidates) ? data.candidates.length : 0;
    return `${n} 位候选人`;
  }
  const claims = Array.isArray(data?.claims) ? data.claims : [];
  const contra = claims.filter((c) => c?.verdict === "contradicted").length;
  return `可信度 ${data?.overall_trust ?? "?"}${contra ? ` · ${contra} 矛盾` : ""}`;
}

async function runJob(job) {
  console.log(`[${new Date().toISOString()}] 认领任务 ${job.id} (${job.kind})`);
  const prompt = job.kind === "search" ? searchPrompt(job.query_text) : verifyPrompt(job.query_text);

  const recent = [];
  let lastWrite = 0;
  const onStep = (kind, info, searches, fetches) => {
    if (info) { recent.push({ kind, info: String(info).slice(0, 120) }); if (recent.length > 8) recent.shift(); }
    const now = Date.now();
    if (now - lastWrite > PROGRESS_MS) {
      lastWrite = now;
      // 节流写进度, 失败忽略 (不影响主研究)
      db.from(TABLE).update({ progress: { searches, fetches, recent }, updated_at: new Date().toISOString() })
        .eq("id", job.id).then(() => {}, () => {});
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
    if (!out) throw lastErr ?? new Error("研究失败");
    const data = normalizeResult(parseJson(out.content));
    if (!data) throw new Error("模型输出不是干净 JSON");
    const doneRow = {
      result: data,
      stats: { searches: out.searches, fetches: out.fetches },
      summary: summarize(job.kind, data),
      progress: { searches: out.searches, fetches: out.fetches, recent },
      status: "done",
      error: null,
      updated_at: new Date().toISOString(),
    };
    // 关键写库: 用 .select() 确认真的更新了行, 没成功就重试 (代理偶发会黑洞掉 PATCH 却返回 OK)。
    let saved = false;
    for (let i = 0; i < 4 && !saved; i++) {
      try {
        const { data: upd, error: e } = await db.from(TABLE).update(doneRow).eq("id", job.id).select("id");
        if (!e && upd && upd.length > 0) { saved = true; break; }
        console.error(`[${new Date().toISOString()}] ${job.id} 结果写库重试 ${i + 1}: ${e?.message || "0 行受影响"}`);
      } catch (er) {
        console.error(`[${new Date().toISOString()}] ${job.id} 结果写库重试 ${i + 1}: ${er?.message || er}`);
      }
      await sleep(2000);
    }
    if (!saved) throw new Error("结果写库失败 (多次重试未成功)");
    console.log(`[${new Date().toISOString()}] 完成 ${job.id}: 搜索 ${out.searches} 抓取 ${out.fetches}`);
  } catch (e) {
    // 标记失败 (await + try, 确保不把任务孤儿在 running)。重试一次以防同一次网络抖动连写库都掐了。
    const errStr = String(e?.message || e).slice(0, 500);
    for (let i = 0; i < 3; i++) {
      try {
        const { data: upd } = await db.from(TABLE).update({ status: "error", error: errStr, updated_at: new Date().toISOString() }).eq("id", job.id).select("id");
        if (upd && upd.length > 0) break;
      } catch {}
      await sleep(1500);
    }
    console.error(`[${new Date().toISOString()}] 任务 ${job.id} 失败:`, errStr);
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
