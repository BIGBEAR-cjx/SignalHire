export const DEFAULT_MAX_ATTEMPTS = 3;
export const STALE_AFTER_MS = 10 * 60 * 1000;

export const RUN_STATUSES = {
  QUEUED: "queued",
  RUNNING: "running",
  RETRYING: "retrying",
  DONE: "done",
  ERROR: "error",
  CANCELED: "canceled",
};

function iso(now = new Date()) {
  return now.toISOString();
}

function dateMs(value) {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

export function attemptCount(row) {
  return Number.isFinite(Number(row?.attempt_count)) ? Number(row.attempt_count) : 0;
}

export function maxAttempts(row) {
  const n = Number(row?.max_attempts);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_MAX_ATTEMPTS;
}

export function isStaleRunningJob(row, now = new Date(), staleAfterMs = STALE_AFTER_MS) {
  if (row?.status !== RUN_STATUSES.RUNNING) return false;
  const basis = dateMs(row.updated_at) ?? dateMs(row.locked_at) ?? dateMs(row.started_at);
  if (basis === null) return false;
  return now.getTime() - basis > staleAfterMs;
}

export function buildRunStartUpdate(now = new Date()) {
  const ts = iso(now);
  return {
    status: RUN_STATUSES.RUNNING,
    locked_at: ts,
    started_at: ts,
    updated_at: ts,
    last_error: null,
  };
}

export function buildRunFailureUpdate({
  attemptCount,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  error,
  now = new Date(),
}) {
  const msg = String(error?.message || error || "研究失败").slice(0, 500);
  const final = attemptCount >= maxAttempts;
  return {
    status: final ? RUN_STATUSES.ERROR : RUN_STATUSES.RETRYING,
    attempt_count: attemptCount,
    max_attempts: maxAttempts,
    last_error: msg,
    error: final ? msg : null,
    locked_at: null,
    updated_at: iso(now),
  };
}

export function buildCancelUpdate(now = new Date()) {
  const msg = "用户已停止搜索";
  return {
    status: RUN_STATUSES.CANCELED,
    error: msg,
    last_error: msg,
    locked_at: null,
    finished_at: iso(now),
    updated_at: iso(now),
  };
}

export function buildStaleRecoveryUpdate(row, now = new Date()) {
  return {
    status: RUN_STATUSES.RETRYING,
    attempt_count: attemptCount(row),
    max_attempts: maxAttempts(row),
    last_error: "任务运行超时，系统已重新排队",
    error: null,
    locked_at: null,
    updated_at: iso(now),
  };
}
