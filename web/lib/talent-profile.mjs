export const AI_DIRECTIONS = [
  "AI Infrastructure / LLM Systems",
  "AI Research / Applied Science",
  "Applied AI / Agents",
  "ML Platform / MLOps",
  "Data / Evaluation / Safety",
  "AI Product / Solutions",
  "Founder / Builder",
];

export const VERDICTS = ["verified", "contradicted", "unverified"];
export const EVIDENCE_QUALITY = ["high", "medium", "low"];

export function isSearchUrl(url) {
  return (
    typeof url === "string" &&
    /(google|bing|duckduckgo)\.[a-z.]+\/(search|url)|[?&]q=/i.test(url)
  );
}

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function clampScore(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function normalizeEvidence(evidence) {
  return (Array.isArray(evidence) ? evidence : [])
    .filter((item) => item && typeof item === "object")
    .map((item) => ({
      note: cleanString(item.note),
      url: cleanString(item.url),
      source_type: cleanString(item.source_type) || "other",
    }))
    .filter((item) => item.url && !isSearchUrl(item.url));
}

function normalizeClaim(claim) {
  const evidence = normalizeEvidence(claim?.evidence);
  let verdict = cleanString(claim?.verdict).toLowerCase();
  if (!VERDICTS.includes(verdict)) verdict = "unverified";
  if (verdict === "verified" && evidence.length === 0) verdict = "unverified";
  return {
    claim: cleanString(claim?.claim),
    verdict,
    evidence,
  };
}

function normalizeLinks(links = {}) {
  links = isPlainObject(links) ? links : {};
  return {
    github: cleanString(links.github) || null,
    linkedin: cleanString(links.linkedin) || null,
    scholar: cleanString(links.scholar) || null,
    huggingface: cleanString(links.huggingface) || null,
    website: cleanString(links.website) || null,
    other: cleanString(links.other) || null,
  };
}

function normalizeScoreBreakdown(score = {}) {
  score = isPlainObject(score) ? score : {};
  return {
    achievement_signals: clampScore(score.achievement_signals),
    skill_match: clampScore(score.skill_match),
    work_history: clampScore(score.work_history),
    evidence_quality: clampScore(score.evidence_quality),
  };
}

function normalizeAudit(audit = {}) {
  audit = isPlainObject(audit) ? audit : {};
  const quality = cleanString(audit.overall_evidence_quality).toLowerCase();
  return {
    verified_claims: Array.isArray(audit.verified_claims) ? audit.verified_claims.map(cleanString).filter(Boolean) : [],
    unverified_claims: Array.isArray(audit.unverified_claims) ? audit.unverified_claims.map(cleanString).filter(Boolean) : [],
    contradicted_claims: Array.isArray(audit.contradicted_claims) ? audit.contradicted_claims.map(cleanString).filter(Boolean) : [],
    single_source_claims: Array.isArray(audit.single_source_claims) ? audit.single_source_claims.map(cleanString).filter(Boolean) : [],
    identity_risks: Array.isArray(audit.identity_risks) ? audit.identity_risks.map(cleanString).filter(Boolean) : [],
    recency_notes: Array.isArray(audit.recency_notes) ? audit.recency_notes.map(cleanString).filter(Boolean) : [],
    overall_evidence_quality: EVIDENCE_QUALITY.includes(quality) ? quality : "medium",
  };
}

function normalizeCandidate(candidate = {}) {
  candidate = isPlainObject(candidate) ? candidate : {};
  const claims = (Array.isArray(candidate.claims) ? candidate.claims : []).map(normalizeClaim);
  return {
    name: cleanString(candidate.name) || "Unknown candidate",
    headline: cleanString(candidate.headline),
    location: cleanString(candidate.location) || null,
    current_role: cleanString(candidate.current_role) || null,
    current_company: cleanString(candidate.current_company) || null,
    ai_directions: Array.isArray(candidate.ai_directions)
      ? candidate.ai_directions.map(cleanString).filter(Boolean)
      : [],
    match_score: clampScore(candidate.match_score),
    score_breakdown: normalizeScoreBreakdown(candidate.score_breakdown),
    strongest_signals: Array.isArray(candidate.strongest_signals)
      ? candidate.strongest_signals.map(cleanString).filter(Boolean).slice(0, 5)
      : [],
    uncertainties: Array.isArray(candidate.uncertainties)
      ? candidate.uncertainties.map(cleanString).filter(Boolean).slice(0, 5)
      : [],
    links: normalizeLinks(candidate.links),
    claims,
    evidence_audit: normalizeAudit(candidate.evidence_audit),
    outreach_angle: cleanString(candidate.outreach_angle),
    summary: cleanString(candidate.summary),
  };
}

function normalizeBrief(brief = {}) {
  brief = isPlainObject(brief) ? brief : {};
  return {
    original_query: cleanString(brief.original_query),
    target_directions: Array.isArray(brief.target_directions) ? brief.target_directions.map(cleanString).filter(Boolean) : [],
    required_skills: Array.isArray(brief.required_skills) ? brief.required_skills.map(cleanString).filter(Boolean) : [],
    preferred_skills: Array.isArray(brief.preferred_skills) ? brief.preferred_skills.map(cleanString).filter(Boolean) : [],
    seniority: cleanString(brief.seniority) || null,
    geography: cleanString(brief.geography) || null,
    evidence_preferences: Array.isArray(brief.evidence_preferences) ? brief.evidence_preferences.map(cleanString).filter(Boolean) : [],
    exclusions: Array.isArray(brief.exclusions) ? brief.exclusions.map(cleanString).filter(Boolean) : [],
  };
}

function normalizeTalentMap(map = []) {
  return (Array.isArray(map) ? map : []).map((item) => {
    item = isPlainObject(item) ? item : {};
    return {
      direction: cleanString(item.direction),
      fit: cleanString(item.fit) || "adjacent",
      candidate_count: Math.max(0, Number(item.candidate_count) || 0),
      rationale: cleanString(item.rationale),
    };
  }).filter((item) => item.direction);
}

export function normalizeTalentSearchResult(data) {
  const source = isPlainObject(data) ? data : {};
  return {
    search_brief: normalizeBrief(source.search_brief),
    talent_map: normalizeTalentMap(source.talent_map),
    candidates: (Array.isArray(source.candidates) ? source.candidates : []).map(normalizeCandidate),
  };
}

export function isTalentSearchResult(data) {
  return Boolean(
    isPlainObject(data) &&
    Array.isArray(data.candidates) &&
    (data.search_brief || data.talent_map || data.candidates.some((candidate) => isPlainObject(candidate) && "match_score" in candidate)),
  );
}
