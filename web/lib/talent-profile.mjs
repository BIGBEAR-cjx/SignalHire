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
  {
    tag: "LLM infra",
    terms: ["llm infra", "llm systems", "inference", "serving", "vllm", "sglang", "tensorrt-llm", "triton", "cuda", "gpu"],
  },
  {
    tag: "RAG",
    terms: ["rag", "retrieval", "vector", "embedding", "rerank", "knowledge base"],
  },
  {
    tag: "agent",
    terms: ["agent", "agents", "tool use", "workflow", "multi-agent", "automation"],
  },
  {
    tag: "multimodal",
    terms: ["multimodal", "vision-language", "vlm", "image", "video", "audio", "ocr"],
  },
  {
    tag: "eval",
    terms: ["eval", "evaluation", "benchmark", "safety", "red team", "observability", "quality"],
  },
  {
    tag: "AI product",
    terms: ["ai product", "product", "copilot", "llm app", "solution", "workflow"],
  },
  {
    tag: "AI GTM",
    terms: ["ai gtm", "gtm", "sales", "solution consultant", "field", "customer", "growth"],
  },
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

export const INTERNET_ROLE_TAXONOMY = [
  {
    key: "software_engineering",
    label_zh: "技术研发/工程",
    label_en: "Software engineering",
    patterns: [/全栈|前端|后端|客户端|移动端|工程师|研发|架构师|frontend|backend|full[- ]?stack|software engineer|developer|react|next\.js|node\.js|python/i],
    sourceHint: "GitHub Stack Overflow 技术社区",
  },
  {
    key: "ai_ml_data",
    label_zh: "AI/算法/数据",
    label_en: "AI, ML and data",
    patterns: [/算法|机器学习|深度学习|数据科学|数据分析|推荐系统|大模型|LLM|ML|AI engineer|data scientist|Kaggle|Hugging Face/i],
    sourceHint: "Google Scholar Kaggle Hugging Face 论文",
  },
  {
    key: "product_management",
    label_zh: "产品管理",
    label_en: "Product management",
    patterns: [/产品经理|产品负责人|增长产品|平台产品|PM\b|product manager|roadmap|需求分析|用户路径/i],
    sourceHint: "Product Hunt 产品案例 roadmap",
  },
  {
    key: "design_creative",
    label_zh: "设计/创意",
    label_en: "Design and creative",
    patterns: [/设计师|UI|UX|交互|视觉|品牌设计|Figma|作品集|designer|product design|portfolio/i],
    sourceHint: "Behance Dribbble portfolio 作品集",
  },
  {
    key: "growth_marketing",
    label_zh: "增长/市场/品牌/内容",
    label_en: "Growth, marketing and brand",
    patterns: [/增长|市场|营销|品牌|内容矩阵|投放|SEO|社媒|小红书|公众号|Twitter|TikTok|YouTube|Marketing|Growth/i],
    sourceHint: "内容平台 小红书 Twitter case study",
  },
  {
    key: "operations_community",
    label_zh: "运营/社区",
    label_en: "Operations and community",
    patterns: [/运营|社区|社群|活动运营|用户运营|内容运营|Discord|Telegram|community|operations/i],
    sourceHint: "Discord 社区 活动 社群",
  },
  {
    key: "sales_bd_gtm",
    label_zh: "销售/BD/GTM",
    label_en: "Sales, BD and GTM",
    patterns: [/销售|商务|BD|渠道|GTM|客户拓展|enterprise|sales|business development|go[- ]?to[- ]?market/i],
    sourceHint: "客户案例 CRM Sales Navigator company",
  },
  {
    key: "customer_success_support",
    label_zh: "客户成功/售前/支持",
    label_en: "Customer success and support",
    patterns: [/客户成功|售前|售后|解决方案|技术支持|support|solution|customer success|renewal|pre[- ]?sales/i],
    sourceHint: "case study 客户成功 support solution",
  },
  {
    key: "security_infra_devops",
    label_zh: "安全/基础设施/DevOps",
    label_en: "Security, infra and DevOps",
    patterns: [/安全|SRE|DevOps|运维|云原生|Kubernetes|K8s|CNCF|incident|security|infrastructure/i],
    sourceHint: "CNCF GitHub 安全 incident",
  },
  {
    key: "business_strategy_ops",
    label_zh: "战略/经营/商业分析",
    label_en: "Business strategy and operations",
    patterns: [/战略|经营分析|商业分析|项目管理|CEO Office|咨询|strategy|business operations|analysis|bizops/i],
    sourceHint: "咨询 strategy analysis 经营",
  },
  {
    key: "people_finance_admin",
    label_zh: "HR/财务/法务/行政",
    label_en: "People, finance and admin",
    patterns: [/HR|招聘|人力|HRBP|财务|法务|行政|recruiter|talent acquisition|finance|legal/i],
    sourceHint: "LinkedIn HR 招聘 finance",
  },
  {
    key: "executive_founder_leadership",
    label_zh: "高管/负责人/创始型",
    label_en: "Executive and founder leadership",
    patterns: [/高管|负责人|VP|C[EOFO]{2}|COO|CTO|CMO|创始|founder|head of|leadership|总监/i],
    sourceHint: "founder CEO 高管 媒体",
  },
];

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

function stripListMarker(line) {
  return cleanString(line)
    .replace(/^[\s\-*•·]+/, "")
    .replace(/^\d+[\s.、)）-]*/, "")
    .replace(/^[（(]?\d+[）)][\s-]*/, "")
    .trim();
}

function isJdSectionLabel(line) {
  return /^(职责|要求|岗位职责|工作职责|职责描述|主要职责|任职要求|职位要求|岗位要求|任职资格|必备条件|加分项|优先条件|优先考虑|排除项|排除条件|不适合|不考虑|avoid|requirements?|responsibilities|nice to have|preferred|bonus|exclusions?)[:：\s]*$/i.test(stripListMarker(line));
}

function sectionKind(line) {
  const text = stripListMarker(line).toLowerCase();
  if (/^(加分项|优先条件|优先考虑|nice to have|preferred|bonus)/i.test(text)) return "nice";
  if (/^(排除项|排除条件|不适合|不考虑|我们不想要的人|avoid|exclusions?)/i.test(text)) return "exclude";
  if (/^(职责|要求|岗位职责|工作职责|职责描述|主要职责|任职要求|职位要求|岗位要求|任职资格|必备条件|requirements?|responsibilities)/i.test(text)) return "must";
  if (/^(岗位备注|公司介绍|项目背景|岗位背景|备注|about company|company context)/i.test(text)) return "context";
  return null;
}

function cleanPlanCondition(line) {
  const text = stripListMarker(line)
    .replace(/^(你将负责|负责|需要|要求|具备|熟悉|能够|可以)[:：\s]*/i, "")
    .replace(/[。；;]+$/g, "")
    .trim();
  if (!text || isJdSectionLabel(text)) return "";
  if (/^(岗位职责|任职要求|加分项|排除项)[:：]/.test(text)) return "";
  return text.length > 96 ? `${text.slice(0, 94)}…` : text;
}

function firstRoleLine(query) {
  const lines = cleanString(query).split(/\n+/).map(stripListMarker).filter(Boolean);
  const first = lines.find((line) => !isJdSectionLabel(line) && line.length <= 80);
  return cleanPlanCondition(first);
}

function parseEditableBrief(query) {
  const clean = cleanString(query);
  const buckets = { must: [], nice: [], exclusions: [], context: [] };
  let current = "must";
  const role = firstRoleLine(clean);
  if (role) buckets.must.push(role);

  for (const rawLine of clean.split(/\n+/)) {
    const marker = stripListMarker(rawLine);
    const nextKind = sectionKind(marker);
    if (nextKind) {
      current = nextKind === "exclude" ? "exclusions" : nextKind;
      continue;
    }
    const item = cleanPlanCondition(rawLine);
    if (!item || item === role) continue;
    if (current !== "context") buckets[current].push(item);
  }

  return {
    must_have: uniqueStrings(buckets.must, 8),
    nice_to_have: uniqueStrings(buckets.nice, 8),
    exclusions: uniqueStrings(buckets.exclusions, 8),
  };
}

function isNoiseLine(line) {
  const text = stripListMarker(line);
  return !text || /^(复制|分享|copy|share)$/i.test(text) || /^#[^\s#]+/.test(text);
}

function looksLikeEmployerContext(line) {
  const text = cleanString(line);
  return /OkayJob|公司介绍|岗位备注|雇主|employer|company context|about company|第一心智|从\s*0\s*到\s*1|行业级影响力|直接影响|机会/i.test(text);
}

function cleanPastedJobBrief(query) {
  const original = cleanString(query);
  const rawNoise = [];
  const lines = [];
  for (const rawLine of original.split(/\n+/)) {
    const line = stripListMarker(rawLine);
    if (isNoiseLine(line)) {
      if (line) rawNoise.push(line);
      continue;
    }
    lines.push(line);
  }
  const roleTitle = cleanPlanCondition(lines.find((line) => !isJdSectionLabel(line) && !sectionKind(line) && line.length <= 80)) || "";
  const buckets = { must: [], nice: [], exclusions: [], context: [] };
  let current = "must";
  for (const rawLine of lines) {
    const marker = stripListMarker(rawLine);
    const nextKind = sectionKind(marker);
    if (nextKind) {
      current = nextKind === "exclude" ? "exclusions" : nextKind;
      continue;
    }
    const item = cleanPlanCondition(marker);
    if (!item || item === roleTitle) continue;
    if (looksLikeEmployerContext(item) && current !== "nice" && current !== "exclusions") {
      buckets.context.push(item);
      continue;
    }
    if (current === "context") buckets.context.push(item);
    else buckets[current].push(item);
  }
  const candidateRequirements = uniqueStrings([
    ...buckets.must,
    ...keywordTermsFromText(buckets.must.join("\n")),
  ], 12);
  return {
    cleaned_query: lines.join("\n"),
    role_title: roleTitle,
    must_have: uniqueStrings(candidateRequirements, 8),
    nice_to_have: uniqueStrings(buckets.nice, 8),
    exclusions: uniqueStrings(buckets.exclusions, 8),
    employer_context: uniqueStrings(buckets.context, 8),
    candidate_requirements: uniqueStrings(candidateRequirements, 12),
    negative_constraints: uniqueStrings(buckets.exclusions, 8),
    raw_noise: uniqueStrings(rawNoise, 20),
  };
}

