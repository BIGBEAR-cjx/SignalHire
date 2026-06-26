import { buildContactProfile, primarySendableEmail } from "./contact-profile.mjs";

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function contactRows(value) {
  return Array.isArray(value) ? value : isRecord(value) || cleanString(value) ? [value] : [];
}

function resolutionMetadata(value) {
  const source = isRecord(value) ? value : {};
  const profile = isRecord(source.contact_profile) ? source.contact_profile : source;
  const resolution = isRecord(profile.resolution) ? profile.resolution : {};
  return {
    provider: cleanString(resolution.provider),
    status: cleanString(resolution.status),
    reason: cleanString(resolution.reason),
    searched_at: cleanString(resolution.searched_at),
    cost_units: Number(resolution.cost_units ?? 0) || 0,
    raw_reference: cleanString(resolution.raw_reference),
  };
}

function recentIso(value, now, windowMs) {
  const clean = cleanString(value);
  if (!clean) return false;
  const date = new Date(clean);
  if (!Number.isFinite(date.getTime())) return false;
  return now.getTime() - date.getTime() >= 0 && now.getTime() - date.getTime() <= windowMs;
}

function explicitEmailRows(source) {
  const row = isRecord(source) ? source : {};
  const profile = isRecord(row.contact_profile) ? row.contact_profile : {};
  const emails = [];
  if (Array.isArray(profile.emails)) emails.push(...profile.emails);
  if (Array.isArray(row.emails)) emails.push(...row.emails);
  if (row.email || row.work_email) {
    emails.push({
      value: row.email || row.work_email,
      type: row.email_type,
      source: row.email_source,
      confidence: row.email_confidence,
      last_verified_at: row.last_verified_at || row.email_last_verified_at,
      deliverability_status: row.deliverability_status || row.email_deliverability_status,
    });
  }
  return contactRows(emails);
}

function explicitPhoneRows(source) {
  const row = isRecord(source) ? source : {};
  const profile = isRecord(row.contact_profile) ? row.contact_profile : {};
  const phones = [];
  if (Array.isArray(profile.phones)) phones.push(...profile.phones);
  if (Array.isArray(row.phones)) phones.push(...row.phones);
  if (row.phone || row.phone_number) {
    phones.push({
      value: row.phone || row.phone_number,
      type: row.phone_type,
      source: row.phone_source,
      confidence: row.phone_confidence,
    });
  }
  return contactRows(phones);
}

function normalizeProviderProfile(providerResult) {
  const source = isRecord(providerResult) ? providerResult : {};
  const profile = buildContactProfile({
    contact_profile: {
      emails: explicitEmailRows(source),
      phones: explicitPhoneRows(source),
      linkedin_url: cleanString(source.contact_profile?.linkedin_url ?? source.linkedin_url),
    },
  });
  return profile;
}

function mergeByValue(existingRows = [], providerRows = []) {
  const seen = new Set();
  const out = [];
  for (const row of [...providerRows, ...existingRows]) {
    const value = cleanString(row?.value).toLowerCase();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(row);
  }
  return out;
}

function mergedContactProfile(existing, provider) {
  const profile = {
    emails: mergeByValue(existing.emails, provider.emails),
    phones: mergeByValue(existing.phones, provider.phones),
    linkedin_url: provider.linkedin_url || existing.linkedin_url,
    contactability_score: 0,
  };
  profile.contactability_score = Math.min(100, (
    profile.emails.some((email) => email.confidence === "high") ? 70 : profile.emails.length ? 55 : 0
  ) + (
    profile.phones.length ? 20 : 0
  ) + (
    profile.linkedin_url ? 15 : 0
  ));
  return profile;
}

function withResolution(profile, metadata) {
  return {
    ...profile,
    resolution: {
      provider: cleanString(metadata.provider),
      status: cleanString(metadata.status),
      reason: cleanString(metadata.reason),
      searched_at: cleanString(metadata.searched_at),
      cost_units: Number(metadata.cost_units ?? 0) || 0,
      raw_reference: cleanString(metadata.raw_reference),
    },
  };
}

function sendBlockReason(profile) {
  const emails = Array.isArray(profile.emails) ? profile.emails : [];
  if (emails.length === 0) return "no_email";
  if (emails.every((email) => email.deliverability_status === "bounced")) return "bounced_email";
  if (emails.every((email) => email.confidence === "low")) return "low_confidence_email";
  return "missing_sendable_email";
}

function sendEligibility(profile) {
  const email = primarySendableEmail(profile);
  if (!email) return { can_send: false, reason: sendBlockReason(profile), primary_email: null, warnings: [] };
  const warnings = email.deliverability_status && email.deliverability_status !== "valid"
    ? [`deliverability_${email.deliverability_status}`]
    : [];
  return { can_send: true, reason: "", primary_email: email, warnings };
}

