// scripts/verify-live-research-job.mjs —— 通过本地/部署的 web API 跑一次真实非缓存研究任务。
// 前置: web server 已启动, worker 已启动, .env.local 已配置 Insforge + MiroMind。
// 用法: node --env-file=.env.local scripts/verify-live-research-job.mjs

import { setTimeout as sleep } from "node:timers/promises";
import { randomUUID } from "node:crypto";
import { assertTalentPayload, resolveAuthCookie } from "./verify-live-research-job-utils.mjs";

const APP_BASE_URL = process.env.APP_BASE_URL || "http://127.0.0.1:3000";
const MODE = process.env.RESEARCH_VERIFY_MODE || "search";
const POLL_MS = Number(process.env.RESEARCH_VERIFY_POLL_MS || 5000);
const TIMEOUT_MS = Number(process.env.RESEARCH_VERIFY_TIMEOUT_MS || 20 * 60 * 1000);
const BYPASS_SECRET = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
const RUN_ID = randomUUID();
const RETRYABLE_HTTP = new Set([408, 425, 429, 500, 502, 503, 504]);
const AUTH_COOKIE = await resolveAuthCookie({
  cookie: process.env.RESEARCH_VERIFY_COOKIE,
  email: process.env.RESEARCH_VERIFY_EMAIL,
  password: process.env.RESEARCH_VERIFY_PASSWORD,
  insforgeBaseUrl: process.env.NEXT_PUBLIC_INSFORGE_API_BASE_URL || process.env.INSFORGE_API_BASE_URL,
});

const input =
  MODE === "verify"
    ? {
        path: "/api/verify",
        body: {
          bio: "Candidate says they maintain a public distributed database project, write reliability engineering articles, and have presented at open source infrastructure meetups.",
        },
      }
    : {
        path: "/api/search",
        body: {
          query:
            "Senior AI infrastructure engineer with public LLM serving, inference optimization, vLLM, Triton, or Kubernetes work; North America or Europe preferred",
        },
      };

function isRetryable(error) {
  const status = Number(error?.status);
  if (RETRYABLE_HTTP.has(status)) return true;
  const message = String(error?.message || error);
  return /fetch failed|ECONNRESET|ECONNREFUSED|ETIMEDOUT|UND_ERR|terminated|TLS|socket/i.test(message);
}

function backoffMs(attempt) {
  return Math.min(8000, 750 * 2 ** (attempt - 1));
}

async function jsonFetch(path, init, { attempts = 4 } = {}) {
  const headers = new Headers(init?.headers ?? {});
  if (BYPASS_SECRET) headers.set("x-vercel-protection-bypass", BYPASS_SECRET);
  if (AUTH_COOKIE) headers.set("Cookie", AUTH_COOKIE);
  headers.set("x-signalhire-verify-run-id", RUN_ID);

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetch(new URL(path, APP_BASE_URL), { ...init, headers });
      const text = await res.text();
      let body = null;
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        const error = new Error(`${path} returned non-JSON (${res.status}): ${text.slice(0, 300)}`);
        error.status = res.status;
        throw error;
      }
      if (!res.ok) {
        const error = new Error(`${path} failed (${res.status}): ${JSON.stringify(body)}`);
        error.status = res.status;
        throw error;
      }
      return body;
    } catch (error) {
      if (attempt >= attempts || !isRetryable(error)) throw error;
      const wait = backoffMs(attempt);
      console.warn(`${path} transient failure (${error.message || error}); retry ${attempt + 1}/${attempts} in ${wait}ms`);
      await sleep(wait);
    }
  }
}

console.log(`Submitting ${MODE} job to ${APP_BASE_URL}${input.path} (run ${RUN_ID})`);
if (AUTH_COOKIE) console.log("Using authenticated verify session");
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

  const status = await jsonFetch(`/api/status?id=${encodeURIComponent(queued.jobId)}`, undefined, { attempts: 3 });
  const phase = status?.status_view?.phase || status?.status;
  if (!status?.status_view) {
    throw new Error(`/api/status missing status_view: ${JSON.stringify(status)}`);
  }
  if (phase !== lastPhase) {
    lastPhase = phase;
    console.log(`phase=${phase} attempts=${status.attempt_count}/${status.max_attempts} detail=${status.status_view.detail}`);
  }

  if (status.status === "done") {
    if (MODE === "verify") {
      if (!status.result) throw new Error("Job reached done without result");
    } else {
      assertTalentPayload(status);
    }
    console.log(`live research job ok: ${queued.jobId}`);
    break;
  }
  if (status.status === "error") {
    throw new Error(`Job ended in error: ${status.error || status.last_error || "unknown error"}`);
  }

  await sleep(POLL_MS);
}
