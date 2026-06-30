const KNOWN_SOURCE_TYPES = new Set([
  "github",
  "paper",
  "company_page",
  "personal_site",
  "people_api",
  "linkedin_seed",
  "public_web",
  "internal_resume",
  "manual_upload",
]);

const PLATFORM_HOST_PARTS = [
  "github.com",
  "linkedin.com",
  "semanticscholar.org",
  "openreview.net",
  "arxiv.org",
  "doi.org",
  "openalex.org",
];

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function cleanString(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeType(value) {
  return cleanString(value).toLowerCase();
}

function sourceUrl(source) {
  return cleanString(source?.source_url || source?.url || source?.href || source?.link);
}

function hostOf(url) {
  const cleanUrl = cleanString(url);
  if (!cleanUrl) return "";

  try {
    const parsed = new URL(cleanUrl.includes("://") ? cleanUrl : `https://${cleanUrl}`);
    return parsed.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function pathOf(url) {
  const cleanUrl = cleanString(url);
  if (!cleanUrl) return "";

  try {
    const parsed = new URL(cleanUrl.includes("://") ? cleanUrl : `https://${cleanUrl}`);
    return parsed.pathname.toLowerCase();
  } catch {
    return "";
  }
}

function collectText(value, parts = [], depth = 0) {
  if (depth > 4 || value == null) return parts;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    parts.push(cleanString(value));
    return parts;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectText(item, parts, depth + 1);
    return parts;
  }
  if (isRecord(value)) {
    for (const [key, item] of Object.entries(value)) {
      parts.push(cleanString(key));
      collectText(item, parts, depth + 1);
    }
  }
  return parts;
}

function sourceText(source, url) {
  return [
    normalizeType(source?.source_type),
    cleanString(source?.provider),
    cleanString(source?.source),
    cleanString(source?.source_family),
    cleanString(source?.family),
    cleanString(source?.title),
    cleanString(source?.snippet),
    cleanString(source?.description),
    cleanString(source?.metadata_provider),
    cleanString(url),
    ...collectText(source?.metadata),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function isLinkedInHost(host) {
  return host === "linkedin.com" || host.endsWith(".linkedin.com");
}

function isGitHubHost(host) {
  return host === "github.com" || host.endsWith(".github.com");
}

function isPaperHost(host) {
  return (
    host === "semanticscholar.org" ||
    host.endsWith(".semanticscholar.org") ||
    host === "openreview.net" ||
    host.endsWith(".openreview.net") ||
    host === "arxiv.org" ||
    host.endsWith(".arxiv.org") ||
    host === "doi.org" ||
    host.endsWith(".doi.org")
  );
}

function isPlatformHost(host) {
  return PLATFORM_HOST_PARTS.some((part) => host === part || host.endsWith(`.${part}`));
}

function looksLikeCompanyPage(path, text) {
  return (
    /\/(team|about|people|company|companies|jobs|careers|profile)([-_/]|$)/.test(path) ||
    /\b(company|team|people|employment|employer|jobs|careers)[ _-]page\b/.test(text) ||
    /\b(team|about|people|company|jobs|careers|employment)[ _-]profile\b/.test(text)
  );
}

function looksLikePersonalSite(host, text) {
  return (
    Boolean(host) &&
    !isPlatformHost(host) &&
    /\b(personal[ _-]site|personal[ _-]website|personal[ _-]homepage|homepage|home page|portfolio|personal[ _-]portfolio|cv|resume|about me|my website)\b/.test(text)
  );
}

export function classifySourceType(source = {}) {
  const record = isRecord(source) ? source : {};
  const sourceType = normalizeType(record.source_type);
  const provider = normalizeType(record.provider);
  const url = sourceUrl(record);
  const host = hostOf(url);
  const path = pathOf(url);
  const text = sourceText(record, url);

  if (sourceType === "internal_resume") return "internal_resume";
  if (sourceType === "manual_upload") return "manual_upload";
  if (sourceType === "people_api" || provider.includes("hunter") || provider.includes("pdl")) return "people_api";
  if (sourceType === "linkedin_seed" || isLinkedInHost(host)) return "linkedin_seed";
  if (isGitHubHost(host) || /\bgithub\b/.test(text)) return "github";
  if (isPaperHost(host) || /\b(semantic scholar|openalex|openreview|arxiv|doi|publication|paper)\b/.test(text)) return "paper";
  if (!isGitHubHost(host) && !isLinkedInHost(host) && looksLikeCompanyPage(path, text)) return "company_page";
  if (sourceType === "personal_site" || looksLikePersonalSite(host, text)) return "personal_site";
  if (sourceType === "company_page") return "company_page";
  if (sourceType === "github" || sourceType === "paper") return sourceType;
  if (KNOWN_SOURCE_TYPES.has(sourceType)) return sourceType;
  return "public_web";
}

const LABELS = {
  github: { en: "GitHub", zh: "GitHub" },
  paper: { en: "Paper", zh: "论文" },
  company_page: { en: "Company page", zh: "公司页面" },
  personal_site: { en: "Personal site", zh: "个人站点" },
  people_api: { en: "People API", zh: "People API" },
  linkedin_seed: { en: "LinkedIn seed", zh: "LinkedIn 线索" },
  public_web: { en: "Public web", zh: "公开网页" },
  internal_resume: { en: "Internal resume", zh: "内部简历" },
  manual_upload: { en: "Manual upload", zh: "手动上传" },
};

const TOOLTIPS = {
  github: {
    en: "Technical evidence when tied to repositories, commits, issues, or profile activity.",
    zh: "当关联 repo、commit、issue 或主页活动时，可作为技术证据。",
  },
  paper: {
    en: "Research evidence when tied to a verified publication or paper index.",
    zh: "当关联可验证论文或论文索引时，可作为研究证据。",
  },
  company_page: {
    en: "Employment or role evidence from a company team, profile, jobs, or about page.",
    zh: "来自公司团队、个人资料、招聘或介绍页面的任职证据。",
  },
  personal_site: {
    en: "Personal homepage or portfolio evidence. Review the linked claims before outreach.",
    zh: "个人主页或作品集证据，外联前需核对关联结论。",
  },
  people_api: {
    en: "Lead/contact source. Not strong evidence by itself.",
    zh: "线索/联系方式来源，本身不是强证据。",
  },
  linkedin_seed: {
    en: "Identity lead from LinkedIn. Verify public evidence before recommendation.",
    zh: "来自 LinkedIn 的身份线索，推荐前需验证公开证据。",
  },
  public_web: {
    en: "Public web evidence candidate. Review the linked claim before outreach.",
    zh: "公开网页证据候选，外联前需核对关联结论。",
  },
  internal_resume: {
    en: "Internal or candidate-provided resume evidence.",
    zh: "内部或候选人提供的简历证据。",
  },
  manual_upload: {
    en: "User-provided lead or evidence. Verify before recommendation.",
    zh: "用户手动提供的线索或证据，推荐前需验证。",
  },
};

function localeKey(locale) {
  return locale === "zh" ? "zh" : "en";
}

export function sourceTypeLabel(sourceType, locale = "en") {
  const key = normalizeType(sourceType);
  return LABELS[key]?.[localeKey(locale)] || cleanString(sourceType).replace(/_/g, " ") || LABELS.public_web[localeKey(locale)];
}

export function sourceTypeTooltip(sourceType, locale = "en") {
  const key = normalizeType(sourceType);
  return TOOLTIPS[key]?.[localeKey(locale)] || TOOLTIPS.public_web[localeKey(locale)];
}
