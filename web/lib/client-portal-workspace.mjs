import { buildRoleOutreachSettings } from "./outreach-settings.mjs";
import { verifyClientDeliveryCustomerAccountAccess } from "./report-share-access.mjs";

const INTERNAL_TEXT_PATTERN = /\b(debug|internal|role_agent|execution_log)\b/i;
const TABS = ["overview", "interview-ready", "weekly-archive", "reports", "feedback"];

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function cleanString(value, maxLength = 500) {
  const clean = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  return clean.slice(0, maxLength).trim();
}

function safeText(value, maxLength = 500) {
  const clean = cleanString(value, maxLength);
  return INTERNAL_TEXT_PATTERN.test(clean) ? "" : clean;
}

function safeTextArray(value) {
  return Array.isArray(value) ? value.map((item) => safeText(item, 240)).filter(Boolean).slice(0, 12) : [];
}

function nonNegativeInteger(value) {
  return Math.max(0, Math.floor(Number(value) || 0));
}

function validIso(value) {
  const clean = cleanString(value);
  const date = clean ? new Date(clean) : null;
  return date && Number.isFinite(date.getTime()) ? date.toISOString() : "";
}

function normalizeAccessPolicy(project) {
  return buildRoleOutreachSettings(project?.outreach_settings || project?.outreachSettings || {}).client_delivery_access;
}

function normalizeAccessGrant(access, viewer) {
  const policy = isRecord(access?.policy) ? access.policy : {};
  const viewerEmail = cleanString(viewer?.email).toLowerCase();
  const domain = viewerEmail.includes("@") ? viewerEmail.split("@").pop() : "";
  const emails = Array.isArray(policy.allowed_emails) ? policy.allowed_emails.map((item) => cleanString(item).toLowerCase()) : [];
  const domains = Array.isArray(policy.allowed_domains) ? policy.allowed_domains.map((item) => cleanString(item).toLowerCase()) : [];
  const method = viewerEmail && emails.includes(viewerEmail)
    ? "email"
    : domain && domains.includes(domain)
      ? "domain"
      : cleanString(access?.reason) || "customer_account";
  return {
    viewer_email: viewerEmail,
    reason: cleanString(access?.reason),
    method,
    matched: method === "domain" ? domain : method === "email" ? viewerEmail : "",
  };
}

function normalizeProject(project, accessReason = "", accessGrant = null) {
  return {
    id: cleanString(project?.id),
    name: safeText(project?.name, 120) || "Untitled project",
    brief: safeText(project?.brief, 500),
    status: cleanString(project?.status) || "open",
    updated_at: validIso(project?.updated_at || project?.created_at),
    candidates_total: nonNegativeInteger(project?.candidates_total),
    access_reason: accessReason,
    access: accessGrant,
  };
}

function normalizeMetrics(value = {}) {
  const source = isRecord(value) ? value : {};
  return {
    candidates: nonNegativeInteger(source.candidates ?? source.candidate_count ?? source.new_candidates),
    contacted: nonNegativeInteger(source.contacted),
    replied: nonNegativeInteger(source.replied),
    interested: nonNegativeInteger(source.interested),
    interview_ready: nonNegativeInteger(source.interview_ready),
    confirmed: nonNegativeInteger(source.confirmed),
  };
}

function detailFor(projectId, projectDetails) {
  if (projectDetails instanceof Map) return projectDetails.get(projectId) || {};
  return isRecord(projectDetails) ? projectDetails[projectId] || {} : {};
}

function latestDate(values) {
  return values.map(validIso).filter(Boolean).sort((a, b) => String(b).localeCompare(String(a)))[0] || "";
}

function workspacePagination(value, pageCount) {
  const source = isRecord(value) ? value : {};
  const offset = nonNegativeInteger(source.offset);
  const total = Math.max(pageCount, nonNegativeInteger(source.total));
  const hasMore = source.has_more === true && offset + pageCount < total;
  const nextOffset = nonNegativeInteger(source.next_offset);
  return {
    offset,
    total,
    has_more: hasMore,
    next_offset: hasMore && nextOffset > offset && nextOffset < total ? nextOffset : null,
  };
}

function normalizeWeeklyArchive(row) {
  if (!isRecord(row)) return null;
  const archiveId = cleanString(row.archive_id);
  const weekStart = cleanString(row.week_start);
  const weekEnd = cleanString(row.week_end);
  if (!archiveId || !weekStart || !weekEnd) return null;
  return {
    archive_id: archiveId,
    week_start: weekStart,
    week_end: weekEnd,
    label: safeText(row.label, 160),
    latest_report_id: cleanString(row.latest_report_id),
    latest_report_at: validIso(row.latest_report_at),
    metrics: normalizeMetrics(row.metrics),
    risks: safeTextArray(row.risks),
    next_actions: safeTextArray(row.next_actions),
  };
}

