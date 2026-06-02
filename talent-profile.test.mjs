import test from "node:test";
import assert from "node:assert/strict";
import {
  AI_DIRECTIONS,
  buildEvidenceCoverage,
  buildCandidateComparisonRows,
  normalizeTalentSearchResult,
  isTalentSearchResult,
} from "./web/lib/talent-profile.mjs";
import { researchStream } from "./web/lib/miro.ts";
import {
  normalizeTalentSearchResult as normalizeWorkerTalentSearchResult,
} from "./worker/talent-profile.mjs";

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

test("normalizes search plan and evidence graph", () => {
  const result = normalizeTalentSearchResult({
    search_plan: {
      must_have: ["LLM serving", "  "],
      nice_to_have: ["Triton"],
      exclusions: ["pure prompt engineering"],
      source_strategy: [
        { source_type: "code", target: "GitHub", reason: "verify engineering" },
        null,
        { source_type: "", target: "", reason: "" },
      ],
      adjacent_pools: [
        { pool: "Distributed systems engineers", reason: "transferable infra" },
        { pool: "", reason: "" },
      ],
    },
    evidence_graph: {
      summary: "Code evidence is strongest.",
      source_mix: [
        { source_type: "code", count: 3 },
        { source_type: "paper", count: -1 },
      ],
      candidates: [
        {
          candidate_name: "Ada Lovelace",
          independent_sources: 5.6,
          source_types: ["code", "", "blog"],
          strongest_evidence: ["Merged serving PRs"],
          weakest_evidence: ["Location from one profile"],
          cross_validation: "Code and blog agree.",
          risk_flags: ["No recent public updates"],
        },
        null,
      ],
    },
    candidates: [{ name: "Ada Lovelace", match_score: 90 }],
  });

  assert.deepEqual(result.search_plan.must_have, ["LLM serving"]);
  assert.equal(result.search_plan.source_strategy.length, 1);
  assert.equal(result.search_plan.adjacent_pools.length, 1);
  assert.equal(result.evidence_graph.summary, "Code evidence is strongest.");
  assert.equal(result.evidence_graph.source_mix[0].count, 3);
  assert.equal(result.evidence_graph.source_mix[1].count, 0);
  assert.equal(result.evidence_graph.candidates.length, 1);
  assert.equal(result.evidence_graph.candidates[0].independent_sources, 6);
  assert.deepEqual(result.evidence_graph.candidates[0].source_types, ["code", "blog"]);
});

test("builds evidence coverage groups from source mix and candidate evidence", () => {
  const result = normalizeTalentSearchResult({
    evidence_graph: {
      source_mix: [
        { source_type: "paper", count: 2 },
        { source_type: "code", count: 1 },
      ],
    },
    candidates: [
      {
        name: "Ada Lovelace",
        claims: [
          {
            claim: "Works on AI infra",
            verdict: "verified",
            evidence: [
              { note: "company", url: "https://example.ai/team/ada", source_type: "company" },
              { note: "talk", url: "https://conf.example/talks/ada", source_type: "talk" },
            ],
          },
        ],
      },
    ],
  });

  const coverage = buildEvidenceCoverage(result);

  assert.equal(coverage.find((item) => item.key === "research")?.count, 2);
  assert.equal(coverage.find((item) => item.key === "practice")?.count, 1);
  assert.equal(coverage.find((item) => item.key === "work_history")?.count, 1);
  assert.equal(coverage.find((item) => item.key === "public_voice")?.count, 1);
  assert.equal(coverage.every((item) => item.status === "covered"), true);
});

test("builds candidate comparison rows from shortlist and evidence graph", () => {
  const result = normalizeTalentSearchResult({
    evidence_graph: {
      candidates: [
        {
          candidate_name: "Ada Lovelace",
          independent_sources: 4,
          source_types: ["code", "blog"],
          risk_flags: ["Location is single-source"],
        },
      ],
    },
    candidates: [
      {
        name: "Ada Lovelace",
        current_role: "Staff Engineer",
        current_company: "Example AI",
        ai_directions: ["AI Infrastructure / LLM Systems", "ML Platform / MLOps"],
        match_score: 91,
        score_breakdown: {
          achievement_signals: 39,
          skill_match: 24,
          work_history: 18,
          evidence_quality: 13,
        },
        strongest_signals: ["Merged LLM serving PRs"],
        evidence_audit: {
          overall_evidence_quality: "high",
          verified_claims: [],
          unverified_claims: [],
          contradicted_claims: [],
          single_source_claims: [],
          identity_risks: [],
          recency_notes: [],
        },
      },
    ],
  });

  const rows = buildCandidateComparisonRows(result);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, "Ada Lovelace");
  assert.equal(rows[0].role, "Staff Engineer / Example AI");
  assert.equal(rows[0].primary_direction, "AI Infrastructure / LLM Systems");
  assert.equal(rows[0].secondary_directions, "ML Platform / MLOps");
  assert.equal(rows[0].match_score, 91);
  assert.equal(rows[0].evidence_quality, "high");
  assert.equal(rows[0].independent_sources, 4);
  assert.equal(rows[0].source_types, "code, blog");
  assert.equal(rows[0].coverage_gaps, "研究, 工作经历");
  assert.equal(rows[0].top_signal, "Merged LLM serving PRs");
  assert.equal(rows[0].risk_summary, "Location is single-source");
});

