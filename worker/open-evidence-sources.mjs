import { createHash } from "node:crypto";

const PROVIDERS = [
  {
    provider: "github",
    label: "GitHub repository search",
    coverage_group: "practice",
    source_type: "code",
    endpoint: "https://api.github.com/search/repositories",
    budget: { requests_per_run: 1, timeout_ms: 8000 },
    retry: { max_attempts: 2, backoff_ms: 500, statuses: [429, 500, 502, 503, 504] },
  },
  {
    provider: "huggingface",
    label: "Hugging Face model search",
    coverage_group: "practice",
    source_type: "huggingface",
    endpoint: "https://huggingface.co/api/models",
    budget: { requests_per_run: 1, timeout_ms: 8000 },
    retry: { max_attempts: 2, backoff_ms: 500, statuses: [429, 500, 502, 503, 504] },
  },
  {
    provider: "openalex",
    label: "OpenAlex works search",
    coverage_group: "research",
    source_type: "paper",
    endpoint: "https://api.openalex.org/works",
    budget: { requests_per_run: 1, timeout_ms: 10000 },
    retry: { max_attempts: 2, backoff_ms: 700, statuses: [429, 500, 502, 503, 504] },
  },
  {
    provider: "semantic_scholar",
    label: "Semantic Scholar paper search",
    coverage_group: "research",
    source_type: "paper",
    endpoint: "https://api.semanticscholar.org/graph/v1/paper/search",
    budget: { requests_per_run: 1, timeout_ms: 10000 },
    retry: { max_attempts: 2, backoff_ms: 1000, statuses: [429, 500, 502, 503, 504] },
  },
  {
    provider: "openreview",
    label: "OpenReview note search",
    coverage_group: "research",
    source_type: "paper",
    endpoint: "https://api2.openreview.net/notes/search",
    budget: { requests_per_run: 1, timeout_ms: 10000 },
    retry: { max_attempts: 2, backoff_ms: 700, statuses: [429, 500, 502, 503, 504] },
  },
  {
    provider: "anysearch",
    label: "AnySearch agent search",
    coverage_group: "public_web",
    source_type: "web",
    endpoint: "https://api.anysearch.com/v1/search",
    budget: { requests_per_run: 1, timeout_ms: 12000 },
    retry: { max_attempts: 2, backoff_ms: 700, statuses: [429, 500, 502, 503, 504] },
  },
];

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function compactQuery(value) {
  return cleanString(value).replace(/\s+/g, " ").slice(0, 160);
}

export function buildOpenEvidenceSearchQueries(query, { maxQueries = 4 } = {}) {
  const base = compactQuery(query);
  if (!base) return [];
  const variants = [
    base,
    `${base} GitHub contributor`,
    `${base} paper benchmark`,
    `${base} Hugging Face model`,
  ];
  const seen = new Set();
  return variants
    .map(compactQuery)
    .filter((item) => {
      const key = item.toLowerCase();
      if (!item || seen.has(key)) return false;
      seen.add(key);
      return !/\b(linkedin|email|phone|contact)\b/i.test(item);
    })
    .slice(0, Math.max(1, Math.min(8, Number(maxQueries) || 1)));
}

function shortHash(value) {
  return createHash("sha256").update(String(value ?? "")).digest("hex").slice(0, 16);
}

function compactKey(value, maxLength = 240) {
  const clean = cleanString(value);
  if (clean.length <= maxLength) return clean;
  const hash = shortHash(clean);
  const prefix = clean.slice(0, Math.max(0, maxLength - hash.length - 1)).trimEnd();
  return `${prefix}:${hash}`;
}

function truncateText(value, maxLength) {
  const clean = cleanString(value);
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

function normalizeCount(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n));
}

function normalizeYear(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1900 || n > 2200) return null;
  return n;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function withQueryParam(url, key, value) {
  const clean = cleanString(value);
  if (!clean) return url;
  const parsed = new URL(url);
  parsed.searchParams.set(key, clean);
  return parsed.toString();
}

