# P1 Search Eval v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a versioned internal search-evaluation baseline that reports quality and latency regressions without changing the user search path.

**Architecture:** Store reviewed golden cases as repository JSON, use pure metric functions against completed run artifacts, and generate versioned JSON/Markdown reports in a local output directory. Fast/deep is only a persisted experiment label/reason; no production routing change is included.

**Tech Stack:** Node.js, `node:test`, JSON fixtures, existing `research_runs` result/progress fields.

---

## File structure

- Create: `docs/evals/search-eval-v1-cases.json` — 30 reviewed L1/L2/L3 cases.
- Create: `web/lib/search-eval.mjs` — identity-aware metrics and thresholds.
- Create: `search-eval.test.mjs` — golden metric behavior.
- Create: `web/scripts/run-search-eval.mjs` — read completed runs and emit reports.
- Create: `web/scripts/run-search-eval.test.mjs` — runner failure/report behavior.
- Modify: `README.md` — internal eval command and interpretation.

### Task 1: Lock the golden-case schema and metrics

- [ ] **Step 1: Write failing metric tests**

```js
assert.deepEqual(scoreCase(caseWithTwoKnownRelevant, resultAtTen), {
  precision_at_5: 0.4, known_relevant_recall_at_10: 1, hard_constraint_recall: 1,
});
assert.equal(scoreCase(caseWithSameNameDifferentCompany, result).identity_errors, 1);
assert.equal(scoreCase(caseWithNoVerifiableEvidence, result).valid_evidence_rate, 0);
```

- [ ] **Step 2: Run red test**

Run: `node --test search-eval.test.mjs`

Expected: FAIL because `search-eval.mjs` does not exist.

- [ ] **Step 3: Add 30-case fixture and pure scoring**

Use case fields `id`, `difficulty`, `brief`, `required_conditions`, `excluded_conditions`, `known_relevant`, `judgments`, `minimum_evidence`. Give every known relevant entry a stable identity (name + company or canonical URL), not only a name. Return `inconclusive` if a completed result lacks candidates or required run metrics.

- [ ] **Step 4: Verify and commit**

Run: `node --test search-eval.test.mjs`

Expected: PASS.

```bash
git add docs/evals/search-eval-v1-cases.json web/lib/search-eval.mjs search-eval.test.mjs
git commit -m "test: add versioned search evaluation metrics"
```

### Task 2: Build the read-only evaluator and regression gate

- [ ] **Step 1: Write failing runner tests**

```js
assert.equal(buildEvalReport([scoredCase]).summary.p95_duration_ms, 1200);
assert.equal(compareToBaseline(regressed, baseline).failed, true);
assert.equal(compareToBaseline(inconclusive, baseline).status, "inconclusive");
```

- [ ] **Step 2: Run red test**

Run: `node --test run-search-eval.test.mjs`

Expected: FAIL for missing runner/report exports.

- [ ] **Step 3: Implement runner**

Accept `--cases`, `--runs`, `--baseline`, and `--out`; read only completed exported run JSON, attach evaluator/strategy/route/route reason, and write `<out>/search-eval.json` plus `<out>/search-eval.md`. Return non-zero for a regression (>5pp quality decline or >25% p95 increase) and for inconclusive data; never enqueue research work.

- [ ] **Step 4: Verify and commit**

Run: `node --test search-eval.test.mjs run-search-eval.test.mjs && node web/scripts/run-search-eval.mjs --help`

Expected: tests PASS and help exits 0.

```bash
git add web/scripts/run-search-eval.mjs web/scripts/run-search-eval.test.mjs web/lib/search-eval.mjs search-eval.test.mjs
git commit -m "feat: report search evaluation regressions"
```

### Task 3: Document and verify no user-path routing change

- [ ] **Step 1: Write a static contract test**

```js
assert.equal(await productionSearchRouteImportsEvaluator(), false);
assert.match(readme, /known-relevant recall/);
```

- [ ] **Step 2: Run red test**

Run: `node --test run-search-eval.test.mjs`

Expected: FAIL until command/docs assertions are added.

- [ ] **Step 3: Document exact command and boundaries**

Add one README section with the fixture path, report command, thresholds, `known-relevant recall` caveat, and explicit “does not route or enqueue production search” boundary. Keep `/api/search` unchanged.

- [ ] **Step 4: Verify and commit**

Run: `node --test search-eval.test.mjs run-search-eval.test.mjs`

Expected: PASS.

```bash
git add README.md web/scripts/run-search-eval.test.mjs
git commit -m "docs: explain internal search evaluation baseline"
```