function normalizeWeeklyArchives(rows) {
  return (Array.isArray(rows) ? rows : [])
    .map(normalizeWeeklyArchive)
    .filter(Boolean)
    .sort((a, b) => String(b.week_start).localeCompare(String(a.week_start)))
    .slice(0, 20);
}

function normalizeReport(row) {
  if (!isRecord(row)) return null;
  const id = cleanString(row.id);
  if (!id) return null;
  return {
    id,
    label: safeText(row.label, 120) || "Client delivery report",
    summary: safeText(row.summary, 240),
    status: cleanString(row.status),
    updated_at: validIso(row.updated_at),
    href: `/r/${encodeURIComponent(id)}`,
  };
}

function normalizeReports(rows) {
  return (Array.isArray(rows) ? rows : [])
    .map(normalizeReport)
    .filter(Boolean)
    .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))
    .slice(0, 20);
}

function normalizeMessageHistory(value) {
  const summary = isRecord(value?.summary) ? value.summary : {};
  return {
    summary: {
      inbound: nonNegativeInteger(summary.inbound),
      outbound: nonNegativeInteger(summary.outbound),
      system: nonNegativeInteger(summary.system),
      total: nonNegativeInteger(summary.total),
    },
    messages: Array.isArray(value?.messages)
      ? value.messages.filter(isRecord).map((message) => ({
        direction: cleanString(message.direction || message.type),
        at: validIso(message.at || message.date),
        text: safeText(message.text || message.snippet || message.body, 240),
      })).filter((message) => message.text).slice(0, 6)
      : [],
  };
}

function normalizeCandidate(item) {
  if (!isRecord(item)) return null;
  const name = safeText(item.name || item.candidate_name || item.canonical_name, 120);
  if (!name) return null;
  return {
    id: cleanString(item.id || item.candidate_id || item.gmail_thread_id || name),
    name,
    headline: safeText(item.headline || item.title || item.detail || item.current_title, 180),
    evidence_summary: safeText(item.evidence_summary || item.evidence || item.detail || item.classification_reason, 300),
    risks: safeTextArray(item.risks),
    scheduling_state: safeText(item.scheduling_state || item.status || item.calendar_status, 120),
    next_action: safeText(item.next_action || item.cta || item.recovery_next_step, 180),
    updated_at: validIso(item.updated_at || item.last_message_at),
    message_history: normalizeMessageHistory(item.message_history),
  };
}

function normalizeCandidateQueue(rows) {
  return (Array.isArray(rows) ? rows : [])
    .map(normalizeCandidate)
    .filter(Boolean)
    .slice(0, 30);
}

function normalizeAuditEvent(row) {
  if (!isRecord(row)) return null;
  const eventType = cleanString(row.event_type);
  if (eventType !== "feedback") return null;
  const actor = safeText(row.actor, 120);
  const sentiment = safeText(row.sentiment, 120);
  const note = safeText(row.note || row.detail, 500);
  if (!actor && !sentiment && !note) return null;
  return {
    event_type: eventType,
    actor,
    sentiment,
    note,
    report_href: cleanString(row.report_href),
    event_at: validIso(row.event_at || row.at || row.created_at),
  };
}

function normalizeFeedbackHistory(rows) {
  return (Array.isArray(rows) ? rows : [])
    .map(normalizeAuditEvent)
    .filter(Boolean)
    .sort((a, b) => String(b.event_at).localeCompare(String(a.event_at)))
    .slice(0, 30);
}

function projectMetrics(project, detail) {
  const deliveryMetrics = normalizeMetrics(detail?.deliverySummary?.metrics || detail?.delivery_summary?.metrics || detail?.metrics);
  return {
    candidates: deliveryMetrics.candidates || nonNegativeInteger(project?.candidates_total),
    contacted: deliveryMetrics.contacted,
    replied: deliveryMetrics.replied,
    interested: deliveryMetrics.interested,
    interview_ready: deliveryMetrics.interview_ready,
    confirmed: deliveryMetrics.confirmed,
  };
}

function clientPortalAccess(project, viewer) {
  const policy = normalizeAccessPolicy(project);
  if (policy.mode !== "token_or_customer_account") return { allowed: false, reason: "customer_account_not_enabled", policy };
  const access = verifyClientDeliveryCustomerAccountAccess(
    {
      user_id: cleanString(project?.user_id),
      project_id: cleanString(project?.id),
      kind: "search",
    },
    viewer,
    policy,
  );
  if (access.reason === "owner_account") return { allowed: false, reason: "customer_account_not_enabled", policy };
  return { ...access, policy };
}