function requestUrl(provider, query, apiKeys = {}) {
  const q = encodeURIComponent(compactQuery(query));
  if (provider === "github") return `https://api.github.com/search/repositories?q=${q}%20in%3Aname%2Cdescription%2Creadme&sort=stars&order=desc&per_page=10`;
  if (provider === "huggingface") return `https://huggingface.co/api/models?search=${q}&limit=10&sort=downloads&direction=-1`;
  if (provider === "openalex") return withQueryParam(`https://api.openalex.org/works?search=${q}&per-page=10&sort=relevance_score%3Adesc`, "api_key", apiKeys.openalex);
  if (provider === "semantic_scholar") return `https://api.semanticscholar.org/graph/v1/paper/search?query=${q}&limit=10&fields=title%2Curl%2Cyear%2Cauthors%2CcitationCount`;
  if (provider === "anysearch") return "https://api.anysearch.com/v1/search";
  return `https://api2.openreview.net/notes/search?term=${q}&limit=10`;
}

function anysearchBody(query) {
  const sourceQuery = compactQuery(query);
  const isChinese = /[\u3400-\u9fff]/.test(sourceQuery);
  return {
    query: sourceQuery,
    max_results: 10,
    domain: /\b(paper|academic|arxiv|openreview|research|publication)\b/i.test(sourceQuery) ? "academic" : "tech",
    content_types: ["web"],
    zone: isChinese ? "cn" : "intl",
    language: isChinese ? "zh-CN" : "en",
  };
}

export function buildOpenEvidenceSourceRequests(query, { apiKeys = {}, maxQueries = 1 } = {}) {
  return buildOpenEvidenceSearchQueries(query, { maxQueries }).flatMap((sourceQuery) => PROVIDERS.map((provider) => ({
      ...provider,
      method: provider.provider === "anysearch" ? "POST" : "GET",
      source_query: sourceQuery,
      url: requestUrl(provider.provider, sourceQuery, apiKeys),
      body: provider.provider === "anysearch" ? anysearchBody(sourceQuery) : undefined,
      requires_json_body: provider.provider === "anysearch" || undefined,
    })));
}

function providerHeaders(provider, apiKeys = {}) {
  const headers = { accept: "application/json" };
  if (provider === "github" && apiKeys.github) headers.Authorization = `Bearer ${apiKeys.github}`;
  if (provider === "huggingface" && apiKeys.huggingface) headers.Authorization = `Bearer ${apiKeys.huggingface}`;
  if (provider === "semantic_scholar" && apiKeys.semantic_scholar) headers["x-api-key"] = apiKeys.semantic_scholar;
  if (provider === "anysearch") {
    headers["content-type"] = "application/json";
    if (apiKeys.anysearch) headers.Authorization = `Bearer ${apiKeys.anysearch}`;
  }
  return headers;
}

function timeoutSignal(timeoutMs) {
  if (typeof AbortController === "undefined" || !timeoutMs) return { signal: undefined, cancel: () => {} };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return { signal: controller.signal, cancel: () => clearTimeout(timer) };
}

function leadsForProvider(provider, payload) {
  return normalizeOpenEvidenceSourceResults({ [provider]: payload });
}

function lead(base) {
  return {
    provider: base.provider,
    family: base.family,
    coverage_group: base.coverage_group,
    source_type: base.source_type,
    candidate_name: base.candidate_name,
    title: base.title,
    url: base.url,
    metric: base.metric ?? 0,
    year: base.year ?? null,
  };
}

function normalizeGithub(payload) {
  return (Array.isArray(payload?.items) ? payload.items : []).map((item) => lead({
    provider: "github",
    family: "github_repo",
    coverage_group: "practice",
    source_type: "code",
    candidate_name: cleanString(item?.owner?.login),
    title: cleanString(item?.full_name),
    url: cleanString(item?.html_url),
    metric: Number(item?.stargazers_count ?? 0) || 0,
  })).filter((item) => item.candidate_name && item.url);
}

function normalizeHuggingFace(payload) {
  return (Array.isArray(payload) ? payload : []).map((item) => {
    const id = cleanString(item?.id);
    const author = cleanString(item?.author) || id.split("/")[0];
    return lead({
      provider: "huggingface",
      family: "huggingface_model",
      coverage_group: "practice",
      source_type: "huggingface",
      candidate_name: author,
      title: id,
      url: id ? `https://huggingface.co/${id}` : "",
      metric: Number(item?.downloads ?? item?.likes ?? 0) || 0,
    });
  }).filter((item) => item.candidate_name && item.url);
}

