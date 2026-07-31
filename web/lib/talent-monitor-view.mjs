const frequencies = new Set(["manual", "daily", "weekly"]);
const statuses = new Set(["active", "paused"]);
const batchSizes = new Set([5, 10, 20]);

function text(value, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function nonNegative(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
}

function safeDate(value) {
  const date = text(value);
  return date && Number.isFinite(Date.parse(date)) ? date : null;
}

function safeSnapshot(value) {
  const row = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    name: text(row.name),
    brief: text(row.brief),
    frequency: frequencies.has(row.frequency) ? row.frequency : "manual",
    candidate_batch_size: batchSizes.has(Number(row.candidate_batch_size)) ? Number(row.candidate_batch_size) : 10,
    timezone: text(row.timezone, "UTC"),
    schedule_time: /^\d{2}:\d{2}$/.test(text(row.schedule_time)) ? text(row.schedule_time) : "09:00",
    monthly_credit_limit: nonNegative(row.monthly_credit_limit),
    notification_enabled: row.notification_enabled === true,
  };
}

function safeRun(row) {
  const value = row && typeof row === "object" && !Array.isArray(row) ? row : {};
  return {
    id: text(value.id),
    status: text(value.status, "unknown"),
    research_run_id: text(value.research_run_id) || null,
    started_at: safeDate(value.started_at),
    finished_at: safeDate(value.finished_at),
    requested_count: nonNegative(value.requested_count),
    returned_count: nonNegative(value.returned_count),
    new_candidates: nonNegative(value.new_candidates),
    updated_candidates: nonNegative(value.updated_candidates),
    seen_candidates: nonNegative(value.seen_candidates),
    skipped_candidates: nonNegative(value.skipped_candidates),
    credits_reserved: nonNegative(value.credits_reserved),
    credits_consumed: nonNegative(value.credits_consumed),
    credits_released: nonNegative(value.credits_released),
    stop_reason: text(value.stop_reason) || null,
    config_snapshot: safeSnapshot(value.config_snapshot),
  };
}

// This is the only model browser routes return for a monitor. It deliberately
// selects fields instead of spreading database rows, so new sensitive columns
// (candidate, report, or outreach data) stay server-only by default.
export function buildMonitorView(task = {}) {
  const limit = nonNegative(task.monthly_credit_limit);
  const used = nonNegative(task.monthly_credit_used);
  const reserved = nonNegative(task.monthly_credit_reserved);
  return {
    id: text(task.id),
    name: text(task.name),
    brief: text(task.brief),
    frequency: frequencies.has(task.frequency) ? task.frequency : "manual",
    status: statuses.has(task.status) ? task.status : "paused",
    candidate_batch_size: batchSizes.has(Number(task.candidate_batch_size)) ? Number(task.candidate_batch_size) : 10,
    timezone: text(task.timezone, "UTC"),
    schedule_time: /^\d{2}:\d{2}$/.test(text(task.schedule_time)) ? text(task.schedule_time) : "09:00",
    notification_enabled: task.notification_enabled === true,
    pause_reason: text(task.pause_reason) || null,
    last_run_at: safeDate(task.last_run_at),
    next_run_at: safeDate(task.next_run_at),
    credits: { limit, used, reserved, available: Math.max(0, limit - used - reserved) },
    run_summary: task.run_summary && typeof task.run_summary === "object" ? {
      last_status: text(task.run_summary.last_status, "idle"),
      last_run_at: safeDate(task.run_summary.last_run_at),
      new_candidates: nonNegative(task.run_summary.new_candidates),
      updated_candidates: nonNegative(task.run_summary.updated_candidates),
    } : undefined,
    runs: Array.isArray(task.runs) ? task.runs.slice(0, 10).map(safeRun) : [],
  };
}
