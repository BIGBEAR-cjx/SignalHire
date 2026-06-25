import { buildContactProfile } from "./contact-profile.mjs";

const MIRA_BASE_URL = "https://mira-api.openjobs-ai.com";
const DEFAULT_PROFILE_SOURCE = [
  "profile_id",
  "full_name",
  "address",
  "linkedin_url",
  "active_experience_title",
  "skills",
];

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function cleanString(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function cleanList(value, limit = 100) {
  return Array.isArray(value) ? value.map(cleanString).filter(Boolean).slice(0, limit) : [];
}

function positiveInt(value, fallback, max) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(n, max);
}

function unwrapEnvelope(payload) {
  if (isRecord(payload) && isRecord(payload.data)) return payload.data;
  return isRecord(payload) ? payload : {};
}

async function jsonPost({ url, apiKey, body, fetchImpl = fetch }) {
  const response = await fetchImpl(url, {
    method: "POST",
    headers: buildMiraAuthHeaders(apiKey),
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  const code = Number(payload?.code ?? response.status);
  if (!response.ok || (Number.isFinite(code) && code >= 400)) {
    const message = cleanString(payload?.msg || payload?.message || payload?.error) || `Mira request failed ${response.status}`;
    throw new Error(message);
  }
  return payload;
}

export function buildMiraAuthHeaders(apiKey) {
  return {
    Authorization: `Bearer ${cleanString(apiKey)}`,
    "Content-Type": "application/json",
  };
}

export function buildMiraPeopleSearchRequest(input = {}) {
  const source = isRecord(input) ? input : {};
  return {
    url: `${MIRA_BASE_URL}/v1/people-search`,
    body: {
      text: cleanString(source.text),
      size: positiveInt(source.size, 20, 100),
    },
  };
}

export function buildMiraProfilesByIdRequest(input = {}) {
  const source = isRecord(input) ? input : {};
  return {
    url: `${MIRA_BASE_URL}/entity/v1/profiles/detail-by-id`,
    body: {
      profile_ids: cleanList(source.profileIds ?? source.profile_ids, 50),
      _source: cleanList(source.source ?? source._source, 50).length
        ? cleanList(source.source ?? source._source, 50)
        : DEFAULT_PROFILE_SOURCE,
    },
  };
}

export function normalizeMiraProfile(value = {}) {
  const row = isRecord(value) ? value : {};
  const activeExperience = isRecord(row.active_experience) ? row.active_experience : {};
  const company = isRecord(activeExperience.company) ? activeExperience.company : {};
  const linkedinUrl = cleanString(row.linkedin_url || row.linkedin);
  const profile = {
    provider: "openjobs_mira",
    provider_id: cleanString(row.profile_id || row.id),
    name: cleanString(row.full_name || row.name),
    current_role: cleanString(row.active_experience_title || activeExperience.title || row.title),
    current_company: cleanString(row.active_experience_company || company.name || row.company),
    location: cleanString(row.address || row.location),
    linkedin_url: linkedinUrl,
    skills: cleanList(row.skills, 30),
  };
  return {
    ...profile,
    contact_profile: buildContactProfile({
      ...profile,
      email: row.email || row.work_email,
      email_source: (row.email || row.work_email) ? "openjobs_mira" : "",
      email_confidence: (row.email || row.work_email) ? "medium" : "",
      phone: row.phone || row.phone_number,
      phone_source: (row.phone || row.phone_number) ? "openjobs_mira" : "",
      phone_confidence: (row.phone || row.phone_number) ? "medium" : "",
      emails: row.emails,
      phone_numbers: row.phone_numbers,
    }),
  };
}

export async function searchMiraPeople({ apiKey = process.env.MIRA_KEY, text = "", size = 20, fetchImpl = fetch } = {}) {
  const cleanKey = cleanString(apiKey);
  if (!cleanKey) return [];
  const searchRequest = buildMiraPeopleSearchRequest({ text, size });
  const searchPayload = await jsonPost({ url: searchRequest.url, apiKey: cleanKey, body: searchRequest.body, fetchImpl });
  const searchData = unwrapEnvelope(searchPayload);
  const profileIds = cleanList(searchData.profile_ids, 100);
  if (profileIds.length === 0) return [];
  const detailRequest = buildMiraProfilesByIdRequest({ profileIds });
  const detailPayload = await jsonPost({ url: detailRequest.url, apiKey: cleanKey, body: detailRequest.body, fetchImpl });
  const detailData = unwrapEnvelope(detailPayload);
  const results = Array.isArray(detailData.results) ? detailData.results : [];
  return results.map(normalizeMiraProfile).filter((profile) => profile.provider_id || profile.name || profile.linkedin_url);
}

export function miraProfilesToShortlistCandidates(rows = []) {
  return (Array.isArray(rows) ? rows : []).map((value) => {
    const row = isRecord(value) ? value : {};
    const name = cleanString(row.name);
    const role = cleanString(row.current_role);
    const company = cleanString(row.current_company);
    const linkedinUrl = cleanString(row.linkedin_url);
    const skills = cleanList(row.skills, 20);
    return {
      ...row,
      provider: "openjobs_mira",
      name,
      headline: [role, company].filter(Boolean).join(" · "),
      current_role: role,
      current_company: company,
      match_score: 55,
      strongest_signals: [...[role, company].filter(Boolean), ...skills].slice(0, 4),
      uncertainties: ["OpenJobs AI profile has not been independently evidence-verified yet."],
      outreach_angle: role ? `Reference their ${role} background after evidence review.` : "Review OpenJobs AI profile before outreach.",
      links: linkedinUrl ? { linkedin: linkedinUrl } : {},
      source_nodes: [{
        source_type: "people_api",
        provider: "openjobs_mira",
        source_url: linkedinUrl,
        captured_at: new Date().toISOString(),
        confidence: "medium",
        extracted_fields: {
          provider_id: cleanString(row.provider_id),
          name,
          current_company: company,
        },
      }],
      evidence_audit: {
        overall_evidence_quality: "low",
        unverified_claims: ["OpenJobs AI profile has not been independently verified by public evidence."],
        contradicted_claims: [],
      },
      claims: [],
    };
  });
}
