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

function normalizeMetrics(value) {
  const source = isRecord(value) ? value : {};
  return {
    new_candidates: Math.max(0, Math.floor(Number(source.new_candidates) || 0)),
    contacted: Math.max(0, Math.floor(Number(source.contacted) || 0)),
    replied: Math.max(0, Math.floor(Number(source.replied) || 0)),
    interview_ready: Math.max(0, Math.floor(Number(source.interview_ready) || 0)),
    confirmed: Math.max(0, Math.floor(Number(source.confirmed) || 0)),
  };
}

function normalizeTextArray(value) {
  return Array.isArray(value)
    ? value.map(cleanString).filter(Boolean).slice(0, 20)
    : [];
}

function normalizeReports(value) {
  return Array.isArray(value)
    ? value.filter(isRecord).map((report) => ({
      id: cleanString(report.id),
      label: cleanString(report.label),
      summary: cleanString(report.summary),
      delivered_at: validIso(report.delivered_at),
      href: cleanString(report.href),
      snapshot_id: cleanString(report.snapshot_id),
      candidate_count: Math.max(0, Math.floor(Number(report.candidate_count) || 0)),
    })).filter((report) => report.id && report.delivered_at).slice(0, 25)
    : [];
}

export function buildClientDeliveryWeeklyArchiveRow(input = {}) {
  const item = isRecord(input.item) ? input.item : {};
  const userId = cleanString(input.userId);
  const projectId = cleanString(input.projectId);
  const archiveId = cleanString(item.archive_id);
  const weekStart = cleanString(item.week_start);
  const weekEnd = cleanString(item.week_end);
  if (!userId || !projectId || !archiveId || !weekStart || !weekEnd) return null;
  const reports = normalizeReports(item.reports);
  return {
    user_id: userId,
    project_id: projectId,
    archive_id: archiveId,
    week_start: weekStart,
    week_end: weekEnd,
    label: cleanString(item.label),
    latest_report_id: cleanString(item.latest_report_id),
    latest_snapshot_id: cleanString(item.latest_snapshot_id),
    metrics: normalizeMetrics(item.metrics),
    risks: normalizeTextArray(item.risks),
    next_actions: normalizeTextArray(item.next_actions),
    reports,
    latest_report_at: reports[0]?.delivered_at || "",
  };
}

export function buildClientDeliveryWeeklyArchiveFromRows(rows = [], { locale = "zh", limit = 8 } = {}) {
  const normalizedLocale = locale === "en" ? "en" : "zh";
  const maxWeeks = Math.max(1, Math.min(Number(limit) || 8, 12));
  const normalizedItems = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!isRecord(row)) continue;
    const item = {
      archive_id: cleanString(row.archive_id),
      week_start: cleanString(row.week_start),
      week_end: cleanString(row.week_end),
      label: cleanString(row.label),
      latest_report_id: cleanString(row.latest_report_id),
      latest_snapshot_id: cleanString(row.latest_snapshot_id),
      metrics: normalizeMetrics(row.metrics),
      risks: normalizeTextArray(row.risks),
      next_actions: normalizeTextArray(row.next_actions),
      reports: normalizeReports(row.reports),
    };
    if (item.archive_id && item.week_start && item.week_end) normalizedItems.push(item);
  }
  const items = normalizedItems
    .sort((a, b) => String(b.week_start).localeCompare(String(a.week_start)))
    .slice(0, maxWeeks);
  return {
    title: normalizedLocale === "en" ? "Weekly delivery archive" : "周交付归档",
    summary: normalizedLocale === "en"
      ? "Persisted weekly delivery records from the client delivery archive table."
      : "来自客户交付周归档表的持久化周交付记录。",
    items,
  };
}