test("builds candidate comparison rows from candidate evidence when evidence graph is absent", () => {
  const result = normalizeTalentSearchResult({
    candidates: [
      {
        name: "Grace Hopper",
        match_score: 84,
        claims: [
          {
            claim: "Built an evaluation system",
            verdict: "verified",
            evidence: [
              { note: "code", url: "https://github.com/example/eval", source_type: "code" },
              { note: "blog", url: "https://example.com/eval", source_type: "blog" },
            ],
          },
        ],
        uncertainties: ["Only one recent project found"],
      },
    ],
  });

  const rows = buildCandidateComparisonRows(result);

  assert.equal(rows[0].independent_sources, 2);
  assert.equal(rows[0].source_types, "code, blog");
  assert.equal(rows[0].risk_summary, "Only one recent project found");
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

test("normalizes v1 talent payload for web streaming output", async () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = {
    MIROMIND_BASE_URL: process.env.MIROMIND_BASE_URL,
    MIROMIND_API_KEY: process.env.MIROMIND_API_KEY,
    MIROMIND_MODEL: process.env.MIROMIND_MODEL,
  };
  const payload = {
    search_brief: { original_query: "Find AI infra talent" },
    candidates: [
      {
        name: "Ada Lovelace",
        match_score: 140,
        claims: [
          {
            claim: "Maintains an AI infra project",
            verdict: "verified",
            evidence: [
              { note: "search", url: "https://www.google.com/search?q=ada+ai", source_type: "search" },
              { note: "project", url: "https://example.com/project", source_type: "project" },
            ],
          },
          {
            claim: "Has an unsupported claim",
            verdict: "verified",
            evidence: [],
          },
        ],
      },
    ],
  };
  const sse = `data: ${JSON.stringify({ choices: [{ delta: { content: JSON.stringify(payload) } }] })}\n\ndata: [DONE]\n\n`;
  let saved;

  process.env.MIROMIND_BASE_URL = "https://miro.example";
  process.env.MIROMIND_API_KEY = "test-key";
  process.env.MIROMIND_MODEL = "test-model";
  globalThis.fetch = async () => new Response(new TextEncoder().encode(sse), { status: 200 });

  try {
    const res = researchStream({
      prompt: "Find AI infra talent",
      onDone: async (data) => {
        saved = data;
        return "run-1";
      },
    });
    const events = (await res.text()).trim().split("\n").map((line) => JSON.parse(line));
    const done = events.find((event) => event.type === "done");

    assert.equal(saved.candidates[0].match_score, 100);
    assert.equal(saved.candidates[0].claims[0].evidence.length, 1);
    assert.equal(saved.candidates[0].claims[0].evidence[0].url, "https://example.com/project");
    assert.equal(saved.candidates[0].claims[1].verdict, "unverified");
    assert.equal(done.data.candidates[0].match_score, 100);
    assert.equal(done.data.candidates[0].claims[0].evidence.length, 1);
    assert.equal(done.data.candidates[0].claims[1].verdict, "unverified");
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("normalizes cached v1 talent payload for web streaming output", async () => {
  const res = researchStream({
    cached: {
      search_brief: { original_query: "Find AI infra talent" },
      candidates: [
        {
          name: "Ada Lovelace",
          match_score: 140,
          claims: [
            {
              claim: "Maintains an AI infra project",
              verdict: "verified",
              evidence: [
                { note: "search", url: "https://www.google.com/search?q=ada+ai", source_type: "search" },
                { note: "project", url: "https://example.com/project", source_type: "project" },
              ],
            },
          ],
        },
      ],
    },
    runId: "cached-run",
  });
  const events = (await res.text()).trim().split("\n").map((line) => JSON.parse(line));
  const done = events.find((event) => event.type === "done");

  assert.equal(done.runId, "cached-run");
  assert.equal(done.stats.cached, true);
  assert.equal(done.data.candidates[0].match_score, 100);
  assert.equal(done.data.candidates[0].claims[0].evidence.length, 1);
  assert.equal(done.data.candidates[0].claims[0].evidence[0].url, "https://example.com/project");
});

test("search prompt requests search plan and evidence graph", async () => {
  const { searchPrompt } = await import("./web/lib/miro.ts");
  const prompt = searchPrompt("Find AI infra engineers");

  assert.match(prompt, /"search_plan"/);
  assert.match(prompt, /"evidence_graph"/);
  assert.match(prompt, /coverage_checklist/);
  assert.match(prompt, /research \| practice \| work_history \| public_voice/);
  assert.match(prompt, /patent \| dataset \| benchmark/);
  assert.match(prompt, /source_strategy/);
  assert.match(prompt, /independent_sources/);
  assert.match(prompt, /cross_validation/);
});

test("worker prompt and normalizer support search plan and evidence graph", async () => {
  const { searchPrompt } = await import("./worker/lib.mjs");
  const prompt = searchPrompt("Find AI infra engineers");
  const result = normalizeWorkerTalentSearchResult({
    search_plan: {
      must_have: ["LLM serving"],
      source_strategy: [{ source_type: "", target: "GitHub", reason: "verify code" }],
    },
    evidence_graph: {
      candidates: [{
        candidate_name: "Ada Lovelace",
        independent_sources: 2,
        source_types: ["code"],
        cross_validation: "GitHub and blog agree.",
      }],
    },
    candidates: [{ name: "Ada Lovelace", match_score: 90 }],
  });

  assert.match(prompt, /"search_plan"/);
  assert.match(prompt, /"evidence_graph"/);
  assert.match(prompt, /coverage_checklist/);
  assert.match(prompt, /research \| practice \| work_history \| public_voice/);
  assert.match(prompt, /patent \| dataset \| benchmark/);
  assert.match(prompt, /source_strategy/);
  assert.match(prompt, /independent_sources/);
  assert.match(prompt, /cross_validation/);
  assert.deepEqual(result.search_plan.must_have, ["LLM serving"]);
  assert.equal(result.search_plan.source_strategy[0].source_type, "other");
  assert.equal(result.evidence_graph.candidates[0].candidate_name, "Ada Lovelace");
});
