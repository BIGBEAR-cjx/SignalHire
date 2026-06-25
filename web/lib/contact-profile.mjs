const CONFIDENCE = new Set(["high", "medium", "low"]);
const SENDABLE_CONFIDENCE = new Set(["high", "medium"]);
const DELIVERABILITY = new Set(["valid", "risky", "unknown", "bounced"]);

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanConfidence(value) {
  const clean = cleanString(value).toLowerCase();
  return CONFIDENCE.has(clean) ? clean : "";
}

function cleanDeliverability(value) {
  const clean = cleanString(value).toLowerCase();
  return DELIVERABILITY.has(clean) ? clean : "unknown";
}

function validEmail(value) {
  const clean = cleanString(value);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean) ? clean : "";
}

function emailRow(value, fallback = {}) {
  const row = isRecord(value) ? value : {};
  const email = validEmail(row.value ?? row.email ?? row.address ?? value);
  const source = cleanString(row.source ?? fallback.source);
  const confidence = cleanConfidence(row.confidence ?? fallback.confidence);
  if (!email || !source || !confidence) return null;
  return {
    value: email,
    type: cleanString(row.type) || "unknown",
    source,
    confidence,
    last_verified_at: cleanString(row.last_verified_at),
    deliverability_status: cleanDeliverability(row.deliverability_status),
  };
}

function phoneRow(value, fallback = {}) {
  const row = isRecord(value) ? value : {};
  const phone = cleanString(row.value ?? row.phone ?? row.number ?? row.raw_number ?? value);
  const source = cleanString(row.source ?? fallback.source);
  const confidence = cleanConfidence(row.confidence ?? fallback.confidence);
  if (!phone || !source || !confidence) return null;
  return {
    value: phone,
    type: cleanString(row.type) || "unknown",
    source,
    confidence,
  };
}

function providerName(source) {
  const provider = cleanString(source.provider);
  return provider || "";
}

function mediumProviderFallback(source) {
  const provider = providerName(source);
  return provider ? { source: provider, confidence: "medium" } : {};
}

function internalResumeContact(source) {
  const snapshot = isRecord(source.candidate_snapshot) ? source.candidate_snapshot : {};
  const resume = isRecord(snapshot.internal_resume)
    ? snapshot.internal_resume
    : isRecord(source.internal_resume)
      ? source.internal_resume
      : {};
  const contact = isRecord(resume.contact) ? resume.contact : resume;
  return isRecord(contact) ? contact : {};
}

function dedupeByValue(rows) {
  const seen = new Set();
  const out = [];
  for (const row of rows) {
    if (!row || seen.has(row.value.toLowerCase())) continue;
    seen.add(row.value.toLowerCase());
    out.push(row);
  }
  return out;
}

export function buildContactProfile(candidate = {}) {
  const source = isRecord(candidate) ? candidate : {};
  const explicit = isRecord(source.contact_profile) ? source.contact_profile : {};
  const emails = [];
  const phones = [];

  if (Array.isArray(explicit.emails)) emails.push(...explicit.emails.map(emailRow));
  if (Array.isArray(explicit.phones)) phones.push(...explicit.phones.map(phoneRow));

  const topLevelEmail = emailRow(source.email || source.work_email, {
    ...mediumProviderFallback(source),
    source: source.email_source ?? mediumProviderFallback(source).source,
    confidence: source.email_confidence ?? mediumProviderFallback(source).confidence,
  });
  if (topLevelEmail) emails.push(topLevelEmail);

  const topLevelPhone = phoneRow(source.phone || source.phone_number, {
    source: source.phone_source,
    confidence: source.phone_confidence,
  });
  if (topLevelPhone) phones.push(topLevelPhone);

  if (Array.isArray(source.emails)) emails.push(...source.emails.map((email) => emailRow(email, mediumProviderFallback(source))));
  if (Array.isArray(source.phone_numbers)) phones.push(...source.phone_numbers.map((phone) => phoneRow(phone, mediumProviderFallback(source))));

  const resumeContact = internalResumeContact(source);
  const resumeEmail = emailRow(resumeContact.email || resumeContact.work_email, { source: "internal_resume", confidence: "medium" });
  if (resumeEmail) emails.push(resumeEmail);
  const resumePhone = phoneRow(resumeContact.phone || resumeContact.phone_number, { source: "internal_resume", confidence: "medium" });
  if (resumePhone) phones.push(resumePhone);

  const emailRows = dedupeByValue(emails);
  const phoneRows = dedupeByValue(phones);
  const linkedinUrl = cleanString(explicit.linkedin_url ?? source.linkedin_url ?? source.links?.linkedin);
  const contactabilityScore = Math.min(100, (
    emailRows.some((email) => email.confidence === "high") ? 70 : emailRows.length ? 55 : 0
  ) + (
    phoneRows.length ? 20 : 0
  ) + (
    linkedinUrl ? 15 : 0
  ));

  return {
    emails: emailRows,
    phones: phoneRows,
    linkedin_url: linkedinUrl,
    contactability_score: contactabilityScore,
  };
}

export function primarySendableEmail(profile = {}) {
  const source = isRecord(profile) ? profile : {};
  const emails = Array.isArray(source.emails) ? source.emails : [];
  return emails.find((email) => {
    const row = emailRow(email);
    return row && SENDABLE_CONFIDENCE.has(row.confidence) && row.deliverability_status !== "bounced";
  }) ?? null;
}