function keywordTermsFromText(text) {
  const clean = cleanString(text);
  const patterns = [
    [/AI\s*Marketing/i, "AI Marketing"],
    [/AI\s*增长|AI\s*growth/i, "AI 增长"],
    [/增长|growth/i, "增长"],
    [/内容营销|content marketing/i, "内容营销"],
    [/内容矩阵|小红书|公众号|视频号|LinkedIn/i, "内容矩阵"],
    [/海外市场|global|overseas/i, "海外市场"],
    [/HR\s*SaaS|招聘|recruiting/i, "HR SaaS"],
    [/AI\s*产品|AI product/i, "AI 产品"],
    [/自动化工作流|workflow automation|automation/i, "自动化工作流"],
    [/数据分析|analytics/i, "数据分析"],
    [/agent|agents/i, "AI Agent"],
    [/llm|large language model/i, "LLM"],
    [/inference|serving/i, "inference serving"],
    [/vllm/i, "vLLM"],
    [/triton/i, "Triton"],
    [/rag|retrieval/i, "RAG"],
  ];
  return patterns.filter(([pattern]) => pattern.test(clean)).map(([, term]) => term);
}

function roleTaxonomyItem(category) {
  return INTERNET_ROLE_TAXONOMY.find((item) => item.key === category) || INTERNET_ROLE_TAXONOMY[0];
}

function roleLabel(category, locale = "zh") {
  const item = roleTaxonomyItem(category);
  return locale === "en" ? item.label_en : item.label_zh;
}

