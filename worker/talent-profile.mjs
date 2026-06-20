import { createHash } from "node:crypto";

export const AI_DIRECTIONS = [
  "AI Infrastructure / LLM Systems",
  "AI Research / Applied Science",
  "Applied AI / Agents",
  "ML Platform / MLOps",
  "Data / Evaluation / Safety",
  "AI Product / Solutions",
  "Founder / Builder",
];
export const AI_VERTICAL_TAXONOMY = [
  { tag: "LLM infra", terms: ["llm infra", "llm systems", "inference", "serving", "vllm", "sglang", "tensorrt-llm", "triton", "cuda", "gpu"] },
  { tag: "RAG", terms: ["rag", "retrieval", "vector", "embedding", "rerank", "knowledge base"] },
  { tag: "agent", terms: ["agent", "agents", "tool use", "workflow", "multi-agent", "automation"] },
  { tag: "multimodal", terms: ["multimodal", "vision-language", "vlm", "image", "video", "audio", "ocr"] },
  { tag: "eval", terms: ["eval", "evaluation", "benchmark", "safety", "red team", "observability", "quality"] },
  { tag: "AI product", terms: ["ai product", "product", "copilot", "llm app", "solution", "workflow"] },
  { tag: "AI GTM", terms: ["ai gtm", "gtm", "sales", "solution consultant", "field", "customer", "growth"] },
];

export const VERDICTS = ["verified", "contradicted", "unverified"];
export const EVIDENCE_QUALITY = ["high", "medium", "low"];
export const SOURCE_EXECUTION_STATUSES = ["planned", "completed", "partial", "failed"];
export const COVERAGE_BACKFILL_STATUSES = ["planned", "completed", "skipped"];
const MAX_CACHE_KEY_LENGTH = 240;

function shortHash(value) {
  return createHash("sha256").update(String(value ?? "")).digest("hex").slice(0, 16);
}

function compactKey(value, maxLength = MAX_CACHE_KEY_LENGTH) {
  const clean = cleanString(value);
  if (clean.length <= maxLength) return clean;
  const hash = shortHash(clean);
  const prefix = clean.slice(0, Math.max(0, maxLength - hash.length - 1)).trimEnd();
  return `${prefix}:${hash}`;
}