function inputFields(candidate) {
  const source = isRecord(candidate) ? candidate : {};
  return [
    cleanString(source.name) ? "name" : "",
    cleanString(source.current_company || source.company) ? "current_company" : "",
    cleanString(source.company_domain || source.domain) ? "company_domain" : "",
    cleanString(source.linkedin_url || source.contact_profile?.linkedin_url) ? "linkedin_url" : "",
  ].filter(Boolean);
}

export function contactResolutionEligibility({
  candidate = {},
  forceRefresh = false,
  now = new Date(),
  recentWindowMs = 24 * 60 * 60 * 1000,
} = {}) {
  if (forceRefresh) return { eligible: true, status: "eligible", reason: "" };
  const profile = buildContactProfile(candidate);
  if (primarySendableEmail(profile)) {
    return { eligible: false, status: "skipped", reason: "already_sendable" };
  }
  const resolution = resolutionMetadata(candidate);
  if (
    resolution.status === "not_found" &&
    recentIso(resolution.searched_at, now, recentWindowMs)
  ) {
    return { eligible: false, status: "skipped", reason: "recent_not_found" };
  }
  return { eligible: true, status: "eligible", reason: "" };
}

export function buildSkippedContactResolutionResult({
  candidateId = "",
  candidate = {},
  provider = "",
  reason = "skipped",
  now = new Date(),
} = {}) {
  const providerName = cleanString(provider) || "contact_provider";
  const searchedAt = now.toISOString();
  const profile = withResolution(buildContactProfile(candidate), {
    provider: providerName,
    status: "skipped",
    reason,
    searched_at: searchedAt,
    cost_units: 0,
    raw_reference: "",
  });
  return {
    ok: false,
    candidate_id: cleanString(candidateId),
    provider: providerName,
    status: "skipped",
    reason: cleanString(reason) || "skipped",
    contact_profile: profile,
    send_eligibility: sendEligibility(profile),
    audit: {
      searched_at: searchedAt,
      cost_units: 0,
      input_fields: inputFields(candidate),
      raw_reference: "",
    },
  };
}

/**
 * @param {{
 *   candidateId?: string;
 *   candidate?: unknown;
 *   provider?: string;
 *   enabled?: boolean;
 *   reason?: string;
 *   providerResult?: unknown;
 *   error?: unknown;
 *   now?: Date;
 * }} input
 */
export function buildContactResolutionResult({
  candidateId = "",
  candidate = {},
  provider = "",
  enabled = false,
  reason = "",
  providerResult = null,
  error = null,
  now = new Date(),
} = {}) {
  const existingProfile = buildContactProfile(candidate);
  const providerName = cleanString(provider) || "contact_provider";
  const searchedAt = now.toISOString();
  const baseAudit = {
    searched_at: searchedAt,
    cost_units: 0,
    input_fields: inputFields(candidate),
    raw_reference: "",
  };

  if (!enabled) {
    const resolution = {
      provider: providerName,
      status: "disabled",
      reason: cleanString(reason) || "provider_not_connected",
      searched_at: searchedAt,
      cost_units: 0,
      raw_reference: "",
    };
    return {
      ok: false,
      candidate_id: cleanString(candidateId),
      provider: providerName,
      status: "disabled",
      reason: cleanString(reason) || "provider_not_connected",
      contact_profile: withResolution(existingProfile, resolution),
      send_eligibility: sendEligibility(existingProfile),
      audit: baseAudit,
    };
  }

  if (error) {
    const errorReason = error instanceof Error ? error.message : cleanString(error) || "provider_error";
    const resolution = {
      provider: providerName,
      status: "error",
      reason: errorReason,
      searched_at: searchedAt,
      cost_units: 0,
      raw_reference: "",
    };
    return {
      ok: false,
      candidate_id: cleanString(candidateId),
      provider: providerName,
      status: "error",
      reason: errorReason,
      contact_profile: withResolution(existingProfile, resolution),
      send_eligibility: sendEligibility(existingProfile),
      audit: baseAudit,
    };
  }

  const result = isRecord(providerResult) ? providerResult : {};
  const providerProfile = normalizeProviderProfile(result);
  const contactProfile = mergedContactProfile(existingProfile, providerProfile);
  const resolved = providerProfile.emails.length > 0 || providerProfile.phones.length > 0;

  return {
    ok: resolved,
    candidate_id: cleanString(candidateId),
    provider: providerName,
    status: resolved ? "resolved" : "not_found",
    reason: resolved ? "" : "no_contact_found",
    contact_profile: withResolution(contactProfile, {
      provider: providerName,
      status: resolved ? "resolved" : "not_found",
      reason: resolved ? "" : "no_contact_found",
      searched_at: searchedAt,
      cost_units: Number(result.cost_units ?? 0) || 0,
      raw_reference: cleanString(result.raw_reference || result.request_id || result.id),
    }),
    send_eligibility: sendEligibility(contactProfile),
    audit: {
      searched_at: searchedAt,
      cost_units: Number(result.cost_units ?? 0) || 0,
      input_fields: inputFields(candidate),
      raw_reference: cleanString(result.raw_reference || result.request_id || result.id),
    },
  };
}
