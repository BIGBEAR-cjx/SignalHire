// scripts/check-ai-talent-cache-schema.mjs —— 只读检查 AI 人才缓存/证据表是否已迁移。
// 用法: node --env-file=.env.local scripts/check-ai-talent-cache-schema.mjs

import { createClient } from "@insforge/sdk";

const BASE = process.env.INSFORGE_API_BASE_URL;
const KEY = process.env.INSFORGE_API_KEY;

if (!BASE || !KEY) {
  console.error("缺少 INSFORGE_API_BASE_URL / INSFORGE_API_KEY。用: node --env-file=.env.local scripts/check-ai-talent-cache-schema.mjs");
  process.exit(1);
}

const REQUIRED_TABLES = [
  {
    table: "candidate_profiles",
    columns: [
      "id",
      "user_id",
      "source_run_id",
      "cache_key",
      "name",
      "vertical_tags",
      "source_types",
      "evidence_urls",
      "profile",
      "last_seen_at",
    ],
  },
  {
    table: "candidate_evidence_sources",
    columns: [
      "id",
      "user_id",
      "source_run_id",
      "candidate_profile_cache_key",
      "cache_key",
      "candidate_name",
      "url",
      "family",
      "coverage_group",
      "source_type",
    ],
  },
  {
    table: "open_evidence_leads",
    columns: [
      "id",
      "user_id",
      "source_run_id",
      "cache_key",
      "query_text",
      "provider",
      "family",
      "coverage_group",
      "source_type",
      "candidate_name",
      "url",
      "metric",
      "year",
    ],
  },
  {
    table: "search_tasks",
    columns: [
      "id",
      "user_id",
      "project_id",
      "name",
      "brief",
      "frequency",
      "status",
      "last_run_at",
      "next_run_at",
    ],
  },
  {
    table: "outreach_threads",
    columns: [
      "id",
      "user_id",
      "project_id",
      "shortlist_item_id",
      "candidate_name",
      "candidate_snapshot",
      "subject",
      "body",
      "status",
      "next_follow_up_at",
      "gmail_draft_id",
      "gmail_draft_updated_at",
    ],
  },
  {
    table: "projects",
    columns: [
      "id",
      "user_id",
      "outreach_settings",
    ],
  },
];

const client = createClient({ baseUrl: BASE, anonKey: KEY, isServerMode: true });

for (const spec of REQUIRED_TABLES) {
  const { error } = await client.database
    .from(spec.table)
    .select(spec.columns.join(","))
    .limit(1);

  if (error) {
    console.error(`${spec.table} schema check failed: ${error.message || String(error)}`);
    process.exit(1);
  }
}

console.log(`AI talent cache schema ok (${REQUIRED_TABLES.length} tables)`);