function normalizeOpenAlex(payload) {
  return (Array.isArray(payload?.results) ? payload.results : []).flatMap((work) => {
    const title = cleanString(work?.title);
    const url = cleanString(work?.id);
    const year = Number(work?.publication_year ?? 0) || null;
    return (Array.isArray(work?.authorships) ? work.authorships : []).slice(0, 3).map((authorship) => lead({
      provider: "openalex",
      family: "openalex_work",
      coverage_group: "research",
      source_type: "paper",
      candidate_name: cleanString(authorship?.author?.display_name),
      title,
      url,
      year,
    })).filter((item) => item.candidate_name && item.url);
  });
}

function normalizeSemanticScholar(payload) {
  return (Array.isArray(payload?.data) ? payload.data : []).flatMap((paper) => {
    const title = cleanString(paper?.title);
    const url = cleanString(paper?.url);
    const year = Number(paper?.year ?? 0) || null;
    const metric = Number(paper?.citationCount ?? 0) || 0;
    return (Array.isArray(paper?.authors) ? paper.authors : []).slice(0, 3).map((author) => lead({
      provider: "semantic_scholar",
      family: "semantic_scholar_paper",
      coverage_group: "research",
      source_type: "paper",
      candidate_name: cleanString(author?.name),
      title,
      url,
      metric,
      year,
    })).filter((item) => item.candidate_name && item.url);
  });
}

function normalizeOpenReview(payload) {
  return (Array.isArray(payload?.notes) ? payload.notes : []).flatMap((note) => {
    const title = cleanString(note?.content?.title?.value ?? note?.content?.title);
    const forum = cleanString(note?.forum ?? note?.id);
    const url = forum ? `https://openreview.net/forum?id=${forum}` : "";
    const authors = note?.content?.authors?.value ?? note?.content?.authors;
    return (Array.isArray(authors) ? authors : []).slice(0, 3).map((author) => lead({
      provider: "openreview",
      family: "openreview_paper",
      coverage_group: "research",
      source_type: "paper",
      candidate_name: cleanString(author),
      title,
      url,
    })).filter((item) => item.candidate_name && item.url);
  });
}

function parsedUrl(value) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function pathSegment(url, index) {
  const parsed = parsedUrl(url);
  return cleanString(parsed?.pathname?.split("/").filter(Boolean)[index]);
}

function anysearchSource(url) {
  const host = parsedUrl(url)?.hostname?.replace(/^www\./, "") ?? "";
  if (host === "github.com") {
    return {
      candidate_name: pathSegment(url, 0),
      family: "anysearch_github",
      coverage_group: "practice",
      source_type: "code",
    };
  }
  if (host === "huggingface.co") {
    return {
      candidate_name: pathSegment(url, 0),
      family: "anysearch_huggingface",
      coverage_group: "practice",
      source_type: "huggingface",
    };
  }
  if (/(arxiv\.org|openreview\.net|semanticscholar\.org|openalex\.org)$/.test(host)) {
    return {
      family: "anysearch_paper",
      coverage_group: "research",
      source_type: "paper",
    };
  }
  return {
    family: "anysearch_result",
    coverage_group: "public_web",
    source_type: "web",
  };
}

function normalizeAnySearch(payload) {
  const results = Array.isArray(payload?.data?.results) ? payload.data.results
    : Array.isArray(payload?.results) ? payload.results
      : [];
  return results.map((item) => {
    const url = cleanString(item?.url);
    const title = cleanString(item?.title);
    const source = anysearchSource(url);
    return lead({
      provider: "anysearch",
      family: source.family,
      coverage_group: source.coverage_group,
      source_type: source.source_type,
      candidate_name: source.candidate_name || title,
      title,
      url,
    });
  }).filter((item) => item.candidate_name && item.url);
}

export function normalizeOpenEvidenceSourceResults(results = {}) {
  return [
    ...normalizeGithub(results.github),
    ...normalizeHuggingFace(results.huggingface),
    ...normalizeOpenAlex(results.openalex),
    ...normalizeSemanticScholar(results.semantic_scholar),
    ...normalizeOpenReview(results.openreview),
    ...normalizeAnySearch(results.anysearch),
  ];
}

