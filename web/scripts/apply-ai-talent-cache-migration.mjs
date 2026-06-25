// scripts/apply-ai-talent-cache-migration.mjs —— 应用 AI 人才缓存/证据表迁移。
// 用法: node --env-file=.env.local scripts/apply-ai-talent-cache-migration.mjs

import { readFile } from "node:fs/promises";

const BASE = process.env.INSFORGE_API_BASE_URL;
const KEY = process.env.INSFORGE_API_KEY;

if (!BASE || !KEY) {
  console.error("缺少 INSFORGE_API_BASE_URL / INSFORGE_API_KEY。用: node --env-file=.env.local scripts/apply-ai-talent-cache-migration.mjs");
  process.exit(1);
}

const migrations = [
  "20260612110000_candidate-profile-cache.sql",
  "20260615100000_dinq-recruiting-agent-mvp.sql",
  "20260624170000_autonomous_recruiter_p1a_gmail_outreach.sql",
  "20260624190000_autonomous_recruiter_p2a_inbox_agent.sql",
];

async function applyMigration(fileName) {
  const migrationUrl = new URL(`../../migrations/${fileName}`, import.meta.url);
  const query = await readFile(migrationUrl, "utf8");
  const response = await fetch(`${BASE}/api/database/advance/rawsql`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KEY}`,
      "x-api-key": KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, params: [] }),
  });

  let payload = {};
  try {
    payload = await response.json();
  } catch {}

  if (!response.ok || payload?.error) {
    const message = payload?.error?.message || payload?.message || response.statusText || "migration failed";
    throw new Error(`${fileName}: ${message}`);
  }
}

for (const fileName of migrations) {
  try {
    await applyMigration(fileName);
    console.log(`Applied ${fileName}`);
  } catch (error) {
    console.error(`AI talent cache migration failed: ${(error instanceof Error ? error.message : String(error))}`);
    process.exit(1);
  }
}

console.log("AI talent cache migrations applied");
