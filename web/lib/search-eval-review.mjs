export const REVIEW_VERDICTS = ["pass", "revise", "uncertain"];

const REVIEW_VERDICT_SET = new Set(REVIEW_VERDICTS);
const MAX_REVIEWER_NAME_LENGTH = 120;
const MAX_NOTE_LENGTH = 2_000;

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function uniqueStrings(values) {
  return [...new Set(values.filter((value) => typeof value === "string" && value.trim()).map((value) => value.trim()))];
}

function candidateFor(caseDefinition) {
  const candidate = Array.isArray(caseDefinition?.known_relevant) ? caseDefinition.known_relevant[0] : null;
  if (!candidate || !text(candidate.name) || !text(candidate.canonical_url)) return null;
  return { name: text(candidate.name), canonicalUrl: text(candidate.canonical_url) };
}

function evidenceFor(caseDefinition, candidate) {
  const judgment = Array.isArray(caseDefinition?.judgments) ? caseDefinition.judgments[0] : null;
  return uniqueStrings([
    candidate.canonicalUrl,
    ...(Array.isArray(judgment?.evidence_urls) ? judgment.evidence_urls : []),
  ]);
}

export function projectSearchEvalCases(fixture) {
  if (!fixture || typeof fixture !== "object" || !Array.isArray(fixture.cases)) {
    throw new Error("Search Eval fixture is unavailable");
  }

  return fixture.cases.map((caseDefinition) => {
    const id = text(caseDefinition?.id);
    const candidate = candidateFor(caseDefinition);
    if (!id || !candidate) throw new Error("Search Eval fixture contains an invalid review case");
    return {
      id,
      difficulty: text(caseDefinition.difficulty),
      brief: text(caseDefinition.brief),
      requiredConditions: uniqueStrings(caseDefinition.required_conditions ?? []),
      excludedConditions: uniqueStrings(caseDefinition.excluded_conditions ?? []),
      candidate,
      evidenceUrls: evidenceFor(caseDefinition, candidate),
    };
  });
}

export function searchEvalFixtureVersion(fixture) {
  const version = text(fixture?.schema_version);
  if (!version) throw new Error("Search Eval fixture has no version");
  return version;
}

export function summarizeIndependentReview(entries, caseIds) {
  const expected = new Set(caseIds);
  const totals = { total: expected.size, reviewed: 0, pass: 0, revise: 0, uncertain: 0 };
  const seen = new Set();
  for (const entry of Array.isArray(entries) ? entries : []) {
    if (!entry || !expected.has(entry.caseId) || seen.has(entry.caseId) || !REVIEW_VERDICT_SET.has(entry.verdict)) continue;
    seen.add(entry.caseId);
    totals.reviewed += 1;
    totals[entry.verdict] += 1;
  }
  return { ...totals, complete: totals.reviewed === totals.total, allPass: totals.total > 0 && totals.pass === totals.total };
}

export function parseIndependentReviewSubmission(body, { caseIds, fixtureVersion }) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  if (text(body.fixture_version) !== fixtureVersion) return null;

  const reviewerName = text(body.reviewer_name);
  if (reviewerName.length < 2 || reviewerName.length > MAX_REVIEWER_NAME_LENGTH) return null;
  if (!Array.isArray(body.entries) || body.entries.length !== caseIds.length) return null;

  const expected = new Set(caseIds);
  const seen = new Set();
  const entries = [];
  for (const candidate of body.entries) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return null;
    const caseId = text(candidate.case_id);
    const verdict = text(candidate.verdict);
    const notes = text(candidate.notes);
    if (!expected.has(caseId) || seen.has(caseId) || !REVIEW_VERDICT_SET.has(verdict) || notes.length > MAX_NOTE_LENGTH) return null;
    if (verdict !== "pass" && !notes) return null;
    seen.add(caseId);
    entries.push({ caseId, verdict, notes });
  }
  if (seen.size !== expected.size) return null;

  return { reviewerName, entries };
}
