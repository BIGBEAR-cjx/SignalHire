const RANGE_DAYS = new Map([
  ["7d", 7],
  ["30d", 30],
  ["90d", 90],
]);
const EVENT_TYPES = new Set(["all", "report_view", "feedback"]);
const INTERNAL_TEXT_PATTERN = /\b(debug|internal|role_agent|execution_log)\b/i;
const CSV_HEADER = "project,event_type,actor,sentiment,note,report_href,event_at,archive_id,week_start,week_end,latest_report_id";

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function cleanString(value) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function validIso(value) {
  const clean = cleanString(value);
  const date = clean ? new Date(clean) : null;
  return date && Number.isFinite(date.getTime()) ? date.toISOString() : "";
}

function safeText(value) {
  const clean = cleanString(value);
  return INTERNAL_TEXT_PATTERN.test(clean) ? "" : clean;
}

function safeTextArray(value) {
  return Array.isArray(value)
    ? value.map(safeText).filter(Boolean).slice(0, 20)
    : [];
}

function nonNegativeInteger(value) {
  return Math.max(0, Math.floor(Number(value) || 0));
}

function normalizeMetrics(value) {
  const source = isRecord(value) ? value : {};
  return {
    new_candidates: nonNegativeInteger(source.new_candidates),
    contacted: nonNegativeInteger(source.contacted),
    replied: nonNegativeInteger(source.replied),
    interview_ready: nonNegativeInteger(source.interview_ready),
    confirmed: nonNegativeInteger(source.confirmed),
  };
}

function normalizeFilters(filters = {}) {
  const source = isRecord(filters) ? filters : {};
  const range = RANGE_DAYS.has(cleanString(source.range)) || cleanString(source.range) === "all"
    ? cleanString(source.range)
    : "30d";
  const type = EVENT_TYPES.has(cleanString(source.type)) ? cleanString(source.type) : "all";
  return {
    project: cleanString(source.project) || "all",
    range,
    type,
  };
}

function rangeStartIso(range, now) {
  if (range === "all") return "";
  const days = RANGE_DAYS.get(range);
  if (!days) return "";
  const basis = new Date(validIso(now) || new Date().toISOString());
  basis.setUTCDate(basis.getUTCDate() - days);
  return basis.toISOString();
}

function projectMap(projects) {
  return new Map((Array.isArray(projects) ? projects : [])
    .filter(isRecord)
    .map((project) => [cleanString(project.id), cleanString(project.name) || "Untitled project"])
    .filter(([id]) => id));
}

function normalizeProjects(projects) {
  return (Array.isArray(projects) ? projects : [])
    .filter(isRecord)
    .map((project) => ({
      id: cleanString(project.id),
      name: cleanString(project.name) || "Untitled project",
    }))
    .filter((project) => project.id);
}

function normalizeEvent(event, projectsById) {
  const projectId = cleanString(event.project_id);
  const eventType = cleanString(event.event_type);
  const eventAt = validIso(event.event_at || event.at || event.created_at);
  if (!projectId || !["report_view", "feedback"].includes(eventType) || !eventAt) return null;
  return {
    project_id: projectId,
    project_name: projectsById.get(projectId) || "Untitled project",
    event_type: eventType,
    actor: safeText(event.actor) || (eventType === "report_view" ? "Client" : ""),
    sentiment: safeText(event.sentiment),
    note: safeText(event.note),
    report_href: cleanString(event.report_href),
    event_at: eventAt,
  };
}

function normalizeReports(value) {
  return Array.isArray(value)
    ? value.filter(isRecord).map((report) => ({
      id: cleanString(report.id),
      label: safeText(report.label),
      summary: safeText(report.summary),
      delivered_at: validIso(report.delivered_at),
      href: cleanString(report.href),
      snapshot_id: cleanString(report.snapshot_id),
      candidate_count: nonNegativeInteger(report.candidate_count),
    })).filter((report) => report.id || report.href).slice(0, 25)
    : [];
}

