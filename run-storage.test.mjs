import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCandidateEvidenceSourceRowsForRun,
  buildCandidateProfileRowsForRun,
  buildRunStorageFields,
  rankCandidateProfileRowsForSearch,
} from "./web/lib/db.ts";

test("bounds long search text before writing research_runs rows", () => {
  const longQuery = "核心产品开发，负责 OkayJob 平台全栈功能迭代，从用户端到管理后台，用 AI 工具链重构开发流程。".repeat(20);
  const fields = buildRunStorageFields({
    kind: "search",
    flatKey: longQuery.toLowerCase(),
    queryText: longQuery,
    label: longQuery,
  });

  assert.ok(fields.cacheKey.length <= 240);
  assert.ok(fields.flatKey.length <= 220);
  assert.ok(fields.queryText.length <= 240);
  assert.ok(fields.label.length <= 80);
  assert.match(fields.flatKey, /[a-f0-9]{16}$/);
  assert.equal(fields.queuedProgress.original_query, longQuery);
  assert.equal(fields.summary, "研究中…");
});

test("keeps distinct hashes for different long run keys", () => {
  const a = buildRunStorageFields({
    kind: "search",
    flatKey: "ai infra ".repeat(80) + "alpha",
    queryText: "alpha",
    label: "alpha",
  });
  const b = buildRunStorageFields({
    kind: "search",
    flatKey: "ai infra ".repeat(80) + "beta",
    queryText: "beta",
    label: "beta",
  });

  assert.notEqual(a.cacheKey, b.cacheKey);
  assert.notEqual(a.flatKey, b.flatKey);
});

test("builds localized queued run summaries from platform language", () => {
  assert.equal(
    buildRunStorageFields({
      kind: "search",
      flatKey: "ai infra",
      queryText: "ai infra",
      label: "ai infra",
      platformLanguage: "English",
    }).summary,
    "Research in progress…",
  );
  assert.equal(
    buildRunStorageFields({
      kind: "search",
      flatKey: "ai infra",
      queryText: "ai infra",
      label: "ai infra",
      platformLanguage: "Chinese (Simplified)",
    }).summary,
    "研究中…",
  );
});

test("builds candidate profile cache rows from completed search results", () => {
  assert.equal(typeof buildCandidateProfileRowsForRun, "function");

  const rows = buildCandidateProfileRowsForRun({
    userId: "user-1",
    sourceRunId: "run-1",
    observedAt: "2026-06-12T00:00:00.000Z",
    result: {
      search_brief: {
        original_query: "Find LLM inference and RAG evaluation engineers",
        required_skills: ["vLLM", "retrieval eval"],
      },
      candidates: [
        {
          name: "Ada Lovelace",
          current_role: "Staff AI Infrastructure Engineer",
          current_company: "Example AI",
          ai_directions: ["AI Infrastructure / LLM Systems"],
          match_score: 91,
          strongest_signals: ["Maintains vLLM serving and RAG evaluation repos"],
          claims: [
            {
              claim: "Maintains vLLM serving and RAG evaluation repos",
              verdict: "verified",
              evidence: [
                { note: "GitHub repo", url: "https://github.com/example/vllm", source_type: "code" },
                { note: "Eval paper", url: "https://openreview.net/forum?id=eval", source_type: "paper" },
              ],
            },
          ],
          evidence_audit: { overall_evidence_quality: "high" },
        },
      ],
    },
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].user_id, "user-1");
  assert.equal(rows[0].source_run_id, "run-1");
  assert.equal(rows[0].cache_key, "user-1:ada-lovelace");
  assert.equal(rows[0].name, "Ada Lovelace");
  assert.equal(rows[0].current_role, "Staff AI Infrastructure Engineer");
  assert.equal(rows[0].current_company, "Example AI");
  assert.deepEqual(rows[0].vertical_tags, ["LLM infra", "RAG", "eval"]);
  assert.deepEqual(rows[0].source_types, ["code", "paper"]);
  assert.deepEqual(rows[0].evidence_urls, [
    "https://github.com/example/vllm",
    "https://openreview.net/forum?id=eval",
  ]);
  assert.equal(rows[0].confidence, "high");
  assert.equal(rows[0].last_seen_at, "2026-06-12T00:00:00.000Z");
  assert.match(rows[0].search_text, /retrieval eval/);
  assert.equal(rows[0].profile.structured_sources[0].family, "github_repo");
  assert.equal(rows[0].profile.structured_sources[1].family, "openreview_paper");
});

