import test from "node:test";
import assert from "node:assert/strict";
import fixture from "./docs/evals/search-eval-v1-cases.json" with { type: "json" };
import { evaluationEligibility, scoreCase, stableCandidateIdentity } from "./web/lib/search-eval.mjs";

const metrics = { duration_ms: 1200, search_count: 3, fetch_count: 8 };
const cases = fixture.cases;

const baseCase = {
  id: "metric-fixture",
  difficulty: "L2",
  required_conditions: ["Agent infrastructure"],
  excluded_conditions: ["Agency recruiter"],
  known_relevant: [
    { name: "Ada Lovelace", company: "Analytical Engines" },
    { canonical_url: "https://github.com/grace-hopper" },
  ],
  judgments: [
    { name: "Ada Lovelace", company: "Analytical Engines", relevance: "relevant", hard_conditions_met: true, identity_correct: true, evidence_verifiable: true, reviewer: "human-reviewer", review_status: "approved_human_review", reviewed_at: "2026-07-30T00:00:00.000Z", version: "v1" },
    { canonical_url: "https://github.com/grace-hopper", relevance: "relevant", hard_conditions_met: true, identity_correct: true, evidence_verifiable: true, reviewer: "human-reviewer", review_status: "approved_human_review", reviewed_at: "2026-07-30T00:00:00.000Z", version: "v1" },
    { name: "Off Target", company: "Agency", relevance: "non-relevant", hard_conditions_met: false, identity_correct: true, evidence_verifiable: true, reviewer: "human-reviewer", review_status: "approved_human_review", reviewed_at: "2026-07-30T00:00:00.000Z", version: "v1" },
  ],
  minimum_evidence: ["public profile", "primary work evidence"],
  review_status: "approved_human_review",
};

test("scores precision, recall, hard constraints, identity, and evidence using stable identities", () => {
  const score = scoreCase(baseCase, {
    candidates: [
      { name: "Ada Lovelace", current_company: "Analytical Engines", evidence: [{ url: "https://example.com/ada" }] },
      { name: "Off Target", current_company: "Agency", evidence: [{ url: "https://example.com/off-target" }] },
      { canonical_url: "https://github.com/grace-hopper", evidence: [{ url: "https://github.com/grace-hopper" }] },
      { name: "Another Person", current_company: "Elsewhere", evidence: [{ url: "https://example.com/another" }] },
      { name: "Fifth Person", current_company: "Elsewhere", evidence: [{ url: "https://example.com/fifth" }] },
    ],
    ...metrics,
  });

  assert.deepEqual(score, {
    status: "scored",
    precision_at_5: 0.4,
    precision_at_10: 0.4,
    known_relevant_recall_at_10: 1,
    hard_constraint_recall: 1,
    identity_errors: 0,
    valid_evidence_rate: 1,
  });
});

test("does not collapse same-name candidates across companies", () => {
  const score = scoreCase(baseCase, {
    candidates: [
      { name: "Ada Lovelace", current_company: "Wrong Company", evidence: [{ url: "https://example.com/wrong-ada" }] },
    ],
    ...metrics,
  });

  assert.equal(score.known_relevant_recall_at_10, 0);
  assert.equal(score.identity_errors, 1);
  assert.equal(stableCandidateIdentity({ name: "Ada Lovelace", current_company: "Wrong Company" }), "name_company:ada lovelace|wrong company");
});

test("reports a zero valid evidence rate when candidates have no verifiable evidence", () => {
  const score = scoreCase(baseCase, {
    candidates: [
      { name: "Ada Lovelace", current_company: "Analytical Engines", evidence: [] },
      { canonical_url: "https://github.com/grace-hopper", claims: [{ evidence: [] }] },
    ],
    ...metrics,
  });

  assert.equal(score.valid_evidence_rate, 0);
});

test("scores an empty completed result as zeros instead of treating it as missing", () => {
  const score = scoreCase(baseCase, { candidates: [], ...metrics });

  assert.deepEqual(score, {
    status: "scored",
    precision_at_5: 0,
    precision_at_10: 0,
    known_relevant_recall_at_10: 0,
    hard_constraint_recall: 0,
    identity_errors: 0,
    valid_evidence_rate: 0,
  });
});

