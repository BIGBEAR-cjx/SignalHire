function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function envHasValue(env, key) {
  return Boolean(cleanString(isRecord(env) ? env[key] : ""));
}

function confidenceFromScore(score) {
  const value = Number(score);
  if (value >= 80) return "high";
  if (value >= 60) return "medium";
  return "low";
}

function deliverabilityFromScore(score) {
  return Number(score) >= 60 ? "valid" : "risky";
}

function firstSource(value) {
  const source = Array.isArray(value) ? value.find(isRecord) : null;
  return source ?? {};
}

function candidateName(candidate) {
  const source = isRecord(candidate) ? candidate : {};
  return cleanString(source.name || source.full_name || source.candidate_name);
}

function companyDomain(candidate) {
  const source = isRecord(candidate) ? candidate : {};
  const company = isRecord(source.company) ? source.company : {};
  return cleanString(
    source.company_domain ||
    source.domain ||
    source.current_company_domain ||
    company.domain,
  );
}

function linkedinUrl(candidate) {
  const source = isRecord(candidate) ? candidate : {};
  const profile = isRecord(source.contact_profile) ? source.contact_profile : {};
  const links = isRecord(source.links) ? source.links : {};
  return cleanString(source.linkedin_url || profile.linkedin_url || links.linkedin);
}

export function buildContactProviderConfig(env = process.env) {
  const enabled = envHasValue(env, "HUNTER_API_KEY");
  return {
    provider: "hunter",
    enabled,
    reason: enabled ? "" : "missing HUNTER_API_KEY",
  };
}

export function buildHunterEmailFinderRequest({ apiKey = "", candidate = {} } = {}) {
  const url = new URL("https://api.hunter.io/v2/email-finder");
  const fullName = candidateName(candidate);
  const domain = companyDomain(candidate);
  const linkedin = linkedinUrl(candidate);
  if (fullName) url.searchParams.set("full_name", fullName);
  if (domain) url.searchParams.set("domain", domain);
  if (!domain && linkedin) url.searchParams.set("linkedin", linkedin);
  url.searchParams.set("api_key", cleanString(apiKey));
  const redacted = new URL(url.toString());
  redacted.searchParams.set("api_key", "REDACTED");
  return { url: url.toString(), redacted_url: redacted.toString(), method: "GET" };
}

export function normalizeHunterEmailFinderResult(value = {}) {
  const source = isRecord(value) ? value : {};
  const data = isRecord(source.data) ? source.data : source;
  const first = firstSource(data.sources);
  const email = cleanString(data.email);
  const score = Number(data.score ?? data.confidence ?? 0);
  const emails = email ? [{
    value: email,
    type: "work",
    source: "hunter",
    confidence: confidenceFromScore(score),
    deliverability_status: deliverabilityFromScore(score),
    last_verified_at: cleanString(first.last_seen_on || first.extracted_on),
  }] : [];
  const meta = isRecord(source.meta) ? source.meta : {};
  const credits = isRecord(meta.credits) ? meta.credits : {};
  return {
    contact_profile: {
      emails,
      phones: [],
      linkedin_url: cleanString(data.linkedin_url || data.linkedin),
    },
    cost_units: Number(credits.used ?? source.cost_units ?? 0) || 0,
    raw_reference: cleanString(first.uri || first.domain || source.request_id),
  };
}

export async function resolveHunterContact({ apiKey = "", candidate = {}, fetchImpl = fetch } = {}) {
  const request = buildHunterEmailFinderRequest({ apiKey, candidate });
  const url = new URL(request.url);
  if (!url.searchParams.get("domain") && !url.searchParams.get("linkedin")) {
    return normalizeHunterEmailFinderResult({ data: null, cost_units: 0 });
  }
  const response = await fetchImpl(request.url, { method: request.method });
  if (response.status === 404) return normalizeHunterEmailFinderResult({ data: null, cost_units: 0 });
  if (!response.ok) throw new Error(`hunter_${response.status}`);
  const payload = await response.json().catch(() => ({}));
  return normalizeHunterEmailFinderResult(payload);
}