test("builds candidate evidence source rows from completed search results", () => {
  assert.equal(typeof buildCandidateEvidenceSourceRowsForRun, "function");

  const rows = buildCandidateEvidenceSourceRowsForRun({
    userId: "user-1",
    sourceRunId: "run-1",
    observedAt: "2026-06-12T00:00:00.000Z",
    result: {
      candidates: [
        {
          name: "Ada Lovelace",
          current_role: "Staff AI Infrastructure Engineer",
          current_company: "Example AI",
          match_score: 91,
          claims: [
            {
              claim: "Maintains vLLM serving and RAG evaluation repos",
              verdict: "verified",
              evidence: [
                { note: "GitHub repo", url: "https://github.com/example/vllm", source_type: "code" },
                { note: "Eval paper", url: "https://openreview.net/forum?id=eval", source_type: "paper" },
              ],
            },
          ],
        },
      ],
    },
  });

  assert.equal(rows.length, 2);
  assert.equal(rows[0].user_id, "user-1");
  assert.equal(rows[0].source_run_id, "run-1");
  assert.equal(rows[0].candidate_profile_cache_key, "user-1:ada-lovelace");
  assert.equal(rows[0].candidate_name, "Ada Lovelace");
  assert.equal(rows[0].claim, "Maintains vLLM serving and RAG evaluation repos");
  assert.equal(rows[0].verdict, "verified");
  assert.equal(rows[0].url, "https://github.com/example/vllm");
  assert.equal(rows[0].host, "github.com");
  assert.equal(rows[0].family, "github_repo");
  assert.equal(rows[0].coverage_group, "practice");
  assert.equal(rows[0].source_type, "code");
  assert.equal(rows[0].primary_id, "example");
  assert.equal(rows[0].secondary_id, "vllm");
  assert.equal(rows[0].observed_at, "2026-06-12T00:00:00.000Z");
  assert.equal(rows[1].family, "openreview_paper");
  assert.match(rows[0].cache_key, /^user-1:ada-lovelace:/);
});

test("ranks cached candidate profiles for a new search brief", () => {
  assert.equal(typeof rankCandidateProfileRowsForSearch, "function");

  const matches = rankCandidateProfileRowsForSearch({
    query: "Find senior vLLM inference engineers with strong GitHub evidence",
    limit: 2,
    rows: [
      {
        cache_key: "user-1:product-lead",
        name: "Product Lead",
        role: "AI Product Lead",
        vertical_tags: ["AI product"],
        source_types: ["blog"],
        search_text: "AI product workflow customer discovery",
        match_score: 78,
        confidence: "medium",
      },
      {
        cache_key: "user-1:ada-lovelace",
        name: "Ada Lovelace",
        role: "Staff AI Infrastructure Engineer",
        vertical_tags: ["LLM infra"],
        source_types: ["code", "paper"],
        search_text: "vLLM inference serving CUDA GitHub evidence",
        match_score: 91,
        confidence: "high",
      },
      {
        cache_key: "user-1:grace-hopper",
        name: "Grace Hopper",
        role: "RAG Evaluation Engineer",
        vertical_tags: ["RAG", "eval"],
        source_types: ["paper"],
        search_text: "retrieval evaluation benchmark",
        match_score: 86,
        confidence: "high",
      },
    ],
  });

  assert.deepEqual(matches.map((item) => item.name), ["Ada Lovelace", "Grace Hopper"]);
  assert.ok(matches[0].cache_score > matches[1].cache_score);
  assert.deepEqual(matches[0].matched_terms.slice(0, 3), ["vllm", "inference", "github"]);
});
