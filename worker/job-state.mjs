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

const messages = {
  zh: {
    errorFallback: "研究失败",
    cancelError: "用户已停止搜索",
    staleRequeued: "任务运行超时，系统已重新排队",
  },
  en: {
    errorFallback: "Research failed",
    cancelError: "User stopped the search",
    staleRequeued: "The task timed out and was requeued",
  },
};

function iso(now = new Date()) {
  return now.toISOString();
}

function dateMs(value) {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function normalizeLocale(locale) {
  return locale === "en" ? "en" : "zh";
}

function localeFromRow(row, fallback = "zh") {
  return normalizeLocale(row?.progress?.platform_language ?? fallback);
}

function msg(locale, key) {
  return messages[normalizeLocale(locale)][key];
}

function errorText(error, locale) {
  if (error?.message) return error.message;
  if (error instanceof Error) return msg(locale, "errorFallback");
  return error || msg(locale, "errorFallback");
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
  locale = "zh",
}) {
  const message = String(errorText(error, locale)).slice(0, 500);
  const final = attemptCount >= maxAttempts;
  return {
    status: final ? RUN_STATUSES.ERROR : RUN_STATUSES.RETRYING,
    attempt_count: attemptCount,
    max_attempts: maxAttempts,
    last_error: message,
    error: final ? message : null,
    locked_at: null,
    updated_at: iso(now),
  };
}

export function buildCancelUpdate(now = new Date(), locale = "zh") {
  const message = msg(locale, "cancelError");
  return {
    status: RUN_STATUSES.CANCELED,
    error: message,
    last_error: message,
    locked_at: null,
    finished_at: iso(now),
    updated_at: iso(now),
  };
}

export function buildStaleRecoveryUpdate(row, now = new Date(), locale = "zh") {
  return {
    status: RUN_STATUSES.RETRYING,
    attempt_count: attemptCount(row),
    max_attempts: maxAttempts(row),
    last_error: msg(localeFromRow(row, locale), "staleRequeued"),
    error: null,
    locked_at: null,
    updated_at: iso(now),
  };
}
