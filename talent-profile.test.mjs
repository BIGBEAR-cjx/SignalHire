import test from "node:test";
import assert from "node:assert/strict";
import * as talentProfile from "./web/lib/talent-profile.mjs";
import {
  AI_DIRECTIONS,
  buildCoverageBackfillPlan,
  buildEvidenceCoverage,
  buildSourceExecution,
  buildSourceQueryPlan,
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

test("builds executable source query plan from brief and source strategy", () => {
  const result = normalizeTalentSearchResult({
    search_brief: {
      original_query: "Find LLM inference engineers",
      target_directions: ["AI Infrastructure / LLM Systems"],
      required_skills: ["vLLM", "Triton"],
    },
    search_plan: {
      source_strategy: [
        {
          source_type: "code",
          target: "GitHub repositories",
          reason: "verify engineering work",
          coverage_group: "practice",
          query: "vLLM Triton site:github.com",
        },
        {
          source_type: "paper",
          target: "arXiv and conference pages",
          reason: "verify research output",
        },
      ],
    },
  });

  const plan = buildSourceQueryPlan(result);

  assert.equal(plan.length, 2);
  assert.equal(plan[0].coverage_group, "practice");
  assert.equal(plan[0].query, "vLLM Triton site:github.com");
  assert.equal(plan[0].target, "GitHub repositories");
  assert.match(plan[1].query, /Find LLM inference engineers/);
  assert.match(plan[1].query, /vLLM/);
  assert.match(plan[1].query, /site:arxiv.org/);
});

test("builds editable search plan draft and compiles it into search input", () => {
  assert.equal(typeof talentProfile.buildEditableSearchPlanDraft, "function");
  assert.equal(typeof talentProfile.buildSearchInputFromEditablePlan, "function");

  const draft = talentProfile.buildEditableSearchPlanDraft("Find senior LLM inference engineers with vLLM, Triton, remote US/EU, exclude prompt-only profiles");

  assert.equal(draft.search_brief.original_query, "Find senior LLM inference engineers with vLLM, Triton, remote US/EU, exclude prompt-only profiles");
  assert.ok(draft.search_plan.must_have.some((item) => /LLM inference/i.test(item)));
  assert.ok(draft.search_plan.exclusions.some((item) => /prompt-only/i.test(item)));
  assert.equal(draft.search_plan.source_strategy.length, 4);
  assert.equal(draft.search_plan.source_strategy[0].source_type, "code");
  assert.equal(draft.search_plan.source_strategy[0].coverage_group, "practice");
  assert.match(draft.search_plan.source_strategy[0].query, /site:github.com/);

  draft.search_plan.must_have.push("Production TensorRT-LLM work");
  draft.search_plan.exclusions.push("Pure academic profiles without code");
  draft.search_plan.source_strategy[0].query = "vLLM TensorRT-LLM site:github.com";

  const input = talentProfile.buildSearchInputFromEditablePlan({ draft });
  assert.match(input, /Editable Search Plan/);
  assert.match(input, /Production TensorRT-LLM work/);
  assert.match(input, /Pure academic profiles without code/);
  assert.match(input, /vLLM TensorRT-LLM site:github.com/);
  assert.match(input, /Return the normal SignalHire talent shortlist payload/);
});

test("builds feedback-optimized search input for the next round", () => {
  assert.equal(typeof talentProfile.buildFeedbackOptimizedSearchInput, "function");

  const result = normalizeTalentSearchResult({
    search_brief: {
      original_query: "Find senior LLM inference engineers in North America",
      required_skills: ["vLLM", "Triton"],
      geography: "North America",
    },
    candidates: [
      {
        name: "Ada Lovelace",
        current_role: "Staff Engineer",
        current_company: "Example AI",
        ai_directions: ["AI Infrastructure / LLM Systems"],
        match_score: 92,
        strongest_signals: ["Merged public vLLM serving PRs"],
        uncertainties: ["Location needs confirmation"],
        evidence_audit: { overall_evidence_quality: "high" },
      },
      {
        name: "Grace Hopper",
        current_role: "Engineer",
        current_company: "InfraCo",
        ai_directions: ["ML Platform / MLOps"],
        match_score: 74,
        strongest_signals: ["Built internal inference tooling"],
        uncertainties: ["No public code found"],
        evidence_audit: { overall_evidence_quality: "medium" },
      },
    ],
  });

  const input = talentProfile.buildFeedbackOptimizedSearchInput({
    result,
    feedback: {
      precision: "partial",
      satisfaction: "mixed",
      issue: "wrong_seniority",
      focus: "stricter_match",
    },
  });

  assert.match(input, /Feedback-optimized SignalHire search/);
  assert.match(input, /Find senior LLM inference engineers in North America/);
  assert.match(input, /部分精准/);
  assert.match(input, /一般/);
  assert.match(input, /资历不对/);
  assert.match(input, /更严格匹配/);
  assert.match(input, /Ada Lovelace/);
  assert.match(input, /Grace Hopper/);
  assert.match(input, /Do not simply rerank the same shortlist/);
  assert.match(input, /Return the normal SignalHire talent shortlist payload/);
});

test("builds candidate evidence audit summary from claims and evidence graph", () => {
  assert.equal(typeof talentProfile.buildCandidateEvidenceAudit, "function");

  const result = normalizeTalentSearchResult({
    evidence_graph: {
      candidates: [
        {
          candidate_name: "Ada Lovelace",
          independent_sources: 4,
          source_types: ["code", "blog"],
          strongest_evidence: ["Public vLLM integration and technical write-up agree."],
          weakest_evidence: ["Location appears on one profile only."],
          cross_validation: "GitHub, blog, and company sources support the core LLM systems fit.",
          risk_flags: ["Current location is single-source."],
        },
      ],
    },
    candidates: [
      {
        name: "Ada Lovelace",
        uncertainties: ["Recent availability is unknown."],
        claims: [
          {
            claim: "Maintains a public vLLM integration",
            verdict: "verified",
            evidence: [
              { note: "GitHub repo", url: "https://github.com/example/vllm", source_type: "code" },
              { note: "Technical post", url: "https://example.com/vllm", source_type: "blog" },
            ],
          },
          {
            claim: "Is currently based in Berlin",
            verdict: "verified",
            evidence: [
              { note: "Profile", url: "https://profile.example/ada", source_type: "profile" },
            ],
          },
          {
            claim: "Led TensorRT-LLM work at Example AI",
            verdict: "unverified",
            evidence: [],
          },
          {
            claim: "Currently works at OldCo",
            verdict: "contradicted",
            evidence: [
              { note: "Company page lists a different employer", url: "https://company.example/team/ada", source_type: "company" },
            ],
          },
        ],
        evidence_audit: {
          identity_risks: ["Same-name profile exists on GitHub."],
          recency_notes: ["Most concrete activity is from 2025."],
          overall_evidence_quality: "high",
        },
      },
    ],
  });

  const summary = talentProfile.buildCandidateEvidenceAudit({
    result,
    candidate: result.candidates[0],
  });

  assert.equal(summary.candidate_name, "Ada Lovelace");
  assert.equal(summary.overall_evidence_quality, "high");
  assert.equal(summary.verified_count, 2);
  assert.equal(summary.unverified_count, 1);
  assert.equal(summary.contradicted_count, 1);
  assert.equal(summary.independent_sources, 4);
  assert.deepEqual(summary.source_types, ["code", "blog", "profile", "company"]);
  assert.deepEqual(summary.single_source_claims, ["Is currently based in Berlin", "Currently works at OldCo"]);
  assert.deepEqual(summary.identity_risks, ["Same-name profile exists on GitHub."]);
  assert.deepEqual(summary.recency_notes, ["Most concrete activity is from 2025."]);
  assert.equal(summary.cross_validation, "GitHub, blog, and company sources support the core LLM systems fit.");
  assert.deepEqual(summary.risk_flags, ["Current location is single-source.", "Recent availability is unknown."]);
});

test("builds localized candidate evidence dossier for result review", () => {
  assert.equal(typeof talentProfile.buildCandidateEvidenceDossier, "function");

  const result = normalizeTalentSearchResult({
    evidence_graph: {
      candidates: [
        {
          candidate_name: "Ada Lovelace",
          independent_sources: 4,
          source_types: ["code", "paper", "company"],
          strongest_evidence: ["Public serving repository and paper cite the same inference work."],
          weakest_evidence: ["Availability is inferred from one profile."],
          cross_validation: "Code, research, and company sources support the core AI infrastructure fit.",
          risk_flags: ["Availability is single-source."],
        },
      ],
    },
    candidates: [
      {
        name: "Ada Lovelace",
        current_role: "Staff AI Infrastructure Engineer",
        current_company: "Example AI",
        match_score: 91,
        strongest_signals: ["Maintains public vLLM serving code"],
        uncertainties: ["Recent availability is unknown."],
        claims: [
          {
            claim: "Maintains public vLLM serving code",
            verdict: "verified",
            evidence: [
              { note: "GitHub repo", url: "https://github.com/example/vllm", source_type: "code" },
              { note: "Paper", url: "https://arxiv.org/abs/1234.5678", source_type: "paper" },
            ],
          },
          {
            claim: "Currently available",
            verdict: "unverified",
            evidence: [],
          },
        ],
        evidence_audit: {
          overall_evidence_quality: "high",
          single_source_claims: ["Currently available"],
        },
      },
    ],
  });

  const zh = talentProfile.buildCandidateEvidenceDossier({ result, candidate: result.candidates[0], locale: "zh" });
  assert.equal(zh.title, "候选人证据档案");
  assert.match(zh.conclusion, /Ada Lovelace/);
  assert.match(zh.conclusion, /强匹配/);
  assert.equal(zh.metrics[0].label, "匹配分");
  assert.equal(zh.metrics[0].value, "91");
  assert.deepEqual(zh.source_types, ["code", "paper", "company"]);
  assert.equal(zh.primary_evidence[0], "Public serving repository and paper cite the same inference work.");
  assert.match(zh.risk_summary, /Availability is single-source/);
  assert.deepEqual(
    zh.evidence_groups.map((group) => [group.key, group.label, group.status, group.source_types, group.claim_count]),
    [
      ["research", "研究", "covered", ["paper"], 1],
      ["practice", "实践", "covered", ["code"], 1],
      ["work_history", "工作经历", "covered", ["company"], 0],
      ["public_voice", "公开表达", "missing", [], 0],
    ],
  );
  assert.deepEqual(zh.evidence_groups[0].primary_claims, ["Maintains public vLLM serving code"]);
  assert.deepEqual(zh.evidence_groups[3].missing_source_types, ["talk", "blog", "podcast", "interview"]);
  assert.ok(zh.verification_gaps.some((gap) => /缺少公开表达证据/.test(gap)));
  assert.equal(zh.backfill_jobs.length, 1);
  assert.deepEqual(zh.backfill_jobs[0].candidate_names, ["Ada Lovelace"]);
  assert.equal(zh.backfill_jobs[0].coverage_group, "public_voice");
  assert.equal(zh.backfill_jobs[0].missing_source_type, "talk");
  assert.deepEqual(zh.backfill_jobs[0].source_types_to_check, ["talk", "blog", "podcast", "interview"]);
  assert.equal(zh.backfill_jobs[0].status, "planned");
  assert.match(zh.backfill_jobs[0].query, /Ada Lovelace/);
  assert.match(zh.backfill_jobs[0].reason, /缺少公开表达证据/);

  const en = talentProfile.buildCandidateEvidenceDossier({ result, candidate: result.candidates[0], locale: "en" });
  assert.equal(en.title, "Candidate evidence dossier");
  assert.match(en.conclusion, /strong match/);
  assert.equal(en.metrics[1].label, "Independent sources");
  assert.equal(en.metrics[1].value, "4");
  assert.match(en.verdict_summary, /1 verified/);
  assert.equal(en.evidence_groups[0].label, "Research");
  assert.ok(en.verification_gaps.some((gap) => /Public voice evidence is missing/.test(gap)));
  assert.match(en.backfill_jobs[0].reason, /Public voice evidence is missing/);
});

test("builds shortlist delivery report for hiring manager handoff", () => {
  assert.equal(typeof talentProfile.buildShortlistDeliveryReport, "function");

  const result = normalizeTalentSearchResult({
    search_brief: {
      original_query: "Find senior LLM inference engineers in North America",
      target_directions: ["AI Infrastructure / LLM Systems"],
      required_skills: ["vLLM", "Triton"],
      geography: "North America",
    },
    evidence_graph: {
      source_mix: [
        { source_type: "code", count: 3 },
        { source_type: "company", count: 1 },
      ],
      candidates: [
        {
          candidate_name: "Ada Lovelace",
          independent_sources: 4,
          source_types: ["code", "blog", "company"],
          risk_flags: ["Location is single-source."],
        },
        {
          candidate_name: "Grace Hopper",
          independent_sources: 1,
          source_types: ["profile"],
          risk_flags: ["Implementation evidence is thin."],
        },
      ],
    },
    candidates: [
      {
        name: "Ada Lovelace",
        current_role: "Staff Engineer",
        current_company: "Example AI",
        ai_directions: ["AI Infrastructure / LLM Systems"],
        match_score: 92,
        strongest_signals: ["Merged public vLLM serving PRs"],
        uncertainties: ["Location needs confirmation"],
        evidence_audit: { overall_evidence_quality: "high" },
        claims: [
          {
            claim: "Maintains public vLLM serving work",
            verdict: "verified",
            evidence: [
              { note: "GitHub", url: "https://github.com/example/vllm", source_type: "code" },
              { note: "Blog", url: "https://example.com/vllm", source_type: "blog" },
            ],
          },
        ],
      },
      {
        name: "Grace Hopper",
        current_role: "Engineer",
        current_company: "InfraCo",
        ai_directions: ["ML Platform / MLOps"],
        match_score: 81,
        strongest_signals: ["Built internal inference tooling"],
        uncertainties: ["No public code found"],
        evidence_audit: { overall_evidence_quality: "medium" },
        claims: [
          {
            claim: "Works on inference tooling",
            verdict: "verified",
            evidence: [{ note: "Profile", url: "https://profile.example/grace", source_type: "profile" }],
          },
        ],
      },
      {
        name: "Alan Turing",
        match_score: 62,
        uncertainties: ["Mostly research-only signal"],
        evidence_audit: { overall_evidence_quality: "low" },
      },
    ],
  });

  const report = talentProfile.buildShortlistDeliveryReport(result);

  assert.equal(report.brief_summary, "Find senior LLM inference engineers in North America");
  assert.equal(report.candidate_count, 3);
  assert.equal(report.strong_recommendation_count, 2);
  assert.equal(report.average_match_score, 78);
  assert.equal(report.high_evidence_count, 1);
  assert.equal(report.covered_group_count, 3);
  assert.equal(report.coverage_group_count, 4);
  assert.equal(report.recommended_candidates.length, 2);
  assert.equal(report.recommended_candidates[0].name, "Ada Lovelace");
  assert.equal(report.recommended_candidates[0].role, "Staff Engineer / Example AI");
  assert.equal(report.recommended_candidates[0].recommendation_reason, "Merged public vLLM serving PRs");
  assert.equal(report.recommended_candidates[0].evidence_quality, "high");
  assert.equal(report.recommended_candidates[0].independent_sources, 4);
  assert.equal(report.recommended_candidates[0].primary_risk, "Location is single-source.");
  assert.ok(report.report_risks.some((risk) => /1 个信息源覆盖缺口/.test(risk)));
  assert.ok(report.report_risks.some((risk) => /Alan Turing/.test(risk)));
  assert.deepEqual(report.next_steps.slice(0, 2), ["优先审阅 2 位强推荐候选人的证据详情。", "对 1 个信息源覆盖缺口执行补搜。"]);
});

test("normalizes source execution and falls back to planned jobs", () => {
  const result = normalizeTalentSearchResult({
    search_brief: {
      original_query: "Find LLM inference engineers",
      required_skills: ["vLLM"],
    },
    search_plan: {
      source_strategy: [
        { source_type: "code", target: "GitHub", reason: "verify code", coverage_group: "practice", query: "vLLM site:github.com" },
      ],
    },
    source_execution: {
      summary: "Code source search completed; paper search still thin.",
      jobs: [
        {
          job_id: "code-1",
          source_type: "code",
          coverage_group: "practice",
          query: "vLLM site:github.com",
          status: "completed",
          urls_found: 2.4,
          evidence_found: 3,
          candidate_leads: ["Ada Lovelace", ""],
          source_urls: [
            "https://github.com/example/vllm-project",
            "https://www.google.com/search?q=vllm",
          ],
          error: "",
          next_action: "Use GitHub evidence in candidate claims.",
        },
        {
          source_type: "paper",
          query: "vLLM site:arxiv.org",
          status: "unknown",
          urls_found: -1,
          evidence_found: 0,
          source_urls: [],
          error: "No concrete paper source found.",
        },
      ],
    },
  });

  assert.equal(result.source_execution.summary, "Code source search completed; paper search still thin.");
  assert.equal(result.source_execution.jobs.length, 2);
  assert.equal(result.source_execution.jobs[0].status, "completed");
  assert.equal(result.source_execution.jobs[0].urls_found, 2);
  assert.equal(result.source_execution.jobs[0].evidence_found, 3);
  assert.deepEqual(result.source_execution.jobs[0].candidate_leads, ["Ada Lovelace"]);
  assert.deepEqual(result.source_execution.jobs[0].source_urls, ["https://github.com/example/vllm-project"]);
  assert.equal(result.source_execution.jobs[1].status, "planned");
  assert.equal(result.source_execution.jobs[1].coverage_group, "research");

  const fallback = buildSourceExecution(normalizeTalentSearchResult({
    search_brief: { original_query: "Find AI infra talent", required_skills: ["Triton"] },
    search_plan: {
      source_strategy: [
        { source_type: "paper", target: "arXiv", reason: "verify research" },
      ],
    },
  }));

  assert.equal(fallback.summary, "");
  assert.equal(fallback.jobs.length, 1);
  assert.equal(fallback.jobs[0].status, "planned");
  assert.match(fallback.jobs[0].query, /site:arxiv.org/);
});

test("builds coverage backfill plan from returned jobs or missing coverage", () => {
  const returned = normalizeTalentSearchResult({
    coverage_backfill: {
      summary: "Practice evidence is missing for two candidates.",
      jobs: [
        {
          gap_id: "practice-code",
          coverage_group: "practice",
          missing_source_type: "code",
          query: "vLLM site:github.com",
          reason: "No public code evidence yet.",
          priority: 2.4,
          status: "ready",
          candidate_names: ["Ada Lovelace", ""],
          source_types_to_check: ["code", "huggingface", ""],
        },
        {
          gap_id: "",
          coverage_group: "unknown",
          missing_source_type: "",
          query: "",
          reason: "",
        },
      ],
    },
  });

  assert.equal(returned.coverage_backfill.summary, "Practice evidence is missing for two candidates.");
  assert.equal(returned.coverage_backfill.jobs.length, 1);
  assert.equal(returned.coverage_backfill.jobs[0].coverage_group, "practice");
  assert.equal(returned.coverage_backfill.jobs[0].missing_source_type, "code");
  assert.equal(returned.coverage_backfill.jobs[0].priority, 2);
  assert.equal(returned.coverage_backfill.jobs[0].status, "planned");
  assert.deepEqual(returned.coverage_backfill.jobs[0].candidate_names, ["Ada Lovelace"]);
  assert.deepEqual(returned.coverage_backfill.jobs[0].source_types_to_check, ["code", "huggingface"]);

  const derived = buildCoverageBackfillPlan(normalizeTalentSearchResult({
    search_brief: {
      original_query: "Find LLM inference engineers",
      required_skills: ["vLLM"],
    },
    evidence_graph: {
      source_mix: [{ source_type: "paper", count: 2 }],
      candidates: [
        { candidate_name: "Ada Lovelace", source_types: ["paper"], risk_flags: ["No public implementation evidence"] },
      ],
    },
    source_execution: {
      jobs: [
        {
          source_type: "code",
          coverage_group: "practice",
          query: "vLLM site:github.com",
          status: "failed",
          error: "No concrete GitHub source found.",
        },
      ],
    },
    candidates: [{ name: "Ada Lovelace" }],
  }));

  assert.equal(derived.jobs.some((job) => job.coverage_group === "practice"), true);
  const practiceJob = derived.jobs.find((job) => job.coverage_group === "practice");
  assert.equal(practiceJob?.status, "planned");
  assert.match(practiceJob?.query ?? "", /site:github.com/);
  assert.deepEqual(practiceJob?.candidate_names, ["Ada Lovelace"]);
  assert.match(practiceJob?.reason ?? "", /缺少实践/);
  assert.match(derived.summary, /待补/);
});

test("builds focused search input for a coverage backfill job", () => {
  assert.equal(typeof talentProfile.buildBackfillSearchInput, "function");

  const input = talentProfile.buildBackfillSearchInput({
    job: {
      gap_id: "practice-code",
      coverage_group: "practice",
      missing_source_type: "code",
      query: "vLLM Triton site:github.com",
      reason: "No public implementation evidence yet.",
      priority: 1,
      status: "planned",
      candidate_names: ["Ada Lovelace", "Grace Hopper"],
      source_types_to_check: ["code", "huggingface"],
    },
    originalQuery: "Find senior LLM inference engineers in North America",
  });

  assert.match(input, /Coverage backfill search/);
  assert.match(input, /Find senior LLM inference engineers in North America/);
  assert.match(input, /practice/);
  assert.match(input, /code/);
  assert.match(input, /vLLM Triton site:github.com/);
  assert.match(input, /Ada Lovelace, Grace Hopper/);
  assert.match(input, /No public implementation evidence yet/);
  assert.match(input, /specific source URLs/);
});

test("summarizes backfill evidence that can merge into the original report", () => {
  assert.equal(typeof talentProfile.buildBackfillMergeSummary, "function");

  const originalResult = normalizeTalentSearchResult({
    evidence_graph: {
      source_mix: [{ source_type: "paper", count: 1 }],
      candidates: [
        { candidate_name: "Ada Lovelace", source_types: ["paper"], independent_sources: 1 },
      ],
    },
    candidates: [
      {
        name: "Ada Lovelace",
        claims: [
          {
            claim: "Published LLM systems research",
            verdict: "verified",
            evidence: [{ note: "paper", url: "https://arxiv.org/abs/1234.5678", source_type: "paper" }],
          },
        ],
      },
    ],
  });
  const backfillResult = normalizeTalentSearchResult({
    evidence_graph: {
      source_mix: [{ source_type: "code", count: 1 }],
      candidates: [
        { candidate_name: "Ada Lovelace", source_types: ["code"], independent_sources: 1 },
      ],
    },
    candidates: [
      {
        name: "Ada Lovelace",
        claims: [
          {
            claim: "Maintains a public vLLM integration",
            verdict: "verified",
            evidence: [{ note: "GitHub repo", url: "https://github.com/example/vllm", source_type: "code" }],
          },
        ],
      },
    ],
  });

  const summary = talentProfile.buildBackfillMergeSummary({ originalResult, backfillResult });

  assert.equal(summary.improved_candidates.length, 1);
  assert.equal(summary.improved_candidates[0].candidate_name, "Ada Lovelace");
  assert.equal(summary.improved_candidates[0].new_evidence_count, 1);
  assert.deepEqual(summary.improved_candidates[0].new_source_types, ["code"]);
  assert.deepEqual(summary.improved_candidates[0].new_evidence_urls, ["https://github.com/example/vllm"]);
  assert.equal(summary.coverage_gains.find((item) => item.key === "practice")?.before_count, 0);
  assert.equal(summary.coverage_gains.find((item) => item.key === "practice")?.after_count, 1);
  assert.match(summary.summary, /1 位候选人/);
  assert.match(summary.summary, /1 条新增证据/);
});

test("merges backfill evidence into the original talent report", () => {
  assert.equal(typeof talentProfile.mergeBackfillResult, "function");

  const originalResult = normalizeTalentSearchResult({
    search_brief: { original_query: "Find LLM infra engineers" },
    evidence_graph: {
      source_mix: [{ source_type: "paper", count: 1 }],
      candidates: [
        { candidate_name: "Ada Lovelace", source_types: ["paper"], independent_sources: 1 },
      ],
    },
    coverage_backfill: {
      jobs: [
        {
          gap_id: "practice-code",
          coverage_group: "practice",
          missing_source_type: "code",
          query: "vLLM site:github.com",
          reason: "No code evidence yet.",
        },
      ],
    },
    candidates: [
      {
        name: "Ada Lovelace",
        claims: [
          {
            claim: "Published LLM systems research",
            verdict: "verified",
            evidence: [{ note: "paper", url: "https://arxiv.org/abs/1234.5678", source_type: "paper" }],
          },
        ],
      },
    ],
  });
  const backfillResult = normalizeTalentSearchResult({
    evidence_graph: {
      source_mix: [{ source_type: "code", count: 1 }],
      candidates: [
        {
          candidate_name: "Ada Lovelace",
          source_types: ["code"],
          independent_sources: 1,
          strongest_evidence: ["Public vLLM integration"],
        },
      ],
    },
    candidates: [
      {
        name: "Ada Lovelace",
        claims: [
          {
            claim: "Maintains a public vLLM integration",
            verdict: "verified",
            evidence: [{ note: "GitHub repo", url: "https://github.com/example/vllm", source_type: "code" }],
          },
        ],
      },
    ],
  });

  const merged = talentProfile.mergeBackfillResult({ originalResult, backfillResult, mergedAt: "2026-06-03T00:00:00.000Z" });
  const candidate = merged.candidates.find((item) => item.name === "Ada Lovelace");
  assert.equal(candidate?.claims.length, 2);
  assert.equal(candidate?.claims[1].claim, "Maintains a public vLLM integration");
  assert.equal(merged.evidence_graph.source_mix.find((item) => item.source_type === "code")?.count, 1);
  assert.deepEqual(
    merged.evidence_graph.candidates.find((item) => item.candidate_name === "Ada Lovelace")?.source_types,
    ["paper", "code"],
  );
  assert.equal(merged.coverage_backfill.jobs.find((job) => job.gap_id === "practice-code")?.status, "completed");
  assert.equal(merged.backfill_merge.merged_at, "2026-06-03T00:00:00.000Z");
  const dossier = talentProfile.buildCandidateEvidenceDossier({ result: merged, candidate, locale: "zh" });
  assert.equal(dossier.backfill_delta.title, "补搜新增证据");
  assert.equal(dossier.backfill_delta.merged_at, "2026-06-03T00:00:00.000Z");
  assert.equal(dossier.backfill_delta.new_evidence_count, 1);
  assert.deepEqual(dossier.backfill_delta.new_source_types, ["code"]);
  assert.deepEqual(dossier.backfill_delta.new_evidence_urls, ["https://github.com/example/vllm"]);
  assert.match(dossier.backfill_delta.merge_note, /新增 code 来源证据/);

  const mergedAgain = talentProfile.mergeBackfillResult({ originalResult: merged, backfillResult, mergedAt: "2026-06-03T00:01:00.000Z" });
  const urls = mergedAgain.candidates
    .find((item) => item.name === "Ada Lovelace")
    ?.claims.flatMap((claim) => claim.evidence.map((evidence) => evidence.url));
  assert.equal(urls?.filter((url) => url === "https://github.com/example/vllm").length, 1);
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
  const { searchPrompt, verifyPrompt } = await import("./web/lib/miro.ts");
  const prompt = searchPrompt("Find AI infra engineers");
  const verify = verifyPrompt("Ada says she built a vLLM project.");

  assert.match(prompt, /"search_plan"/);
  assert.match(prompt, /"source_execution"/);
  assert.match(prompt, /"coverage_backfill"/);
  assert.match(prompt, /"evidence_graph"/);
  assert.match(prompt, /coverage_checklist/);
  assert.match(prompt, /missing_source_type/);
  assert.match(prompt, /source_types_to_check/);
  assert.match(prompt, /urls_found/);
  assert.match(prompt, /evidence_found/);
  assert.match(prompt, /coverage_group/);
  assert.match(prompt, /"query"/);
  assert.match(prompt, /research \| practice \| work_history \| public_voice/);
  assert.match(prompt, /patent \| dataset \| benchmark/);
  assert.match(prompt, /source_strategy/);
  assert.match(prompt, /independent_sources/);
  assert.match(prompt, /cross_validation/);
  assert.match(prompt, /OUTPUT LANGUAGE/);
  assert.match(prompt, /Platform language: Chinese \(Simplified\)/);
  assert.match(prompt, /user-facing text fields/);
  assert.match(prompt, /Do not paste raw source passages/);
  assert.match(verify, /OUTPUT LANGUAGE/);
  assert.match(verify, /Platform language: Chinese \(Simplified\)/);
  assert.match(verify, /claim/);
  assert.match(verify, /red_flags/);
});

test("worker prompt and normalizer support search plan and evidence graph", async () => {
  const { searchPrompt, verifyPrompt } = await import("./worker/lib.mjs");
  const prompt = searchPrompt("Find AI infra engineers");
  const verify = verifyPrompt("Ada says she built a vLLM project.");
  const result = normalizeWorkerTalentSearchResult({
    search_plan: {
      must_have: ["LLM serving"],
      source_strategy: [{ source_type: "", target: "GitHub", reason: "verify code", coverage_group: "practice", query: "site:github.com vLLM" }],
    },
    source_execution: {
      summary: "GitHub source completed.",
      jobs: [{
        source_type: "code",
        coverage_group: "practice",
        query: "site:github.com vLLM",
        status: "completed",
        urls_found: 1,
        evidence_found: 1,
        source_urls: ["https://github.com/example/vllm"],
      }],
    },
    coverage_backfill: {
      summary: "Practice coverage complete.",
      jobs: [{
        coverage_group: "practice",
        missing_source_type: "code",
        query: "site:github.com vLLM",
        reason: "Double-check implementation evidence.",
        candidate_names: ["Ada Lovelace"],
        source_types_to_check: ["code"],
      }],
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
  assert.match(prompt, /"source_execution"/);
  assert.match(prompt, /"coverage_backfill"/);
  assert.match(prompt, /"evidence_graph"/);
  assert.match(prompt, /coverage_checklist/);
  assert.match(prompt, /missing_source_type/);
  assert.match(prompt, /source_types_to_check/);
  assert.match(prompt, /urls_found/);
  assert.match(prompt, /evidence_found/);
  assert.match(prompt, /coverage_group/);
  assert.match(prompt, /"query"/);
  assert.match(prompt, /research \| practice \| work_history \| public_voice/);
  assert.match(prompt, /patent \| dataset \| benchmark/);
  assert.match(prompt, /source_strategy/);
  assert.match(prompt, /independent_sources/);
  assert.match(prompt, /cross_validation/);
  assert.match(prompt, /OUTPUT LANGUAGE/);
  assert.match(prompt, /Platform language: Chinese \(Simplified\)/);
  assert.match(prompt, /user-facing text fields/);
  assert.match(prompt, /Do not paste raw source passages/);
  assert.match(verify, /OUTPUT LANGUAGE/);
  assert.match(verify, /Platform language: Chinese \(Simplified\)/);
  assert.match(verify, /claim/);
  assert.match(verify, /red_flags/);
  assert.deepEqual(result.search_plan.must_have, ["LLM serving"]);
  assert.equal(result.search_plan.source_strategy[0].source_type, "other");
  assert.equal(result.search_plan.source_strategy[0].coverage_group, "practice");
  assert.equal(result.search_plan.source_strategy[0].query, "site:github.com vLLM");
  assert.equal(result.source_execution.jobs[0].status, "completed");
  assert.equal(result.source_execution.jobs[0].source_urls[0], "https://github.com/example/vllm");
  assert.equal(result.coverage_backfill.jobs[0].coverage_group, "practice");
  assert.equal(result.coverage_backfill.jobs[0].missing_source_type, "code");
  assert.equal(result.evidence_graph.candidates[0].candidate_name, "Ada Lovelace");
});
