function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function cleanString(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function envHasValue(env, key) {
  return Boolean(cleanString(isRecord(env) ? env[key] : ""));
}

function contactRows(value, provider, fieldNames) {
  const values = Array.isArray(value) ? value : cleanString(value) ? [value] : [];
  return values
    .map((item) => {
      const row = isRecord(item) ? item : {};
      const found = fieldNames.map((field) => row[field]).find((fieldValue) => cleanString(fieldValue));
      return {
        value: cleanString(found ?? item),
        type: "work",
        source: provider,
        confidence: "medium",
      };
    })
    .filter((item) => item.value);
}

function emailRows(value, provider) {
  return contactRows(value, provider, ["value", "email", "address"]);
}

function phoneRows(value, provider) {
  return contactRows(value, provider, ["value", "phone", "number", "raw_number", "sanitized_number"]);
}

function contactabilityScore(profile) {
  const emails = Array.isArray(profile.emails) ? profile.emails.length : 0;
  const phones = Array.isArray(profile.phones) ? profile.phones.length : 0;
  return Math.min(100, emails * 60 + phones * 25);
}

function buildContactProfile({ emails, phones, linkedinUrl }) {
  const profile = {
    emails,
    phones,
    linkedin_url: cleanString(linkedinUrl),
    contactability_score: 0,
  };
  profile.contactability_score = contactabilityScore(profile);
  return profile;
}

const APOLLO_PEOPLE_SEARCH_URL = "https://api.apollo.io/api/v1/mixed_people/api_search";
const APOLLO_PEOPLE_MATCH_URL = "https://api.apollo.io/api/v1/people/match";
const APOLLO_CONTACTS_SEARCH_URL = "https://api.apollo.io/api/v1/contacts/search";

function cleanList(value, limit = 10) {
  return Array.isArray(value) ? value.map(cleanString).filter(Boolean).slice(0, limit) : [];
}

function positiveInt(value, fallback, max) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(n, max);
}

function jsonHeaders(apiKey) {
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-Api-Key": cleanString(apiKey),
  };
}

