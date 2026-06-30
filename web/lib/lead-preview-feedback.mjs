function cleanString(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function buildLeadPreviewConstraint({ lead = {}, reason = "" } = {}) {
  const cleanReason = cleanString(reason) || "Not relevant to this role";
  const sourceType = cleanString(lead.source_type || "lead");
  const sourceUrl = cleanString(lead.source_url);

  return {
    lead_id: cleanString(lead.id),
    feedback: "not_relevant",
    reason: cleanReason,
    source_type: sourceType,
    source_url: sourceUrl,
    candidate_name: cleanString(lead.candidate_name),
    next_search_instruction: `Avoid similar ${sourceType} leads: ${cleanReason}. Source: ${sourceUrl}`.trim(),
  };
}
