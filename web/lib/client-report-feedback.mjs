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

export function normalizeClientFeedback(input = {}, context = {}) {
  const source = isRecord(input) ? input : {};
  const actor = cleanString(context?.actorEmail, 120);
  const reportId = cleanString(context?.reportId, 160);
  const sentiment = cleanString(source.sentiment, 80);
  const note = cleanString(source.note, 500);

  if (!actor || !reportId || !SENTIMENTS.has(sentiment) || !note) return null;
  return {
    sentiment,
    note,
    actor,
    report_id: reportId,
  };
}

export function buildClientReportFeedbackEvent({ feedback, reportHref = "", now = new Date() } = {}) {
  const normalized = isRecord(feedback) && cleanString(feedback.actor, 120)
    ? {
      sentiment: cleanString(feedback.sentiment, 80),
      reviewer: cleanString(feedback.actor, 120),
      note: cleanString(feedback.note, 500),
    }
    : normalizeClientReportFeedback(feedback);
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

function errorResponse(locale, key, status, dependencies) {
  return Response.json({ error: dependencies.t(locale, key) }, { status });
}

export async function handleClientPortalFeedbackPost({ req, projectId, dependencies = {} } = {}) {
  const {
    getUser,
    findAuthorizedProject,
    findProjectReport,
    clientPortalReportHref,
    recordProjectRoleAgentEvent,
    normalizeLocale,
    t,
    expectedAction = "client_delivery_feedback",
    now = () => new Date(),
  } = dependencies;
  if (typeof getUser !== "function" || typeof findAuthorizedProject !== "function" || typeof findProjectReport !== "function"
    || typeof clientPortalReportHref !== "function" || typeof recordProjectRoleAgentEvent !== "function"
    || typeof normalizeLocale !== "function" || typeof t !== "function") {
    throw new Error("client_portal_feedback_dependencies_missing");
  }

  let body = {};
  try {
    const parsed = await req.json();
    if (isRecord(parsed)) body = parsed;
  } catch {}
  const locale = normalizeLocale(body.locale);
  const user = await getUser();
  if (!user) return errorResponse(locale, "api.error.unauthorized", 401, { t });

  const id = cleanString(projectId, 160);
  const project = id ? await findAuthorizedProject(user, id) : null;
  if (!project) return errorResponse(locale, "api.error.jobUnavailable", 404, { t });

  const reportId = cleanString(body.report_id, 160);
  if (!reportId) return errorResponse(locale, "api.error.invalidFeedback", 400, { t });
  const report = await findProjectReport(project, reportId);
  if (!report || cleanString(report.id, 160) !== reportId) {
    return errorResponse(locale, "api.error.jobUnavailable", 404, { t });
  }

  const feedback = normalizeClientFeedback({
    sentiment: body.sentiment,
    note: body.note,
  }, {
    actorEmail: user.email,
    reportId,
  });
  if (!feedback) return errorResponse(locale, "api.error.invalidFeedback", 400, { t });

  const event = buildClientReportFeedbackEvent({
    feedback,
    reportHref: clientPortalReportHref(report, locale),
    now: now(),
  });
  if (!event || event.action_type !== expectedAction) {
    return errorResponse(locale, "api.error.invalidFeedback", 400, { t });
  }

  const metrics = await recordProjectRoleAgentEvent({
    userId: project.user_id,
    id: project.id,
    event,
  });
  if (!metrics) return errorResponse(locale, "api.error.projectUpdateUnavailable", 404, { t });

  return Response.json({ saved: true, feedback, event, metrics });
}