async function jsonPost({ url, apiKey, body, fetchImpl = fetch }) {
  const response = await fetchImpl(url, {
    method: "POST",
    headers: jsonHeaders(apiKey),
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = cleanString(payload?.error || payload?.message) || `Apollo request failed ${response.status}`;
    throw new Error(message);
  }
  return payload;
}

function apolloPlanGated(error) {
  return error instanceof Error && /not accessible|free plan|pricing plan|upgrade/i.test(error.message);
}

export function buildApolloPeopleSearchRequest(input = {}) {
  const source = isRecord(input) ? input : {};
  const body = {
    page: positiveInt(source.page, 1, 500),
    per_page: positiveInt(source.perPage ?? source.per_page, 25, 100),
  };
  const titles = cleanList(source.titles ?? source.person_titles, 20);
  const locations = cleanList(source.locations ?? source.person_locations, 20);
  const organizationDomains = cleanList(source.organizationDomains ?? source.q_organization_domains_list, 100);
  const seniorities = cleanList(source.seniorities ?? source.person_seniorities, 10);
  const keywords = cleanString(source.keywords ?? source.q_keywords);
  if (titles.length) body.person_titles = titles;
  if (locations.length) body.person_locations = locations;
  if (organizationDomains.length) body.q_organization_domains_list = organizationDomains;
  if (seniorities.length) body.person_seniorities = seniorities;
  if (keywords) body.q_keywords = keywords;
  return { url: APOLLO_PEOPLE_SEARCH_URL, body };
}

export function buildApolloContactsSearchRequest(input = {}) {
  const source = isRecord(input) ? input : {};
  const titles = cleanList(source.titles ?? source.person_titles, 20);
  const keywords = cleanString(source.keywords ?? source.q_keywords);
  return {
    url: APOLLO_CONTACTS_SEARCH_URL,
    body: {
      q_keywords: [...titles, keywords].filter(Boolean).join(" "),
      page: positiveInt(source.page, 1, 500),
      per_page: positiveInt(source.perPage ?? source.per_page, 25, 100),
    },
  };
}

export function buildApolloPeopleEnrichmentRequest(input = {}) {
  const source = isRecord(input) ? input : {};
  const person = isRecord(source.person) ? source.person : source;
  const body = {};
  const id = cleanString(person.provider_id || person.id);
  const name = cleanString(person.name);
  const linkedinUrl = cleanString(person.linkedin_url);
  const organizationName = cleanString(person.current_company || person.organization_name);
  const domain = cleanString(person.organization_domain || person.domain);
  const email = cleanString(person.email);
  if (id) body.id = id;
  if (name) body.name = name;
  if (email) body.email = email;
  if (linkedinUrl) body.linkedin_url = linkedinUrl;
  if (organizationName) body.organization_name = organizationName;
  if (domain) body.domain = domain;
  if (source.revealPersonalEmails === true) body.reveal_personal_emails = true;
  if (source.revealPhoneNumber === true) body.reveal_phone_number = true;
  if (source.runWaterfallEmail === true) body.run_waterfall_email = true;
  if (source.runWaterfallPhone === true) body.run_waterfall_phone = true;
  if (cleanString(source.webhookUrl)) body.webhook_url = cleanString(source.webhookUrl);
  return { url: APOLLO_PEOPLE_MATCH_URL, body };
}

export function buildPeopleProviderConfig(env = process.env) {
  return {
    providers: [
      { provider: "apollo", enabled: envHasValue(env, "APOLLO_API_KEY"), reason: envHasValue(env, "APOLLO_API_KEY") ? "" : "missing APOLLO_API_KEY" },
      { provider: "pdl", enabled: envHasValue(env, "PDL_API_KEY"), reason: envHasValue(env, "PDL_API_KEY") ? "" : "missing PDL_API_KEY" },
    ],
  };
}

export function normalizeApolloPerson(value = {}) {
  const row = isRecord(value) ? value : {};
  const organization = isRecord(row.organization) ? row.organization : {};
  const linkedinUrl = cleanString(row.linkedin_url);
  return {
    provider: "apollo",
    provider_id: cleanString(row.id),
    name: cleanString(row.name),
    current_role: cleanString(row.title || row.headline),
    current_company: cleanString(organization.name || row.organization_name),
    location: cleanString(row.location || row.city),
    linkedin_url: linkedinUrl,
    contact_profile: buildContactProfile({
      emails: emailRows(row.email || row.emails, "apollo"),
      phones: phoneRows(row.phone_numbers || row.phones || row.phone, "apollo"),
      linkedinUrl,
    }),
  };
}

export async function searchApolloPeople({ apiKey = process.env.APOLLO_API_KEY, input = {}, fetchImpl = fetch } = {}) {
  const cleanKey = cleanString(apiKey);
  if (!cleanKey) return [];
  let payload;
  try {
    const request = buildApolloPeopleSearchRequest(input);
    payload = await jsonPost({ url: request.url, apiKey: cleanKey, body: request.body, fetchImpl });
  } catch (error) {
    if (!apolloPlanGated(error)) throw error;
    const request = buildApolloContactsSearchRequest(input);
    payload = await jsonPost({ url: request.url, apiKey: cleanKey, body: request.body, fetchImpl });
  }
  const people = Array.isArray(payload.people) ? payload.people : Array.isArray(payload.contacts) ? payload.contacts : [];
  return people.map(normalizeApolloPerson).filter((person) => person.name || person.provider_id || person.linkedin_url);
}

export async function enrichApolloPerson({
  apiKey = process.env.APOLLO_API_KEY,
  person = {},
  fetchImpl = fetch,
  revealPersonalEmails = false,
  revealPhoneNumber = false,
  runWaterfallEmail = false,
  runWaterfallPhone = false,
  webhookUrl = "",
} = {}) {
  const cleanKey = cleanString(apiKey);
  if (!cleanKey) return normalizeApolloPerson(person);
  const request = buildApolloPeopleEnrichmentRequest({
    person,
    revealPersonalEmails,
    revealPhoneNumber,
    runWaterfallEmail,
    runWaterfallPhone,
    webhookUrl,
  });
  const payload = await jsonPost({ url: request.url, apiKey: cleanKey, body: request.body, fetchImpl });
  return normalizeApolloPerson(payload.person || payload.contact || payload);
}

export function normalizePdlPerson(value = {}) {
  const row = isRecord(value) ? value : {};
  const linkedinUrl = cleanString(row.linkedin_url || row.linkedin);
  return {
    provider: "pdl",
    provider_id: cleanString(row.id),
    name: cleanString(row.full_name || row.name),
    current_role: cleanString(row.job_title || row.title),
    current_company: cleanString(row.job_company_name || row.company),
    location: cleanString(row.location_name || row.location),
    linkedin_url: linkedinUrl,
    contact_profile: buildContactProfile({
      emails: emailRows(row.work_email || row.emails || row.email, "pdl"),
      phones: phoneRows(row.phone_numbers || row.mobile_phone || row.phone, "pdl"),
      linkedinUrl,
    }),
  };
}

export function providerRowsToSourceLeads(rows = []) {
  return (Array.isArray(rows) ? rows : []).map((value) => {
    const row = isRecord(value) ? value : {};
    return {
      source_type: "people_api",
      provider: cleanString(row.provider),
      source_url: cleanString(row.linkedin_url),
      captured_at: "",
      confidence: "medium",
      extracted_fields: {
        provider_id: cleanString(row.provider_id),
        name: cleanString(row.name),
        current_company: cleanString(row.current_company),
      },
    };
  });
}

export function apolloRowsToShortlistCandidates(rows = []) {
  return (Array.isArray(rows) ? rows : []).map((value) => {
    const row = isRecord(value) ? value : {};
    const name = cleanString(row.name);
    const role = cleanString(row.current_role);
    const company = cleanString(row.current_company);
    const linkedinUrl = cleanString(row.linkedin_url);
    return {
      ...row,
      provider: "apollo",
      name,
      headline: [role, company].filter(Boolean).join(" · "),
      current_role: role,
      current_company: company,
      match_score: 55,
      strongest_signals: [role, company].filter(Boolean).slice(0, 2),
      uncertainties: ["Apollo profile has not been independently evidence-verified yet."],
      outreach_angle: role ? `Reference their ${role} background after evidence review.` : "Review Apollo profile before outreach.",
      links: linkedinUrl ? { linkedin: linkedinUrl } : {},
      source_nodes: [{
        source_type: "people_api",
        provider: "apollo",
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
        unverified_claims: ["Apollo profile has not been independently verified by public evidence."],
        contradicted_claims: [],
      },
      claims: [],
    };
  });
}