function normalizeWeeklyArchive(row, projectsById) {
  const projectId = cleanString(row.project_id);
  const archiveId = cleanString(row.archive_id);
  const weekStart = cleanString(row.week_start);
  const weekEnd = cleanString(row.week_end);
  if (!projectId || !archiveId || !weekStart || !weekEnd) return null;
  return {
    project_id: projectId,
    project_name: projectsById.get(projectId) || "Untitled project",
    archive_id: archiveId,
    week_start: weekStart,
    week_end: weekEnd,
    label: safeText(row.label),
    latest_report_id: cleanString(row.latest_report_id),
    latest_snapshot_id: cleanString(row.latest_snapshot_id),
    metrics: normalizeMetrics(row.metrics),
    risks: safeTextArray(row.risks),
    next_actions: safeTextArray(row.next_actions),
    reports: normalizeReports(row.reports),
    latest_report_at: validIso(row.latest_report_at),
  };
}

function withinRange(dateValue, startIso) {
  if (!startIso) return true;
  const date = validIso(dateValue);
  return Boolean(date && date >= startIso);
}

export function buildClientDeliveryAuditCenterView({
  projects = [],
  events = [],
  weeklyArchives = [],
  filters = {},
  now = new Date().toISOString(),
  locale = "zh",
} = {}) {
  const normalizedFilters = normalizeFilters(filters);
  const startIso = rangeStartIso(normalizedFilters.range, now);
  const projectsById = projectMap(projects);
  const projectOptions = normalizeProjects(projects);
  const filteredEvents = (Array.isArray(events) ? events : [])
    .filter(isRecord)
    .map((event) => normalizeEvent(event, projectsById))
    .filter(Boolean)
    .filter((event) => normalizedFilters.project === "all" || event.project_id === normalizedFilters.project)
    .filter((event) => normalizedFilters.type === "all" || event.event_type === normalizedFilters.type)
    .filter((event) => withinRange(event.event_at, startIso))
    .sort((a, b) => String(b.event_at).localeCompare(String(a.event_at)));
  const filteredArchives = (Array.isArray(weeklyArchives) ? weeklyArchives : [])
    .filter(isRecord)
    .map((row) => normalizeWeeklyArchive(row, projectsById))
    .filter(Boolean)
    .filter((archive) => normalizedFilters.project === "all" || archive.project_id === normalizedFilters.project)
    .filter((archive) => withinRange(archive.latest_report_at || archive.week_start, startIso))
    .sort((a, b) => String(b.week_start).localeCompare(String(a.week_start)));
  const latestActivity = [
    ...filteredEvents.map((event) => event.event_at),
    ...filteredArchives.map((archive) => archive.latest_report_at || archive.week_start),
  ].filter(Boolean).sort((a, b) => String(b).localeCompare(String(a)))[0] || "";
  return {
    locale: locale === "en" ? "en" : "zh",
    filters: normalizedFilters,
    projects: projectOptions,
    summary: {
      report_views: filteredEvents.filter((event) => event.event_type === "report_view").length,
      feedback: filteredEvents.filter((event) => event.event_type === "feedback").length,
      weekly_archives: filteredArchives.length,
      latest_activity: latestActivity,
    },
    events: filteredEvents,
    weekly_archives: filteredArchives,
  };
}

function csvCell(value) {
  const clean = safeText(value);
  if (!/[",\n\r]/.test(clean)) return clean;
  return `"${clean.replace(/"/g, '""')}"`;
}

export function buildClientDeliveryAuditCenterCsv(view = {}) {
  const events = Array.isArray(view.events) ? view.events : [];
  const archives = Array.isArray(view.weekly_archives) ? view.weekly_archives : [];
  const lines = [CSV_HEADER];
  for (const event of events) {
    lines.push([
      event.project_name,
      event.event_type,
      event.actor,
      event.sentiment,
      event.note,
      event.report_href,
      event.event_at,
      "",
      "",
      "",
      "",
    ].map(csvCell).join(","));
  }
  for (const archive of archives) {
    lines.push([
      archive.project_name,
      "weekly_archive",
      "",
      "",
      "",
      "",
      "",
      archive.archive_id,
      archive.week_start,
      archive.week_end,
      archive.latest_report_id,
    ].map(csvCell).join(","));
  }
  return `${lines.join("\n")}\n`;
}
