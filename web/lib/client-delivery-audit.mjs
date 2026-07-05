const REPORT_ACTION_TYPES = new Set(["shareable_client_delivery_loop", "client_portal_project_view"]);
const FEEDBACK_ACTION_TYPES = new Set(["client_delivery_feedback"]);

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function cleanString(value) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function validIso(value) {
  const clean = cleanString(value);
  const date = clean ? new Date(clean) : new Date();
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
}

function reportHrefFromDetail(detail) {
  const clean = cleanString(detail);
  const match = clean.match(/(https?:\/\/\S+|\/r\/\S+|\/client\/projects\/\S+)/);
  return match ? match[1].replace(/[).,]+$/, "") : "";
}

function parseFeedbackDetail(detail) {
  const clean = cleanString(detail);
  const withoutHref = clean.replace(/\s*\((https?:\/\/\S+|\/r\/\S+)\)\s*$/, "").trim();
  const match = withoutHref.match(/^Client feedback:\s*([a-z_]+)(?:\s+by\s+(.+?))?\s+-\s+(.+)$/i);
  if (!match) return { actor: "Client", sentiment: "", note: withoutHref };
  return {
    sentiment: cleanString(match[1]),
    actor: cleanString(match[2]) || "Client",
    note: cleanString(match[3]),
  };
}

export function buildClientDeliveryAuditEvent(input = {}) {
  const event = isRecord(input.event) ? input.event : {};
  const userId = cleanString(input.userId);
  const projectId = cleanString(input.projectId);
  const eventType = cleanString(event.event_type);
  const actionType = cleanString(event.action_type);
  const detail = cleanString(event.detail);
  const reportHref = cleanString(event.report_href) || reportHrefFromDetail(detail);
  if (!userId || !projectId) return null;

  if (eventType === "client_report_view" && REPORT_ACTION_TYPES.has(actionType)) {
    return {
      user_id: userId,
      project_id: projectId,
      event_type: "report_view",
      action_type: actionType,
      report_href: reportHref || detail,
      actor: cleanString(event.actor) || "Client",
      sentiment: "",
      note: cleanString(event.note),
      detail,
      event_at: validIso(event.at),
    };
  }

  if (eventType === "manager_feedback" && FEEDBACK_ACTION_TYPES.has(actionType)) {
    const feedback = parseFeedbackDetail(detail);
    return {
      user_id: userId,
      project_id: projectId,
      event_type: "feedback",
      action_type: actionType,
      report_href: reportHrefFromDetail(detail),
      actor: feedback.actor,
      sentiment: feedback.sentiment,
      note: feedback.note,
      detail,
      event_at: validIso(event.at),
    };
  }

  return null;
}
