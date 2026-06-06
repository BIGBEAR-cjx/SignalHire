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
export const EVIDENCE_COVERAGE_GROUPS = [
  { key: "research", label: "研究", source_types: ["paper", "patent", "dataset", "benchmark"] },
  { key: "practice", label: "实践", source_types: ["code", "project", "huggingface"] },
  { key: "work_history", label: "工作经历", source_types: ["profile", "company", "community"] },
  { key: "public_voice", label: "公开表达", source_types: ["talk", "blog", "podcast", "interview"] },
];
export const SOURCE_EXECUTION_STATUSES = ["planned", "completed", "partial", "failed"];
export const COVERAGE_BACKFILL_STATUSES = ["planned", "completed", "skipped"];
const COVERAGE_GROUP_KEYS = EVIDENCE_COVERAGE_GROUPS.map((group) => group.key);
const SOURCE_TYPE_TO_COVERAGE_GROUP = new Map(
  EVIDENCE_COVERAGE_GROUPS.flatMap((group) => group.source_types.map((sourceType) => [sourceType, group.key])),
);
const SOURCE_QUERY_OPERATORS = {
  paper: "site:arxiv.org OR site:openreview.net OR site:semanticscholar.org",
  patent: "site:patents.google.com",
  dataset: "site:huggingface.co/datasets OR site:kaggle.com/datasets",
  benchmark: "site:paperswithcode.com OR benchmark",
  code: "site:github.com",
  project: "site:github.io OR project",
  huggingface: "site:huggingface.co",
  profile: "site:linkedin.com/in OR site:scholar.google.com",
  company: "site:*.ai/team OR site:*.com/team",
  community: "site:news.ycombinator.com OR site:reddit.com",
  talk: "site:youtube.com OR site:confreaks.tv OR talk",
  blog: "site:medium.com OR site:substack.com OR blog",
  podcast: "podcast interview",
  interview: "interview podcast",
};

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
        coverage_group: normalizeCoverageGroup(item.coverage_group, item.source_type),
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
    coverage_group: normalizeCoverageGroup(job.coverage_group, sourceType),
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
  const missingSourceType = cleanString(job.missing_source_type).toLowerCase();
  const coverageGroup = normalizeCoverageGroup(job.coverage_group, missingSourceType);
  const status = cleanString(job.status).toLowerCase();
  return {
    gap_id: cleanString(job.gap_id) || `${coverageGroup}-${missingSourceType || index + 1}`,
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

function normalizeCoverageGroup(value, sourceType = "") {
  const group = cleanString(value).toLowerCase();
  if (COVERAGE_GROUP_KEYS.includes(group)) return group;
  return SOURCE_TYPE_TO_COVERAGE_GROUP.get(cleanString(sourceType).toLowerCase()) || "practice";
}

function sourceQueryTerms(brief = {}) {
  const terms = [
    cleanString(brief.original_query),
    ...cleanStringArray(brief.required_skills, 6),
    ...cleanStringArray(brief.target_directions, 3),
  ].filter(Boolean);
  return Array.from(new Set(terms)).join(" ");
}

function fallbackSourceQuery(sourceType, brief) {
  const operator = SOURCE_QUERY_OPERATORS[cleanString(sourceType).toLowerCase()] || "";
  return [sourceQueryTerms(brief), operator].filter(Boolean).join(" ").trim();
}

function inferredMustHave(query) {
  const clean = cleanString(query);
  const items = [];
  if (/llm|large language model|inference|serving/i.test(clean)) items.push("LLM inference / serving experience");
  if (/vllm/i.test(clean)) items.push("vLLM experience");
  if (/triton/i.test(clean)) items.push("Triton or GPU serving experience");
  if (/senior|staff|principal|lead/i.test(clean)) items.push("Senior-level engineering ownership");
  return items.length ? uniqueStrings(items, 8) : [clean || "AI talent fit"];
}

function inferredExclusions(query) {
  const clean = cleanString(query);
  const items = [];
  if (/prompt[- ]?only|pure prompt|prompt engineering/i.test(clean)) items.push("prompt-only profiles");
  if (/exclude|not|avoid/i.test(clean)) items.push("profiles that only match keywords without public evidence");
  return uniqueStrings(items, 8);
}

const EDITABLE_PLAN_COPY = {
  zh: {
    codeReason: "校验实现能力与工程实践",
    paperReason: "校验研究深度与论文产出",
    companyReason: "校验角色、资历与工作经历",
    blogReason: "校验公开技术判断与影响力",
    adjacentPool: "相邻的 AI 基础设施与应用 AI 建设者",
    adjacentReason: "从精确关键词之外发现可迁移的公开证据",
  },
  en: {
    codeReason: "verify implementation and engineering practice",
    paperReason: "verify research depth and publications",
    companyReason: "verify role, seniority, and work history",
    blogReason: "verify public technical judgment and influence",
    adjacentPool: "adjacent AI infrastructure and applied AI builders",
    adjacentReason: "surface transferable public evidence beyond exact keyword matches",
  },
};

function editablePlanCopy(locale, key) {
  return EDITABLE_PLAN_COPY[locale === "en" ? "en" : "zh"][key] ?? EDITABLE_PLAN_COPY.zh[key];
}

function defaultEditableSourceStrategy(query, locale = "zh") {
  const brief = { original_query: query, required_skills: inferredMustHave(query) };
  return [
    {
      source_type: "code",
      coverage_group: "practice",
      target: "GitHub, Hugging Face, Papers with Code",
      query: fallbackSourceQuery("code", brief),
      reason: editablePlanCopy(locale, "codeReason"),
    },
    {
      source_type: "paper",
      coverage_group: "research",
      target: "arXiv, OpenReview, Semantic Scholar",
      query: fallbackSourceQuery("paper", brief),
      reason: editablePlanCopy(locale, "paperReason"),
    },
    {
      source_type: "company",
      coverage_group: "work_history",
      target: "company team pages, public profiles, speaker bios",
      query: fallbackSourceQuery("company", brief),
      reason: editablePlanCopy(locale, "companyReason"),
    },
    {
      source_type: "blog",
      coverage_group: "public_voice",
      target: "technical blogs, talks, podcasts, interviews",
      query: fallbackSourceQuery("blog", brief),
      reason: editablePlanCopy(locale, "blogReason"),
    },
  ];
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

function hostFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function evidenceSummaryFromClaims(claims) {
  const hosts = new Set();
  const sourceTypes = new Set();
  for (const claim of Array.isArray(claims) ? claims : []) {
    for (const evidence of Array.isArray(claim?.evidence) ? claim.evidence : []) {
      const host = hostFromUrl(evidence?.url);
      if (host && !isSearchUrl(evidence.url)) hosts.add(host);
      const sourceType = cleanString(evidence?.source_type);
      if (sourceType) sourceTypes.add(sourceType);
    }
  }
  return {
    independent_sources: hosts.size,
    source_types: Array.from(sourceTypes).slice(0, 12).join(", "),
  };
}

function evidenceDetailsFromClaims(claims) {
  const urls = new Set();
  const sourceTypes = new Set();
  for (const claim of Array.isArray(claims) ? claims : []) {
    for (const evidence of Array.isArray(claim?.evidence) ? claim.evidence : []) {
      const url = cleanString(evidence?.url);
      if (url && !isSearchUrl(url)) urls.add(url);
      const sourceType = cleanString(evidence?.source_type).toLowerCase();
      if (sourceType) sourceTypes.add(sourceType);
    }
  }
  return { urls, sourceTypes };
}

function evidenceHostsFromClaim(claim) {
  const hosts = new Set();
  for (const evidence of Array.isArray(claim?.evidence) ? claim.evidence : []) {
    const host = hostFromUrl(evidence?.url);
    if (host && !isSearchUrl(evidence.url)) hosts.add(host);
  }
  return hosts;
}

function candidateMapByName(candidates) {
  const map = new Map();
  for (const candidate of Array.isArray(candidates) ? candidates : []) {
    const name = cleanString(candidate?.name);
    if (name) map.set(name.toLowerCase(), candidate);
  }
  return map;
}

function sourceTypeCountsFromClaims(candidates) {
  const counts = new Map();
  for (const candidate of Array.isArray(candidates) ? candidates : []) {
    for (const claim of Array.isArray(candidate?.claims) ? candidate.claims : []) {
      for (const evidence of Array.isArray(claim?.evidence) ? claim.evidence : []) {
        const sourceType = cleanString(evidence?.source_type).toLowerCase();
        if (sourceType) counts.set(sourceType, (counts.get(sourceType) ?? 0) + 1);
      }
    }
  }
  return counts;
}

function sourceTypeCountsFromMix(sourceMix, candidates) {
  const counts = sourceTypeCountsFromClaims(candidates);
  for (const item of Array.isArray(sourceMix) ? sourceMix : []) {
    const sourceType = cleanString(item?.source_type).toLowerCase();
    if (sourceType) counts.set(sourceType, Math.max(counts.get(sourceType) ?? 0, normalizeCount(item?.count)));
  }
  return counts;
}

function addCounts(target, source) {
  for (const [key, count] of source.entries()) {
    target.set(key, (target.get(key) ?? 0) + count);
  }
  return target;
}

function uniqueStrings(values, limit = 20) {
  return Array.from(new Set(cleanStringArray(values, limit * 2))).slice(0, limit);
}

function evidenceUrlSet(claims) {
  const urls = new Set();
  for (const claim of Array.isArray(claims) ? claims : []) {
    for (const evidence of Array.isArray(claim?.evidence) ? claim.evidence : []) {
      const url = cleanString(evidence?.url);
      if (url) urls.add(url);
    }
  }
  return urls;
}

function claimKey(claim) {
  const text = cleanString(claim?.claim).toLowerCase();
  const urls = (Array.isArray(claim?.evidence) ? claim.evidence : [])
    .map((evidence) => cleanString(evidence?.url))
    .filter(Boolean)
    .sort()
    .join("|");
  return `${text}:${urls}`;
}

function mergeClaims(originalClaims, backfillClaims) {
  const merged = Array.isArray(originalClaims) ? [...originalClaims] : [];
  const seenKeys = new Set(merged.map(claimKey));
  const seenUrls = evidenceUrlSet(merged);
  for (const claim of Array.isArray(backfillClaims) ? backfillClaims : []) {
    const key = claimKey(claim);
    const urls = Array.isArray(claim?.evidence) ? claim.evidence.map((evidence) => cleanString(evidence?.url)).filter(Boolean) : [];
    if (seenKeys.has(key) || (urls.length > 0 && urls.every((url) => seenUrls.has(url)))) continue;
    merged.push(claim);
    seenKeys.add(key);
    for (const url of urls) seenUrls.add(url);
  }
  return merged;
}

function mergeSourceMix(originalMix, backfillMix) {
  const counts = new Map();
  for (const item of Array.isArray(originalMix) ? originalMix : []) {
    const sourceType = cleanString(item?.source_type).toLowerCase();
    if (sourceType) counts.set(sourceType, Math.max(counts.get(sourceType) ?? 0, normalizeCount(item?.count)));
  }
  for (const item of Array.isArray(backfillMix) ? backfillMix : []) {
    const sourceType = cleanString(item?.source_type).toLowerCase();
    if (sourceType) counts.set(sourceType, (counts.get(sourceType) ?? 0) + normalizeCount(item?.count));
  }
  return Array.from(counts.entries()).map(([source_type, count]) => ({ source_type, count })).slice(0, 12);
}

function mergeEvidenceGraphCandidates(originalCandidates, backfillCandidates) {
  const byName = new Map();
  for (const candidate of Array.isArray(originalCandidates) ? originalCandidates : []) {
    const name = cleanString(candidate?.candidate_name);
    if (name) byName.set(name.toLowerCase(), { ...candidate });
  }
  for (const candidate of Array.isArray(backfillCandidates) ? backfillCandidates : []) {
    const name = cleanString(candidate?.candidate_name);
    if (!name) continue;
    const key = name.toLowerCase();
    const existing = byName.get(key);
    if (!existing) {
      byName.set(key, { ...candidate });
      continue;
    }
    byName.set(key, {
      ...existing,
      independent_sources: normalizeCount(existing.independent_sources) + normalizeCount(candidate.independent_sources),
      source_types: uniqueStrings([...(existing.source_types ?? []), ...(candidate.source_types ?? [])], 12),
      strongest_evidence: uniqueStrings([...(existing.strongest_evidence ?? []), ...(candidate.strongest_evidence ?? [])], 8),
      weakest_evidence: uniqueStrings([...(existing.weakest_evidence ?? []), ...(candidate.weakest_evidence ?? [])], 8),
      risk_flags: uniqueStrings([...(existing.risk_flags ?? []), ...(candidate.risk_flags ?? [])], 8),
      cross_validation: cleanString(candidate.cross_validation) || cleanString(existing.cross_validation),
    });
  }
  return Array.from(byName.values()).slice(0, 20);
}

function markCompletedBackfillJobs(jobs, summary) {
  const gainedPairs = new Set(
    (Array.isArray(summary?.coverage_gains) ? summary.coverage_gains : []).flatMap((gain) => {
      const coverageGroup = cleanString(gain?.key);
      return cleanStringArray(gain?.added_source_types, 12).map((sourceType) => `${coverageGroup}:${sourceType}`);
    }),
  );
  return (Array.isArray(jobs) ? jobs : []).map((job) => {
    const key = `${cleanString(job.coverage_group)}:${cleanString(job.missing_source_type)}`;
    return gainedPairs.has(key) ? { ...job, status: "completed" } : job;
  });
}

function coverageGroupsFromCounts(counts) {
  return EVIDENCE_COVERAGE_GROUPS.map((group) => {
    const coveredSourceTypes = group.source_types.filter((type) => (counts.get(type) ?? 0) > 0);
    const count = group.source_types.reduce((total, type) => total + (counts.get(type) ?? 0), 0);
    return {
      key: group.key,
      label: group.label,
      count,
      source_types: coveredSourceTypes,
      missing_source_types: group.source_types.filter((type) => !coveredSourceTypes.includes(type)),
      status: count > 0 ? "covered" : "missing",
    };
  });
}

function coverageGapLabelsForSourceTypes(sourceTypes) {
  const counts = new Map();
  for (const sourceType of cleanStringArray(sourceTypes, 20)) {
    counts.set(sourceType.toLowerCase(), 1);
  }
  return coverageGroupsFromCounts(counts)
    .filter((group) => group.status === "missing")
    .map((group) => group.label);
}

function coverageGroupByKey(key) {
  return EVIDENCE_COVERAGE_GROUPS.find((group) => group.key === key) || EVIDENCE_COVERAGE_GROUPS[1];
}

function candidateNamesForCoverageGroup(result, coverageGroup) {
  const group = coverageGroupByKey(coverageGroup);
  const graphCandidates = Array.isArray(result?.evidence_graph?.candidates) ? result.evidence_graph.candidates : [];
  const names = graphCandidates
    .filter((candidate) => {
      const sourceTypes = cleanStringArray(candidate?.source_types, 12).map((type) => type.toLowerCase());
      return sourceTypes.length === 0 || !sourceTypes.some((type) => group.source_types.includes(type));
    })
    .map((candidate) => cleanString(candidate?.candidate_name))
    .filter(Boolean);
  if (names.length > 0) return Array.from(new Set(names)).slice(0, 8);
  return (Array.isArray(result?.candidates) ? result.candidates : [])
    .map((candidate) => cleanString(candidate?.name))
    .filter(Boolean)
    .slice(0, 8);
}

const BACKFILL_PLAN_COPY = {
  zh: {
    failed: "前一轮 {sourceType} 来源任务失败，需要补搜。",
    partial: "前一轮 {sourceType} 来源证据偏薄，需要补搜。",
    noEvidence: "前一轮 {sourceType} 未找到可用证据，需要补搜。",
    missing: "缺少{groupLabel}覆盖，需要补搜 {sourceType} 来源做交叉验证。",
    summary: "{count} 个覆盖缺口待补搜。",
  },
  en: {
    failed: "The previous {sourceType} source task failed. Backfill is needed.",
    partial: "The previous {sourceType} source evidence was thin. Backfill is needed.",
    noEvidence: "The previous {sourceType} task found no usable evidence. Backfill is needed.",
    missing: "{groupLabel} coverage is missing. Backfill {sourceType} sources for cross-validation.",
    summary: "{count} coverage gaps need backfill.",
  },
};

function backfillPlanCopy(locale, key, params = {}) {
  let text = BACKFILL_PLAN_COPY[locale === "en" ? "en" : "zh"][key] ?? BACKFILL_PLAN_COPY.zh[key];
  for (const [name, value] of Object.entries(params)) text = text.replace(`{${name}}`, String(value));
  return text;
}

function backfillReason(group, sourceType, executionJob, locale = "zh") {
  if (executionJob?.status === "failed") return executionJob.error || backfillPlanCopy(locale, "failed", { sourceType });
  if (executionJob?.status === "partial") return executionJob.next_action || backfillPlanCopy(locale, "partial", { sourceType });
  if (executionJob && executionJob.evidence_found === 0) return executionJob.next_action || backfillPlanCopy(locale, "noEvidence", { sourceType });
  return backfillPlanCopy(locale, "missing", { groupLabel: dossierGroupLabel(locale, group.key), sourceType });
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
  };
}

export function buildCandidateComparisonRows(result) {
  const source = isPlainObject(result) ? result : {};
  const graphCandidates = Array.isArray(source.evidence_graph?.candidates) ? source.evidence_graph.candidates : [];
  return (Array.isArray(source.candidates) ? source.candidates : []).map((candidate) => {
    candidate = isPlainObject(candidate) ? candidate : {};
    const graphNode = graphCandidates.find((item) => item?.candidate_name === candidate.name) || {};
    const roleParts = [candidate.current_role, candidate.current_company].map(cleanString).filter(Boolean);
    const directions = cleanStringArray(candidate.ai_directions);
    const evidenceSummary = evidenceSummaryFromClaims(candidate.claims);
    const sourceTypes = cleanStringArray(graphNode.source_types, 12);
    const sourceTypesText = sourceTypes.join(", ") || evidenceSummary.source_types;
    return {
      name: cleanString(candidate.name) || "Unknown candidate",
      role: roleParts.join(" / "),
      primary_direction: directions[0] || "",
      secondary_directions: directions.slice(1).join(", "),
      match_score: clampScore(candidate.match_score),
      achievement_signals: clampScore(candidate.score_breakdown?.achievement_signals),
      skill_match: clampScore(candidate.score_breakdown?.skill_match),
      work_history: clampScore(candidate.score_breakdown?.work_history),
      evidence_score: clampScore(candidate.score_breakdown?.evidence_quality),
      evidence_quality: cleanString(candidate.evidence_audit?.overall_evidence_quality) || "medium",
      independent_sources: normalizeCount(graphNode.independent_sources) || evidenceSummary.independent_sources,
      source_types: sourceTypesText,
      coverage_gaps: coverageGapLabelsForSourceTypes(sourceTypesText.split(",")).join(", "),
      top_signal: cleanStringArray(candidate.strongest_signals, 1)[0] || "",
      risk_summary: cleanStringArray(graphNode.risk_flags, 1)[0] || cleanStringArray(candidate.uncertainties, 1)[0] || "",
    };
  });
}

/**
 * @param {{ result?: unknown; candidate?: unknown }} input
 */
export function buildCandidateEvidenceAudit({ result, candidate } = {}) {
  const normalizedResult = normalizeTalentSearchResult(result);
  const suppliedCandidate = normalizeTalentSearchResult({ candidates: [candidate] }).candidates[0];
  const suppliedName = cleanString(suppliedCandidate?.name);
  const resultCandidate = normalizedResult.candidates.find((item) => item.name.toLowerCase() === suppliedName.toLowerCase());
  const selected = resultCandidate || suppliedCandidate;
  const candidateName = cleanString(selected?.name);
  const graphNode = normalizedResult.evidence_graph.candidates.find((item) => item.candidate_name.toLowerCase() === candidateName.toLowerCase()) || {};
  const claims = Array.isArray(selected?.claims) ? selected.claims : [];
  const audit = selected?.evidence_audit || normalizeAudit();
  const evidenceDetails = evidenceDetailsFromClaims(claims);
  const sourceTypes = uniqueStrings([
    ...cleanStringArray(graphNode.source_types, 12),
    ...Array.from(evidenceDetails.sourceTypes),
  ], 12);
  const independentSources = Math.max(
    normalizeCount(graphNode.independent_sources),
    new Set(Array.from(evidenceDetails.urls).map(hostFromUrl).filter(Boolean)).size,
  );
  const claimsByVerdict = (verdict) => claims
    .filter((claim) => claim.verdict === verdict)
    .map((claim) => cleanString(claim.claim))
    .filter(Boolean);
  const singleSourceClaims = claims
    .filter((claim) => cleanString(claim.claim) && Array.isArray(claim.evidence) && claim.evidence.length > 0 && evidenceHostsFromClaim(claim).size <= 1)
    .map((claim) => cleanString(claim.claim));

  return {
    candidate_name: candidateName,
    overall_evidence_quality: audit.overall_evidence_quality,
    independent_sources: independentSources,
    source_types: sourceTypes,
    verified_count: claims.filter((claim) => claim.verdict === "verified").length,
    unverified_count: claims.filter((claim) => claim.verdict === "unverified").length,
    contradicted_count: claims.filter((claim) => claim.verdict === "contradicted").length,
    verified_claims: audit.verified_claims.length ? audit.verified_claims : claimsByVerdict("verified"),
    unverified_claims: audit.unverified_claims.length ? audit.unverified_claims : claimsByVerdict("unverified"),
    contradicted_claims: audit.contradicted_claims.length ? audit.contradicted_claims : claimsByVerdict("contradicted"),
    single_source_claims: audit.single_source_claims.length ? audit.single_source_claims : uniqueStrings(singleSourceClaims, 8),
    identity_risks: audit.identity_risks,
    recency_notes: audit.recency_notes,
    cross_validation: cleanString(graphNode.cross_validation) || (independentSources > 1 ? `${independentSources} 个独立信源支持部分候选人声称。` : ""),
    strongest_evidence: cleanStringArray(graphNode.strongest_evidence, 8),
    weakest_evidence: cleanStringArray(graphNode.weakest_evidence, 8),
    risk_flags: uniqueStrings([
      ...cleanStringArray(graphNode.risk_flags, 8),
      ...cleanStringArray(selected?.uncertainties, 8),
    ], 8),
  };
}

const DOSSIER_COPY = {
  zh: {
    title: "候选人证据档案",
    match: "匹配分",
    sources: "独立信源",
    quality: "证据质量",
    verified: "已验证",
    unverified: "查无实据",
    contradicted: "矛盾",
    strongMatch: "强匹配",
    possibleMatch: "可进一步评估",
    weakMatch: "需要谨慎评估",
    conclusion: "{name} 当前可判断为{fit}：{role}{signal}，核心判断基于 {sources} 个独立信源和 {quality} 证据质量。",
    noRole: "公开资料",
    signalPrefix: "；主要信号是 {signal}",
    riskPrefix: "主要风险：{risk}",
    noMaterialRisk: "暂未发现明确高风险，但仍需要人工复核原始链接。",
    verdictSummary: "{verified} 条已验证 / {unverified} 条查无实据 / {contradicted} 条矛盾",
    gapSummary: "缺少{label}证据，建议补搜 {sources} 来源。",
    backfillDeltaTitle: "补搜新增证据",
  },
  en: {
    title: "Candidate evidence dossier",
    match: "Match score",
    sources: "Independent sources",
    quality: "Evidence quality",
    verified: "verified",
    unverified: "unverified",
    contradicted: "contradicted",
    strongMatch: "strong match",
    possibleMatch: "worth further review",
    weakMatch: "needs cautious review",
    conclusion: "{name} is currently a {fit}: {role}{signal}. This read is based on {sources} independent sources and {quality} evidence quality.",
    noRole: "public profile",
    signalPrefix: "; key signal: {signal}",
    riskPrefix: "Primary risk: {risk}",
    noMaterialRisk: "No clear high-risk signal was found yet, but original links still need human review.",
    verdictSummary: "{verified} verified / {unverified} unverified / {contradicted} contradicted",
    gapSummary: "{label} evidence is missing. Backfill {sources} sources.",
    backfillDeltaTitle: "Backfill evidence added",
  },
};

const DOSSIER_GROUP_LABELS = {
  zh: {
    research: "研究",
    practice: "实践",
    work_history: "工作经历",
    public_voice: "公开表达",
  },
  en: {
    research: "Research",
    practice: "Practice",
    work_history: "Work history",
    public_voice: "Public voice",
  },
};

function dossierCopy(locale, key, params = {}) {
  let text = DOSSIER_COPY[locale === "en" ? "en" : "zh"][key] ?? DOSSIER_COPY.zh[key];
  for (const [name, value] of Object.entries(params)) text = text.replace(`{${name}}`, String(value));
  return text;
}

const EVIDENCE_MATRIX_COPY = {
  zh: {
    title: "声称与来源矩阵",
    description: "逐条查看候选人声称、判断状态和公开来源，先处理无来源、单来源和矛盾项。",
    verified: "已验证",
    unverified: "查无实据",
    contradicted: "矛盾",
    noSource: "无公开来源",
    singleSource: "单一来源",
    multiSource: "多来源",
  },
  en: {
    title: "Claim-source matrix",
    description: "Review each candidate claim, verdict, and public source before acting on weak, single-source, or contradicted items.",
    verified: "Verified",
    unverified: "No evidence found",
    contradicted: "Contradicted",
    noSource: "No public source",
    singleSource: "Single source",
    multiSource: "Multiple sources",
  },
};

function evidenceMatrixCopy(locale, key) {
  return EVIDENCE_MATRIX_COPY[locale === "en" ? "en" : "zh"][key] ?? EVIDENCE_MATRIX_COPY.zh[key];
}

function evidenceMatrixRiskLabel({ verdict, evidenceCount, locale }) {
  if (verdict === "contradicted") return evidenceMatrixCopy(locale, "contradicted");
  if (evidenceCount === 0) return evidenceMatrixCopy(locale, "noSource");
  if (evidenceCount === 1) return evidenceMatrixCopy(locale, "singleSource");
  return evidenceMatrixCopy(locale, "multiSource");
}

/**
 * @param {{ result?: unknown; candidate?: unknown; locale?: "zh" | "en" }} input
 */
export function buildCandidateEvidenceMatrix({ result, candidate, locale = "zh" } = {}) {
  const normalizedLocale = locale === "en" ? "en" : "zh";
  const normalizedResult = normalizeTalentSearchResult(result);
  const suppliedCandidate = normalizeTalentSearchResult({ candidates: [candidate] }).candidates[0];
  const suppliedName = cleanString(suppliedCandidate?.name);
  const selected = normalizedResult.candidates.find((item) => item.name.toLowerCase() === suppliedName.toLowerCase()) || suppliedCandidate;
  const claims = Array.isArray(selected?.claims) ? selected.claims : [];
  const rows = claims
    .map((claim, index) => {
      const evidence = Array.isArray(claim?.evidence) ? claim.evidence : [];
      const verdict = VERDICTS.includes(claim?.verdict) ? claim.verdict : "unverified";
      const sources = evidence.map((source) => {
        const url = cleanString(source?.url);
        return {
          note: cleanString(source?.note),
          url,
          host: hostFromUrl(url),
          source_type: cleanString(source?.source_type) || "other",
        };
      }).filter((source) => source.url);
      const sourceTypes = uniqueStrings(sources.map((source) => source.source_type), 8);
      return {
        key: `${index}-${cleanString(claim?.claim).slice(0, 36) || "claim"}`,
        claim: cleanString(claim?.claim),
        verdict,
        verdict_label: evidenceMatrixCopy(normalizedLocale, verdict),
        evidence_count: sources.length,
        source_types: sourceTypes,
        sources,
        risk_label: evidenceMatrixRiskLabel({ verdict, evidenceCount: sources.length, locale: normalizedLocale }),
      };
    })
    .filter((row) => row.claim || row.sources.length);

  return {
    title: evidenceMatrixCopy(normalizedLocale, "title"),
    description: evidenceMatrixCopy(normalizedLocale, "description"),
    summary: {
      verified: rows.filter((row) => row.verdict === "verified").length,
      unverified: rows.filter((row) => row.verdict === "unverified").length,
      contradicted: rows.filter((row) => row.verdict === "contradicted").length,
      no_source: rows.filter((row) => row.evidence_count === 0).length,
      single_source: rows.filter((row) => row.evidence_count === 1).length,
    },
    rows,
    empty: rows.length === 0,
  };
}

function candidateFitLabel(score, locale) {
  if (score >= 80) return dossierCopy(locale, "strongMatch");
  if (score >= 65) return dossierCopy(locale, "possibleMatch");
  return dossierCopy(locale, "weakMatch");
}

const READING_SUMMARY_COPY = {
  zh: {
    title: "候选人阅读摘要",
    recommendation: "推荐判断",
    fitReason: "匹配理由",
    evidenceConfidence: "证据可信度",
    riskAndNextStep: "风险与下一步",
    strong: "强推荐",
    review: "建议进一步评估",
    cautious: "谨慎评估",
    noRole: "公开资料",
    recommendationBody: "{name} 当前属于{recommendation}：{role}，匹配分 {score}。",
    directionBody: "主要匹配 {direction}。关键公开信号：{signal}。",
    noDirectionBody: "暂未归入明确 AI 方向。关键公开信号：{signal}。",
    noSignal: "需要继续补充可验证的论文、代码、项目或工作经历证据",
    evidenceBody: "当前有 {sources} 个独立信源，{verified} 条已验证、{unverified} 条查无实据、{contradicted} 条矛盾；整体证据质量为 {quality}。",
    riskBody: "{risk}。建议先做人工复核，并补齐薄弱来源后再推进沟通。",
    noRiskBody: "暂未发现明确高风险。建议人工复核原始链接，确认身份、近期经历和可联系性后再推进。",
  },
  en: {
    title: "Candidate reading summary",
    recommendation: "Recommendation",
    fitReason: "Fit rationale",
    evidenceConfidence: "Evidence confidence",
    riskAndNextStep: "Risk and next step",
    strong: "strong recommendation",
    review: "recommended for further review",
    cautious: "cautious review",
    noRole: "public profile",
    recommendationBody: "{name} is currently a {recommendation}: {role}, with a match score of {score}.",
    directionBody: "Primary fit: {direction}. Key public signal: {signal}.",
    noDirectionBody: "No specific AI direction is confirmed yet. Key public signal: {signal}.",
    noSignal: "more verifiable paper, code, project, or work-history evidence is needed",
    evidenceBody: "Current evidence includes {sources} independent sources, {verified} verified, {unverified} unverified, and {contradicted} contradicted claims; overall evidence quality is {quality}.",
    riskBody: "{risk}. Human review should check the original links and fill weak sources before outreach.",
    noRiskBody: "No clear high-risk signal was found yet. Human review should still confirm identity, recent work history, and contactability before outreach.",
  },
};

function readingCopy(locale, key, params = {}) {
  let text = READING_SUMMARY_COPY[locale === "en" ? "en" : "zh"][key] ?? READING_SUMMARY_COPY.zh[key];
  for (const [name, value] of Object.entries(params)) text = text.replace(`{${name}}`, String(value));
  return text;
}

function readingRecommendation(score, locale) {
  if (score >= 80) return readingCopy(locale, "strong");
  if (score >= 65) return readingCopy(locale, "review");
  return readingCopy(locale, "cautious");
}

function candidateDisplayName(value, locale) {
  const name = cleanString(value);
  if (!name || (locale !== "en" && name === "Unknown candidate")) return locale === "en" ? "Unknown candidate" : "未知候选人";
  return name;
}

/**
 * @param {{ result?: unknown; candidate?: unknown; locale?: "zh" | "en" }} input
 */
export function buildCandidateReadingSummary({ result, candidate, locale = "zh" } = {}) {
  const normalizedLocale = locale === "en" ? "en" : "zh";
  const normalizedResult = normalizeTalentSearchResult(result);
  const suppliedCandidate = normalizeTalentSearchResult({ candidates: [candidate] }).candidates[0];
  const suppliedName = cleanString(suppliedCandidate?.name);
  const selected = normalizedResult.candidates.find((item) => item.name.toLowerCase() === suppliedName.toLowerCase()) || suppliedCandidate;
  const audit = buildCandidateEvidenceAudit({ result: normalizedResult, candidate: selected });
  const score = clampScore(selected?.match_score);
  const name = candidateDisplayName(audit.candidate_name || selected?.name, normalizedLocale);
  const role = candidateRole(selected) || cleanString(selected?.headline) || readingCopy(normalizedLocale, "noRole");
  const direction = cleanStringArray(selected?.ai_directions, 1)[0];
  const signal = cleanStringArray(selected?.strongest_signals, 1)[0]
    || cleanStringArray(audit.strongest_evidence, 1)[0]
    || readingCopy(normalizedLocale, "noSignal");
  const risk = cleanStringArray(audit.risk_flags, 1)[0]
    || cleanStringArray(audit.weakest_evidence, 1)[0]
    || cleanStringArray(audit.single_source_claims, 1)[0]
    || cleanStringArray(audit.unverified_claims, 1)[0]
    || "";
  return {
    title: readingCopy(normalizedLocale, "title"),
    sections: [
      {
        key: "recommendation",
        label: readingCopy(normalizedLocale, "recommendation"),
        body: readingCopy(normalizedLocale, "recommendationBody", {
          name,
          recommendation: readingRecommendation(score, normalizedLocale),
          role,
          score,
        }),
      },
      {
        key: "fit_reason",
        label: readingCopy(normalizedLocale, "fitReason"),
        body: readingCopy(normalizedLocale, direction ? "directionBody" : "noDirectionBody", {
          direction,
          signal,
        }),
      },
      {
        key: "evidence_confidence",
        label: readingCopy(normalizedLocale, "evidenceConfidence"),
        body: readingCopy(normalizedLocale, "evidenceBody", {
          sources: audit.independent_sources,
          verified: audit.verified_count,
          unverified: audit.unverified_count,
          contradicted: audit.contradicted_count,
          quality: audit.overall_evidence_quality,
        }),
      },
      {
        key: "risk_next_step",
        label: readingCopy(normalizedLocale, "riskAndNextStep"),
        body: risk
          ? readingCopy(normalizedLocale, "riskBody", { risk })
          : readingCopy(normalizedLocale, "noRiskBody"),
      },
    ],
  };
}

function dossierGroupLabel(locale, key) {
  return DOSSIER_GROUP_LABELS[locale === "en" ? "en" : "zh"][key] ?? key;
}

function buildDossierEvidenceGroups({ audit, claims, locale }) {
  const claimRows = (Array.isArray(claims) ? claims : [])
    .map((claim) => ({
      claim: cleanString(claim?.claim),
      sourceTypes: uniqueStrings((Array.isArray(claim?.evidence) ? claim.evidence : [])
        .map((evidence) => cleanString(evidence?.source_type).toLowerCase())
        .filter(Boolean), 12),
      evidenceCount: Array.isArray(claim?.evidence) ? claim.evidence.length : 0,
    }))
    .filter((row) => row.claim || row.sourceTypes.length);
  const auditSourceTypes = new Set(cleanStringArray(audit?.source_types, 12).map((type) => type.toLowerCase()));

  return EVIDENCE_COVERAGE_GROUPS.map((group) => {
    const sourceTypes = group.source_types.filter((type) => auditSourceTypes.has(type));
    const rows = claimRows.filter((row) => row.sourceTypes.some((type) => group.source_types.includes(type)));
    const evidenceCount = rows.reduce((total, row) => total + row.sourceTypes.filter((type) => group.source_types.includes(type)).length, 0);
    const covered = sourceTypes.length > 0 || evidenceCount > 0;
    return {
      key: group.key,
      label: dossierGroupLabel(locale, group.key),
      status: covered ? "covered" : "missing",
      source_types: sourceTypes,
      missing_source_types: group.source_types.filter((type) => !sourceTypes.includes(type)),
      claim_count: rows.length,
      evidence_count: evidenceCount,
      primary_claims: uniqueStrings(rows.map((row) => row.claim).filter(Boolean), 3),
    };
  });
}

function buildDossierBackfillJobs({ evidenceGroups, candidate, result, locale }) {
  const name = cleanString(candidate?.name);
  const role = candidateRole(candidate) || cleanString(candidate?.headline);
  const originalQuery = cleanString(result?.search_brief?.original_query);
  const directionTerms = cleanStringArray(candidate?.ai_directions, 4).join(" ");
  const signalTerms = cleanStringArray(candidate?.strongest_signals, 2).join(" ");
  const baseQuery = [name, role, directionTerms, signalTerms, originalQuery].filter(Boolean).join(" ");
  return evidenceGroups
    .filter((group) => group.status === "missing" && group.missing_source_types.length > 0)
    .map((group, index) => {
      const missingSourceType = group.missing_source_types[0];
      return {
        gap_id: `${cleanString(name).toLowerCase().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "candidate"}-${group.key}-${missingSourceType}`,
        coverage_group: group.key,
        missing_source_type: missingSourceType,
        query: fallbackSourceQuery(missingSourceType, {
          original_query: baseQuery,
          required_skills: cleanStringArray(result?.search_brief?.required_skills, 6),
          target_directions: cleanStringArray(candidate?.ai_directions, 4),
        }),
        reason: dossierCopy(locale, "gapSummary", {
          label: group.label,
          sources: group.missing_source_types.join(", "),
        }),
        priority: index + 1,
        status: "planned",
        candidate_names: name ? [name] : [],
        source_types_to_check: group.missing_source_types,
      };
    })
    .slice(0, 4);
}

function buildDossierBackfillDelta({ result, candidateName, locale }) {
  const source = isPlainObject(result) ? result : {};
  const merge = isPlainObject(source.backfill_merge) ? source.backfill_merge : {};
  const summary = isPlainObject(merge.summary) ? merge.summary : {};
  const improved = Array.isArray(summary.improved_candidates) ? summary.improved_candidates : [];
  const candidate = improved
    .filter(isPlainObject)
    .find((item) => cleanString(item.candidate_name).toLowerCase() === cleanString(candidateName).toLowerCase());
  if (!candidate) return null;
  return {
    title: dossierCopy(locale, "backfillDeltaTitle"),
    merged_at: cleanString(merge.merged_at),
    new_evidence_count: normalizeCount(candidate.new_evidence_count),
    new_source_types: cleanStringArray(candidate.new_source_types, 12),
    new_evidence_urls: normalizeSourceUrls(candidate.new_evidence_urls, 12),
    merge_note: cleanString(candidate.merge_note),
  };
}

/**
 * @param {{ result?: unknown; candidate?: unknown; locale?: "zh" | "en" }} input
 */
export function buildCandidateEvidenceDossier({ result, candidate, locale = "zh" } = {}) {
  const normalizedResult = normalizeTalentSearchResult(result);
  const suppliedCandidate = normalizeTalentSearchResult({ candidates: [candidate] }).candidates[0];
  const suppliedName = cleanString(suppliedCandidate?.name);
  const resultCandidate = normalizedResult.candidates.find((item) => item.name.toLowerCase() === suppliedName.toLowerCase());
  const selected = resultCandidate || suppliedCandidate;
  const audit = buildCandidateEvidenceAudit({ result: normalizedResult, candidate: selected });
  const score = clampScore(selected?.match_score);
  const role = candidateRole(selected) || cleanString(selected?.headline) || dossierCopy(locale, "noRole");
  const topSignal = cleanStringArray(selected?.strongest_signals, 1)[0] || cleanStringArray(audit.strongest_evidence, 1)[0] || "";
  const risk = cleanStringArray(audit.risk_flags, 1)[0]
    || cleanStringArray(audit.weakest_evidence, 1)[0]
    || cleanStringArray(audit.single_source_claims, 1)[0]
    || cleanStringArray(audit.unverified_claims, 1)[0]
    || "";
  const quality = audit.overall_evidence_quality || "medium";
  const signalText = topSignal ? dossierCopy(locale, "signalPrefix", { signal: topSignal }) : "";
  const evidenceGroups = buildDossierEvidenceGroups({ audit, claims: selected?.claims, locale });
  const verificationGaps = evidenceGroups
    .filter((group) => group.status === "missing")
    .map((group) => dossierCopy(locale, "gapSummary", {
      label: group.label,
      sources: group.missing_source_types.join(", "),
    }));
  const backfillJobs = buildDossierBackfillJobs({ evidenceGroups, candidate: selected, result: normalizedResult, locale });
  const backfillDelta = buildDossierBackfillDelta({ result, candidateName: selected?.name, locale });

  return {
    title: dossierCopy(locale, "title"),
    conclusion: dossierCopy(locale, "conclusion", {
      name: candidateDisplayName(audit.candidate_name || selected?.name, locale),
      fit: candidateFitLabel(score, locale),
      role,
      signal: signalText,
      sources: audit.independent_sources,
      quality,
    }),
    risk_summary: risk ? dossierCopy(locale, "riskPrefix", { risk }) : dossierCopy(locale, "noMaterialRisk"),
    verdict_summary: dossierCopy(locale, "verdictSummary", {
      verified: audit.verified_count,
      unverified: audit.unverified_count,
      contradicted: audit.contradicted_count,
    }),
    metrics: [
      { label: dossierCopy(locale, "match"), value: String(score) },
      { label: dossierCopy(locale, "sources"), value: String(audit.independent_sources) },
      { label: dossierCopy(locale, "quality"), value: quality },
    ],
    source_types: audit.source_types,
    primary_evidence: audit.strongest_evidence.slice(0, 3),
    weak_evidence: audit.weakest_evidence.slice(0, 2),
    evidence_groups: evidenceGroups,
    verification_gaps: verificationGaps,
    backfill_jobs: backfillJobs,
    backfill_delta: backfillDelta,
  };
}

function candidateRole(candidate) {
  return [candidate?.current_role, candidate?.current_company].map(cleanString).filter(Boolean).join(" / ");
}

const DELIVERY_REPORT_COPY = {
  zh: {
    missingCoverage: "{count} 个信息源覆盖缺口需要补搜。",
    weakEvidence: "证据偏弱候选人：{names}。",
    singleSource: "单源声称需复核：{names}。",
    reviewStrong: "优先审阅 {count} 位强推荐候选人的证据详情。",
    backfill: "对 {count} 个信息源覆盖缺口执行补搜。",
    share: "将候选人详情分享给 hiring manager 做人工复核。",
  },
  en: {
    missingCoverage: "{count} source coverage gaps need backfill.",
    weakEvidence: "Weak-evidence candidates: {names}.",
    singleSource: "Single-source claims need review: {names}.",
    reviewStrong: "Review evidence details for {count} strong recommended {candidateWord}.",
    backfill: "Run backfill for {count} source coverage {gapWord}.",
    share: "Share candidate details with the hiring manager for human review.",
  },
};

function deliveryReportCopy(locale, key, params = {}) {
  let text = DELIVERY_REPORT_COPY[locale === "en" ? "en" : "zh"][key] ?? DELIVERY_REPORT_COPY.zh[key];
  for (const [name, value] of Object.entries(params)) text = text.replace(`{${name}}`, String(value));
  return text;
}

export function buildShortlistDeliveryReport(result, { locale = "zh" } = {}) {
  const normalizedLocale = locale === "en" ? "en" : "zh";
  const normalized = normalizeTalentSearchResult(result);
  const coverage = buildEvidenceCoverage(normalized);
  const coveredGroups = coverage.filter((group) => group.status === "covered");
  const candidateAudits = normalized.candidates.map((candidate) => buildCandidateEvidenceAudit({ result: normalized, candidate }));
  const strongCandidates = normalized.candidates.filter((candidate) => candidate.match_score >= 80);
  const weakEvidenceCandidates = normalized.candidates.filter((candidate) => candidate.evidence_audit.overall_evidence_quality === "low");
  const missingCoverageCount = Math.max(0, coverage.length - coveredGroups.length);
  const averageMatchScore = normalized.candidates.length
    ? Math.round(normalized.candidates.reduce((total, candidate) => total + candidate.match_score, 0) / normalized.candidates.length)
    : 0;
  const recommendedCandidates = normalized.candidates
    .filter((candidate) => candidate.match_score >= 75)
    .sort((a, b) => b.match_score - a.match_score)
    .slice(0, 5)
    .map((candidate) => {
      const audit = candidateAudits.find((item) => item.candidate_name === candidate.name) || buildCandidateEvidenceAudit({ candidate });
      return {
        name: candidate.name,
        role: candidateRole(candidate),
        match_score: candidate.match_score,
        evidence_quality: candidate.evidence_audit.overall_evidence_quality,
        independent_sources: audit.independent_sources,
        recommendation_reason: cleanStringArray(candidate.strongest_signals, 1)[0] || candidate.summary || candidate.headline,
        primary_risk: cleanStringArray(audit.risk_flags, 1)[0] || cleanStringArray(candidate.uncertainties, 1)[0] || "",
      };
    });
  const risks = [];
  if (missingCoverageCount > 0) risks.push(deliveryReportCopy(normalizedLocale, "missingCoverage", { count: missingCoverageCount }));
  if (weakEvidenceCandidates.length > 0) {
    risks.push(deliveryReportCopy(normalizedLocale, "weakEvidence", { names: weakEvidenceCandidates.map((candidate) => candidate.name).slice(0, 4).join(", ") }));
  }
  const singleSourceCandidates = candidateAudits.filter((audit) => audit.single_source_claims.length > 0).map((audit) => audit.candidate_name).filter(Boolean);
  if (singleSourceCandidates.length > 0) {
    risks.push(deliveryReportCopy(normalizedLocale, "singleSource", { names: singleSourceCandidates.slice(0, 4).join(", ") }));
  }
  const nextSteps = [];
  if (strongCandidates.length > 0) {
    nextSteps.push(deliveryReportCopy(normalizedLocale, "reviewStrong", {
      count: strongCandidates.length,
      candidateWord: strongCandidates.length === 1 ? "candidate" : "candidates",
    }));
  }
  if (missingCoverageCount > 0) {
    nextSteps.push(deliveryReportCopy(normalizedLocale, "backfill", {
      count: missingCoverageCount,
      gapWord: missingCoverageCount === 1 ? "gap" : "gaps",
    }));
  }
  nextSteps.push(deliveryReportCopy(normalizedLocale, "share"));

  return {
    brief_summary: normalized.search_brief.original_query || normalized.search_plan.must_have.join("; ") || "AI talent shortlist",
    candidate_count: normalized.candidates.length,
    strong_recommendation_count: strongCandidates.length,
    average_match_score: averageMatchScore,
    high_evidence_count: normalized.candidates.filter((candidate) => candidate.evidence_audit.overall_evidence_quality === "high").length,
    covered_group_count: coveredGroups.length,
    coverage_group_count: coverage.length,
    coverage_summary: coverage.map((group) => ({
      key: group.key,
      label: dossierGroupLabel(normalizedLocale, group.key),
      status: group.status,
      count: group.count,
      source_types: group.source_types,
      missing_source_types: group.missing_source_types,
    })),
    recommended_candidates: recommendedCandidates,
    report_risks: risks,
    next_steps: nextSteps,
  };
}

export function buildEvidenceCoverage(result) {
  const source = isPlainObject(result) ? result : {};
  const counts = sourceTypeCountsFromMix(source.evidence_graph?.source_mix, source.candidates);
  return coverageGroupsFromCounts(counts);
}

export function buildSourceQueryPlan(result) {
  const source = isPlainObject(result) ? result : {};
  const brief = isPlainObject(source.search_brief) ? source.search_brief : {};
  const strategy = Array.isArray(source.search_plan?.source_strategy) ? source.search_plan.source_strategy : [];
  return strategy.map((item, index) => {
    item = isPlainObject(item) ? item : {};
    const sourceType = cleanString(item.source_type) || "other";
    const coverageGroup = normalizeCoverageGroup(item.coverage_group, sourceType);
    return {
      source_type: sourceType,
      coverage_group: coverageGroup,
      target: cleanString(item.target),
      query: cleanString(item.query) || fallbackSourceQuery(sourceType, brief),
      reason: cleanString(item.reason),
      priority: index + 1,
    };
  }).filter((item) => item.query || item.target || item.reason).slice(0, 12);
}

export function buildEditableSearchPlanDraft(query, { locale = "zh" } = {}) {
  const normalizedLocale = locale === "en" ? "en" : "zh";
  const originalQuery = cleanString(query);
  return normalizeTalentSearchResult({
    search_brief: {
      original_query: originalQuery,
      required_skills: inferredMustHave(originalQuery),
      exclusions: inferredExclusions(originalQuery),
    },
    search_plan: {
      must_have: inferredMustHave(originalQuery),
      nice_to_have: [],
      exclusions: inferredExclusions(originalQuery),
      source_strategy: defaultEditableSourceStrategy(originalQuery, normalizedLocale),
      adjacent_pools: [
        {
          pool: editablePlanCopy(normalizedLocale, "adjacentPool"),
          reason: editablePlanCopy(normalizedLocale, "adjacentReason"),
        },
      ],
    },
  });
}

const EDITABLE_SEARCH_INPUT_COPY = {
  zh: {
    title: "SignalHire 可编辑搜索计划。",
    originalBrief: "原始搜索画像：{value}",
    mustHave: "必备条件：{value}",
    niceToHave: "加分条件：{value}",
    exclude: "排除条件：{value}",
    notSpecified: "未指定",
    sourcePlan: "来源计划：",
    returnPayload: "返回标准 SignalHire 人才 shortlist payload，包含 search_plan、source_execution、coverage_backfill、evidence_graph、talent_map 和 candidates。",
  },
  en: {
    title: "Editable Search Plan for SignalHire.",
    originalBrief: "Original search brief: {value}",
    mustHave: "Must-have: {value}",
    niceToHave: "Nice-to-have: {value}",
    exclude: "Exclude: {value}",
    notSpecified: "not specified",
    sourcePlan: "Source plan:",
    returnPayload: "Return the normal SignalHire talent shortlist payload with search_plan, source_execution, coverage_backfill, evidence_graph, talent_map, and candidates.",
  },
};

function editableSearchInputCopy(locale, key, params = {}) {
  const normalizedLocale = locale === "zh" ? "zh" : "en";
  let text = EDITABLE_SEARCH_INPUT_COPY[normalizedLocale][key] ?? EDITABLE_SEARCH_INPUT_COPY.en[key];
  for (const [name, value] of Object.entries(params)) text = text.replace(`{${name}}`, String(value));
  return text;
}

/**
 * @param {{ draft?: unknown; locale?: string }} input
 */
export function buildSearchInputFromEditablePlan({ draft, locale = "en" } = {}) {
  const normalizedLocale = locale === "zh" ? "zh" : "en";
  const normalized = normalizeTalentSearchResult(draft);
  const plan = normalized.search_plan;
  const sources = buildSourceQueryPlan(normalized);
  const emptyValue = editableSearchInputCopy(normalizedLocale, "notSpecified");
  return [
    editableSearchInputCopy(normalizedLocale, "title"),
    editableSearchInputCopy(normalizedLocale, "originalBrief", { value: normalized.search_brief.original_query }),
    editableSearchInputCopy(normalizedLocale, "mustHave", { value: plan.must_have.join("; ") || emptyValue }),
    editableSearchInputCopy(normalizedLocale, "niceToHave", { value: plan.nice_to_have.join("; ") || emptyValue }),
    editableSearchInputCopy(normalizedLocale, "exclude", { value: plan.exclusions.join("; ") || emptyValue }),
    editableSearchInputCopy(normalizedLocale, "sourcePlan"),
    ...sources.map((source) => `- ${source.coverage_group}/${source.source_type}: ${source.query} (${source.reason || source.target})`),
    editableSearchInputCopy(normalizedLocale, "returnPayload"),
  ].join("\n");
}

const SEARCH_FEEDBACK_LABELS = {
  precision: {
    accurate: "精准",
    partial: "部分精准",
    off: "不精准",
  },
  satisfaction: {
    satisfied: "满意",
    mixed: "一般",
    unsatisfied: "不满意",
  },
  issue: {
    too_broad: "候选人太泛",
    wrong_seniority: "资历不对",
    wrong_direction: "方向不对",
    weak_evidence: "证据不足",
    wrong_location: "地域不对",
    too_few: "候选人太少",
    too_many: "候选人太多",
    other: "其他",
  },
  focus: {
    stricter_match: "更严格匹配",
    expand_sources: "扩大信息源",
    stronger_evidence: "补强证据",
    adjacent_pools: "换相邻人才池",
    higher_seniority: "提高资历门槛",
    location_fit: "调整地域匹配",
  },
};

function feedbackLabel(group, value, fallback) {
  const key = cleanString(value);
  return SEARCH_FEEDBACK_LABELS[group]?.[key] || fallback;
}

function candidateFeedbackSummary(candidate, locale = "en") {
  const normalizedLocale = locale === "zh" ? "zh" : "en";
  const roleFallback = normalizedLocale === "zh" ? "角色未知" : "role unknown";
  const directionFallback = normalizedLocale === "zh" ? "方向未知" : "direction unknown";
  const signalFallback = normalizedLocale === "zh" ? "暂无强信号" : "no strong signal captured";
  const uncertaintyFallback = normalizedLocale === "zh" ? "暂无主要不确定性" : "no major uncertainty captured";
  const role = [candidate.current_role, candidate.current_company].filter(Boolean).join(" / ") || candidate.headline || roleFallback;
  const directions = candidate.ai_directions.length ? candidate.ai_directions.join(", ") : directionFallback;
  const signal = candidate.strongest_signals[0] || candidate.summary || signalFallback;
  const uncertainty = candidate.uncertainties[0] || uncertaintyFallback;
  if (normalizedLocale === "zh") {
    return `- ${candidate.name}：匹配分 ${candidate.match_score}；${role}；${directions}；信号：${signal}；风险：${uncertainty}`;
  }
  return `- ${candidate.name}: score ${candidate.match_score}; ${role}; ${directions}; signal: ${signal}; risk: ${uncertainty}`;
}

const FEEDBACK_SEARCH_INPUT_COPY = {
  zh: {
    title: "SignalHire 反馈优化搜索。",
    originalBrief: "原始搜索画像：{value}",
    requiredSkills: "必备技能：{value}",
    preferredSkills: "加分技能：{value}",
    seniority: "资历：{value}",
    geography: "地域：{value}",
    exclusions: "排除条件：{value}",
    notProvided: "未提供",
    notSpecified: "未指定",
    feedbackTitle: "用户对上一轮 shortlist 的反馈：",
    precision: "精准度：{value}",
    satisfaction: "满意度：{value}",
    issue: "主要问题：{value}",
    focus: "下一轮重点：{value}",
    previousTitle: "上一轮候选名单学习样本：",
    emptyCandidates: "- 没有可用的上一轮候选人摘要。",
    instructionsTitle: "优化要求：",
    sameIntent: "- 将反馈作为同一搜索意图下的排序和来源策略指导。",
    noRerank: "- 不要只重新排序同一批候选人；当反馈显示匹配薄弱时，搜索更合适的替代候选人。",
    preserveStrong: "- 保留真正强匹配的人选，同时围绕选定问题和下一轮重点提高筛选门槛。",
    expandEvidence: "- 扩展并交叉验证研究、实践、工作经历和公开表达等公开证据。",
    returnPayload: "返回标准 SignalHire 人才 shortlist payload，包含 search_plan、source_execution、coverage_backfill、evidence_graph、talent_map 和 candidates。",
  },
  en: {
    title: "Feedback-optimized SignalHire search.",
    originalBrief: "Original search brief: {value}",
    requiredSkills: "Required skills: {value}",
    preferredSkills: "Preferred skills: {value}",
    seniority: "Seniority: {value}",
    geography: "Geography: {value}",
    exclusions: "Exclusions: {value}",
    notProvided: "Not provided",
    notSpecified: "not specified",
    feedbackTitle: "User feedback from reviewed shortlist:",
    precision: "Precision: {value}",
    satisfaction: "Satisfaction: {value}",
    issue: "Main issue: {value}",
    focus: "Next-round focus: {value}",
    previousTitle: "Previous shortlist to learn from:",
    emptyCandidates: "- No previous candidate summary available.",
    instructionsTitle: "Optimization instructions:",
    sameIntent: "- Treat the feedback as ranking and sourcing guidance for the same underlying search intent.",
    noRerank: "- Do not simply rerank the same shortlist; search for improved or replacement candidates where feedback indicates weak fit.",
    preserveStrong: "- Preserve genuinely strong matches, but raise the bar on the selected issue and next-round focus.",
    expandEvidence: "- Expand and cross-validate public evidence across research, practice, work history, and public voice sources.",
    returnPayload: "Return the normal SignalHire talent shortlist payload with search_plan, source_execution, coverage_backfill, evidence_graph, talent_map, and candidates.",
  },
};

function feedbackSearchInputCopy(locale, key, params = {}) {
  const normalizedLocale = locale === "zh" ? "zh" : "en";
  let text = FEEDBACK_SEARCH_INPUT_COPY[normalizedLocale][key] ?? FEEDBACK_SEARCH_INPUT_COPY.en[key];
  for (const [name, value] of Object.entries(params)) text = text.replace(`{${name}}`, String(value));
  return text;
}

/**
 * @param {{ result?: unknown; feedback?: { precision?: string; satisfaction?: string; issue?: string; focus?: string }; locale?: string }} input
 */
export function buildFeedbackOptimizedSearchInput({ result, feedback = {}, locale = "en" } = {}) {
  const normalizedLocale = locale === "zh" ? "zh" : "en";
  const normalized = normalizeTalentSearchResult(result);
  const brief = normalized.search_brief;
  const plan = normalized.search_plan;
  const emptySelection = normalizedLocale === "zh" ? "未选择" : "not selected";
  const emptyValue = feedbackSearchInputCopy(normalizedLocale, "notSpecified");
  const feedbackSummary = [
    feedbackSearchInputCopy(normalizedLocale, "precision", { value: feedbackLabel("precision", feedback.precision, emptySelection) }),
    feedbackSearchInputCopy(normalizedLocale, "satisfaction", { value: feedbackLabel("satisfaction", feedback.satisfaction, emptySelection) }),
    feedbackSearchInputCopy(normalizedLocale, "issue", { value: feedbackLabel("issue", feedback.issue, emptySelection) }),
    feedbackSearchInputCopy(normalizedLocale, "focus", { value: feedbackLabel("focus", feedback.focus, emptySelection) }),
  ];
  const previousCandidates = normalized.candidates.length
    ? normalized.candidates.slice(0, 12).map((candidate) => candidateFeedbackSummary(candidate, normalizedLocale))
    : [feedbackSearchInputCopy(normalizedLocale, "emptyCandidates")];

  return [
    feedbackSearchInputCopy(normalizedLocale, "title"),
    feedbackSearchInputCopy(normalizedLocale, "originalBrief", { value: brief.original_query || feedbackSearchInputCopy(normalizedLocale, "notProvided") }),
    feedbackSearchInputCopy(normalizedLocale, "requiredSkills", { value: brief.required_skills.join("; ") || plan.must_have.join("; ") || emptyValue }),
    feedbackSearchInputCopy(normalizedLocale, "preferredSkills", { value: brief.preferred_skills.join("; ") || plan.nice_to_have.join("; ") || emptyValue }),
    feedbackSearchInputCopy(normalizedLocale, "seniority", { value: brief.seniority || emptyValue }),
    feedbackSearchInputCopy(normalizedLocale, "geography", { value: brief.geography || emptyValue }),
    feedbackSearchInputCopy(normalizedLocale, "exclusions", { value: brief.exclusions.join("; ") || plan.exclusions.join("; ") || emptyValue }),
    feedbackSearchInputCopy(normalizedLocale, "feedbackTitle"),
    ...feedbackSummary,
    feedbackSearchInputCopy(normalizedLocale, "previousTitle"),
    ...previousCandidates,
    feedbackSearchInputCopy(normalizedLocale, "instructionsTitle"),
    feedbackSearchInputCopy(normalizedLocale, "sameIntent"),
    feedbackSearchInputCopy(normalizedLocale, "noRerank"),
    feedbackSearchInputCopy(normalizedLocale, "preserveStrong"),
    feedbackSearchInputCopy(normalizedLocale, "expandEvidence"),
    feedbackSearchInputCopy(normalizedLocale, "returnPayload"),
  ].join("\n");
}

export function buildSourceExecution(result) {
  const source = isPlainObject(result) ? result : {};
  const execution = normalizeSourceExecution(source.source_execution);
  if (execution.jobs.length > 0) return execution;
  return {
    summary: "",
    jobs: buildSourceQueryPlan(source).map((item) => ({
      job_id: `source-${item.priority}-${item.source_type}`,
      source_type: item.source_type,
      coverage_group: item.coverage_group,
      query: item.query,
      status: "planned",
      urls_found: 0,
      evidence_found: 0,
      candidate_leads: [],
      source_urls: [],
      error: "",
      next_action: item.reason || item.target,
    })),
  };
}

export function buildCoverageBackfillPlan(result, { locale = "zh" } = {}) {
  const normalizedLocale = locale === "en" ? "en" : "zh";
  const source = isPlainObject(result) ? result : {};
  const returned = normalizeCoverageBackfill(source.coverage_backfill);
  if (returned.jobs.length > 0) return returned;

  const executionJobs = buildSourceExecution(source).jobs;
  const jobs = [];
  const seen = new Set();

  const addJob = ({ coverageGroup, sourceType, reason, query, candidateNames, sourceTypesToCheck }) => {
    const group = coverageGroupByKey(coverageGroup);
    const normalizedSourceType = cleanString(sourceType).toLowerCase();
    const key = `${group.key}:${normalizedSourceType}`;
    if (!normalizedSourceType || seen.has(key)) return;
    seen.add(key);
    jobs.push({
      gap_id: `${group.key}-${normalizedSourceType}`,
      coverage_group: group.key,
      missing_source_type: normalizedSourceType,
      query: cleanString(query) || fallbackSourceQuery(normalizedSourceType, source.search_brief),
      reason: cleanString(reason) || backfillPlanCopy(normalizedLocale, "missing", {
        groupLabel: dossierGroupLabel(normalizedLocale, group.key),
        sourceType: normalizedSourceType,
      }),
      priority: jobs.length + 1,
      status: "planned",
      candidate_names: cleanStringArray(candidateNames, 12),
      source_types_to_check: cleanStringArray(sourceTypesToCheck, 8),
    });
  };

  for (const group of buildEvidenceCoverage(source)) {
    if (group.status !== "missing") continue;
    for (const sourceType of group.missing_source_types.slice(0, 2)) {
      addJob({
        coverageGroup: group.key,
        sourceType,
        reason: backfillPlanCopy(normalizedLocale, "missing", {
          groupLabel: dossierGroupLabel(normalizedLocale, group.key),
          sourceType,
        }),
        candidateNames: candidateNamesForCoverageGroup(source, group.key),
        sourceTypesToCheck: group.missing_source_types,
      });
    }
  }

  for (const executionJob of executionJobs) {
    if (executionJob.status === "completed" && executionJob.evidence_found > 0) continue;
    addJob({
      coverageGroup: executionJob.coverage_group,
      sourceType: executionJob.source_type,
      reason: backfillReason(coverageGroupByKey(executionJob.coverage_group), executionJob.source_type, executionJob, normalizedLocale),
      query: executionJob.query,
      candidateNames: executionJob.candidate_leads.length ? executionJob.candidate_leads : candidateNamesForCoverageGroup(source, executionJob.coverage_group),
      sourceTypesToCheck: [executionJob.source_type],
    });
  }

  return {
    summary: jobs.length > 0 ? backfillPlanCopy(normalizedLocale, "summary", { count: jobs.length }) : "",
    jobs: jobs.slice(0, 16),
  };
}

const BACKFILL_SEARCH_INPUT_COPY = {
  zh: {
    title: "SignalHire 覆盖缺口补搜。",
    originalBrief: "原始搜索画像：{value}",
    notProvided: "未提供",
    coverageGroup: "覆盖组：{value}",
    missingSourceType: "缺失来源类型：{value}",
    unknown: "未知",
    focusedQuery: "聚焦查询：{value}",
    reason: "补搜原因：{value}",
    defaultReason: "补强薄弱证据覆盖，并做交叉验证。",
    affectedCandidates: "受影响候选人：{value}",
    noCandidates: "未指定具体候选人",
    sourceTypes: "需要检查的来源类型：{value}",
    publicSources: "公开来源",
    returnPayload: "返回一份聚焦该覆盖缺口的全新 AI 人才 shortlist payload。",
    sourceUrls: "优先补充具体公开证据和明确来源 URL，不要引用搜索结果页 URL。",
    explainFit: "说明新增证据是确认、削弱，还是改变原候选人匹配判断。",
  },
  en: {
    title: "Coverage backfill search for SignalHire.",
    originalBrief: "Original search brief: {value}",
    notProvided: "Not provided",
    coverageGroup: "Coverage group: {value}",
    missingSourceType: "Missing source type: {value}",
    unknown: "unknown",
    focusedQuery: "Focused query: {value}",
    reason: "Reason: {value}",
    defaultReason: "Improve weak evidence coverage and cross-validation.",
    affectedCandidates: "Affected candidates: {value}",
    noCandidates: "No specific candidates supplied",
    sourceTypes: "Source types to check: {value}",
    publicSources: "public sources",
    returnPayload: "Return a fresh AI talent shortlist payload focused on this coverage gap.",
    sourceUrls: "Prioritize concrete public evidence and specific source URLs. Do not cite search-result URLs.",
    explainFit: "Explain whether the new evidence confirms, weakens, or changes the original candidate fit.",
  },
};

function backfillSearchInputCopy(locale, key, params = {}) {
  const normalizedLocale = locale === "zh" ? "zh" : "en";
  let text = BACKFILL_SEARCH_INPUT_COPY[normalizedLocale][key] ?? BACKFILL_SEARCH_INPUT_COPY.en[key];
  for (const [name, value] of Object.entries(params)) text = text.replace(`{${name}}`, String(value));
  return text;
}

/**
 * @param {{ job?: unknown; originalQuery?: string; locale?: string }} input
 */
export function buildBackfillSearchInput({ job, originalQuery = "", locale = "en" } = {}) {
  const normalizedLocale = locale === "zh" ? "zh" : "en";
  const backfillJob = normalizeCoverageBackfillJob(job);
  const candidates = backfillJob.candidate_names.length
    ? backfillJob.candidate_names.join(", ")
    : backfillSearchInputCopy(normalizedLocale, "noCandidates");
  const sourceTypes = backfillJob.source_types_to_check.length
    ? backfillJob.source_types_to_check.join(", ")
    : backfillJob.missing_source_type || backfillSearchInputCopy(normalizedLocale, "publicSources");

  return [
    backfillSearchInputCopy(normalizedLocale, "title"),
    backfillSearchInputCopy(normalizedLocale, "originalBrief", { value: cleanString(originalQuery) || backfillSearchInputCopy(normalizedLocale, "notProvided") }),
    backfillSearchInputCopy(normalizedLocale, "coverageGroup", { value: backfillJob.coverage_group }),
    backfillSearchInputCopy(normalizedLocale, "missingSourceType", { value: backfillJob.missing_source_type || backfillSearchInputCopy(normalizedLocale, "unknown") }),
    backfillSearchInputCopy(normalizedLocale, "focusedQuery", { value: backfillJob.query || fallbackSourceQuery(backfillJob.missing_source_type, { original_query: originalQuery }) }),
    backfillSearchInputCopy(normalizedLocale, "reason", { value: backfillJob.reason || backfillSearchInputCopy(normalizedLocale, "defaultReason") }),
    backfillSearchInputCopy(normalizedLocale, "affectedCandidates", { value: candidates }),
    backfillSearchInputCopy(normalizedLocale, "sourceTypes", { value: sourceTypes }),
    backfillSearchInputCopy(normalizedLocale, "returnPayload"),
    backfillSearchInputCopy(normalizedLocale, "sourceUrls"),
    backfillSearchInputCopy(normalizedLocale, "explainFit"),
  ].join("\n");
}

const BACKFILL_MERGE_COPY = {
  zh: {
    sourceEvidence: "新增 {sourceTypes} 来源证据。",
    publicEvidence: "发现新的公开证据链接。",
    summary: "{candidateCount} 位候选人发现 {evidenceCount} 条新增证据。",
    empty: "未发现可合并到原报告的新增候选人证据。",
  },
  en: {
    sourceEvidence: "Added {sourceTypes} source evidence.",
    publicEvidence: "Found new public evidence links.",
    summary: "{candidateCount} {candidateLabel} {candidateVerb} {evidenceCount} new {evidenceLabel}.",
    empty: "No new candidate evidence was found to merge into the original report.",
  },
};

function backfillMergeCopy(locale, key, params = {}) {
  const normalizedLocale = locale === "en" ? "en" : "zh";
  let text = BACKFILL_MERGE_COPY[normalizedLocale][key] ?? BACKFILL_MERGE_COPY.zh[key];
  for (const [name, value] of Object.entries(params)) text = text.replace(`{${name}}`, String(value));
  return text;
}

/**
 * @param {{ originalResult?: unknown; backfillResult?: unknown; locale?: string }} input
 */
export function buildBackfillMergeSummary({ originalResult, backfillResult, locale = "zh" } = {}) {
  const normalizedLocale = locale === "en" ? "en" : "zh";
  const original = normalizeTalentSearchResult(originalResult);
  const backfill = normalizeTalentSearchResult(backfillResult);
  const originalCandidates = candidateMapByName(original.candidates);
  const improvedCandidates = [];
  const newCandidateNames = [];

  for (const candidate of backfill.candidates) {
    const name = cleanString(candidate.name);
    if (!name) continue;
    const originalCandidate = originalCandidates.get(name.toLowerCase());
    if (!originalCandidate) {
      newCandidateNames.push(name);
      continue;
    }

    const before = evidenceDetailsFromClaims(originalCandidate.claims);
    const after = evidenceDetailsFromClaims(candidate.claims);
    const newEvidenceUrls = Array.from(after.urls).filter((url) => !before.urls.has(url)).slice(0, 12);
    const newSourceTypes = Array.from(after.sourceTypes).filter((type) => !before.sourceTypes.has(type)).slice(0, 12);
    if (newEvidenceUrls.length === 0 && newSourceTypes.length === 0) continue;

    improvedCandidates.push({
      candidate_name: name,
      new_evidence_count: newEvidenceUrls.length,
      new_source_types: newSourceTypes,
      new_evidence_urls: newEvidenceUrls,
      merge_note: newSourceTypes.length
        ? backfillMergeCopy(normalizedLocale, "sourceEvidence", { sourceTypes: newSourceTypes.join(", ") })
        : backfillMergeCopy(normalizedLocale, "publicEvidence"),
    });
  }

  const beforeCounts = sourceTypeCountsFromMix(original.evidence_graph.source_mix, original.candidates);
  const backfillCounts = sourceTypeCountsFromMix(backfill.evidence_graph.source_mix, backfill.candidates);
  const afterCounts = addCounts(new Map(beforeCounts), backfillCounts);
  const beforeCoverage = coverageGroupsFromCounts(beforeCounts);
  const afterCoverage = coverageGroupsFromCounts(afterCounts);
  const coverageGains = afterCoverage
    .map((afterGroup) => {
      const beforeGroup = beforeCoverage.find((group) => group.key === afterGroup.key);
      const beforeCount = beforeGroup?.count ?? 0;
      return {
        key: afterGroup.key,
        label: afterGroup.label,
        before_count: beforeCount,
        after_count: afterGroup.count,
        added_source_types: afterGroup.source_types.filter((type) => !(beforeGroup?.source_types ?? []).includes(type)),
      };
    })
    .filter((group) => group.after_count > group.before_count)
    .slice(0, 4);

  const newEvidenceCount = improvedCandidates.reduce((total, candidate) => total + candidate.new_evidence_count, 0);
  return {
    summary: improvedCandidates.length > 0
      ? backfillMergeCopy(normalizedLocale, "summary", {
        candidateCount: improvedCandidates.length,
        candidateLabel: improvedCandidates.length === 1 ? "candidate" : "candidates",
        candidateVerb: improvedCandidates.length === 1 ? "has" : "have",
        evidenceCount: newEvidenceCount,
        evidenceLabel: newEvidenceCount === 1 ? "evidence item" : "evidence items",
      })
      : backfillMergeCopy(normalizedLocale, "empty"),
    improved_candidates: improvedCandidates.slice(0, 12),
    new_candidate_names: Array.from(new Set(newCandidateNames)).slice(0, 12),
    coverage_gains: coverageGains,
  };
}

/**
 * @param {{ originalResult?: unknown; backfillResult?: unknown; mergedAt?: string; locale?: string }} input
 */
export function mergeBackfillResult({ originalResult, backfillResult, mergedAt = new Date().toISOString(), locale = "zh" } = {}) {
  const original = normalizeTalentSearchResult(originalResult);
  const backfill = normalizeTalentSearchResult(backfillResult);
  const summary = buildBackfillMergeSummary({ originalResult: original, backfillResult: backfill, locale });
  const backfillCandidates = candidateMapByName(backfill.candidates);
  const existingNames = new Set(original.candidates.map((candidate) => candidate.name.toLowerCase()));

  const candidates = original.candidates.map((candidate) => {
    const backfillCandidate = backfillCandidates.get(candidate.name.toLowerCase());
    if (!backfillCandidate) return candidate;
    return {
      ...candidate,
      claims: mergeClaims(candidate.claims, backfillCandidate.claims),
      strongest_signals: uniqueStrings([...candidate.strongest_signals, ...backfillCandidate.strongest_signals], 5),
      uncertainties: uniqueStrings([...candidate.uncertainties, ...backfillCandidate.uncertainties], 5),
    };
  });
  for (const candidate of backfill.candidates) {
    if (!existingNames.has(candidate.name.toLowerCase())) candidates.push(candidate);
  }

  return {
    ...original,
    candidates: candidates.slice(0, 24),
    source_execution: {
      summary: original.source_execution.summary,
      jobs: original.source_execution.jobs,
    },
    coverage_backfill: {
      summary: original.coverage_backfill.summary || summary.summary,
      jobs: markCompletedBackfillJobs(original.coverage_backfill.jobs, summary),
    },
    evidence_graph: {
      summary: summary.summary || original.evidence_graph.summary,
      source_mix: mergeSourceMix(original.evidence_graph.source_mix, backfill.evidence_graph.source_mix),
      candidates: mergeEvidenceGraphCandidates(original.evidence_graph.candidates, backfill.evidence_graph.candidates),
    },
    backfill_merge: {
      merged_at: mergedAt,
      summary,
    },
  };
}

export function isTalentSearchResult(data) {
  return Boolean(
    isPlainObject(data) &&
    Array.isArray(data.candidates) &&
    (data.search_brief || data.talent_map || data.candidates.some((candidate) => isPlainObject(candidate) && "match_score" in candidate)),
  );
}
