export const SEARCH_TASK_FREQUENCIES = ["manual", "daily", "weekly"];
export const SEARCH_TASK_STATUSES = ["active", "paused"];
export const SEARCH_TASK_BATCH_SIZES = [5, 10, 20];

const DEFAULT_MONITOR_BATCH_SIZE = 10;
const DEFAULT_MONITOR_TIMEZONE = "UTC";
const DEFAULT_MONITOR_SCHEDULE_TIME = "09:00";
const DEFAULT_MONTHLY_CREDIT_LIMIT = 20;
const timezoneFormatters = new Map();

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function addDays(now, days) {
  const date = new Date(now);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function normalizedInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function normalizeTimezone(value) {
  const timezone = cleanString(value) || DEFAULT_MONITOR_TIMEZONE;
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone: timezone }).resolvedOptions().timeZone;
  } catch {
    return DEFAULT_MONITOR_TIMEZONE;
  }
}

function normalizeScheduleTime(value) {
  const scheduleTime = cleanString(value);
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(scheduleTime) ? scheduleTime : DEFAULT_MONITOR_SCHEDULE_TIME;
}

function getTimezoneFormatter(timezone) {
  const existing = timezoneFormatters.get(timezone);
  if (existing) return existing;
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  timezoneFormatters.set(timezone, formatter);
  return formatter;
}

function timezoneParts(date, timezone) {
  const values = Object.fromEntries(
    getTimezoneFormatter(timezone)
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour) === 24 ? 0 : Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
}

function compareLocalParts(left, right) {
  return ["year", "month", "day", "hour", "minute"].reduce((result, key) => {
    if (result !== 0) return result;
    return Number(left[key]) - Number(right[key]);
  }, 0);
}

function localTimeToUtc({ year, month, day, hour, minute }, timezone) {
  const expected = { year, month, day, hour, minute };
  const targetEpoch = Date.UTC(year, month - 1, day, hour, minute);
  let candidateEpoch = targetEpoch;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const actual = timezoneParts(new Date(candidateEpoch), timezone);
    const offset = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute) - candidateEpoch;
    const adjusted = targetEpoch - offset;
    if (adjusted === candidateEpoch) break;
    candidateEpoch = adjusted;
  }

  if (compareLocalParts(timezoneParts(new Date(candidateEpoch), timezone), expected) === 0) {
    return new Date(candidateEpoch);
  }

  // A local wall time can be skipped by a daylight-saving transition. Schedule
  // the first valid local minute after it instead of silently moving backwards.
  for (let minutes = 1; minutes <= 180; minutes += 1) {
    const adjustedEpoch = candidateEpoch + minutes * 60_000;
    if (compareLocalParts(timezoneParts(new Date(adjustedEpoch), timezone), expected) > 0) {
      return new Date(adjustedEpoch);
    }
  }

  return new Date(candidateEpoch);
}

function nextLocalDate(now, timezone, days) {
  const local = timezoneParts(now, timezone);
  const next = new Date(Date.UTC(local.year, local.month - 1, local.day + days));
  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
  };
}

function candidateKey(candidate) {
  const name = cleanString(candidate?.name).toLowerCase();
  const company = cleanString(candidate?.current_company).toLowerCase();
  const role = cleanString(candidate?.current_role).toLowerCase();
  return [name, company, role].filter(Boolean).join(":") || name;
}

function evidenceUrls(candidate) {
  const urls = new Set();
  for (const claim of Array.isArray(candidate?.claims) ? candidate.claims : []) {
    for (const evidence of Array.isArray(claim?.evidence) ? claim.evidence : []) {
      const url = cleanString(evidence?.url);
      if (url) urls.add(url);
    }
  }
  return [...urls];
}

export function normalizeSearchTaskInput(input = {}) {
  const brief = cleanString(input.brief);
  const name = cleanString(input.name) || brief.slice(0, 80) || "Talent monitor";
  const frequency = SEARCH_TASK_FREQUENCIES.includes(input.frequency) ? input.frequency : "manual";
  const status = SEARCH_TASK_STATUSES.includes(input.status) ? input.status : "active";
  return { name, brief, frequency, status, ...normalizeMonitorInput(input) };
}

export function normalizeMonitorInput(input = {}) {
  const candidateBatchSize = Number(input.candidate_batch_size ?? input.candidateBatchSize);
  const candidate_batch_size = SEARCH_TASK_BATCH_SIZES.includes(candidateBatchSize)
    ? candidateBatchSize
    : DEFAULT_MONITOR_BATCH_SIZE;
  const monthly_credit_limit = normalizedInteger(input.monthly_credit_limit ?? input.monthlyCreditLimit, DEFAULT_MONTHLY_CREDIT_LIMIT);
  const pauseReason = cleanString(input.pause_reason ?? input.pauseReason);
  return {
    candidate_batch_size,
    timezone: normalizeTimezone(input.timezone),
    schedule_time: normalizeScheduleTime(input.schedule_time ?? input.scheduleTime),
    monthly_credit_limit,
    notification_enabled: input.notification_enabled === true || input.notificationEnabled === true,
    pause_reason: pauseReason || null,
  };
}