export function detectInternetRoleCategory(query) {
  const clean = cleanString(query);
  if (!clean) return "software_engineering";
  const explicitCategory = clean.match(/\brole_category\s*[:：]\s*([a-z_]+)/i)?.[1];
  if (INTERNET_ROLE_TAXONOMY.some((item) => item.key === explicitCategory)) return explicitCategory;
  const title = firstRoleLine(clean);
  if (/CEO Office|战略|经营|商业分析|strategy|business operations|bizops/i.test(title)) return "business_strategy_ops";
  if (/\b(COO|CEO|CTO|CMO|VP)\b|创始|founder|head of/i.test(title)) return "executive_founder_leadership";
  if (/AI\s*Marketing|AI\s*增长|growth|marketing|市场|营销|内容/i.test(title)) return "growth_marketing";
  if (/产品经理|产品负责人|Product Manager|Product Lead|\bPM\b/i.test(title)) return "product_management";
  if (/UX|UI|设计师|designer|product design/i.test(title)) return "design_creative";
  if (/客户成功|售前|售后|solution|support|customer success/i.test(title)) return "customer_success_support";
  if (/BD|销售|商务|GTM|sales|business development/i.test(title)) return "sales_bd_gtm";
  if (/HR|招聘|HRBP|recruiter|talent acquisition|财务|法务|行政/i.test(title)) return "people_finance_admin";
  if (/DevOps|SRE|安全|infra|infrastructure|Kubernetes/i.test(title)) return "security_infra_devops";
  if (/负责人/i.test(title)) return "executive_founder_leadership";
  if (/算法|机器学习|数据科学|data scientist|ML|AI researcher/i.test(title)) return "ai_ml_data";
  if (/工程师|developer|engineer|研发|前端|后端|全栈|software/i.test(title)) return "software_engineering";
  const scores = new Map(INTERNET_ROLE_TAXONOMY.map((item) => [item.key, 0]));
  for (const item of INTERNET_ROLE_TAXONOMY) {
    for (const pattern of item.patterns) {
      if (pattern.test(clean)) scores.set(item.key, (scores.get(item.key) ?? 0) + 1);
    }
  }
  if (/AI\s*Marketing|AI\s*增长/i.test(clean)) scores.set("growth_marketing", (scores.get("growth_marketing") ?? 0) + 3);
  if (/产品经理|product manager/i.test(clean)) scores.set("product_management", (scores.get("product_management") ?? 0) + 2);
  if (/CEO Office|战略|经营分析|商业分析|business operations|bizops/i.test(clean)) scores.set("business_strategy_ops", (scores.get("business_strategy_ops") ?? 0) + 3);
  if (/HR|招聘|人力|HRBP|财务|法务|行政|recruiter|talent acquisition|finance|legal/i.test(clean)) scores.set("people_finance_admin", (scores.get("people_finance_admin") ?? 0) + 3);
  if (/\b(COO|CEO|CTO|CMO|VP)\b|负责人|创始|founder|head of/i.test(clean)) scores.set("executive_founder_leadership", (scores.get("executive_founder_leadership") ?? 0) + 2);
  if (/DevOps|SRE|Kubernetes|安全/i.test(clean)) scores.set("security_infra_devops", (scores.get("security_infra_devops") ?? 0) + 2);
  if (/(engineer|工程师|developer|研发|inference|serving|vllm|triton|react|node\.js|next\.js)/i.test(clean)) scores.set("software_engineering", (scores.get("software_engineering") ?? 0) + 3);
  if (/算法|机器学习|深度学习|数据科学|数据分析|推荐系统|data scientist|Kaggle/i.test(clean)) scores.set("ai_ml_data", (scores.get("ai_ml_data") ?? 0) + 3);
  if (/AI|LLM|算法|机器学习/i.test(clean) && !/Marketing|增长|产品|运营/i.test(clean)) scores.set("ai_ml_data", (scores.get("ai_ml_data") ?? 0) + 2);
  return [...scores.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "software_engineering";
}

function channel(key, label, coverageGroup, sourceTypes, target, suffixes, reason, baseTerms) {
  return {
    key,
    label,
    coverage_group: coverageGroup,
    source_types: sourceTypes,
    target,
    query_variants: suffixes.map((suffix) => strategyQuery(baseTerms, suffix)),
    reason,
  };
}

function roleChannelTemplates(category, locale, baseTerms) {
  const zh = locale !== "en";
  const sharedProfile = channel(
    "public-profiles",
    zh ? "公开履历与职业档案" : "Public profiles",
    "work_history",
    ["profile", "social_profile", "company_profile"],
    "LinkedIn, company team pages, speaker bios",
    ["site:linkedin.com/in public profile current role", "company team page bio speaker profile"],
    zh ? "核验角色、资历、行业背景和职业轨迹。" : "Verify role, seniority, industry background, and career trajectory.",
    baseTerms,
  );
  const publicVoice = channel(
    "public-voice",
    zh ? "公开表达与影响力" : "Public voice",
    "public_voice",
    ["blog", "talk", "interview", "media"],
    "blogs, talks, podcasts, interviews, newsletters",
    ["blog podcast interview newsletter", "YouTube talk webinar media interview"],
    zh ? "核验判断力、影响力和公开表达质量。" : "Verify judgment, influence, and public communication.",
    baseTerms,
  );
  const templates = {
    software_engineering: [
      channel("code-practice", zh ? "代码与工程实践" : "Code and engineering practice", "practice", ["code", "repository", "project"], "GitHub, Stack Overflow, 技术社区", ["site:github.com repository contributor", "Stack Overflow 技术社区 engineering blog"], zh ? "用代码、项目和技术社区记录核验工程能力。" : "Verify engineering ability through code, projects, and technical community traces.", baseTerms),
      sharedProfile,
      channel("technical-writing", zh ? "技术内容" : "Technical writing", "public_voice", ["blog", "talk"], "engineering blogs, talks, podcasts", ["engineering blog talk architecture", "conference talk podcast interview"], zh ? "补充架构判断、复杂项目经验和表达能力。" : "Backfill architecture judgment, complex project work, and communication.", baseTerms),
      channel("adjacent-builders", zh ? "相邻构建者" : "Adjacent builders", "practice", ["project", "community"], "hackathons, builders, OSS communities", ["hackathon builder open source community", "indie builder product shipping"], zh ? "扩大到有可迁移项目证据的人。" : "Expand to people with transferable shipped-project evidence.", baseTerms),
    ],
    ai_ml_data: [
      sharedProfile,
      channel("research-data", zh ? "研究与数据证据" : "Research and data evidence", "research", ["paper", "dataset", "benchmark"], "Google Scholar, arXiv, OpenReview, Kaggle", ["Google Scholar arXiv OpenReview paper", "Kaggle Hugging Face dataset benchmark"], zh ? "核验算法、研究、数据集和 benchmark 产出。" : "Verify algorithm, research, dataset, and benchmark output.", baseTerms),
      channel("model-practice", zh ? "模型与工程落地" : "Model implementation", "practice", ["code", "huggingface", "project"], "GitHub, Hugging Face, Papers with Code", ["site:github.com model training inference", "site:huggingface.co model dataset space"], zh ? "确认是否有可运行模型、代码或产品化实践。" : "Confirm runnable models, code, or production practice.", baseTerms),
      publicVoice,
    ],
    product_management: [
      sharedProfile,
      channel("product-shipping", zh ? "产品交付与案例" : "Shipped product evidence", "practice", ["project", "case_study", "company_profile"], "Product Hunt, launch notes, product case studies", ["Product Hunt launch roadmap case study", "产品案例 用户路径 增长产品"], zh ? "核验产品从需求到上线和指标影响。" : "Verify product shipping from requirements to launch and metrics.", baseTerms),
      channel("market-user-sense", zh ? "用户与市场判断" : "User and market judgment", "public_voice", ["blog", "media", "content_platform"], "blogs, newsletters, podcasts", ["product teardown user research blog", "roadmap strategy interview podcast"], zh ? "评估用户理解、市场判断和表达能力。" : "Assess user understanding, market judgment, and communication.", baseTerms),
      channel("adjacent-operators", zh ? "相邻增长/运营产品" : "Adjacent product operators", "practice", ["community", "case_study"], "growth, ops, founder operator pools", ["growth product operator founder", "platform product operations case study"], zh ? "扩展到做过相邻业务闭环的人。" : "Expand to people who owned adjacent business loops.", baseTerms),
    ],
    design_creative: [
      sharedProfile,
      channel("portfolio", zh ? "作品集与设计案例" : "Portfolio and design cases", "practice", ["portfolio", "project", "case_study"], "Behance, Dribbble, portfolio, 作品集", ["Behance Dribbble portfolio 作品集", "Figma case study product design"], zh ? "用作品集和案例核验设计能力。" : "Verify design ability through portfolios and case studies.", baseTerms),
      channel("design-voice", zh ? "设计表达" : "Design voice", "public_voice", ["blog", "talk", "media"], "design blogs, talks, communities", ["design blog talk interview", "Figma community product design article"], zh ? "评估设计方法、审美判断和表达能力。" : "Assess design method, judgment, and communication.", baseTerms),
      channel("brand-product-fit", zh ? "品牌/产品适配" : "Brand and product fit", "work_history", ["company_profile", "profile"], "company pages, product pages", ["brand visual product page team", "startup design lead company profile"], zh ? "确认行业、团队和产品阶段适配。" : "Confirm industry, team, and product-stage fit.", baseTerms),
    ],
    growth_marketing: [
      sharedProfile,
      channel("content-social", zh ? "内容平台与社媒增长" : "Content and social growth", "public_voice", ["content_platform", "social_profile", "media"], "小红书, Twitter, YouTube, TikTok, 公众号", ["小红书 Twitter YouTube TikTok 内容平台", "LinkedIn X 公众号 增长 内容矩阵"], zh ? "核验内容矩阵、社媒增长和公开影响力。" : "Verify content matrix, social growth, and public influence.", baseTerms),
      channel("growth-cases", zh ? "增长案例与业务结果" : "Growth cases and business outcomes", "practice", ["case_study", "company_profile", "project"], "case studies, company pages, campaign pages", ["growth case study 增长案例 conversion", "campaign user acquisition CAC retention"], zh ? "优先找有真实增长结果和转化指标的人。" : "Prioritize people with real growth outcomes and conversion metrics.", baseTerms),
      channel("community-kol", zh ? "社区/KOL 资源" : "Community and KOL network", "public_voice", ["community", "event", "media"], "communities, events, KOL networks", ["KOL community event speaker", "Web3 AI community growth marketing"], zh ? "补充渠道资源和行业影响力证据。" : "Backfill channel network and industry influence evidence.", baseTerms),
    ],
    operations_community: [
      sharedProfile,
      channel("community-ops", zh ? "社区与活动运营" : "Community and event operations", "practice", ["community", "event", "social_profile"], "Discord, Telegram, communities, events", ["Discord Telegram 社区 活动 社群", "community operations event growth"], zh ? "核验社区搭建、活动执行和用户运营能力。" : "Verify community building, event execution, and user operations.", baseTerms),
      channel("content-ops", zh ? "内容/用户运营案例" : "Content and user ops cases", "practice", ["case_study", "content_platform"], "content platforms, user lifecycle cases", ["内容运营 用户运营 case study", "user lifecycle community retention"], zh ? "寻找可复盘的运营动作和留存结果。" : "Find reviewable operations actions and retention outcomes.", baseTerms),
      publicVoice,
    ],
    sales_bd_gtm: [
      sharedProfile,
      channel("gtm-cases", zh ? "客户案例与商业结果" : "Customer cases and commercial results", "practice", ["case_study", "company_profile"], "客户案例, CRM, Sales Navigator, company pages", ["客户案例 enterprise sales CRM", "Sales Navigator GTM case study revenue"], zh ? "核验客户拓展、成交和商业结果。" : "Verify customer acquisition, deals, and commercial results.", baseTerms),
      channel("industry-network", zh ? "行业网络" : "Industry network", "work_history", ["profile", "event", "media"], "industry events, partner pages, media", ["industry event partner speaker", "BD partnership channel media"], zh ? "补充行业连接、渠道和合作伙伴证据。" : "Backfill industry connections, channels, and partner evidence.", baseTerms),
      publicVoice,
    ],
    customer_success_support: [
      sharedProfile,
      channel("success-cases", zh ? "客户成功案例" : "Customer success cases", "practice", ["case_study", "company_profile"], "case study, customer success, support, solution", ["customer success case study renewal", "solution consultant support implementation"], zh ? "核验客户交付、续约、支持和解决方案能力。" : "Verify delivery, renewal, support, and solution capability.", baseTerms),
      channel("solution-content", zh ? "解决方案内容" : "Solution content", "public_voice", ["blog", "talk", "project"], "solution blogs, webinars, documentation", ["solution webinar documentation blog", "implementation playbook support article"], zh ? "评估复杂问题解释和客户教育能力。" : "Assess complex problem explanation and customer education.", baseTerms),
      channel("customer-facing-history", zh ? "客户侧经历" : "Customer-facing history", "work_history", ["profile", "company_profile"], "public profiles, company pages", ["customer-facing profile enterprise implementation", "pre-sales solution engineer company profile"], zh ? "确认是否有真实客户侧交付经历。" : "Confirm real customer-facing delivery history.", baseTerms),
    ],
    security_infra_devops: [
      sharedProfile,
      channel("infra-practice", zh ? "基础设施与开源实践" : "Infra and open-source practice", "practice", ["code", "repository", "project"], "CNCF, GitHub, security, incident reports", ["CNCF Kubernetes GitHub SRE", "security incident postmortem DevOps"], zh ? "用开源、事故复盘和基础设施项目核验能力。" : "Verify through OSS, incident reviews, and infra projects.", baseTerms),
      channel("security-ops", zh ? "安全/稳定性证据" : "Security and reliability evidence", "research", ["paper", "benchmark", "case_study"], "security papers, benchmarks, postmortems", ["security benchmark paper CVE", "reliability postmortem observability"], zh ? "补充安全、可靠性和可观测性证据。" : "Backfill security, reliability, and observability evidence.", baseTerms),
      publicVoice,
    ],
    business_strategy_ops: [
      sharedProfile,
      channel("strategy-cases", zh ? "战略/经营案例" : "Strategy and business cases", "practice", ["case_study", "company_profile", "media"], "咨询, strategy, analysis, 经营", ["strategy business analysis case study", "consulting operating model market analysis"], zh ? "核验战略分析、经营改善和跨部门推进结果。" : "Verify strategy analysis, operating improvement, and cross-functional outcomes.", baseTerms),
      channel("operator-network", zh ? "经营/项目网络" : "Operator network", "work_history", ["profile", "event", "media"], "operator communities, events, company pages", ["CEO Office business operations profile", "operator event project management"], zh ? "补充经营、项目和团队协作背景。" : "Backfill operating, project, and team collaboration background.", baseTerms),
      publicVoice,
    ],
    people_finance_admin: [
      sharedProfile,
      channel("people-finance-proof", zh ? "职能专业证据" : "Function expertise evidence", "work_history", ["profile", "company_profile", "case_study"], "LinkedIn, HR, 招聘, finance, legal", ["LinkedIn HR 招聘 finance legal", "talent acquisition case study HRBP"], zh ? "核验职能经验、合规边界和组织阶段适配。" : "Verify function experience, compliance boundaries, and org-stage fit.", baseTerms),
      channel("process-outcomes", zh ? "流程与结果" : "Process and outcomes", "practice", ["case_study", "project"], "hiring funnels, finance processes, legal ops", ["hiring funnel recruiting metrics", "finance operations legal process"], zh ? "寻找流程建设、效率和业务结果证据。" : "Find process building, efficiency, and business outcome evidence.", baseTerms),
      publicVoice,
    ],
    executive_founder_leadership: [
      sharedProfile,
      channel("leadership-proof", zh ? "领导力与业务结果" : "Leadership and business outcomes", "work_history", ["company_profile", "media", "case_study"], "founder, CEO, 高管, 媒体", ["founder CEO VP leadership media", "business outcome company profile case study"], zh ? "核验负责人经历、业务结果和组织影响力。" : "Verify leadership history, business outcomes, and organizational influence.", baseTerms),
      channel("public-reputation", zh ? "公开声誉与行业影响" : "Public reputation and industry influence", "public_voice", ["media", "talk", "event"], "media interviews, podcasts, events", ["media interview podcast keynote", "industry event speaker leadership"], zh ? "评估行业声量、观点质量和可信度。" : "Assess industry visibility, quality of judgment, and credibility.", baseTerms),
      channel("adjacent-founders", zh ? "相邻创始型人才" : "Adjacent founder operators", "practice", ["project", "community"], "founder operators, startup builders", ["founder operator startup builder", "0 to 1 business lead community"], zh ? "扩展到有 0 到 1 业务建设证据的人。" : "Expand to people with zero-to-one business building evidence.", baseTerms),
    ],
  };
  return templates[category] || templates.software_engineering;
}

export function buildInternetRoleSearchPlaybook(query, { locale = "zh" } = {}) {
  const normalizedLocale = locale === "en" ? "en" : "zh";
  const category = detectInternetRoleCategory(query);
  const baseTerms = strategyTermsFromQuery(query);
  const channels = roleChannelTemplates(category, normalizedLocale, baseTerms);
  const label = roleLabel(category, normalizedLocale);
  return {
    role_category: category,
    role_category_label: label,
    recall_mode: "aggressive_public_web_recall",
    channels,
    channel_plan: channels.map((item) => ({
      key: item.key,
      label: item.label,
      target: item.target,
      coverage_group: item.coverage_group,
      source_types: item.source_types,
    })),
    query_clusters: [
      { key: "precise_match", label: normalizedLocale === "en" ? "Precise matches" : "精准匹配", query_variants: channels.flatMap((item) => item.query_variants.slice(0, 1)).slice(0, 6) },
      { key: "adjacent_pool", label: normalizedLocale === "en" ? "Adjacent pools" : "相邻人才池", query_variants: channels.flatMap((item) => item.query_variants.slice(1, 2)).slice(0, 6) },
      { key: "public_evidence", label: normalizedLocale === "en" ? "Public evidence" : "公开证据", query_variants: channels.map((item) => `${baseTerms.join(" ")} ${item.source_types.join(" ")}`).slice(0, 6) },
    ],
    score_dimensions: [
      { key: "role_fit", label: normalizedLocale === "en" ? `${label} fit` : `${label}匹配`, weight: 30 },
      { key: "achievement_signals", label: normalizedLocale === "en" ? "Achievement signals" : "结果/成就信号", weight: 25 },
      { key: "evidence_quality", label: normalizedLocale === "en" ? "Evidence quality" : "证据质量", weight: 20 },
      { key: "work_history", label: normalizedLocale === "en" ? "Career relevance" : "履历相关性", weight: 15 },
      { key: "public_influence", label: normalizedLocale === "en" ? "Public influence" : "公开影响力", weight: 10 },
    ],
    target_segments: [
      { key: "primary-fit", label: normalizedLocale === "en" ? "Primary matches" : "精准匹配", reason: normalizedLocale === "en" ? `Direct ${label} profiles matching the core brief.` : `直接满足${label}核心条件的人。` },
      { key: "evidence-strong", label: normalizedLocale === "en" ? "Evidence-strong candidates" : "证据强候选人", reason: normalizedLocale === "en" ? "People supported by multiple independent public sources." : "具备多源公开证据的人。" },
      { key: "adjacent-transferable", label: normalizedLocale === "en" ? "Adjacent transferable pool" : "相邻可迁移人才", reason: normalizedLocale === "en" ? "Nearby backgrounds worth checking when exact matches are limited." : "精准匹配不足时可补充验证的相邻背景。" },
    ],
  };
}

function editableSourceTerms(query, plan) {
  const values = [
    firstRoleLine(query),
    ...cleanStringArray(plan.must_have, 5),
    ...cleanStringArray(plan.nice_to_have, 3),
  ];
  const keywordTerms = keywordTermsFromText(values.join("\n"));
  const compactTerms = values
    .flatMap((value) => cleanString(value).split(/[，,、/|；;：:\s]+/))
    .map((term) => term.trim())
    .filter((term) => term.length >= 2 && term.length <= 28)
    .filter((term) => !/^(岗位职责|任职要求|加分项|排除项|你将|负责|要求|经验|以上)$/.test(term));
  return uniqueStrings([...keywordTerms, ...compactTerms], 10);
}

function inferredMustHave(query) {
  const clean = cleanString(query);
  const parsed = parseEditableBrief(clean);
  if (parsed.must_have.length > 1 || parsed.nice_to_have.length || parsed.exclusions.length) return parsed.must_have;
  const items = [];
  if (/llm|large language model|inference|serving/i.test(clean)) items.push("LLM inference / serving experience");
  if (/vllm/i.test(clean)) items.push("vLLM experience");
  if (/triton/i.test(clean)) items.push("Triton or GPU serving experience");
  if (/senior|staff|principal|lead/i.test(clean)) items.push("Senior-level engineering ownership");
  return items.length ? uniqueStrings(items, 8) : [clean || "AI talent fit"];
}

function inferredExclusions(query) {
  const clean = cleanString(query);
  const parsed = parseEditableBrief(clean);
  if (parsed.exclusions.length) return parsed.exclusions;
  const items = [];
  if (/prompt[- ]?only|pure prompt|prompt engineering/i.test(clean)) items.push("prompt-only profiles");
  if (/exclude|not|avoid/i.test(clean)) items.push("profiles that only match keywords without public evidence");
  return uniqueStrings(items, 8);
}

function inferredNiceToHave(query) {
  const parsed = parseEditableBrief(query);
  return parsed.nice_to_have;
}

function searchIntakeCopy(locale, key) {
  const copy = {
    zh: {
      locationQuestion: "先确认一下工作地点偏好：这个岗位希望候选人主要分布在哪里？",
      locationReason: "地点会影响搜索关键词、公开履历筛选和候选人优先级。",
      salaryQuestion: "接下来确认薪资范围：你能给到的月薪大概是？",
      salaryReason: "薪资会影响候选人的资历判断和推荐排序。",
      targetCountQuestion: "这次大概想看多少位候选人？",
      targetCountReason: "候选数量会影响搜索深度和精选程度。",
      evidenceQuestion: "最后确认证据偏好：你更希望优先看到哪类证据？",
      evidenceReason: "证据偏好会影响来源优先级，但不会删除其他来源。",
      searchInputTitle: "搜索前需求确认",
      originalBrief: "原始需求：",
      role: "岗位：",
      mustHave: "必须条件：",
      niceToHave: "加分条件：",
      exclusions: "排除条件：",
      location: "地点：",
      salary: "薪资：",
      targetCount: "目标候选数量：",
      evidencePreference: "证据偏好：",
      sourceDirection: "搜索方向：",
      notSpecified: "未指定",
      sourceDirectionText: "请基于上述招聘约束搜索候选人，并按匹配度、证据质量和风险排序。优先使用公开来源交叉验证，不要把弱证据包装成强结论。",
    },
    en: {
      locationQuestion: "First, confirm location preference: where should candidates primarily be based?",
      locationReason: "Location affects search keywords, public profile filtering, and candidate priority.",
      salaryQuestion: "Next, confirm compensation range: what monthly salary range can you offer?",
      salaryReason: "Compensation affects seniority fit and ranking.",
      targetCountQuestion: "How many candidates do you want to review this round?",
      targetCountReason: "Candidate count affects search depth and selectivity.",
      evidenceQuestion: "Finally, confirm evidence preference: which evidence should be prioritized?",
      evidenceReason: "Evidence preference affects source priority without removing other sources.",
      searchInputTitle: "Pre-search requirement confirmation",
      originalBrief: "Original brief:",
      role: "Role:",
      mustHave: "Must-have:",
      niceToHave: "Nice-to-have:",
      exclusions: "Exclusions:",
      location: "Location:",
      salary: "Salary:",
      targetCount: "Target candidate count:",
      evidencePreference: "Evidence preference:",
      sourceDirection: "Search direction:",
      notSpecified: "not specified",
      sourceDirectionText: "Search candidates based on these hiring constraints, then rank by fit, evidence quality, and risk. Prioritize public-source cross-validation and do not present weak evidence as strong claims.",
    },
  };
  const normalizedLocale = locale === "en" ? "en" : "zh";
  return copy[normalizedLocale][key] ?? copy.zh[key] ?? "";
}

function searchIntakeOptions(locale, key) {
  const zh = {
    location: [
      { label: "不限地点（全国/海外远程均可）", value: "remote_anywhere", effect: "扩大候选池，优先看远程协作证据。" },
      { label: "北上广深一线城市", value: "tier1_cn", effect: "优先查找一线城市公开履历和公司经历。" },
      { label: "杭州/成都/南京等新一线", value: "new_tier1_cn", effect: "增加新一线城市关键词和本地团队线索。" },
      { label: "海外华人优先", value: "overseas_chinese", effect: "优先覆盖海外华人、远程和国际化背景。" },
    ],
    salary: [
      { label: "20-30K", value: "20-30K", effect: "偏向早中期或高潜候选人。" },
      { label: "30-50K", value: "30-50K", effect: "偏向成熟工程师和核心 contributor。" },
      { label: "50K 以上", value: "50K+", effect: "偏向资深、负责人或稀缺人才。" },
      { label: "面议/按能力定", value: "negotiable", effect: "不以薪资收窄候选池。" },
    ],
    target_count: [
      { label: "3-5 位精选", value: "3-5", effect: "更严格筛选，优先高证据质量。" },
      { label: "8-10 位", value: "8-10", effect: "平衡数量和精度。" },
      { label: "15-20 位", value: "15-20", effect: "扩大覆盖，允许更多待复核候选。" },
      { label: "越多越好", value: "many", effect: "最大化召回，再由证据排序。" },
    ],
    evidence_preference: [
      { label: "开源项目优先", value: "open_source", effect: "提高 GitHub、Hugging Face 和项目证据优先级。" },
      { label: "产品落地优先", value: "product_shipping", effect: "提高项目、公司页和案例证据优先级。" },
      { label: "大厂/知名团队经历优先", value: "brand_team", effect: "提高公司、团队和公开履历证据优先级。" },
      { label: "技术内容/公开表达优先", value: "public_voice", effect: "提高博客、演讲、播客和访谈证据优先级。" },
    ],
  };
  const en = {
    location: [
      { label: "Any location or remote", value: "remote_anywhere", effect: "Expands the pool and prioritizes remote-work evidence." },
      { label: "Major tech hubs", value: "major_hubs", effect: "Prioritizes public profiles in major tech hubs." },
      { label: "China tier-1 cities", value: "tier1_cn", effect: "Adds China tier-1 city signals." },
      { label: "Overseas Chinese preferred", value: "overseas_chinese", effect: "Prioritizes overseas Chinese and international profiles." },
    ],
    salary: [
      { label: "20-30K", value: "20-30K", effect: "Biases toward early-mid or high-potential candidates." },
      { label: "30-50K", value: "30-50K", effect: "Biases toward mature engineers and core contributors." },
      { label: "50K+", value: "50K+", effect: "Biases toward senior or scarce talent." },
      { label: "Negotiable", value: "negotiable", effect: "Avoids narrowing the pool by compensation." },
    ],
    target_count: [
      { label: "3-5 curated", value: "3-5", effect: "Stricter screening and higher evidence quality." },
      { label: "8-10 candidates", value: "8-10", effect: "Balances precision and coverage." },
      { label: "15-20 candidates", value: "15-20", effect: "Expands coverage with more review-needed leads." },
      { label: "As many as possible", value: "many", effect: "Maximizes recall, then ranks by evidence." },
    ],
    evidence_preference: [
      { label: "Open-source first", value: "open_source", effect: "Prioritizes GitHub, Hugging Face, and project evidence." },
      { label: "Shipped product first", value: "product_shipping", effect: "Prioritizes project, company, and case evidence." },
      { label: "Known team experience first", value: "brand_team", effect: "Prioritizes company, team, and public profile evidence." },
      { label: "Public voice first", value: "public_voice", effect: "Prioritizes blogs, talks, podcasts, and interviews." },
    ],
  };
  return (locale === "en" ? en : zh)[key] ?? zh[key] ?? [];
}

function defaultIntakeUnknowns(draft) {
  const source = isPlainObject(draft) ? draft : {};
  const clarification = isPlainObject(source.clarification) ? source.clarification : {};
  const skipped = new Set(Array.isArray(source.skipped_questions) ? source.skipped_questions.map(cleanString) : []);
  return ["location", "salary", "target_count"].filter((key) => !cleanString(clarification[key]) && !skipped.has(key));
}

export function buildSearchIntakeDraft(query, { locale = "zh" } = {}) {
  const originalQuery = cleanString(query);
  const normalizedLocale = locale === "en" ? "en" : "zh";
  const cleaned = cleanPastedJobBrief(originalQuery);
  const parsed = parseEditableBrief(cleaned.cleaned_query || originalQuery);
  const fallbackMustHave = cleaned.must_have.length ? cleaned.must_have : inferredMustHave(cleaned.cleaned_query || originalQuery);
  const roleCategory = detectInternetRoleCategory(cleaned.cleaned_query || originalQuery);
  const playbook = buildInternetRoleSearchPlaybook(cleaned.cleaned_query || originalQuery, { locale: normalizedLocale });
  const roleTitle = cleaned.role_title || firstRoleLine(cleaned.cleaned_query || originalQuery) || fallbackMustHave[0] || (normalizedLocale === "en" ? "Internet role" : "互联网岗位");
  const draft = {
    original_query: originalQuery,
    role_title: roleTitle,
    role_category: roleCategory,
    role_category_label: roleLabel(roleCategory, normalizedLocale),
    employer_context: cleaned.employer_context,
    candidate_requirements: cleaned.candidate_requirements.length ? cleaned.candidate_requirements : fallbackMustHave,
    negative_constraints: cleaned.negative_constraints,
    raw_noise: cleaned.raw_noise,
    channel_plan: playbook.channel_plan,
    query_clusters: playbook.query_clusters,
    score_dimensions: playbook.score_dimensions,
    must_have: cleaned.must_have.length ? cleaned.must_have : parsed.must_have.length ? parsed.must_have : fallbackMustHave,
    nice_to_have: cleaned.nice_to_have.length ? cleaned.nice_to_have : parsed.nice_to_have,
    exclusions: cleaned.exclusions.length ? cleaned.exclusions : parsed.exclusions.length ? parsed.exclusions : inferredExclusions(cleaned.cleaned_query || originalQuery),
    unknowns: [],
    clarification: {},
    skipped_questions: [],
  };
  draft.unknowns = defaultIntakeUnknowns(draft);
  return draft;
}

const ROLE_BRIEF_SOURCE_LABELS = {
  natural_language: "Natural language",
  jd_file: "JD file",
  job_url: "Job URL",
  linkedin_url: "LinkedIn URL",
  similar_profile: "Similar profile",
  existing_brief: "Existing brief",
};

function normalizeRoleBriefSourceType(sourceType, value) {
  const explicit = cleanString(sourceType).toLowerCase();
  if (Object.prototype.hasOwnProperty.call(ROLE_BRIEF_SOURCE_LABELS, explicit)) return explicit;
  const text = cleanString(value);
  if (/linkedin\.com\/(in|pub|company|jobs)\//i.test(text)) return "linkedin_url";
  if (/^https?:\/\//i.test(text)) return "job_url";
  return "natural_language";
}

function roleBriefSourcePrefix(type, value, locale) {
  if (type === "natural_language") return cleanString(value);
  const label = ROLE_BRIEF_SOURCE_LABELS[type] ?? ROLE_BRIEF_SOURCE_LABELS.natural_language;
  const prefix = locale === "en" ? `${label}:` : `${label}：`;
  return `${prefix} ${cleanString(value)}`.trim();
}

export function buildRoleBriefDraft(value, { locale = "zh", sourceType } = {}) {
  const normalizedLocale = locale === "en" ? "en" : "zh";
  const type = normalizeRoleBriefSourceType(sourceType, value);
  const query = roleBriefSourcePrefix(type, value, normalizedLocale);
  const draft = buildSearchIntakeDraft(query, { locale: normalizedLocale });
  const channelPreview = (draft.channel_plan ?? []).slice(0, 4).map((item) => item.label || item.key).filter(Boolean);
  return {
    ...draft,
    intake_source: {
      type,
      label: ROLE_BRIEF_SOURCE_LABELS[type] ?? ROLE_BRIEF_SOURCE_LABELS.natural_language,
      value: cleanString(value),
    },
    confirmation: {
      required_before_search: true,
      summary: normalizedLocale === "en"
        ? "Confirm this role brief before deep research so the search does not run from unreviewed input."
        : "先确认岗位理解，再启动深度搜索，避免把未复核的输入直接当成搜索任务。",
      primary_action: normalizedLocale === "en" ? "Confirm role brief and start deep research" : "确认岗位画像并开始深度搜索",
      secondary_action: normalizedLocale === "en" ? "Adjust role brief" : "继续调整岗位画像",
    },
    search_plan_preview: [
      {
        key: "must_have",
        label: normalizedLocale === "en" ? "Must-have constraints" : "必须条件",
        value: draft.must_have.join("; "),
      },
      {
        key: "evidence_channels",
        label: normalizedLocale === "en" ? "Channel plan" : "渠道计划",
        value: channelPreview.join("; "),
      },
      {
        key: "ranking",
        label: normalizedLocale === "en" ? "Ranking signals" : "排序依据",
        value: (draft.score_dimensions ?? []).slice(0, 3).map((item) => item.label).join("; "),
      },
    ].filter((item) => item.value),
  };
}

export function buildSearchIntakeQuestions(draft, { locale = "zh" } = {}) {
  const source = isPlainObject(draft) ? draft : {};
  const unknowns = Array.isArray(source.unknowns) && source.unknowns.length ? source.unknowns : defaultIntakeUnknowns(source);
  const questionCopy = {
    location: ["locationQuestion", "locationReason"],
    salary: ["salaryQuestion", "salaryReason"],
    target_count: ["targetCountQuestion", "targetCountReason"],
    evidence_preference: ["evidenceQuestion", "evidenceReason"],
  };
  return unknowns
    .filter((key) => Object.prototype.hasOwnProperty.call(questionCopy, key))
    .map((key) => {
      const [questionKey, reasonKey] = questionCopy[key];
      return {
        key,
        question: searchIntakeCopy(locale, questionKey),
        reason: searchIntakeCopy(locale, reasonKey),
        options: searchIntakeOptions(locale, key),
        allow_custom: true,
        skippable: true,
      };
    });
}

export function answerSearchIntakeQuestion(draft, answer = {}) {
  const source = isPlainObject(draft) ? draft : buildSearchIntakeDraft("");
  const key = cleanString(answer.key);
  if (!key) return source;
  const skipped = Boolean(answer.skipped);
  const label = cleanString(answer.label) || cleanString(answer.value);
  const next = {
    ...source,
    clarification: { ...(isPlainObject(source.clarification) ? source.clarification : {}) },
    skipped_questions: Array.isArray(source.skipped_questions) ? [...source.skipped_questions] : [],
  };
  if (skipped) {
    if (!next.skipped_questions.includes(key)) next.skipped_questions.push(key);
  } else if (label) {
    next.clarification[key] = label;
  }
  next.unknowns = (Array.isArray(source.unknowns) ? source.unknowns : defaultIntakeUnknowns(source)).filter((item) => item !== key);
  return next;
}

function intakeLine(label, value) {
  const values = Array.isArray(value) ? cleanStringArray(value) : [cleanString(value)].filter(Boolean);
  if (!values.length) return `${label}`;
  return `${label}${values.join("; ")}`;
}

export function buildSearchInputFromSearchIntake({ draft, locale = "zh" } = {}) {
  const normalizedLocale = locale === "en" ? "en" : "zh";
  const source = isPlainObject(draft) ? draft : buildSearchIntakeDraft("");
  const clarification = isPlainObject(source.clarification) ? source.clarification : {};
  const emptyValue = searchIntakeCopy(normalizedLocale, "notSpecified");
  const channelPlan = Array.isArray(source.channel_plan) ? source.channel_plan : [];
  return [
    searchIntakeCopy(normalizedLocale, "searchInputTitle"),
    source.role_category ? `role_category: ${source.role_category}` : "",
    intakeLine(searchIntakeCopy(normalizedLocale, "role"), source.role_title || emptyValue),
    intakeLine(normalizedLocale === "en" ? "Role category:" : "岗位类别：", source.role_category_label || source.role_category || emptyValue),
    intakeLine(normalizedLocale === "en" ? "Employer context:" : "雇主背景：", source.employer_context),
    intakeLine(searchIntakeCopy(normalizedLocale, "mustHave"), source.must_have),
    intakeLine(searchIntakeCopy(normalizedLocale, "niceToHave"), source.nice_to_have),
    intakeLine(searchIntakeCopy(normalizedLocale, "exclusions"), source.exclusions),
    intakeLine(normalizedLocale === "en" ? "Channel plan:" : "渠道计划：", channelPlan.map((item) => `${item.label || item.key} - ${item.target || ""}`)),
    intakeLine(searchIntakeCopy(normalizedLocale, "location"), clarification.location || emptyValue),
    intakeLine(searchIntakeCopy(normalizedLocale, "salary"), clarification.salary || emptyValue),
    intakeLine(searchIntakeCopy(normalizedLocale, "targetCount"), clarification.target_count || emptyValue),
    intakeLine(searchIntakeCopy(normalizedLocale, "evidencePreference"), clarification.evidence_preference || emptyValue),
    intakeLine(searchIntakeCopy(normalizedLocale, "sourceDirection"), searchIntakeCopy(normalizedLocale, "sourceDirectionText")),
  ].filter(Boolean).join("\n");
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
  const playbook = buildInternetRoleSearchPlaybook(query, { locale });
  return playbook.channels.slice(0, 4).map((item) => ({
    source_type: item.source_types[0] || "profile",
    coverage_group: item.coverage_group,
    target: item.target,
    query: item.query_variants[0] || fallbackSourceQuery(item.source_types[0], { original_query: query }),
    reason: item.reason,
  }));
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
    ...(isPlainObject(source.agent_execution) ? { agent_execution: source.agent_execution } : {}),
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
    unverified: "未确认",
    contradicted: "矛盾",
    strongMatch: "强匹配",
    possibleMatch: "可进一步评估",
    weakMatch: "需要谨慎评估",
    conclusion: "{name} 当前可判断为{fit}：{role}{signal}，核心判断基于 {sources} 个独立信源和 {quality} 证据质量。",
    noRole: "公开资料",
    signalPrefix: "；主要信号是 {signal}",
    riskPrefix: "主要风险：{risk}",
    noMaterialRisk: "暂未发现明确高风险，但仍需要人工复核原始链接。",
    verdictSummary: "{verified} 条已验证 / {unverified} 条未确认 / {contradicted} 条矛盾",
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
    unverified: "未确认",
    contradicted: "矛盾",
    noSource: "无公开来源",
    singleSource: "单一来源",
    multiSource: "多来源",
  },
  en: {
    title: "Claim-source matrix",
    description: "Review each candidate claim, verdict, and public source before acting on weak, single-source, or contradicted items.",
    verified: "Verified",
    unverified: "Unverified",
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
    evidenceBody: "当前有 {sources} 个独立信源，{verified} 条已验证、{unverified} 条未确认、{contradicted} 条矛盾；整体证据质量为 {quality}。",
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

function evidenceQualityDisplay(value, locale) {
  const quality = cleanString(value).toLowerCase();
  const normalizedQuality = EVIDENCE_QUALITY.includes(quality) ? quality : "medium";
  const labels = locale === "en"
    ? { high: "High", medium: "Medium", low: "Low" }
    : { high: "强", medium: "中", low: "弱" };
  return labels[normalizedQuality];
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
          quality: evidenceQualityDisplay(audit.overall_evidence_quality, normalizedLocale),
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

const REVIEW_BRIEF_COPY = {
  zh: {
    title: "三问审阅摘要",
    why: "为什么推荐？",
    evidence: "证据够不够？",
    next: "下一步做什么？",
    whyBody: "{name} 当前匹配分 {score}，{role}；关键公开信号是：{signal}",
    evidenceBody: "证据质量为 {quality}，已有 {sources} 个独立信源；已验证 {verified} 条，未确认 {unverified} 条，矛盾 {contradicted} 条。",
    nextBackfill: "先补齐 {gap} 等薄弱证据，再决定是否推进。",
    nextReview: "先人工复核：{risk}",
    nextOutreach: "证据基础较完整，可以复核原始链接后加入候选池并起草外联。",
    noRole: "公开资料",
    noSignal: "仍需补充可验证的论文、代码、项目或工作经历证据。",
  },
  en: {
    title: "Three-question review brief",
    why: "Why recommend?",
    evidence: "Is the evidence enough?",
    next: "What next?",
    whyBody: "{name} has a match score of {score}, {role}; key public signal: {signal}",
    evidenceBody: "Evidence quality is {quality}, with {sources} independent sources; {verified} verified, {unverified} unverified, and {contradicted} contradicted claims.",
    nextBackfill: "Backfill weak evidence such as {gap} before deciding whether to advance.",
    nextReview: "Review this manually first: {risk}",
    nextOutreach: "The evidence base is usable. Review original links, add to the pool, and draft outreach.",
    noRole: "public profile",
    noSignal: "more verifiable paper, code, project, or work-history evidence is needed.",
  },
};

function reviewBriefCopy(locale, key, params = {}) {
  let text = REVIEW_BRIEF_COPY[locale === "en" ? "en" : "zh"][key] ?? REVIEW_BRIEF_COPY.zh[key];
  for (const [name, value] of Object.entries(params)) text = text.replace(`{${name}}`, String(value));
  return text;
}

/**
 * @param {{ result?: unknown; candidate?: unknown; locale?: "zh" | "en" }} input
 */
export function buildCandidateReviewBrief({ result, candidate, locale = "zh" } = {}) {
  const normalizedLocale = locale === "en" ? "en" : "zh";
  const normalizedResult = normalizeTalentSearchResult(result);
  const suppliedCandidate = normalizeTalentSearchResult({ candidates: [candidate] }).candidates[0];
  const suppliedName = cleanString(suppliedCandidate?.name);
  const selected = normalizedResult.candidates.find((item) => item.name.toLowerCase() === suppliedName.toLowerCase()) || suppliedCandidate;
  const audit = buildCandidateEvidenceAudit({ result: normalizedResult, candidate: selected });
  const dossier = buildCandidateEvidenceDossier({ result: normalizedResult, candidate: selected, locale: normalizedLocale });
  const name = candidateDisplayName(selected?.name, normalizedLocale);
  const role = candidateRole(selected) || cleanString(selected?.headline) || reviewBriefCopy(normalizedLocale, "noRole");
  const signal = cleanStringArray(selected?.strongest_signals, 1)[0]
    || cleanStringArray(audit.strongest_evidence, 1)[0]
    || reviewBriefCopy(normalizedLocale, "noSignal");
  const risk = cleanStringArray(audit.risk_flags, 1)[0]
    || cleanStringArray(audit.weakest_evidence, 1)[0]
    || cleanStringArray(audit.single_source_claims, 1)[0]
    || cleanStringArray(audit.unverified_claims, 1)[0]
    || "";
  const gap = dossier.verification_gaps[0] || "";
  const nextBody = gap
    ? reviewBriefCopy(normalizedLocale, "nextBackfill", { gap })
    : risk
      ? reviewBriefCopy(normalizedLocale, "nextReview", { risk })
      : reviewBriefCopy(normalizedLocale, "nextOutreach");

  return {
    title: reviewBriefCopy(normalizedLocale, "title"),
    sections: [
      {
        key: "why_recommended",
        label: reviewBriefCopy(normalizedLocale, "why"),
        body: reviewBriefCopy(normalizedLocale, "whyBody", {
          name,
          score: clampScore(selected?.match_score),
          role,
          signal,
        }),
      },
      {
        key: "evidence_strength",
        label: reviewBriefCopy(normalizedLocale, "evidence"),
        body: reviewBriefCopy(normalizedLocale, "evidenceBody", {
          quality: evidenceQualityDisplay(audit.overall_evidence_quality, normalizedLocale),
          sources: audit.independent_sources,
          verified: audit.verified_count,
          unverified: audit.unverified_count,
          contradicted: audit.contradicted_count,
        }),
      },
      {
        key: "next_action",
        label: reviewBriefCopy(normalizedLocale, "next"),
        body: nextBody,
      },
    ],
  };
}

function slugifyName(value) {
  const slug = cleanString(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return slug || "unknown-candidate";
}

function textForVerticalMatch(candidate) {
  const claims = Array.isArray(candidate?.claims) ? candidate.claims : [];
  const evidenceText = claims.flatMap((claim) => [
    claim?.claim,
    ...(Array.isArray(claim?.evidence) ? claim.evidence.flatMap((evidence) => [evidence?.note, evidence?.url, evidence?.source_type]) : []),
  ]);
  return [
    candidate?.name,
    candidate?.headline,
    candidate?.current_role,
    candidate?.current_company,
    ...(candidate?.ai_directions ?? []),
    ...(candidate?.strongest_signals ?? []),
    ...(candidate?.uncertainties ?? []),
    candidate?.summary,
    ...evidenceText,
  ].map(cleanString).filter(Boolean).join(" ").toLowerCase();
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

/**
 * @param {{ result?: unknown; candidate?: unknown }} input
 */
export function buildCandidateProfileCacheEntry({ result, candidate } = {}) {
  const normalizedResult = normalizeTalentSearchResult(result);
  const selected = normalizeTalentSearchResult({ candidates: [candidate] }).candidates[0];
  const audit = buildCandidateEvidenceAudit({ result: normalizedResult, candidate: selected });
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
    ...audit.strongest_evidence,
  ], 40).join(" ");

  return {
    cache_key: slugifyName(selected.name),
    name: selected.name,
    role: candidateRole(selected),
    ai_directions: selected.ai_directions,
    vertical_tags: verticalTags,
    match_score: selected.match_score,
    confidence: audit.overall_evidence_quality,
    independent_sources: audit.independent_sources,
    evidence_urls: evidenceDetails.evidence_urls,
    source_types: evidenceDetails.source_types,
    structured_sources: evidenceDetails.structured_sources,
    search_text: searchText,
  };
}

/**
 * @param {{ result?: unknown; candidate?: unknown; limit?: number }} input
 */
export function buildSimilarCandidateSuggestions({ result, candidate, limit = 4 } = {}) {
  const normalized = normalizeTalentSearchResult(result);
  const selected = buildCandidateProfileCacheEntry({ result: normalized, candidate });
  const selectedTags = new Set(selected.vertical_tags);
  const selectedSourceTypes = new Set(selected.source_types);
  const selectedDirections = new Set(selected.ai_directions);

  return normalized.candidates
    .filter((item) => item.name !== selected.name)
    .map((item) => {
      const entry = buildCandidateProfileCacheEntry({ result: normalized, candidate: item });
      const sharedVerticalTags = entry.vertical_tags.filter((tag) => selectedTags.has(tag));
      const sharedSourceTypes = entry.source_types.filter((type) => selectedSourceTypes.has(type));
      const sharedDirections = entry.ai_directions.filter((direction) => selectedDirections.has(direction));
      const similarity_score = (sharedVerticalTags.length * 3) + (sharedDirections.length * 2) + sharedSourceTypes.length;
      return {
        name: entry.name,
        role: entry.role,
        match_score: entry.match_score,
        shared_vertical_tags: sharedVerticalTags,
        shared_source_types: sharedSourceTypes,
        shared_directions: sharedDirections,
        similarity_score,
      };
    })
    .filter((item) => item.similarity_score > 0)
    .sort((a, b) => b.similarity_score - a.similarity_score || b.match_score - a.match_score)
    .slice(0, Math.max(0, normalizeCount(limit) || 4));
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
  const qualityLabel = evidenceQualityDisplay(quality, locale);
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
      quality: qualityLabel,
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
      { label: dossierCopy(locale, "quality"), value: qualityLabel },
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

const SEARCH_WORKSPACE_COPY = {
  zh: {
    complete: "搜索完成",
    highConfidence: "高置信候选人",
    highConfidenceDesc: "匹配度高且证据基础较完整，适合优先审阅和推进。",
    needsVerification: "需要补证据",
    needsVerificationDesc: "匹配方向可能成立，但来源偏薄、存在未确认信息或风险提示。",
    adjacentPool: "相邻人才池",
    adjacentPoolDesc: "方向接近，可作为扩展候选池或下一轮搜索种子。",
    lowerConfidence: "低置信线索",
    lowerConfidenceDesc: "暂不适合作为优先候选人，保留为搜索反馈或负向样本。",
    noRisk: "暂无明显风险，仍建议打开原始来源复核。",
    noReason: "需要结合原始来源进一步判断匹配度。",
    summary: "共发现 {count} 位候选人，优先查看 {top}；证据覆盖 {covered}/{total}。",
    summaryNoCandidates: "本轮搜索没有返回可审阅候选人，建议调整条件后重试。",
    logSummary: "研究日志默认折叠，保留搜索计划、来源执行和补证据线索。",
    handoffReason: "生成可分享的证据摘要，给 hiring manager 做人工审阅。",
    interviewQuestion: "面试时请复核：{risk}",
    evidenceQuestion: "请候选人补充能证明「{claim}」的公开来源或案例。",
    strengthQuestion: "请候选人展开说明：{signal}",
  },
  en: {
    complete: "Search complete",
    highConfidence: "High-confidence matches",
    highConfidenceDesc: "Strong fit with a usable evidence base. Review and advance first.",
    needsVerification: "Needs verification",
    needsVerificationDesc: "Potential fit, but evidence is thin, unverified, or risky.",
    adjacentPool: "Adjacent pool",
    adjacentPoolDesc: "Nearby talent worth using as expansion seeds.",
    lowerConfidence: "Lower-confidence leads",
    lowerConfidenceDesc: "Keep as feedback or negative examples before prioritizing.",
    noRisk: "No obvious risk yet. Still review original sources before acting.",
    noReason: "Review original sources before judging fit.",
    summary: "Found {count} candidates. Review {top} first; source coverage {covered}/{total}.",
    summaryNoCandidates: "No reviewable candidates returned. Adjust the brief and try again.",
    logSummary: "Research log is collapsed by default and keeps search plan, source execution, and backfill leads.",
    handoffReason: "Create a shareable evidence brief for hiring-manager review.",
    interviewQuestion: "In interview, verify: {risk}",
    evidenceQuestion: "Ask the candidate for public evidence or examples supporting: {claim}.",
    strengthQuestion: "Ask the candidate to walk through this evidence-backed signal: {signal}.",
  },
};

function searchWorkspaceCopy(locale, key, params = {}) {
  let text = SEARCH_WORKSPACE_COPY[locale === "en" ? "en" : "zh"][key] ?? SEARCH_WORKSPACE_COPY.zh[key];
  for (const [name, value] of Object.entries(params)) text = text.replace(`{${name}}`, String(value));
  return text;
}

function candidateInitials(name) {
  const clean = cleanString(name);
  if (!clean) return "?";
  const asciiParts = clean.split(/\s+/).filter(Boolean);
  if (asciiParts.length >= 2) return `${asciiParts[0][0]}${asciiParts[1][0]}`.toUpperCase();
  const compact = Array.from(clean.replace(/\s+/g, ""));
  return compact.slice(0, 2).join("").toUpperCase();
}

function candidateBucket({ candidate, audit }) {
  const score = clampScore(candidate?.match_score);
  const quality = cleanString(candidate?.evidence_audit?.overall_evidence_quality) || "medium";
  const hasRisk = audit.contradicted_count > 0 || audit.identity_risks.length > 0 || audit.risk_flags.length > 0;
  const thinEvidence = quality === "low" || audit.independent_sources < 2 || audit.unverified_count > 0 || audit.single_source_claims.length > 0;
  if (score >= 75 && quality === "high" && !hasRisk && audit.independent_sources >= 2) return "high_confidence";
  if (thinEvidence || hasRisk) return "needs_verification";
  if (score >= 60) return "adjacent_pool";
  return "lower_confidence";
}

function groupMeta(locale, key) {
  const meta = {
    high_confidence: ["highConfidence", "highConfidenceDesc"],
    needs_verification: ["needsVerification", "needsVerificationDesc"],
    adjacent_pool: ["adjacentPool", "adjacentPoolDesc"],
    lower_confidence: ["lowerConfidence", "lowerConfidenceDesc"],
  }[key];
  return {
    key,
    label: searchWorkspaceCopy(locale, meta[0]),
    description: searchWorkspaceCopy(locale, meta[1]),
  };
}

function shortSlug(value) {
  return cleanString(value)
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function strategyTermsFromQuery(query) {
  const clean = cleanString(query);
  const keywords = keywordTermsFromText(clean);
  const explicitTerms = clean
    .split(/[，,、/|；;：:\s\n]+/g)
    .map((term) => term.trim())
    .filter((term) => term.length >= 2 && term.length <= 32)
    .filter((term) => !/^(岗位|职责|要求|负责|候选人|经验|以上|不限|远程|薪资|工作|search|find|with|and|or|the|for)$/i.test(term));
  return uniqueStrings([...keywords, ...explicitTerms], 8);
}

function strategyQuery(baseTerms, suffix) {
  const terms = baseTerms.length ? baseTerms.join(" ") : "AI talent";
  return `${terms} ${suffix}`.trim();
}

export function buildAgentSearchStrategy(query, { locale = "zh", cachedCandidateHints = [] } = {}) {
  const normalizedLocale = locale === "en" ? "en" : "zh";
  const playbook = buildInternetRoleSearchPlaybook(query, { locale: normalizedLocale });
  const hintNames = (Array.isArray(cachedCandidateHints) ? cachedCandidateHints : [])
    .map((hint) => cleanString(hint?.name))
    .filter(Boolean)
    .slice(0, 4);
  return {
    role_category: playbook.role_category,
    role_category_label: playbook.role_category_label,
    recall_mode: playbook.recall_mode,
    summary: normalizedLocale === "en"
      ? `Plan aggressive public-web sourcing for ${playbook.role_category_label} across ${playbook.channels.length} evidence routes before ranking candidates.`
      : `先按 ${playbook.role_category_label} 的 ${playbook.channels.length} 条公开证据路线多渠道搜人，再按匹配度、证据质量和风险排序。`,
    channels: playbook.channels,
    channel_plan: playbook.channel_plan,
    query_clusters: playbook.query_clusters,
    score_dimensions: playbook.score_dimensions,
    target_segments: playbook.target_segments,
    evidence_priorities: [
      normalizedLocale === "en" ? "Do not mark claims verified without concrete URLs." : "没有具体 URL 的 claim 不能标记为 verified。",
      normalizedLocale === "en" ? "Prefer independent source count over keyword density." : "优先看独立来源数量，而不是关键词密度。",
      normalizedLocale === "en" ? "Keep single-source candidates in verification buckets." : "单一来源候选人必须保留在待核验分组。",
      normalizedLocale === "en" ? "Do not treat the hiring company or product as a candidate target." : "不要把招聘公司或产品当作候选人搜索目标。",
      ...(hintNames.length ? [normalizedLocale === "en" ? `Re-check cached leads: ${hintNames.join(", ")}.` : `复核已见线索：${hintNames.join("、")}。`] : []),
    ],
  };
}

function normalizeAgentTrace(trace = []) {
  return (Array.isArray(trace) ? trace : []).map((item, index) => {
    const sourceType = cleanString(item?.source_type) || "other";
    const status = cleanString(item?.status).toLowerCase();
    return {
      trace_id: cleanString(item?.trace_id) || `trace-${index + 1}-${sourceType}`,
      tool: cleanString(item?.tool) || sourceType,
      source_type: sourceType,
      coverage_group: normalizeCoverageGroup(item?.coverage_group, sourceType),
      query: cleanString(item?.query),
      status: ["planned", "running", "completed", "partial", "failed"].includes(status) ? status : "planned",
      candidates_found: normalizeCount(item?.candidates_found),
      evidence_found: normalizeCount(item?.evidence_found),
      duration_ms: normalizeCount(item?.duration_ms),
      note: cleanString(item?.note),
    };
  }).filter((item) => item.query || item.note || item.evidence_found || item.candidates_found).slice(0, 24);
}

function traceFromSourceExecution(result) {
  return buildSourceExecution(result).jobs.map((job, index) => ({
    trace_id: `source-${index + 1}-${job.source_type}`,
    tool: job.source_type,
    source_type: job.source_type,
    coverage_group: job.coverage_group,
    query: job.query,
    status: job.status,
    candidates_found: job.candidate_leads.length,
    evidence_found: job.evidence_found || job.urls_found,
    duration_ms: 0,
    note: job.next_action || job.error || job.source_urls.slice(0, 2).join(", "),
  }));
}

function candidateSubmissionEvents(result, candidates) {
  const existing = Array.isArray(result?.agent_execution?.candidate_submission_events)
    ? result.agent_execution.candidate_submission_events
    : [];
  if (existing.length > 0) {
    return existing.map((item, index) => ({
      row_id: cleanString(item?.row_id) || `row-${index + 1}`,
      candidate_index: normalizeCount(item?.candidate_index),
      name: cleanString(item?.name) || "Unknown candidate",
      role: cleanString(item?.role),
      source: cleanString(item?.source) || "search",
      match_score: clampScore(item?.match_score),
      evidence_quality: EVIDENCE_QUALITY.includes(item?.evidence_quality) ? item.evidence_quality : "medium",
      independent_sources: normalizeCount(item?.independent_sources),
      reason: cleanString(item?.reason),
      status: "submitted",
    })).slice(0, 50);
  }
  return candidates.map((candidate, index) => {
    const audit = buildCandidateEvidenceAudit({ result, candidate });
    const source = audit.source_types[0] || candidate.links?.github && "github" || candidate.links?.linkedin && "linkedin" || "search";
    return {
      row_id: `candidate-${index + 1}-${shortSlug(candidate.name) || "unknown"}`,
      candidate_index: index,
      name: candidate.name,
      role: candidateRole(candidate),
      source,
      match_score: clampScore(candidate.match_score),
      evidence_quality: candidate.evidence_audit.overall_evidence_quality,
      independent_sources: audit.independent_sources,
      reason: cleanStringArray(candidate.strongest_signals, 1)[0] || candidate.summary || candidate.headline || "",
      status: "submitted",
    };
  });
}

function buildDeliveryClusters(result, candidates, locale) {
  const existing = Array.isArray(result?.agent_execution?.delivery_clusters) ? result.agent_execution.delivery_clusters : [];
  if (existing.length > 0) {
    return existing.map((item, index) => ({
      key: cleanString(item?.key) || `cluster-${index + 1}`,
      label: cleanString(item?.label) || `Cluster ${index + 1}`,
      candidate_indices: (Array.isArray(item?.candidate_indices) ? item.candidate_indices : [])
        .map((value) => normalizeCount(value))
        .filter((value) => value < candidates.length),
      rationale: cleanString(item?.rationale),
      next_action: cleanString(item?.next_action),
    })).filter((item) => item.candidate_indices.length > 0).slice(0, 8);
  }
  const bucketOrder = ["high_confidence", "needs_verification", "adjacent_pool", "lower_confidence"];
  return bucketOrder.map((key) => {
    const meta = groupMeta(locale, key);
    const indices = candidates
      .map((candidate, index) => ({ candidate, index, audit: buildCandidateEvidenceAudit({ result, candidate }) }))
      .filter((item) => candidateBucket({ candidate: item.candidate, audit: item.audit }) === key)
      .map((item) => item.index);
    return {
      key,
      label: meta.label,
      candidate_indices: indices,
      rationale: meta.description,
      next_action: key === "high_confidence"
        ? (locale === "en" ? "Review first and draft outreach." : "优先审阅并起草外联。")
        : key === "needs_verification"
          ? (locale === "en" ? "Backfill evidence before outreach." : "先补证据，再决定是否触达。")
          : (locale === "en" ? "Use as next-round search seeds." : "作为下一轮搜索种子。"),
    };
  }).filter((item) => item.candidate_indices.length > 0);
}

export function buildAgentExecutionLayer(result, { locale = "zh", stats = {}, durationMs = 0 } = {}) {
  const normalizedLocale = locale === "en" ? "en" : "zh";
  const source = isPlainObject(result) ? result : {};
  const normalized = normalizeTalentSearchResult(source);
  const existing = isPlainObject(source.agent_execution) ? source.agent_execution : {};
  const searchStrategy = isPlainObject(existing.search_strategy)
    ? existing.search_strategy
    : buildAgentSearchStrategy(normalized.search_brief.original_query || normalized.search_plan.must_have.join(" "), { locale: normalizedLocale });
  const executionTrace = normalizeAgentTrace(existing.execution_trace).length > 0
    ? normalizeAgentTrace(existing.execution_trace)
    : normalizeAgentTrace(traceFromSourceExecution(normalized));
  const submissions = candidateSubmissionEvents(source, normalized.candidates);
  const clusters = buildDeliveryClusters(source, normalized.candidates, normalizedLocale);
  const sourceMix = normalized.evidence_graph.source_mix.length > 0
    ? normalized.evidence_graph.source_mix
    : Array.from(new Map(executionTrace.map((trace) => [trace.source_type, trace.evidence_found || trace.candidates_found || 1])).entries())
      .map(([source_type, count]) => ({ source_type, count }));
  return {
    search_strategy: searchStrategy,
    execution_trace: executionTrace,
    candidate_submission_events: submissions,
    delivery_clusters: clusters,
    telemetry: {
      duration_ms: normalizeCount(existing.telemetry?.duration_ms ?? durationMs ?? stats?.duration_ms ?? stats?.durationMs),
      search_count: normalizeCount(existing.telemetry?.search_count ?? stats?.searches),
      fetch_count: normalizeCount(existing.telemetry?.fetch_count ?? stats?.fetches),
      tool_count: normalizeCount(existing.telemetry?.tool_count ?? executionTrace.length),
      submitted_count: submissions.length,
      source_mix: sourceMix,
    },
  };
}

export function buildSearchResultWorkspace(result, { locale = "zh", stats = {} } = {}) {
  const normalizedLocale = locale === "en" ? "en" : "zh";
  const source = isPlainObject(result) ? result : {};
  const normalized = normalizeTalentSearchResult(result);
  const agentExecution = buildAgentExecutionLayer(source, { locale: normalizedLocale, stats });
  const coverage = buildEvidenceCoverage(normalized);
  const coveredGroups = coverage.filter((group) => group.status === "covered");
  const execution = buildSourceExecution(normalized);
  const candidates = normalized.candidates.map((candidate, index) => {
    const audit = buildCandidateEvidenceAudit({ result: normalized, candidate });
    const bucket = candidateBucket({ candidate, audit });
    const matchReason = cleanStringArray(candidate.strongest_signals, 1)[0]
      || cleanStringArray(audit.strongest_evidence, 1)[0]
      || candidate.summary
      || candidate.headline
      || searchWorkspaceCopy(normalizedLocale, "noReason");
    const primaryRisk = cleanStringArray(audit.risk_flags, 1)[0]
      || cleanStringArray(candidate.uncertainties, 1)[0]
      || cleanStringArray(audit.weakest_evidence, 1)[0]
      || cleanStringArray(audit.unverified_claims, 1)[0]
      || searchWorkspaceCopy(normalizedLocale, "noRisk");
    const riskFlags = uniqueStrings([
      ...cleanStringArray(audit.risk_flags, 4),
      ...cleanStringArray(candidate.uncertainties, 4),
      ...cleanStringArray(audit.identity_risks, 4),
      ...cleanStringArray(audit.recency_notes, 4),
    ], 6);
    const unverifiedClaims = cleanStringArray(audit.unverified_claims, 6);
    const strongestEvidence = uniqueStrings([
      ...cleanStringArray(audit.strongest_evidence, 4),
      ...cleanStringArray(candidate.strongest_signals, 4),
    ], 5);
    const nextInterviewQuestions = uniqueStrings([
      primaryRisk && primaryRisk !== searchWorkspaceCopy(normalizedLocale, "noRisk")
        ? searchWorkspaceCopy(normalizedLocale, "interviewQuestion", { risk: primaryRisk })
        : "",
      ...unverifiedClaims.slice(0, 2).map((claim) => searchWorkspaceCopy(normalizedLocale, "evidenceQuestion", { claim })),
      strongestEvidence[0] ? searchWorkspaceCopy(normalizedLocale, "strengthQuestion", { signal: strongestEvidence[0] }) : "",
    ], 3);
    return {
      index,
      name: candidate.name,
      initials: candidateInitials(candidate.name),
      role: candidateRole(candidate) || candidate.headline,
      match_score: clampScore(candidate.match_score),
      evidence_quality: candidate.evidence_audit.overall_evidence_quality,
      independent_sources: audit.independent_sources,
      source_types: audit.source_types,
      match_reason: matchReason,
      primary_risk: primaryRisk,
      strongest_evidence: strongestEvidence,
      risk_flags: riskFlags,
      unverified_claims: unverifiedClaims,
      claim_counts: {
        verified: audit.verified_count,
        unverified: audit.unverified_count,
        contradicted: audit.contradicted_count,
      },
      next_interview_questions: nextInterviewQuestions,
      outreach_angle: candidate.outreach_angle || matchReason,
      bucket,
      handoff_action: {
        label: normalizedLocale === "en" ? "Share evidence brief" : "分享证据摘要",
        enabled: true,
        reason: searchWorkspaceCopy(normalizedLocale, "handoffReason"),
      },
      submission: agentExecution.candidate_submission_events.find((event) => event.candidate_index === index) ?? null,
    };
  });
  const bucketOrder = ["high_confidence", "needs_verification", "adjacent_pool", "lower_confidence"];
  const groups = bucketOrder
    .map((key) => {
      const indexes = candidates.filter((candidate) => candidate.bucket === key).map((candidate) => candidate.index);
      return { ...groupMeta(normalizedLocale, key), candidate_indices: indexes, count: indexes.length };
    })
    .filter((group) => group.count > 0);
  const selected = candidates.find((candidate) => candidate.bucket === "high_confidence")
    || candidates.find((candidate) => candidate.bucket === "needs_verification")
    || candidates[0];
  const toolCount = execution.jobs.length || normalized.search_plan.source_strategy.length;
  const sourceCount = new Set([
    ...execution.jobs.map((job) => job.source_type),
    ...coverage.flatMap((group) => group.source_types),
  ].filter(Boolean)).size;
  const topName = selected?.name || (normalizedLocale === "en" ? "the top candidate" : "优先候选人");
  const summary = candidates.length > 0
    ? searchWorkspaceCopy(normalizedLocale, "summary", {
      count: candidates.length,
      top: topName,
      covered: coveredGroups.length,
      total: coverage.length,
    })
    : searchWorkspaceCopy(normalizedLocale, "summaryNoCandidates");
  return {
    completion: {
      status: "complete",
      label: searchWorkspaceCopy(normalizedLocale, "complete"),
      candidate_count: candidates.length,
      tool_count: toolCount,
      source_count: sourceCount,
      covered_group_count: coveredGroups.length,
      coverage_group_count: coverage.length,
      searches: normalizeCount(stats?.searches ?? agentExecution.telemetry.search_count),
      fetches: normalizeCount(stats?.fetches ?? agentExecution.telemetry.fetch_count),
      duration_seconds: normalizeCount(stats?.durationSeconds ?? stats?.duration_seconds ?? Math.round(agentExecution.telemetry.duration_ms / 1000)),
      submitted_count: agentExecution.telemetry.submitted_count,
      execution_trace_count: agentExecution.execution_trace.length,
    },
    summary,
    candidates,
    groups,
    selected_candidate_index: selected?.index ?? null,
    delivery_report: {
      title: "Evidence-qualified shortlist",
      ready_for_hiring_manager: candidates.length > 0,
      summary,
      next_steps: buildShortlistDeliveryReport(normalized, { locale: normalizedLocale }).next_steps,
    },
    agent_execution: agentExecution,
    delivery_clusters: agentExecution.delivery_clusters,
    research_log: {
      default_open: false,
      summary: searchWorkspaceCopy(normalizedLocale, "logSummary"),
      jobs: execution.jobs,
      execution_trace: agentExecution.execution_trace,
      coverage,
    },
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
      preferred_skills: inferredNiceToHave(originalQuery),
      exclusions: inferredExclusions(originalQuery),
    },
    search_plan: {
      must_have: inferredMustHave(originalQuery),
      nice_to_have: inferredNiceToHave(originalQuery),
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

function sourcePlanLabel(source, locale) {
  const normalizedLocale = locale === "zh" ? "zh" : "en";
  const coverageGroup = backfillCoverageGroupLabel(source.coverage_group, normalizedLocale);
  const sourceType = backfillSourceTypeLabel(source.source_type, normalizedLocale);
  return [coverageGroup, sourceType].filter(Boolean).join("/");
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
    ...sources.map((source) => `- ${sourcePlanLabel(source, normalizedLocale)}: ${source.query} (${source.reason || source.target})`),
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

const BACKFILL_SOURCE_TYPE_LABELS = {
  zh: {
    benchmark: "基准",
    blog: "公开写作",
    code: "代码",
    community: "社区",
    company: "公司页",
    dataset: "数据集",
    huggingface: "Hugging Face",
    interview: "访谈",
    paper: "论文",
    patent: "专利",
    podcast: "播客",
    profile: "个人资料",
    project: "项目",
    talk: "演讲",
  },
  en: {},
};

function backfillSourceTypeLabel(value, locale) {
  const sourceType = cleanString(value).toLowerCase();
  if (!sourceType) return "";
  return BACKFILL_SOURCE_TYPE_LABELS[locale === "zh" ? "zh" : "en"][sourceType] || sourceType;
}

function backfillCoverageGroupLabel(value, locale) {
  const coverageGroup = cleanString(value);
  if (!coverageGroup) return "";
  return locale === "zh" ? dossierGroupLabel(locale, coverageGroup) : coverageGroup;
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
    ? backfillJob.source_types_to_check.map((sourceType) => backfillSourceTypeLabel(sourceType, normalizedLocale)).join(normalizedLocale === "zh" ? "、" : ", ")
    : backfillSourceTypeLabel(backfillJob.missing_source_type, normalizedLocale) || backfillSearchInputCopy(normalizedLocale, "publicSources");

  return [
    backfillSearchInputCopy(normalizedLocale, "title"),
    backfillSearchInputCopy(normalizedLocale, "originalBrief", { value: cleanString(originalQuery) || backfillSearchInputCopy(normalizedLocale, "notProvided") }),
    backfillSearchInputCopy(normalizedLocale, "coverageGroup", { value: backfillCoverageGroupLabel(backfillJob.coverage_group, normalizedLocale) }),
    backfillSearchInputCopy(normalizedLocale, "missingSourceType", { value: backfillSourceTypeLabel(backfillJob.missing_source_type, normalizedLocale) || backfillSearchInputCopy(normalizedLocale, "unknown") }),
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
