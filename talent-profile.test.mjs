import test from "node:test";
import assert from "node:assert/strict";
import {
  AI_DIRECTIONS,
  normalizeTalentSearchResult,
  isTalentSearchResult,
} from "./web/lib/talent-profile.mjs";

test("normalizes talent shortlist shape and clamps scores", () => {
  const result = normalizeTalentSearchResult({
    search_brief: {
      original_query: "Find LLM inference engineers",
      target_directions: ["LLM Systems"],
      required_skills: ["vLLM"],
      preferred_skills: ["Triton"],
      seniority: "senior",
      geography: "global",
      evidence_preferences: ["open source"],
      exclusions: [],
    },
    talent_map: [
      { direction: "LLM Systems", fit: "primary", candidate_count: 1, rationale: "main fit" },
    ],
    candidates: [
      {
        name: "Ada Lovelace",
        headline: "LLM systems engineer",
        location: "London",
        current_role: "Engineer",
        current_company: "Example AI",
        ai_directions: ["LLM Systems"],
        match_score: 140,
        score_breakdown: {
          achievement_signals: 50,
          skill_match: 30,
          work_history: 10,
          evidence_quality: 10,
        },
        strongest_signals: ["Maintains a public inference project"],
        uncertainties: [],
        links: { github: "https://github.com/example", linkedin: null, scholar: null, huggingface: null, website: null, other: null },
        claims: [
          {
            claim: "Maintains an inference project",
            verdict: "verified",
            evidence: [{ note: "Project page", url: "https://example.com/project", source_type: "project" }],
          },
          {
            claim: "Has a private claim with no source",
            verdict: "verified",
            evidence: [],
          },
        ],
        evidence_audit: {
          verified_claims: [],
          unverified_claims: [],
          contradicted_claims: [],
          single_source_claims: [],
          identity_risks: [],
          recency_notes: [],
          overall_evidence_quality: "high",
        },
        outreach_angle: "Mention inference work.",
        summary: "Strong LLM systems fit.",
      },
    ],
  });

  assert.equal(result.candidates[0].match_score, 100);
  assert.equal(result.candidates[0].claims[1].verdict, "unverified");
  assert.equal(result.candidates[0].claims[1].evidence.length, 0);
  assert.ok(isTalentSearchResult(result));
  assert.ok(AI_DIRECTIONS.includes("AI Infrastructure / LLM Systems"));
});

test("filters search-result URLs from evidence", () => {
  const result = normalizeTalentSearchResult({
    candidates: [
      {
        name: "Grace Hopper",
        claims: [
          {
            claim: "Published AI infra work",
            verdict: "verified",
            evidence: [
              { note: "search", url: "https://www.google.com/search?q=grace+ai", source_type: "search" },
              { note: "paper", url: "https://arxiv.org/abs/1234.5678", source_type: "paper" },
            ],
          },
        ],
      },
    ],
  });

  assert.equal(result.candidates[0].claims[0].evidence.length, 1);
  assert.equal(result.candidates[0].claims[0].evidence[0].source_type, "paper");
});

test("handles malformed nested objects without throwing", () => {
  const result = normalizeTalentSearchResult({
    search_brief: null,
    talent_map: [null, { direction: "AI Research / Applied Science", candidate_count: -2 }],
    candidates: [null, { name: "", links: null, score_breakdown: null, evidence_audit: null, claims: [null] }],
  });

  assert.equal(result.search_brief.original_query, "");
  assert.equal(result.talent_map.length, 1);
  assert.equal(result.talent_map[0].candidate_count, 0);
  assert.equal(result.candidates.length, 2);
  assert.equal(result.candidates[0].name, "Unknown candidate");
  assert.equal(result.candidates[1].links.github, null);
  assert.equal(result.candidates[1].claims[0].verdict, "unverified");
});

test("detects v1 talent payloads without misclassifying legacy reports", () => {
  assert.equal(isTalentSearchResult({ candidate_name: "Ada", claims: [] }), false);
  assert.equal(isTalentSearchResult({ candidates: [{ name: "Ada", claims: [] }] }), false);
  assert.equal(isTalentSearchResult({ candidates: [null] }), false);
  assert.equal(isTalentSearchResult({ candidates: [{ name: "Ada", match_score: 80 }] }), true);
});
