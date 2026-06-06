import { t as translate } from "./i18n.mjs";

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

function normalizeLocale(locale) {
  return locale === "en" ? "en" : "zh";
}

function msg(locale, key, params) {
  return translate(locale, key, params);
}

export function errorMessage(error) {
  return String(error?.message || error || "研究失败").slice(0, 500);
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
  const msg = errorMessage(error);
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

export function buildRetryUpdate(now = new Date()) {
  return {
    status: RUN_STATUSES.QUEUED,
    attempt_count: 0,
    max_attempts: DEFAULT_MAX_ATTEMPTS,
    error: null,
    last_error: null,
    locked_at: null,
    started_at: null,
    finished_at: null,
    progress: null,
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
  const nextAttempt = attemptCount(row);
  return {
    status: RUN_STATUSES.RETRYING,
    attempt_count: nextAttempt,
    max_attempts: maxAttempts(row),
    last_error: "任务运行超时，系统已重新排队",
    error: null,
    locked_at: null,
    updated_at: iso(now),
  };
}

export function buildQueueRetryUpdate(row, now = new Date()) {
  return {
    status: RUN_STATUSES.QUEUED,
    attempt_count: attemptCount(row),
    max_attempts: maxAttempts(row),
    error: null,
    locked_at: null,
    updated_at: iso(now),
  };
}

export function describeJobStatus(row, locale = "zh") {
  const normalizedLocale = normalizeLocale(locale);
  const status = row?.status || RUN_STATUSES.QUEUED;
  const attempts = attemptCount(row);
  const max = maxAttempts(row);
  const last = row?.last_error || row?.error;

  if (status === RUN_STATUSES.RUNNING) {
    return {
      phase: "running",
      label: msg(normalizedLocale, "job.status.running.label"),
      detail: msg(normalizedLocale, "job.status.running.detail"),
      canRetry: false,
    };
  }
  if (status === RUN_STATUSES.RETRYING) {
    return {
      phase: "retrying",
      label: msg(normalizedLocale, "job.status.retrying.label"),
      detail: msg(normalizedLocale, "job.status.retrying.detail", {
        last: last || msg(normalizedLocale, "job.status.retrying.fallback"),
        attempt: Math.min(attempts + 1, max),
        max,
      }),
      canRetry: false,
    };
  }
  if (status === RUN_STATUSES.DONE) {
    return {
      phase: "done",
      label: msg(normalizedLocale, "job.status.done.label"),
      detail: msg(normalizedLocale, "job.status.done.detail"),
      canRetry: false,
    };
  }
  if (status === RUN_STATUSES.ERROR) {
    return {
      phase: "error",
      label: msg(normalizedLocale, "job.status.error.label"),
      detail: String(row?.error || row?.last_error || msg(normalizedLocale, "job.status.error.detail")),
      canRetry: true,
    };
  }
  if (status === RUN_STATUSES.CANCELED) {
    return {
      phase: "canceled",
      label: msg(normalizedLocale, "job.status.canceled.label"),
      detail: msg(normalizedLocale, "job.status.canceled.detail"),
      canRetry: false,
    };
  }
  return {
    phase: "queued",
    label: msg(normalizedLocale, "job.status.queued.label"),
    detail: msg(normalizedLocale, "job.status.queued.detail"),
    canRetry: false,
  };
}
