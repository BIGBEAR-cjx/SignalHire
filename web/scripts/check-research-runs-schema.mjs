// scripts/check-research-runs-schema.mjs —— 只读检查 research_runs 是否满足 v1 队列契约。
// 用法: node --env-file=.env.local scripts/check-research-runs-schema.mjs

import { createClient } from "@insforge/sdk";

const BASE = process.env.INSFORGE_API_BASE_URL;
const KEY = process.env.INSFORGE_API_KEY;

if (!BASE || !KEY) {
  console.error("缺少 INSFORGE_API_BASE_URL / INSFORGE_API_KEY。用: node --env-file=.env.local scripts/check-research-runs-schema.mjs");
  process.exit(1);
}

const REQUIRED_COLUMNS = [
  "id",
  "cache_key",
  "kind",
  "flat_key",
  "query_text",
  "label",
  "summary",
  "result",
  "stats",
  "status",
  "progress",
  "error",
  "last_error",
  "attempt_count",
  "max_attempts",
  "locked_at",
  "started_at",
  "finished_at",
  "created_at",
  "updated_at",
];

const client = createClient({ baseUrl: BASE, anonKey: KEY, isServerMode: true });
const { error } = await client.database
  .from("research_runs")
  .select(REQUIRED_COLUMNS.join(","))
  .limit(1);

if (error) {
  console.error(`research_runs schema check failed: ${error.message || String(error)}`);
  process.exit(1);
}

console.log(`research_runs schema ok (${REQUIRED_COLUMNS.length} required columns)`);
