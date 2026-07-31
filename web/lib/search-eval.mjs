function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeKey(value) {
  return cleanString(value).toLowerCase().replace(/\s+/g, " ");
}

function canonicalUrl(value) {
  const url = cleanString(value);
  if (!url) return "";
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    parsed.search = "";
    return parsed.toString().replace(/\/$/, "").toLowerCase();
  } catch {
    return "";
  }
}

function candidateUrls(candidate = {}) {
  return [
    candidate.canonical_url,
    candidate.canonicalUrl,
    candidate.profile_url,
    candidate.profileUrl,
    candidate.url,
    candidate.linkedin_url,
    candidate.github_url,
  ].map(canonicalUrl).filter(Boolean);
}

export function stableCandidateIdentity(candidate = {}) {
  const url = candidateUrls(candidate)[0];
  if (url) return `url:${url}`;
  const name = normalizeKey(candidate.name || candidate.full_name || candidate.fullName);
  const company = normalizeKey(candidate.company || candidate.current_company || candidate.currentCompany);
  return name && company ? `name_company:${name}|${company}` : "";
}

function hasVerifiableEvidence(candidate = {}) {
  const evidence = [candidate.evidence, candidate.evidence_urls, candidate.evidenceUrls, candidate.sources]
    .flatMap((items) => Array.isArray(items) ? items : []);
  if (evidence.some((item) => typeof item === "string" ? Boolean(canonicalUrl(item)) : Boolean(canonicalUrl(item?.url || item?.canonical_url)))) return true;
  return Array.isArray(candidate.claims) && candidate.claims.some((claim) =>
    Array.isArray(claim?.evidence) && claim.evidence.some((item) => Boolean(canonicalUrl(item?.url || item?.canonical_url || item))),
  );
}

function finiteNonNegative(value) {
  return Number.isFinite(value) && value >= 0;
}

function requiredRunMetrics(result = {}) {
  const source = result.run_metrics && typeof result.run_metrics === "object" ? result.run_metrics : result;
  return [source.duration_ms, source.search_count, source.fetch_count];
}

export function evaluationEligibility({ caseDefinition, fixture } = {}) {
  const caseReviewStatus = cleanString(caseDefinition?.review_status);
  const fixtureReviewStatus = fixture ? cleanString(fixture.review_status) : "approved_human_review";
  const judgments = Array.isArray(caseDefinition?.judgments) ? caseDefinition.judgments : [];
  const hasApprovedJudgments = judgments.length > 0 && judgments.every((judgment) =>
    cleanString(judgment?.reviewer) &&
    cleanString(judgment.reviewer) !== "pending-human-review" &&
    cleanString(judgment?.review_status) === "approved_human_review" &&
    Number.isFinite(Date.parse(cleanString(judgment?.reviewed_at))),
  );
  if (caseReviewStatus !== "approved_human_review" || fixtureReviewStatus !== "approved_human_review" || !hasApprovedJudgments) {
    return { status: "inconclusive", reason: "case_review_pending" };
  }
  const knownRelevant = (caseDefinition?.known_relevant || []).map(stableCandidateIdentity).filter(Boolean);
  const hasApprovedGoldenLabel = knownRelevant.some((identity) => judgments.some((judgment) =>
    stableCandidateIdentity(judgment) === identity &&
    judgment.relevance === "relevant" &&
    judgment.hard_conditions_met === true,
  ));
  return hasApprovedGoldenLabel
    ? { status: "eligible" }
    : { status: "inconclusive", reason: "missing_approved_golden_labels" };
}

function judgmentFor(candidate, judgments) {
  const identity = stableCandidateIdentity(candidate);
  return identity ? judgments.find((judgment) => stableCandidateIdentity(judgment) === identity) || null : null;
}

function rate(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
}

function uniqueCandidates(candidates) {
  const seen = new Set();
  return candidates.filter((candidate) => {
    const identity = stableCandidateIdentity(candidate);
    if (!identity) return true;
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}

export function scoreCase(caseDefinition, result, { fixture } = {}) {
  const eligibility = evaluationEligibility({ caseDefinition, fixture });
  if (eligibility.status !== "eligible") return eligibility;
  if (!Array.isArray(result?.candidates)) return { status: "inconclusive", reason: "missing_candidates" };
  if (!requiredRunMetrics(result).every(finiteNonNegative)) return { status: "inconclusive", reason: "missing_run_metrics" };

  const judgments = Array.isArray(caseDefinition?.judgments) ? caseDefinition.judgments : [];
  const knownRelevant = new Set((caseDefinition?.known_relevant || []).map(stableCandidateIdentity).filter(Boolean));
  const relevantIdentities = new Set([
    ...knownRelevant,
    ...judgments.filter((item) => item.relevance === "relevant").map(stableCandidateIdentity).filter(Boolean),
  ]);
  const topTen = uniqueCandidates(result.candidates).slice(0, 10);
  const topFive = topTen.slice(0, 5);
  const matchedKnown = new Set();
  let hardMatches = 0;
  let identityErrors = 0;

  for (const candidate of topTen) {
    const identity = stableCandidateIdentity(candidate);
    const judgment = judgmentFor(candidate, judgments);
    if (!identity) identityErrors += 1;
    if (knownRelevant.has(identity)) matchedKnown.add(identity);
    if (judgment?.relevance === "relevant" && judgment.hard_conditions_met === true) hardMatches += 1;
    if (judgment?.identity_correct === false) identityErrors += 1;
    if (!judgment && candidate?.name && candidate?.current_company) {
      const sameNameKnown = (caseDefinition?.known_relevant || []).some((known) =>
        normalizeKey(known.name) === normalizeKey(candidate.name) && normalizeKey(known.company) !== normalizeKey(candidate.current_company),
      );
      if (sameNameKnown) identityErrors += 1;
    }
  }

  const hardConditionTotal = (caseDefinition?.known_relevant || []).filter((known) => {
    const judgment = judgments.find((item) => stableCandidateIdentity(item) === stableCandidateIdentity(known));
    return !judgment || judgment.hard_conditions_met === true;
  }).length;
  const relevantAt = (candidates) => candidates.filter((candidate) => relevantIdentities.has(stableCandidateIdentity(candidate))).length;

  return {
    status: "scored",
    precision_at_5: rate(relevantAt(topFive), topFive.length),
    precision_at_10: rate(relevantAt(topTen), topTen.length),
    known_relevant_recall_at_10: rate(matchedKnown.size, knownRelevant.size),
    hard_constraint_recall: rate(hardMatches, hardConditionTotal),
    identity_errors: identityErrors,
    valid_evidence_rate: rate(topTen.filter(hasVerifiableEvidence).length, topTen.length),
  };
}
