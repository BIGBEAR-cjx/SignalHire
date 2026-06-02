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
export const SOURCE_EXECUTION_STATUSES = ["planned", "completed", "partial", "failed"];

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

function cleanStringArray(value, limit = 20) {
  return Array.isArray(value) ? value.map(cleanString).filter(Boolean).slice(0, limit) : [];
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

function normalizeSourceUrls(value, limit = 12) {
  return cleanStringArray(value, limit).filter((url) => !isSearchUrl(url));
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
    verified_claims: cleanStringArray(audit.verified_claims),
    unverified_claims: cleanStringArray(audit.unverified_claims),
    contradicted_claims: cleanStringArray(audit.contradicted_claims),
    single_source_claims: cleanStringArray(audit.single_source_claims),
    identity_risks: cleanStringArray(audit.identity_risks),
    recency_notes: cleanStringArray(audit.recency_notes),
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
    ai_directions: cleanStringArray(candidate.ai_directions),
    match_score: clampScore(candidate.match_score),
    score_breakdown: normalizeScoreBreakdown(candidate.score_breakdown),
    strongest_signals: cleanStringArray(candidate.strongest_signals).slice(0, 5),
    uncertainties: cleanStringArray(candidate.uncertainties).slice(0, 5),
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
    target_directions: cleanStringArray(brief.target_directions),
    required_skills: cleanStringArray(brief.required_skills),
    preferred_skills: cleanStringArray(brief.preferred_skills),
    seniority: cleanString(brief.seniority) || null,
    geography: cleanString(brief.geography) || null,
    evidence_preferences: cleanStringArray(brief.evidence_preferences),
    exclusions: cleanStringArray(brief.exclusions),
  };
}

function normalizeCount(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n));
}

function normalizeSearchPlan(plan = {}) {
  plan = isPlainObject(plan) ? plan : {};
  return {
    must_have: cleanStringArray(plan.must_have),
    nice_to_have: cleanStringArray(plan.nice_to_have),
    exclusions: cleanStringArray(plan.exclusions),
    source_strategy: (Array.isArray(plan.source_strategy) ? plan.source_strategy : []).map((item) => {
      item = isPlainObject(item) ? item : {};
      return {
        source_type: cleanString(item.source_type) || "other",
        target: cleanString(item.target),
        reason: cleanString(item.reason),
        coverage_group: cleanString(item.coverage_group),
        query: cleanString(item.query),
      };
    }).filter((item) => item.target || item.reason).slice(0, 12),
    adjacent_pools: (Array.isArray(plan.adjacent_pools) ? plan.adjacent_pools : []).map((item) => {
      item = isPlainObject(item) ? item : {};
      return {
        pool: cleanString(item.pool),
        reason: cleanString(item.reason),
      };
    }).filter((item) => item.pool || item.reason).slice(0, 8),
  };
}

function normalizeSourceExecutionJob(job = {}, index = 0) {
  job = isPlainObject(job) ? job : {};
  const sourceType = cleanString(job.source_type) || "other";
  const status = cleanString(job.status).toLowerCase();
  return {
    job_id: cleanString(job.job_id) || `source-${index + 1}-${sourceType}`,
    source_type: sourceType,
    coverage_group: cleanString(job.coverage_group),
    query: cleanString(job.query),
    status: SOURCE_EXECUTION_STATUSES.includes(status) ? status : "planned",
    urls_found: normalizeCount(job.urls_found),
    evidence_found: normalizeCount(job.evidence_found),
    candidate_leads: cleanStringArray(job.candidate_leads, 12),
    source_urls: normalizeSourceUrls(job.source_urls),
    error: cleanString(job.error),
    next_action: cleanString(job.next_action),
  };
}

function normalizeSourceExecution(execution = {}) {
  execution = isPlainObject(execution) ? execution : {};
  return {
    summary: cleanString(execution.summary),
    jobs: (Array.isArray(execution.jobs) ? execution.jobs : [])
      .map(normalizeSourceExecutionJob)
      .filter((job) => job.query || job.source_urls.length || job.error || job.next_action)
      .slice(0, 16),
  };
}

function normalizeEvidenceGraph(graph = {}) {
  graph = isPlainObject(graph) ? graph : {};
  return {
    summary: cleanString(graph.summary),
    source_mix: (Array.isArray(graph.source_mix) ? graph.source_mix : []).map((item) => {
      item = isPlainObject(item) ? item : {};
      return {
        source_type: cleanString(item.source_type),
        count: normalizeCount(item.count),
      };
    }).filter((item) => item.source_type).slice(0, 12),
    candidates: (Array.isArray(graph.candidates) ? graph.candidates : []).map((candidate) => {
      candidate = isPlainObject(candidate) ? candidate : {};
      return {
        candidate_name: cleanString(candidate.candidate_name),
        independent_sources: normalizeCount(candidate.independent_sources),
        source_types: cleanStringArray(candidate.source_types, 12),
        strongest_evidence: cleanStringArray(candidate.strongest_evidence, 8),
        weakest_evidence: cleanStringArray(candidate.weakest_evidence, 8),
        cross_validation: cleanString(candidate.cross_validation),
        risk_flags: cleanStringArray(candidate.risk_flags, 8),
      };
    }).filter((candidate) => candidate.candidate_name || candidate.source_types.length || candidate.cross_validation).slice(0, 20),
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
    search_plan: normalizeSearchPlan(source.search_plan),
    source_execution: normalizeSourceExecution(source.source_execution),
    evidence_graph: normalizeEvidenceGraph(source.evidence_graph),
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
