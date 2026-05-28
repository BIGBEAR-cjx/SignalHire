// scripts/check-worker-health.mjs —— 检查 worker 队列是否有超时任务。

const APP_BASE_URL = process.env.APP_BASE_URL || "http://127.0.0.1:3000";
const BYPASS_SECRET = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

const headers = new Headers();
if (BYPASS_SECRET) headers.set("x-vercel-protection-bypass", BYPASS_SECRET);

const res = await fetch(new URL("/api/worker-health", APP_BASE_URL), { headers });
const text = await res.text();
let body = null;
try {
  body = text ? JSON.parse(text) : null;
} catch {
  throw new Error(`/api/worker-health returned non-JSON (${res.status}): ${text.slice(0, 300)}`);
}

console.log(JSON.stringify(body, null, 2));

if (!res.ok || !body?.ok) {
  process.exitCode = 1;
}
