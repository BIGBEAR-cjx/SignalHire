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

export function buildPeopleProviderConfig(env = process.env) {
  return {
    providers: [
      { provider: "pdl", enabled: envHasValue(env, "PDL_API_KEY"), reason: envHasValue(env, "PDL_API_KEY") ? "" : "missing PDL_API_KEY" },
    ],
  };
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
