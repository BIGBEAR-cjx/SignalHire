function cleanString(value) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function firstArrayItem(value) {
  return Array.isArray(value) && value.length > 0 ? asObject(value[0]) : {};
}

function contactProvenanceSummary(contactProfile) {
  const profile = asObject(contactProfile);
  const email = firstArrayItem(profile.emails);
  const source = cleanString(email.source);
  const confidence = cleanString(email.confidence);
  const deliverability = cleanString(email.deliverability_status || email.deliverability);

  if (!source && !confidence && !deliverability) return "No sourced contact yet";
  return [
    source || "sourced contact",
    confidence ? `${confidence} confidence` : "",
    deliverability ? `${deliverability} deliverability` : "",
  ].filter(Boolean).join(" / ");
}

function threadLines(thread) {
  const source = asObject(thread);
  return [
    `Candidate: ${cleanString(source.candidate_name || source.candidateName || source.name) || "Unknown candidate"}`,
    `Status: ${cleanString(source.status) || "draft"}`,
    `Last activity: ${cleanString(source.last_activity || source.lastActivity) || "not recorded"}`,
    `Next follow-up: ${cleanString(source.next_follow_up_at || source.nextFollowUpAt) || "not scheduled"}`,
    `Evidence angle: ${cleanString(source.evidence_angle || source.evidenceAngle || source.contact_angle || source.contactAngle) || "not specified"}`,
    `Contact provenance: ${contactProvenanceSummary(source.contact_profile || source.contactProfile)}`,
    `Reply summary: ${cleanString(source.reply_summary || source.replySummary) || "none yet"}`,
  ];
}

export function buildAgencyOutreachActivityDigest({ roleName = "", threads = [] } = {}) {
  const lines = [`Outreach activity digest`, `Role: ${cleanString(roleName) || "Role"}`];
  const rows = Array.isArray(threads) ? threads : [];

  if (rows.length === 0) {
    lines.push("", "No outreach activity yet.");
    return lines.join("\n");
  }

  rows.forEach((thread, index) => {
    lines.push("", `${index + 1}. ${threadLines(thread).join("\n")}`);
  });

  return lines.join("\n");
}
