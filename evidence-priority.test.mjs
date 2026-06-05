import test from "node:test";
import assert from "node:assert/strict";
import * as evidencePriority from "./web/lib/evidence-priority.mjs";
import {
  buildEvidencePriorityItem,
  buildEvidencePriorityView,
} from "./web/lib/evidence-priority.mjs";
import { normalizeTalentSearchResult } from "./web/lib/talent-profile.mjs";

function candidateFixture(overrides = {}) {
  return {
    name: "Ada Lovelace",
    current_role: "Staff Engineer",
    current_company: "Example AI",
    match_score: 91,
    score_breakdown: { evidence_quality: 88 },
    strongest_signals: ["Merged LLM serving PRs"],
    claims: [
      {
        claim: "Maintains an inference project",
        verdict: "verified",
        evidence: [{ note: "code", url: "https://github.com/example/inference", source_type: "code" }],
      },
      {
        claim: "Published serving research",
        verdict: "verified",
        evidence: [{ note: "paper", url: "https://arxiv.org/abs/1234.5678", source_type: "paper" }],
      },
      {
        claim: "Listed as staff engineer",
        verdict: "verified",
        evidence: [{ note: "company", url: "https://example.ai/team/ada", source_type: "company" }],
      },
      {
        claim: "Explained production tradeoffs",
        verdict: "verified",
        evidence: [{ note: "talk", url: "https://conf.example/talks/ada", source_type: "talk" }],
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
    ...overrides,
  };
}

function resultFixture(candidates) {
  return normalizeTalentSearchResult({
    evidence_graph: {
      candidates: candidates.map((candidate) => ({
        candidate_name: candidate.name,
        independent_sources: candidate.independent_sources ?? 4,
        source_types: candidate.source_types ?? ["code", "paper", "company", "talk"],
        strongest_evidence: ["Public evidence agrees."],
        weakest_evidence: [],
        cross_validation: "Code, paper, company, and talk sources agree.",
        risk_flags: candidate.risk_flags ?? [],
      })),
    },
    candidates,
  });
}

test("marks high match, high evidence, low risk candidates ready to review", () => {
  const result = resultFixture([candidateFixture()]);

  const item = buildEvidencePriorityItem({ candidate: result.candidates[0], result, locale: "zh" });

  assert.equal(item.name, "Ada Lovelace");
  assert.equal(item.candidate_index, 0);
  assert.equal(item.role, "Staff Engineer / Example AI");
  assert.equal(item.match_score, 91);
  assert.equal(item.evidence_quality, "high");
  assert.equal(item.independent_sources, 4);
  assert.equal(item.verified_count, 4);
  assert.equal(item.unverified_count, 0);
  assert.equal(item.contradicted_count, 0);
  assert.equal(item.risk_count, 0);
  assert.equal(item.priority, "ready_to_review");
  assert.equal(item.priority_label, "可优先审阅");
  assert.match(item.priority_reason, /高匹配/);
  assert.match(item.recommended_action, /候选人详情/);
});

test("marks thin or unverified evidence as needing backfill", () => {
  const thinEvidenceCandidate = candidateFixture({
    name: "Grace Hopper",
    match_score: 88,
    claims: [
      {
        claim: "Built an evaluation system",
        verdict: "verified",
        evidence: [{ note: "code", url: "https://github.com/example/eval", source_type: "code" }],
      },
      { claim: "Led production rollout", verdict: "unverified", evidence: [] },
      { claim: "Owned model monitoring", verdict: "unverified", evidence: [] },
    ],
    evidence_audit: {
      verified_claims: [],
      unverified_claims: [],
      contradicted_claims: [],
      single_source_claims: [],
      identity_risks: [],
      recency_notes: [],
      overall_evidence_quality: "medium",
    },
    independent_sources: 1,
    source_types: ["code"],
  });
  const result = resultFixture([thinEvidenceCandidate]);

  const item = buildEvidencePriorityItem({ candidate: result.candidates[0], result, locale: "zh" });

  assert.equal(item.priority, "needs_backfill");
  assert.equal(item.priority_label, "需要补证据");
  assert.equal(item.independent_sources, 1);
  assert.equal(item.unverified_count, 2);
  assert.match(item.priority_reason, /独立信源不足|未验证/);
  assert.match(item.recommended_action, /补搜/);
});

test("marks contradictions or identity risks for risk review", () => {
  const riskyCandidate = candidateFixture({
    name: "Katherine Johnson",
    match_score: 82,
    claims: [
      {
        claim: "Worked at Example AI in 2024",
        verdict: "contradicted",
        evidence: [{ note: "profile", url: "https://example.com/profile/katherine", source_type: "profile" }],
      },
    ],
    evidence_audit: {
      verified_claims: [],
      unverified_claims: [],
      contradicted_claims: ["Worked at Example AI in 2024"],
      single_source_claims: [],
      identity_risks: ["Same-name profile conflicts with GitHub account."],
      recency_notes: [],
      overall_evidence_quality: "high",
    },
    risk_flags: ["Employment history conflicts across sources."],
  });
  const result = resultFixture([riskyCandidate]);

  const item = buildEvidencePriorityItem({ candidate: result.candidates[0], result, locale: "en" });

  assert.equal(item.priority, "risk_review");
  assert.equal(item.priority_label, "Risk review");
  assert.equal(item.contradicted_count, 1);
  assert.equal(item.risk_count, 3);
  assert.match(item.priority_reason, /contradiction|identity risk/i);
  assert.match(item.recommended_action, /Review conflicting evidence/);
});

test("builds summary counts and action-first item ordering", () => {
  const ready = candidateFixture({ name: "Ready Candidate", match_score: 91 });
  const backfill = candidateFixture({
    name: "Backfill Candidate",
    match_score: 89,
    evidence_audit: {
      verified_claims: [],
      unverified_claims: [],
      contradicted_claims: [],
      single_source_claims: ["Private rollout ownership"],
      identity_risks: [],
      recency_notes: [],
      overall_evidence_quality: "low",
    },
    claims: [{ claim: "Private rollout ownership", verdict: "unverified", evidence: [] }],
    independent_sources: 1,
    source_types: ["profile"],
  });
  const risk = candidateFixture({
    name: "Risk Candidate",
    match_score: 72,
    claims: [{ claim: "Founded Example AI", verdict: "contradicted", evidence: [] }],
    evidence_audit: {
      verified_claims: [],
      unverified_claims: [],
      contradicted_claims: ["Founded Example AI"],
      single_source_claims: [],
      identity_risks: [],
      recency_notes: [],
      overall_evidence_quality: "medium",
    },
  });
  const result = resultFixture([ready, backfill, risk]);

  const view = buildEvidencePriorityView({ result, locale: "zh" });

  assert.deepEqual(view.summary, {
    ready_to_review: 1,
    needs_backfill: 1,
    risk_review: 1,
  });
  assert.equal(view.empty, false);
  assert.deepEqual(view.items.map((item) => item.priority), [
    "risk_review",
    "needs_backfill",
    "ready_to_review",
  ]);
  assert.deepEqual(view.items.map((item) => item.candidate_index), [2, 1, 0]);
});

test("returns an empty view for empty candidate pools", () => {
  const view = buildEvidencePriorityView({ candidates: [], locale: "en" });

  assert.deepEqual(view.summary, {
    ready_to_review: 0,
    needs_backfill: 0,
    risk_review: 0,
  });
  assert.deepEqual(view.items, []);
  assert.equal(view.empty, true);
});

test("keeps duplicate-name candidates distinct by candidate index", () => {
  const first = candidateFixture({ name: "Duplicate Name", match_score: 92 });
  const second = candidateFixture({
    name: "Duplicate Name",
    match_score: 78,
    claims: [{ claim: "Founded Example AI", verdict: "contradicted", evidence: [] }],
    evidence_audit: {
      verified_claims: [],
      unverified_claims: [],
      contradicted_claims: ["Founded Example AI"],
      single_source_claims: [],
      identity_risks: [],
      recency_notes: [],
      overall_evidence_quality: "medium",
    },
    risk_flags: ["Contradicted founder claim."],
  });
  const result = resultFixture([first, second]);

  const view = buildEvidencePriorityView({ result, locale: "en" });

  assert.equal(view.items[0].candidate_index, 1);
  assert.equal(view.items[0].priority, "risk_review");
  assert.equal(view.items[1].candidate_index, 0);
  assert.equal(view.items[1].priority, "ready_to_review");
});

test("builds a project evidence matrix from shortlist status and evidence priority", () => {
  const ready = candidateFixture({ name: "Ready Candidate", match_score: 91 });
  const backfill = candidateFixture({
    name: "Backfill Candidate",
    match_score: 84,
    evidence_audit: {
      verified_claims: [],
      unverified_claims: [],
      contradicted_claims: [],
      single_source_claims: ["Single-source product launch"],
      identity_risks: [],
      recency_notes: [],
      overall_evidence_quality: "low",
    },
    claims: [{ claim: "Single-source product launch", verdict: "unverified", evidence: [] }],
    independent_sources: 1,
    source_types: ["profile"],
  });
  const risk = candidateFixture({
    name: "Risk Candidate",
    match_score: 79,
    claims: [{ claim: "Led Example AI research", verdict: "contradicted", evidence: [] }],
    evidence_audit: {
      verified_claims: [],
      unverified_claims: [],
      contradicted_claims: ["Led Example AI research"],
      single_source_claims: [],
      identity_risks: [],
      recency_notes: [],
      overall_evidence_quality: "medium",
    },
    risk_flags: ["Role history conflicts across public profiles."],
  });

  assert.equal(typeof evidencePriority.buildProjectEvidenceMatrix, "function");

  const matrix = evidencePriority.buildProjectEvidenceMatrix({
    locale: "zh",
    items: [
      { id: "ready-id", status: "interviewing", candidate: ready },
      { id: "backfill-id", status: "new", candidate: backfill },
      { id: "risk-id", status: "rejected", candidate: risk },
    ],
  });

  assert.equal(matrix.title, "项目证据矩阵");
  assert.equal(matrix.empty, false);
  assert.deepEqual(matrix.summary, {
    total: 3,
    active: 1,
    rejected: 1,
    ready_to_review: 1,
    needs_backfill: 1,
    risk_review: 1,
  });
  assert.deepEqual(
    matrix.rows.map((row) => [row.id, row.status, row.status_label, row.priority, row.priority_label]),
    [
      ["risk-id", "rejected", "已拒", "risk_review", "风险复核"],
      ["backfill-id", "new", "待联系", "needs_backfill", "需要补证据"],
      ["ready-id", "interviewing", "面试中", "ready_to_review", "可优先审阅"],
    ],
  );
  assert.equal(matrix.rows[0].decision_hint, "保留为负向样本，避免下一轮重复推荐。");
  assert.match(matrix.rows[1].recommended_action, /补搜/);
  assert.equal(matrix.rows[2].decision_hint, "已进入推进中，优先补备注、外联或安排面试。");
});