export function filterClientPortalAuthorizedProjects(projects = [], viewer = {}) {
  return (Array.isArray(projects) ? projects : [])
    .filter(isRecord)
    .map((project) => {
      const access = clientPortalAccess(project, viewer);
      return access.allowed ? normalizeProject(project, access.reason, normalizeAccessGrant(access, viewer)) : null;
    })
    .filter(Boolean);
}

export function verifyClientPortalProjectAccess(project, viewer = {}) {
  return clientPortalAccess(project, viewer);
}

export function buildClientPortalWorkspaceView({
  viewer = {},
  projects = [],
  projectDetails = {},
  pagination = {},
  now = new Date().toISOString(),
  locale = "zh",
} = {}) {
  const authorized = filterClientPortalAuthorizedProjects(projects, viewer);
  const cards = authorized.map((project) => {
    const detail = detailFor(project.id, projectDetails);
    const archives = normalizeWeeklyArchives(detail.weeklyArchives || detail.weekly_archives);
    const candidates = normalizeCandidateQueue(detail.candidateQueue || detail.interview_ready_queue);
    const metrics = projectMetrics(project, detail);
    const latestArchive = archives[0];
    const latestActivity = latestDate([
      project.updated_at,
      latestArchive?.latest_report_at,
      ...candidates.map((candidate) => candidate.updated_at),
    ]);
    return {
      ...project,
      metrics,
      latest_activity: latestActivity,
      risks: safeTextArray(detail.deliverySummary?.risks || detail.delivery_summary?.risks || latestArchive?.risks),
      next_actions: safeTextArray(detail.deliverySummary?.next_actions || detail.delivery_summary?.next_actions || latestArchive?.next_actions),
      interview_ready_queue: candidates.slice(0, 3),
      latest_weekly_archive: latestArchive || null,
    };
  }).sort((a, b) => String(b.latest_activity).localeCompare(String(a.latest_activity)));
  const latestActivity = latestDate(cards.map((item) => item.latest_activity).concat(now ? [] : []));
  const page = workspacePagination(pagination, cards.length);
  return {
    locale: locale === "en" ? "en" : "zh",
    viewer: { email: cleanString(viewer?.email) },
    summary: {
      authorized_projects: page.total,
      interview_ready: cards.reduce((sum, item) => sum + nonNegativeInteger(item.metrics.interview_ready), 0),
      this_week_replies: cards.reduce((sum, item) => sum + nonNegativeInteger(item.latest_weekly_archive?.metrics?.replied), 0),
      latest_activity: latestActivity,
    },
    latest_activity: latestActivity,
    pagination: page,
    recent_weekly_archives: cards.map((item) => item.latest_weekly_archive).filter(Boolean).slice(0, 8),
    interview_ready_queue: cards.flatMap((item) => item.interview_ready_queue.map((candidate) => ({
      ...candidate,
      project_id: item.id,
      project_name: item.name,
    }))).slice(0, 12),
    projects: cards,
  };
}

export function buildClientPortalProjectView({
  viewer = {},
  project = {},
  deliverySummary = {},
  weeklyArchives = [],
  reports = [],
  candidateQueue = [],
  auditEvents = [],
  locale = "zh",
} = {}) {
  const access = clientPortalAccess(project, viewer);
  const accessGrant = normalizeAccessGrant(access, viewer);
  const normalizedProject = normalizeProject(project, access.reason, accessGrant);
  const archives = normalizeWeeklyArchives(weeklyArchives);
  const normalizedReports = normalizeReports(reports);
  const interviewReadyQueue = normalizeCandidateQueue(candidateQueue);
  const metrics = projectMetrics(project, { deliverySummary });
  const feedbackHistory = normalizeFeedbackHistory(auditEvents);
  const latestActivity = latestDate([
    normalizedProject.updated_at,
    archives[0]?.latest_report_at,
    normalizedReports[0]?.updated_at,
    feedbackHistory[0]?.event_at,
  ]);
  return {
    locale: locale === "en" ? "en" : "zh",
    authorized: access.allowed,
    access_reason: access.reason,
    access: accessGrant,
    tabs: TABS,
    project: normalizedProject,
    summary: {
      ...metrics,
      interview_ready: Math.max(metrics.interview_ready, interviewReadyQueue.length),
      latest_activity: latestActivity,
    },
    overview: {
      risks: safeTextArray(deliverySummary?.risks || archives[0]?.risks),
      next_actions: safeTextArray(deliverySummary?.next_actions || archives[0]?.next_actions),
      latest_weekly_archive: archives[0] || null,
      latest_report: normalizedReports[0] || null,
    },
    interview_ready_queue: interviewReadyQueue,
    weekly_archives: archives,
    reports: normalizedReports,
    feedback_history: feedbackHistory,
  };
}