function truncateText(value, maxLength) {
  const clean = String(value ?? "").trim();
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

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

function emptyParsedSource(url) {
  return {
    url: cleanString(url),
    family: "other_public_source",
    coverage_group: "public_voice",
    source_type: "other",
    primary_id: "",
    secondary_id: "",
    host: "",
  };
}

export function parsePublicTalentSource(url) {
  const cleanUrl = cleanString(url);
  if (!cleanUrl || isSearchUrl(cleanUrl)) return emptyParsedSource(cleanUrl);
  let parsed;
  try {
    parsed = new URL(cleanUrl);
  } catch {
    return emptyParsedSource(cleanUrl);
  }
  const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
  const segments = parsed.pathname.split("/").map((segment) => decodeURIComponent(segment)).filter(Boolean);
  const base = { ...emptyParsedSource(cleanUrl), host };

  if (host === "github.com" && segments.length >= 2) {
    return { ...base, family: "github_repo", coverage_group: "practice", source_type: "code", primary_id: segments[0], secondary_id: segments[1] };
  }
  if (host === "arxiv.org" && ["abs", "pdf"].includes(segments[0]) && segments[1]) {
    return { ...base, family: "arxiv_paper", coverage_group: "research", source_type: "paper", primary_id: segments[1].replace(/\.pdf$/i, "") };
  }
  if (host === "openreview.net" && parsed.searchParams.get("id")) {
    return { ...base, family: "openreview_paper", coverage_group: "research", source_type: "paper", primary_id: parsed.searchParams.get("id") ?? "" };
  }
  if (host === "huggingface.co" && segments.length >= 2) {
    if (segments[0] === "datasets" && segments.length >= 3) {
      return { ...base, family: "huggingface_dataset", coverage_group: "research", source_type: "dataset", primary_id: segments[1], secondary_id: segments[2] };
    }
    if (segments[0] === "spaces" && segments.length >= 3) {
      return { ...base, family: "huggingface_space", coverage_group: "practice", source_type: "project", primary_id: segments[1], secondary_id: segments[2] };
    }
    return { ...base, family: "huggingface_model", coverage_group: "practice", source_type: "huggingface", primary_id: segments[0], secondary_id: segments[1] };
  }
  if (host === "scholar.google.com" && parsed.searchParams.get("user")) {
    return { ...base, family: "google_scholar_profile", coverage_group: "work_history", source_type: "profile", primary_id: parsed.searchParams.get("user") ?? "" };
  }
  if (segments.some((segment) => ["team", "people", "about-us", "about"].includes(segment.toLowerCase()))) {
    return { ...base, family: "company_team_page", coverage_group: "work_history", source_type: "company", primary_id: host };
  }
  return base;
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

function normalizeCoverageBackfillJob(job = {}, index = 0) {
  job = isPlainObject(job) ? job : {};
  const status = cleanString(job.status).toLowerCase();
  const coverageGroup = cleanString(job.coverage_group);
  const missingSourceType = cleanString(job.missing_source_type);
  return {
    gap_id: cleanString(job.gap_id) || `${coverageGroup || "coverage"}-${missingSourceType || index + 1}`,
    coverage_group: coverageGroup,
    missing_source_type: missingSourceType,
    query: cleanString(job.query),
    reason: cleanString(job.reason),
    priority: normalizeCount(job.priority) || index + 1,
    status: COVERAGE_BACKFILL_STATUSES.includes(status) ? status : "planned",
    candidate_names: cleanStringArray(job.candidate_names, 12),
    source_types_to_check: cleanStringArray(job.source_types_to_check, 8),
  };
}

function normalizeCoverageBackfill(backfill = {}) {
  backfill = isPlainObject(backfill) ? backfill : {};
  return {
    summary: cleanString(backfill.summary),
    jobs: (Array.isArray(backfill.jobs) ? backfill.jobs : [])
      .map(normalizeCoverageBackfillJob)
      .filter((job) => job.coverage_group && (job.missing_source_type || job.query || job.reason))
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
    coverage_backfill: normalizeCoverageBackfill(source.coverage_backfill),
    evidence_graph: normalizeEvidenceGraph(source.evidence_graph),
    talent_map: normalizeTalentMap(source.talent_map),
    candidates: (Array.isArray(source.candidates) ? source.candidates : []).map(normalizeCandidate),
    ...(isPlainObject(source.agent_execution) ? { agent_execution: source.agent_execution } : {}),
  };
}

export function isTalentSearchResult(data) {
  return Boolean(
    isPlainObject(data) &&
    Array.isArray(data.candidates) &&
    (data.search_brief || data.talent_map || data.candidates.some((candidate) => isPlainObject(candidate) && "match_score" in candidate)),
  );
}

function uniqueStrings(values, limit = 40) {
  const out = [];
  const seen = new Set();
  for (const value of values) {
    const clean = cleanString(value);
    const key = clean.toLowerCase();
    if (!clean || seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
    if (out.length >= limit) break;
  }
  return out;
}

function slugifyName(name) {
  return cleanString(name)
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96) || "unknown-candidate";
}

function candidateProfileCacheKey(userId, candidateCacheKey) {
  return compactKey(`${userId}:${candidateCacheKey}`, MAX_CACHE_KEY_LENGTH);
}

function candidateRole(candidate) {
  return uniqueStrings([candidate?.current_role, candidate?.current_company], 2).join(" · ") || candidate?.headline || "Role not confirmed";
}

function textForVerticalMatch(candidate) {
  return uniqueStrings([
    candidate?.name,
    candidateRole(candidate),
    candidate?.headline,
    ...(Array.isArray(candidate?.ai_directions) ? candidate.ai_directions : []),
    ...(Array.isArray(candidate?.strongest_signals) ? candidate.strongest_signals : []),
    ...(Array.isArray(candidate?.claims) ? candidate.claims.map((claim) => claim?.claim) : []),
  ], 80).join(" ").toLowerCase();
}

function inferVerticalTags(candidate) {
  const haystack = textForVerticalMatch(candidate);
  return AI_VERTICAL_TAXONOMY
    .filter((vertical) => vertical.terms.some((term) => haystack.includes(term)))
    .map((vertical) => vertical.tag);
}

function evidenceUrlsAndSourceTypes(candidate) {
  const urls = new Set();
  const sourceTypes = new Set();
  const structuredSources = new Map();
  for (const claim of Array.isArray(candidate?.claims) ? candidate.claims : []) {
    for (const evidence of Array.isArray(claim?.evidence) ? claim.evidence : []) {
      const url = cleanString(evidence?.url);
      if (url && !isSearchUrl(url)) {
        urls.add(url);
        const parsed = parsePublicTalentSource(url);
        if (parsed.source_type) sourceTypes.add(parsed.source_type);
        structuredSources.set(url, parsed);
      }
      const sourceType = cleanString(evidence?.source_type).toLowerCase();
      if (sourceType) sourceTypes.add(sourceType);
    }
  }
  return {
    evidence_urls: Array.from(urls).slice(0, 24),
    source_types: Array.from(sourceTypes).slice(0, 16),
    structured_sources: Array.from(structuredSources.values()).slice(0, 24),
  };
}

function candidateEvidenceQuality(candidate) {
  const quality = cleanString(candidate?.evidence_audit?.overall_evidence_quality).toLowerCase();
  return EVIDENCE_QUALITY.includes(quality) ? quality : "medium";
}

function candidateIndependentSourceCount(candidate) {
  return evidenceUrlsAndSourceTypes(candidate).source_types.length;
}

function buildCandidateProfileCacheEntry({ result, candidate } = {}) {
  const normalizedResult = normalizeTalentSearchResult(result);
  const selected = normalizeTalentSearchResult({ candidates: [candidate] }).candidates[0];
  const evidenceDetails = evidenceUrlsAndSourceTypes(selected);
  const verticalTags = inferVerticalTags(selected);
  const searchText = uniqueStrings([
    selected.name,
    candidateRole(selected),
    selected.headline,
    normalizedResult.search_brief.original_query,
    ...normalizedResult.search_brief.required_skills,
    ...selected.ai_directions,
    ...verticalTags,
    ...selected.strongest_signals,
    ...selected.claims.map((claim) => claim.claim),
  ], 40).join(" ");

  return {
    cache_key: slugifyName(selected.name),
    name: selected.name,
    role: candidateRole(selected),
    ai_directions: selected.ai_directions,
    vertical_tags: verticalTags,
    match_score: selected.match_score,
    confidence: candidateEvidenceQuality(selected),
    independent_sources: candidateIndependentSourceCount(selected),
    evidence_urls: evidenceDetails.evidence_urls,
    source_types: evidenceDetails.source_types,
    structured_sources: evidenceDetails.structured_sources,
    search_text: searchText,
  };
}

export function buildCandidateProfileRowsForRun({ userId, sourceRunId = null, observedAt = new Date().toISOString(), result } = {}) {
  if (!userId || !isTalentSearchResult(result)) return [];
  const normalized = normalizeTalentSearchResult(result);
  return normalized.candidates
    .map((candidate) => {
      const entry = buildCandidateProfileCacheEntry({ result: normalized, candidate });
      if (!entry.cache_key || !entry.name || entry.name === "Unknown candidate") return null;
      return {
        user_id: userId,
        source_run_id: sourceRunId,
        cache_key: candidateProfileCacheKey(userId, entry.cache_key),
        name: entry.name,
        current_role: candidate.current_role,
        current_company: candidate.current_company,
        role: entry.role,
        ai_directions: entry.ai_directions,
        vertical_tags: entry.vertical_tags,
        match_score: entry.match_score,
        confidence: entry.confidence,
        independent_sources: entry.independent_sources,
        source_types: entry.source_types,
        evidence_urls: entry.evidence_urls,
        search_text: entry.search_text.slice(0, 4000),
        profile: entry,
        first_seen_at: observedAt,
        last_seen_at: observedAt,
        updated_at: observedAt,
      };
    })
    .filter(Boolean);
}

export function buildCandidateEvidenceSourceRowsForRun({ userId, sourceRunId = null, observedAt = new Date().toISOString(), result } = {}) {
  if (!userId || !isTalentSearchResult(result)) return [];
  const normalized = normalizeTalentSearchResult(result);
  const rows = [];
  const seen = new Set();
  for (const candidate of normalized.candidates) {
    const entry = buildCandidateProfileCacheEntry({ result: normalized, candidate });
    if (!entry.cache_key || !entry.name || entry.name === "Unknown candidate") continue;
    const candidateCacheKey = candidateProfileCacheKey(userId, entry.cache_key);
    for (const claim of candidate.claims) {
      for (const evidence of claim.evidence) {
        if (!evidence.url) continue;
        const parsed = parsePublicTalentSource(evidence.url);
        const sourceKey = compactKey(`${candidateCacheKey}:${shortHash(`${parsed.url}:${claim.claim}`)}`);
        if (seen.has(sourceKey)) continue;
        seen.add(sourceKey);
        rows.push({
          user_id: userId,
          source_run_id: sourceRunId,
          candidate_profile_cache_key: candidateCacheKey,
          cache_key: sourceKey,
          candidate_name: entry.name,
          claim: truncateText(claim.claim, 500),
          verdict: claim.verdict,
          note: truncateText(evidence.note, 500),
          url: parsed.url,
          host: parsed.host,
          family: parsed.family,
          coverage_group: parsed.coverage_group,
          source_type: evidence.source_type || parsed.source_type,
          primary_id: parsed.primary_id,
          secondary_id: parsed.secondary_id,
          observed_at: observedAt,
          updated_at: observedAt,
        });
      }
    }
  }
  return rows;
}
