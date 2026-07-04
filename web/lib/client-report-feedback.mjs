const SENTIMENTS = new Set([
  "ready_to_interview",
  "needs_more_candidates",
  "needs_stronger_evidence",
  "not_a_fit",
]);

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function cleanString(value, maxLength = 500) {
  const clean = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  return clean.slice(0, maxLength).trim();
}

function validIso(value) {
  const date = value instanceof Date ? value : new Date(value ?? Date.now());
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
}

export function normalizeClientReportFeedback(input = {}) {
  const source = isRecord(input) ? input : {};
  const sentiment = cleanString(source.sentiment, 80);
  const note = cleanString(source.note, 500);
  const reviewer = cleanString(source.reviewer, 80);

  if (!SENTIMENTS.has(sentiment) || !note) return null;
  return {
    sentiment,
    reviewer: reviewer || "Hiring manager",
    note,
  };
}

export function buildClientReportFeedbackEvent({ feedback, reportHref = "", now = new Date() } = {}) {
  const normalized = normalizeClientReportFeedback(feedback);
  if (!normalized) return null;
  const href = cleanString(reportHref, 240);
  const detail = [
    `Client feedback: ${normalized.sentiment}`,
    `by ${normalized.reviewer}`,
    `- ${normalized.note}`,
    href ? `(${href})` : "",
  ].filter(Boolean).join(" ").slice(0, 500);

  return {
    event_type: "manager_feedback",
    action_type: "client_delivery_feedback",
    action_status: "succeeded",
    detail,
    at: validIso(now),
  };
}