/**
 * @param {{ frequency?: string, timezone?: string, scheduleTime?: string, schedule_time?: string, now?: Date }} input
 */
export function buildNextRunAt(input = {}) {
  const { frequency, timezone, scheduleTime, schedule_time, now = new Date() } = input;
  if (frequency !== "daily" && frequency !== "weekly") return null;
  if (timezone == null && scheduleTime == null && schedule_time == null) {
    return addDays(now, frequency === "daily" ? 1 : 7);
  }
  const safeTimezone = normalizeTimezone(timezone);
  const safeScheduleTime = normalizeScheduleTime(scheduleTime ?? schedule_time);
  const [hour, minute] = safeScheduleTime.split(":").map(Number);
  const nextDate = nextLocalDate(new Date(now), safeTimezone, frequency === "daily" ? 1 : 7);
  return localTimeToUtc({ ...nextDate, hour, minute }, safeTimezone).toISOString();
}

export function nextRunAfterPatch(existing = {}, patch = {}, now = new Date()) {
  const normalizedExisting = normalizeSearchTaskInput(existing);
  const normalizedNext = normalizeSearchTaskInput({ ...existing, ...patch });
  const scheduleChanged = normalizedExisting.status !== normalizedNext.status
    || normalizedExisting.frequency !== normalizedNext.frequency
    || normalizedExisting.timezone !== normalizedNext.timezone
    || normalizedExisting.schedule_time !== normalizedNext.schedule_time;

  if (!scheduleChanged) return existing.next_run_at ?? null;
  if (normalizedNext.status !== "active") return null;
  return buildNextRunAt({
    frequency: normalizedNext.frequency,
    timezone: normalizedNext.timezone,
    schedule_time: normalizedNext.schedule_time,
    now,
  });
}

export function snapshotMonitorConfig(task = {}) {
  const normalized = normalizeSearchTaskInput(task);
  return {
    name: normalized.name,
    brief: normalized.brief,
    frequency: normalized.frequency,
    candidate_batch_size: normalized.candidate_batch_size,
    timezone: normalized.timezone,
    schedule_time: normalized.schedule_time,
    monthly_credit_limit: normalized.monthly_credit_limit,
    notification_enabled: normalized.notification_enabled,
  };
}

export function buildSearchTaskRunLabel({ taskName, sequence = 1 }) {
  const safeName = cleanString(taskName) || "Talent monitor";
  return `${safeName} · Monitor run ${Math.max(1, Number(sequence) || 1)}`;
}

export function classifyTaskCandidates({ result, knownProfiles = [] }) {
  const knownByKey = new Map();
  const knownByBareName = new Map();
  for (const profile of knownProfiles) {
    const nameKey = cleanString(profile?.name).toLowerCase();
    const key = candidateKey(profile);
    if (key) knownByKey.set(key, profile);
    if (nameKey && !cleanString(profile?.current_company) && !cleanString(profile?.current_role)) {
      knownByBareName.set(nameKey, profile);
    }
  }
  const items = (Array.isArray(result?.candidates) ? result.candidates : []).map((candidate, index) => {
    const candidateLookupKey = candidateKey(candidate);
    const candidateName = cleanString(candidate?.name).toLowerCase();
    const candidateHasIdentityContext = Boolean(cleanString(candidate?.current_company) || cleanString(candidate?.current_role));
    const known = knownByKey.get(candidateLookupKey) ?? (candidateHasIdentityContext ? null : knownByBareName.get(candidateName)) ?? null;
    const urls = evidenceUrls(candidate);
    const knownUrls = new Set(Array.isArray(known?.evidence_urls) ? known.evidence_urls : []);
    const evidenceUpdated = Boolean(known && urls.some((url) => !knownUrls.has(url)));
    return {
      candidate_index: index,
      cache_key: candidateKey(candidate),
      name: cleanString(candidate?.name) || "Unknown candidate",
      discovery_state: known ? "seen_before" : "new_candidate",
      evidence_updated: evidenceUpdated,
      evidence_urls: urls,
    };
  });
  return {
    summary: {
      new_candidates: items.filter((item) => item.discovery_state === "new_candidate").length,
      seen_candidates: items.filter((item) => item.discovery_state === "seen_before").length,
      updated_candidates: items.filter((item) => item.evidence_updated).length,
    },
    items,
  };
}

export function summarizeTaskRuns(runs = []) {
  const ordered = [...runs].sort((a, b) => String(b?.updated_at ?? "").localeCompare(String(a?.updated_at ?? "")));
  const last = ordered[0] ?? null;
  const doneRuns = ordered.filter((run) => run?.status === "done");
  const totals = doneRuns.reduce((acc, run) => {
    const summary = run?.result?.task_discovery?.summary ?? {};
    acc.new_candidates += Number(summary.new_candidates ?? 0) || 0;
    acc.updated_candidates += Number(summary.updated_candidates ?? 0) || 0;
    return acc;
  }, { new_candidates: 0, updated_candidates: 0 });
  return {
    last_status: last?.status ?? "idle",
    last_run_at: last?.updated_at ?? null,
    ...totals,
  };
}
