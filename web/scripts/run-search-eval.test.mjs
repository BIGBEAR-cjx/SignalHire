import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { buildEvalReport, compareToBaseline, runSearchEval } from "./run-search-eval.mjs";

const approvedCase = {
  id: "case-1",
  review_status: "approved_human_review",
  known_relevant: [{ name: "Ada Lovelace", company: "Analytical Engines" }],
  judgments: [{
    name: "Ada Lovelace",
    company: "Analytical Engines",
    relevance: "relevant",
    hard_conditions_met: true,
    identity_correct: true,
    reviewer: "reviewer",
    review_status: "approved_human_review",
    reviewed_at: "2026-07-30T00:00:00.000Z",
  }],
};

const completedRun = {
  id: "run-1",
  status: "completed",
  case_id: "case-1",
  evaluator_version: "eval-v1",
  strategy_version: "strategy-deep-v1",
  route: "deep",
  route_reason: "multiple hard conditions",
  result: {
    candidates: [{
      name: "Ada Lovelace",
      current_company: "Analytical Engines",
      evidence: [{ url: "https://example.com/ada" }],
    }],
    agent_execution: { telemetry: { duration_ms: 1200, search_count: 3, fetch_count: 8 } },
  },
};

test("builds a stable, sorted report with quality and latency fields", () => {
  const report = buildEvalReport([{ caseDefinition: approvedCase, run: completedRun }], {
    fixture: { review_status: "approved_human_review" },
    generatedAt: "2026-07-31T00:00:00.000Z",
  });

  assert.deepEqual(Object.keys(report), ["schema_version", "generated_at", "summary", "cases"]);
  assert.deepEqual(Object.keys(report.summary), [
    "status",
    "total_cases",
    "scored_cases",
    "inconclusive_cases",
    "precision_at_5",
    "precision_at_10",
    "known_relevant_recall_at_10",
    "hard_constraint_recall",
    "valid_evidence_rate",
    "identity_errors",
    "p50_duration_ms",
    "p95_duration_ms",
    "search_count",
    "fetch_count",
  ]);
  assert.equal(report.summary.status, "scored");
  assert.equal(report.summary.p95_duration_ms, 1200);
  assert.equal(report.cases[0].evaluator_version, "eval-v1");
  assert.equal(report.cases[0].strategy_version, "strategy-deep-v1");
  assert.equal(report.cases[0].route_reason, "multiple hard conditions");
});

test("fails the comparison when a quality or p95 regression exceeds the gate", () => {
  const baseline = { summary: { status: "scored", precision_at_10: 0.8, hard_constraint_recall: 0.8, valid_evidence_rate: 0.8, p95_duration_ms: 1000 } };
  const current = { summary: { status: "scored", precision_at_10: 0.74, hard_constraint_recall: 0.8, valid_evidence_rate: 0.8, p95_duration_ms: 1300 } };

  const comparison = compareToBaseline(current, baseline);
  assert.equal(comparison.status, "failed");
  assert.equal(comparison.failed, true);
  assert.deepEqual(comparison.failures.map((failure) => failure.metric), ["precision_at_10", "p95_duration_ms"]);
});

test("fails closed when baseline or current comparison metrics are invalid", () => {
  const valid = { summary: { status: "scored", precision_at_10: 0.8, hard_constraint_recall: 0.8, valid_evidence_rate: 0.8, p95_duration_ms: 1000 } };

  assert.deepEqual(
    compareToBaseline(valid, { summary: { ...valid.summary, p95_duration_ms: -1 } }),
    { status: "inconclusive", failed: false, failures: [], reason: "invalid_comparison_metrics" },
  );
  assert.deepEqual(
    compareToBaseline({ summary: { ...valid.summary, valid_evidence_rate: 1.1 } }, valid),
    { status: "inconclusive", failed: false, failures: [], reason: "invalid_comparison_metrics" },
  );
});

test("reports inconclusive instead of passing missing labels or incomplete run exports", async () => {
  const report = buildEvalReport([{ caseDefinition: approvedCase, run: { ...completedRun, route_reason: "" } }], {
    fixture: { review_status: "approved_human_review" },
    generatedAt: "2026-07-31T00:00:00.000Z",
  });
  assert.equal(report.summary.status, "inconclusive");
  assert.equal(report.cases[0].reason, "missing_run_metadata");

  const output = await mkdtemp(join(tmpdir(), "signalhire-search-eval-"));
  try {
    const casesPath = join(output, "cases.json");
    const runsPath = join(output, "runs.json");
    await writeFile(casesPath, JSON.stringify({ review_status: "approved_human_review", cases: [approvedCase] }));
    await writeFile(runsPath, JSON.stringify([completedRun]));
    const result = await runSearchEval({ casesPath, runsPath, outDir: output, generatedAt: "2026-07-31T00:00:00.000Z" });
    assert.equal(result.exitCode, 0);
    const json = JSON.parse(await readFile(join(output, "search-eval.json"), "utf8"));
    assert.equal(json.summary.status, "scored");
  } finally {
    await rm(output, { recursive: true, force: true });
  }
});

test("keeps evaluation internal and documents the approved review boundary", async () => {
  const [productionSearchRoute, readme] = await Promise.all([
    readFile(new URL("../app/api/search/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../../README.md", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(productionSearchRoute, /(?:from\s+["'][^"']*(?:search-eval|run-search-eval)[^"']*["']|import\(\s*["'][^"']*(?:search-eval|run-search-eval))/);
  assert.match(readme, /known-relevant recall/i);
  assert.match(readme, /does not route or enqueue production search/i);
});