export function buildOpenEvidenceLeadRowsForRun({
  userId,
  sourceRunId = null,
  queryText = "",
  observedAt = new Date().toISOString(),
  leads = [],
} = {}) {
  if (!userId || !Array.isArray(leads)) return [];
  const rows = [];
  const seen = new Set();
  for (const item of leads) {
    const provider = cleanString(item?.provider);
    const candidateName = cleanString(item?.candidate_name);
    const url = cleanString(item?.url);
    if (!provider || !candidateName || !url) continue;
    const sourceKey = compactKey(`${userId}:${sourceRunId ?? "pending"}:${provider}:${shortHash(`${candidateName}:${url}`)}`);
    if (seen.has(sourceKey)) continue;
    seen.add(sourceKey);
    rows.push({
      user_id: userId,
      source_run_id: sourceRunId,
      cache_key: sourceKey,
      query_text: truncateText(queryText, 500),
      provider,
      family: cleanString(item?.family) || "open_evidence",
      coverage_group: cleanString(item?.coverage_group) || "public_voice",
      source_type: cleanString(item?.source_type) || "other",
      candidate_name: truncateText(candidateName, 240),
      title: truncateText(item?.title, 500),
      url,
      metric: normalizeCount(item?.metric),
      year: normalizeYear(item?.year),
      observed_at: observedAt,
      updated_at: observedAt,
    });
  }
  return rows;
}

export async function runOpenEvidenceSourcePrecheck(query, {
  fetchImpl = globalThis.fetch,
  apiKeys = {},
  sleepImpl = sleep,
  nowImpl = () => Date.now(),
  maxQueries = 1,
} = {}) {
  const responses = {};
  const errors = [];
  const provider_stats = {};
  const leads = [];
  for (const request of buildOpenEvidenceSourceRequests(query, { apiKeys, maxQueries })) {
    const started = nowImpl();
    let attempts = 0;
    let lastStatus = 0;
    let lastError = "";
    for (let attempt = 1; attempt <= request.retry.max_attempts; attempt++) {
      attempts = attempt;
      const timeout = timeoutSignal(request.budget.timeout_ms);
      try {
        const res = await fetchImpl(request.url, {
          method: request.method,
          headers: providerHeaders(request.provider, apiKeys),
          body: request.body ? JSON.stringify(request.body) : undefined,
          signal: timeout.signal,
        });
        timeout.cancel();
        lastStatus = res?.status ?? 0;
        if (res?.ok) {
          const payload = await res.json();
          if (responses[request.provider] === undefined) responses[request.provider] = payload;
          const requestLeads = leadsForProvider(request.provider, payload);
          leads.push(...requestLeads);
          const previous = provider_stats[request.provider] ?? { attempts: 0, requests: 0, lead_count: 0, duration_ms: 0 };
          provider_stats[request.provider] = {
            attempts: previous.attempts + attempts,
            requests: previous.requests + 1,
            status: lastStatus,
            duration_ms: previous.duration_ms + Math.max(0, nowImpl() - started),
            lead_count: previous.lead_count + requestLeads.length,
          };
          break;
        }
        if (!request.retry.statuses.includes(lastStatus) || attempt >= request.retry.max_attempts) {
          errors.push({ provider: request.provider, status: lastStatus });
          const previous = provider_stats[request.provider] ?? { attempts: 0, requests: 0, lead_count: 0, duration_ms: 0 };
          provider_stats[request.provider] = {
            attempts: previous.attempts + attempts,
            requests: previous.requests + 1,
            status: lastStatus,
            duration_ms: previous.duration_ms + Math.max(0, nowImpl() - started),
            lead_count: previous.lead_count,
          };
          break;
        }
      } catch (error) {
        timeout.cancel();
        lastError = error?.message ?? String(error);
        if (attempt >= request.retry.max_attempts) {
          errors.push({ provider: request.provider, error: lastError });
          const previous = provider_stats[request.provider] ?? { attempts: 0, requests: 0, lead_count: 0, duration_ms: 0 };
          provider_stats[request.provider] = {
            attempts: previous.attempts + attempts,
            requests: previous.requests + 1,
            status: lastStatus,
            duration_ms: previous.duration_ms + Math.max(0, nowImpl() - started),
            lead_count: previous.lead_count,
            error: lastError,
          };
          break;
        }
      }
      await sleepImpl(request.retry.backoff_ms * attempt);
    }
  }
  return {
    responses,
    leads,
    errors,
    provider_stats,
  };
}

export function buildOpenEvidenceSourcePromptBlock(query) {
  const lines = buildOpenEvidenceSourceRequests(query)
    .map((request) => `- ${request.label}: ${request.url}`)
    .join("\n");
  return `OPEN-SOURCE EVIDENCE ENRICHMENT PLAN:
Use these public API/source families as first-class source_strategy options before paid enrichment. Treat returned people as leads only; verify identity and claims with concrete source URLs.
${lines}`;
}