test("returns inconclusive when candidates or required run metrics are missing", () => {
  assert.deepEqual(scoreCase(baseCase, { ...metrics }), { status: "inconclusive", reason: "missing_candidates" });
  assert.deepEqual(scoreCase(baseCase, { candidates: [], duration_ms: 1200, search_count: 3 }), { status: "inconclusive", reason: "missing_run_metrics" });
});

test("keeps draft fixtures out of passing evaluation until human review is approved", () => {
  const eligibility = evaluationEligibility({
    caseDefinition: baseCase,
    fixture: { review_status: "draft_pending_human_review" },
  });
  assert.deepEqual(eligibility, { status: "inconclusive", reason: "case_review_pending" });
  assert.deepEqual(
    scoreCase(baseCase, { candidates: [], ...metrics }, { fixture: { review_status: "draft_pending_human_review" } }),
    { status: "inconclusive", reason: "case_review_pending" },
  );
  assert.deepEqual(
    scoreCase({ ...baseCase, review_status: "draft_pending_human_review" }, { candidates: [], ...metrics }),
    { status: "inconclusive", reason: "case_review_pending" },
  );
});

test("does not let a case review-status field bypass missing approved judgments", () => {
  const score = scoreCase({ ...baseCase, judgments: [{ ...baseCase.judgments[0], reviewer: "pending-human-review", review_status: "approved_human_review" }] }, { candidates: [], ...metrics });
  assert.deepEqual(score, { status: "inconclusive", reason: "case_review_pending" });
  assert.deepEqual(
    scoreCase({ ...baseCase, review_status: "draft_pending_human_review" }, { candidates: [], ...metrics }, { fixture: { review_status: "approved_human_review" } }),
    { status: "inconclusive", reason: "case_review_pending" },
  );
});

test("deduplicates stable identities before precision and hard-constraint scoring", () => {
  const score = scoreCase(baseCase, {
    candidates: [
      { name: "Ada Lovelace", current_company: "Analytical Engines", evidence: [{ url: "https://example.com/ada" }] },
      { name: "Ada Lovelace", current_company: "Analytical Engines", evidence: [{ url: "https://example.com/ada-again" }] },
      { canonical_url: "https://github.com/grace-hopper", evidence: [{ url: "https://github.com/grace-hopper" }] },
    ],
    ...metrics,
  });
  assert.equal(score.known_relevant_recall_at_10, 1);
  assert.equal(score.hard_constraint_recall, 1);
  assert.equal(score.precision_at_5, 1);
});

test("ships exactly thirty human-review-pending cases with ten cases at every difficulty", () => {
  assert.equal(fixture.schema_version, "search-eval-v1-draft");
  assert.equal(fixture.review_status, "draft_pending_human_review");
  assert.match(fixture.annotation_note, /not a recruitment performance conclusion/i);
  assert.equal(cases.length, 30);
  assert.deepEqual(
    Object.fromEntries(["L1", "L2", "L3"].map((difficulty) => [difficulty, cases.filter((item) => item.difficulty === difficulty).length])),
    { L1: 10, L2: 10, L3: 10 },
  );

  for (const item of cases) {
    assert.ok(item.id && item.brief);
    assert.ok(Array.isArray(item.required_conditions) && Array.isArray(item.excluded_conditions));
    assert.deepEqual(item.known_relevant, []);
    assert.ok(Array.isArray(item.source_scaffolds) && item.source_scaffolds.length > 0);
    assert.ok(Array.isArray(item.judgments) && item.judgments.length > 0);
    assert.ok(Array.isArray(item.minimum_evidence) && item.minimum_evidence.length > 0);
    for (const source of item.source_scaffolds) {
      assert.ok(source.canonical_url, `${item.id} has a public source scaffold`);
    }
    for (const judgment of item.judgments) {
      assert.equal(judgment.relevance, "uncertain");
      assert.equal(typeof judgment.hard_conditions_met, "boolean");
      assert.equal(typeof judgment.identity_correct, "boolean");
      assert.equal(typeof judgment.evidence_verifiable, "boolean");
      assert.equal(judgment.reviewer, "pending-human-review");
      assert.equal(judgment.version, "v1-draft");
    }
  }
});
