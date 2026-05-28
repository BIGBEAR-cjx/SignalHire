// scripts/verify-retry-api.mjs —— 创建临时 error 行, 调 /api/retry, 验证后清理。
// 前置: web server 已启动, .env.local 已配置 Insforge。
// 用法: node --env-file=.env.local scripts/verify-retry-api.mjs

import { createClient } from "@insforge/sdk";

const BASE = process.env.INSFORGE_API_BASE_URL;
const KEY = process.env.INSFORGE_API_KEY;
const APP_BASE_URL = process.env.APP_BASE_URL || "http://127.0.0.1:3000";
const BYPASS_SECRET = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

if (!BASE || !KEY) {
  console.error("缺少 INSFORGE_API_BASE_URL / INSFORGE_API_KEY。用: node --env-file=.env.local scripts/verify-retry-api.mjs");
  process.exit(1);
}

const client = createClient({ baseUrl: BASE, anonKey: KEY, isServerMode: true });
const table = "research_runs";
const ts = new Date().toISOString();
const flatKey = `retry-api-smoke-${Date.now()}`;
const cacheKey = `verify:${flatKey}`;
let rowId = null;

async function jsonFetch(path, init) {
  const headers = new Headers(init?.headers);
  if (BYPASS_SECRET) headers.set("x-vercel-protection-bypass", BYPASS_SECRET);
  const res = await fetch(new URL(path, APP_BASE_URL), { ...init, headers });
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

try {
  const { error: insertError } = await client.database.from(table).upsert(
    {
      cache_key: cacheKey,
      kind: "verify",
      flat_key: flatKey,
      query_text: "Synthetic retry API verification row. Safe to delete.",
      label: "Synthetic retry API verification",
      summary: "retry api smoke",
      result: null,
      stats: null,
      status: "error",
      progress: null,
      error: "synthetic retry verification",
      last_error: "synthetic retry verification",
      attempt_count: 3,
      max_attempts: 3,
      locked_at: null,
      started_at: ts,
      finished_at: null,
      updated_at: ts,
    },
    { onConflict: "cache_key" },
  );
  if (insertError) throw new Error(`insert failed: ${insertError.message || String(insertError)}`);

  const { data, error: selectError } = await client.database
    .from(table)
    .select("id")
    .eq("cache_key", cacheKey)
    .limit(1);
  if (selectError || !data?.[0]?.id) {
    throw new Error(`could not read synthetic row id: ${selectError?.message || "0 rows"}`);
  }
  rowId = data[0].id;

  const retried = await jsonFetch("/api/retry", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: rowId }),
  });

  if (retried.status !== "queued" || retried.attempt_count !== 0 || retried.status_view?.phase !== "queued") {
    throw new Error(`retry response did not reset row to queued: ${JSON.stringify(retried)}`);
  }

  console.log(`retry api ok: ${rowId}`);
} finally {
  if (rowId) {
    await client.database.from(table).delete().eq("id", rowId);
  }
}
