import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  parseIndependentReviewSubmission,
  projectSearchEvalCases,
  searchEvalFixtureVersion,
  summarizeIndependentReview,
} from "./web/lib/search-eval-review.mjs";

const fixture = JSON.parse(await readFile(new URL("./docs/evals/search-eval-v1-cases.json", import.meta.url), "utf8"));
const cases = projectSearchEvalCases(fixture);
const caseIds = cases.map((item) => item.id);
const fixtureVersion = searchEvalFixtureVersion(fixture);

test("review projection keeps every candidate and at least two evidence links", () => {
  assert.equal(cases.length, 30);
  for (const item of cases) {
    assert.ok(item.id);
    assert.ok(item.candidate.name);
    assert.ok(item.evidenceUrls.length >= 2, `${item.id} needs independently reviewable evidence`);
  }
});

test("independent review requires a full, unique case set", () => {
  const input = parseIndependentReviewSubmission({
    reviewer_name: "Independent reviewer",
    fixture_version: fixtureVersion,
    entries: caseIds.map((case_id) => ({ case_id, verdict: "pass", notes: "" })),
  }, { caseIds, fixtureVersion });
  assert.equal(input?.entries.length, 30);

  assert.equal(parseIndependentReviewSubmission({
    reviewer_name: "Independent reviewer",
    fixture_version: fixtureVersion,
    entries: caseIds.slice(1).map((case_id) => ({ case_id, verdict: "pass", notes: "" })),
  }, { caseIds, fixtureVersion }), null);
});

test("revise and uncertain conclusions need an audit note", () => {
  const entries = caseIds.map((case_id) => ({ case_id, verdict: "pass", notes: "" }));
  entries[0] = { case_id: entries[0].case_id, verdict: "uncertain", notes: "" };
  assert.equal(parseIndependentReviewSubmission({ reviewer_name: "Independent reviewer", fixture_version: fixtureVersion, entries }, { caseIds, fixtureVersion }), null);
  entries[0] = { case_id: entries[0].case_id, verdict: "uncertain", notes: "Identity proof is not sufficient." };
  assert.equal(parseIndependentReviewSubmission({ reviewer_name: "Independent reviewer", fixture_version: fixtureVersion, entries }, { caseIds, fixtureVersion })?.entries[0].verdict, "uncertain");
});

test("source promotion only becomes eligible after every case passes", () => {
  const allPass = summarizeIndependentReview(caseIds.map((caseId) => ({ caseId, verdict: "pass" })), caseIds);
  assert.equal(allPass.complete, true);
  assert.equal(allPass.allPass, true);
  const incomplete = summarizeIndependentReview([{ caseId: caseIds[0], verdict: "pass" }], caseIds);
  assert.equal(incomplete.complete, false);
  assert.equal(incomplete.allPass, false);
});
