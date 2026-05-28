// scripts/seed-db.mjs —— 把 3 份证据核实过的缓存灌进 Insforge research_runs。
// 这样即使 Vercel 免费版实时跑不完, 生产 DB 也有数据可演示 (历史面板有 3 条 + DB 读穿命中)。
// 建表后跑一次:  node --env-file=.env.local scripts/seed-db.mjs
//
// 与 lib/db.ts 用同样的 createClient/upsert; 与 routes 用同样的 flat_key/label/summary 规则。

import { createClient } from "@insforge/sdk";
import { readFileSync } from "node:fs";

const BASE = process.env.INSFORGE_API_BASE_URL;
const KEY = process.env.INSFORGE_API_KEY;
if (!BASE || !KEY) {
  console.error("缺少 INSFORGE_API_BASE_URL / INSFORGE_API_KEY。用: node --env-file=.env.local scripts/seed-db.mjs");
  process.exit(1);
}
const client = createClient({ baseUrl: BASE, anonKey: KEY, isServerMode: true });

const flatten = (s) => s.toLowerCase().replace(/[^a-z0-9一-龥]+/g, " ").trim();
const HERO_BIO = `Jordan Smith — Staff Software Engineer at Google.
I am the original creator of the Tokio asynchronous runtime for Rust, which I started in 2016.
I have 12 years of professional Rust experience and hold a PhD in Computer Science from Stanford.`;

const SEEDS = [
  { kind: "search", file: "senior-rust.json", queryText: "Senior Rust engineer who has contributed to the Tokio project" },
  { kind: "search", file: "ai-recruiting-pm.json", queryText: "Product manager who has worked on an AI recruiting / hiring platform" },
  { kind: "verify", file: "verify-jordan-smith.json", queryText: HERO_BIO },
];

function labelSummary(kind, queryText, data) {
  if (kind === "search") {
    const n = Array.isArray(data?.candidates) ? data.candidates.length : 0;
    return {
      label: queryText.length > 60 ? queryText.slice(0, 60) + "…" : queryText,
      summary: `${n} 位候选人`,
    };
  }
  const claims = Array.isArray(data?.claims) ? data.claims : [];
  const contra = claims.filter((c) => c?.verdict === "contradicted").length;
  return {
    label: data?.candidate_name || queryText.slice(0, 40),
    summary: `可信度 ${data?.overall_trust ?? "?"}${contra ? ` · ${contra} 矛盾` : ""}`,
  };
}

for (const s of SEEDS) {
  const data = JSON.parse(readFileSync(new URL(`../data/${s.file}`, import.meta.url), "utf8"));
  const { label, summary } = labelSummary(s.kind, s.queryText, data);
  const flatKey = flatten(s.queryText);
  const { error } = await client.database.from("research_runs").upsert(
    {
      cache_key: `${s.kind}:${flatKey}`,
      kind: s.kind,
      flat_key: flatKey,
      query_text: s.queryText,
      label,
      summary,
      result: data,
      stats: { searches: 0, fetches: 0 },
      status: "done",
      error: null,
      last_error: null,
      progress: null,
      attempt_count: 0,
      max_attempts: 3,
      locked_at: null,
      started_at: null,
      finished_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "cache_key" },
  );
  console.log(`${s.file}: ${error ? "ERR " + error.message : "ok (" + summary + ")"}`);
}
console.log("seed 完成。");
