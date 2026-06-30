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

function analyticsLines(sequenceAnalytics) {
  const view = asObject(sequenceAnalytics);
  const summary = asObject(view.summary);
  if (Object.keys(summary).length === 0) return [];
  const steps = Array.isArray(view.step_performance) ? view.step_performance : [];
  const lines = [
    "Sequence analytics",
    `Drafted: ${Number(summary.drafted ?? 0)}`,
    `Approved: ${Number(summary.approved ?? 0)}`,
    `Sent: ${Number(summary.sent ?? 0)}`,
    `Replied: ${Number(summary.replied ?? 0)}`,
    `Interested: ${Number(summary.interested ?? 0)}`,
    `Bounced: ${Number(summary.bounced ?? 0)}`,
    `Stopped: ${Number(summary.stopped ?? 0)}`,
    `Due follow-up: ${Number(summary.due_follow_up ?? 0)}`,
    `Open tracking: ${summary.open_tracking_available ? "available" : "unavailable"}`,
  ];
  for (const step of steps) {
    const item = asObject(step);
    if (!item.step) continue;
    lines.push(`Step ${Number(item.step)}: sent ${Number(item.sent ?? 0)}, replied ${Number(item.replied ?? 0)}, interested ${Number(item.interested ?? 0)}, bounced ${Number(item.bounced ?? 0)}`);
  }
  const actions = Array.isArray(view.next_actions) ? view.next_actions.map(cleanString).filter(Boolean).slice(0, 3) : [];
  if (actions.length > 0) lines.push(`Next actions: ${actions.join("; ")}`);
  return lines;
}

export function buildAgencyOutreachActivityDigest({ roleName = "", threads = [], sequenceAnalytics = null } = {}) {
  const lines = [`Outreach activity digest`, `Role: ${cleanString(roleName) || "Role"}`];
  const rows = Array.isArray(threads) ? threads : [];
  const analytics = analyticsLines(sequenceAnalytics);
  if (analytics.length > 0) lines.push("", ...analytics);

  if (rows.length === 0) {
    lines.push("", "No outreach activity yet.");
    return lines.join("\n");
  }

  rows.forEach((thread, index) => {
    lines.push("", `${index + 1}. ${threadLines(thread).join("\n")}`);
  });

  return lines.join("\n");
}
