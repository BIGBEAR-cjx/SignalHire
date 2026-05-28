// scripts/verify-live-research-job.mjs —— 通过本地/部署的 web API 跑一次真实非缓存研究任务。
// 前置: web server 已启动, worker 已启动, .env.local 已配置 Insforge + MiroMind。
// 用法: node --env-file=.env.local scripts/verify-live-research-job.mjs

import { setTimeout as sleep } from "node:timers/promises";

const APP_BASE_URL = process.env.APP_BASE_URL || "http://127.0.0.1:3000";
const MODE = process.env.RESEARCH_VERIFY_MODE || "search";
const POLL_MS = Number(process.env.RESEARCH_VERIFY_POLL_MS || 5000);
const TIMEOUT_MS = Number(process.env.RESEARCH_VERIFY_TIMEOUT_MS || 20 * 60 * 1000);
const unique = new Date().toISOString();

const input =
  MODE === "verify"
    ? {
        path: "/api/verify",
        body: {
          bio: `Verification smoke test ${unique}. Candidate claims they invented a private test-only distributed database.`,
        },
      }
    : {
        path: "/api/search",
        body: {
          query: `SignalHire live reliability smoke test ${unique} niche distributed systems recruiter`,
        },
      };

async function jsonFetch(path, init) {
  const res = await fetch(new URL(path, APP_BASE_URL), init);
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`${path} returned non-JSON (${res.status}): ${text.slice(0, 300)}`);
  }
  if (!res.ok) {
    throw new Error(`${path} failed (${res.status}): ${JSON.stringify(body)}`);
  }
  return body;
}

console.log(`Submitting ${MODE} job to ${APP_BASE_URL}${input.path}`);
const queued = await jsonFetch(input.path, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(input.body),
});

if (!queued?.queued || !queued?.jobId) {
  throw new Error(`Expected queued job response, got: ${JSON.stringify(queued)}`);
}

const started = Date.now();
let lastPhase = "";
console.log(`jobId=${queued.jobId}`);

for (;;) {
  if (Date.now() - started > TIMEOUT_MS) {
    throw new Error(`Timed out after ${Math.round(TIMEOUT_MS / 1000)}s waiting for job ${queued.jobId}`);
  }

  const status = await jsonFetch(`/api/status?id=${encodeURIComponent(queued.jobId)}`);
  const phase = status?.status_view?.phase || status?.status;
  if (!status?.status_view) {
    throw new Error(`/api/status missing status_view: ${JSON.stringify(status)}`);
  }
  if (phase !== lastPhase) {
    lastPhase = phase;
    console.log(`phase=${phase} attempts=${status.attempt_count}/${status.max_attempts} detail=${status.status_view.detail}`);
  }

  if (status.status === "done") {
    if (!status.result) throw new Error("Job reached done without result");
    console.log(`live research job ok: ${queued.jobId}`);
    break;
  }
  if (status.status === "error") {
    throw new Error(`Job ended in error: ${status.error || status.last_error || "unknown error"}`);
  }

  await sleep(POLL_MS);
}
