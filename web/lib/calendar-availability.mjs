export const GOOGLE_CALENDAR_FREEBUSY_SCOPE = "https://www.googleapis.com/auth/calendar.freebusy";
const DEFAULT_CALENDAR_ID = "primary";
const DEFAULT_DURATION_MINUTES = 30;
const DEFAULT_MAX_SLOTS = 3;

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function validDate(value) {
  const date = new Date(cleanString(value));
  return Number.isFinite(date.getTime()) ? date : null;
}

function slotLabel(start, end, locale = "en", timeZone = "UTC") {
  const lang = locale === "zh" ? "zh-CN" : "en-US";
  const date = new Intl.DateTimeFormat(lang, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(start);
  const endTime = new Intl.DateTimeFormat(lang, {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(end);
  return `${date} - ${endTime}`;
}

function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

export function calendarScopeStatus(scope = "") {
  const scopes = cleanString(scope).split(/\s+/).filter(Boolean);
  const canRead = scopes.includes(GOOGLE_CALENDAR_FREEBUSY_SCOPE);
  return {
    can_read_calendar: canRead,
    missing_reason: canRead ? "" : "calendar_scope_missing",
  };
}

export function buildCalendarFreeBusyRequest({
  accessToken = "",
  timeMin = "",
  timeMax = "",
  calendarId = DEFAULT_CALENDAR_ID,
  url = "https://www.googleapis.com/calendar/v3/freeBusy",
} = {}) {
  return {
    url,
    method: "POST",
    headers: {
      Authorization: `Bearer ${cleanString(accessToken)}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      timeMin: cleanString(timeMin),
      timeMax: cleanString(timeMax),
      items: [{ id: cleanString(calendarId) || DEFAULT_CALENDAR_ID }],
    }),
  };
}

export function defaultAvailabilityWindow(now = new Date()) {
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() + 1);
  start.setUTCHours(9, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);
  end.setUTCHours(17, 0, 0, 0);
  return { timeMin: start.toISOString(), timeMax: end.toISOString() };
}

export function slotsFromFreeBusy({
  response = {},
  timeMin = "",
  timeMax = "",
  durationMinutes = DEFAULT_DURATION_MINUTES,
  maxSlots = DEFAULT_MAX_SLOTS,
  locale = "en",
  timeZone = "UTC",
} = {}) {
  const start = validDate(timeMin);
  const end = validDate(timeMax);
  const durationMs = Math.max(15, Number(durationMinutes) || DEFAULT_DURATION_MINUTES) * 60 * 1000;
  const limit = Math.max(1, Number(maxSlots) || DEFAULT_MAX_SLOTS);
  if (!start || !end || end.getTime() <= start.getTime()) return [];
  const source = isRecord(response) ? response : {};
  const calendar = source.calendars?.[DEFAULT_CALENDAR_ID] ?? Object.values(source.calendars ?? {})[0] ?? {};
  const busyRows = Array.isArray(calendar.busy) ? calendar.busy : [];
  const busy = busyRows.map((row) => ({
    start: validDate(row?.start),
    end: validDate(row?.end),
  })).filter((row) => row.start && row.end && row.end.getTime() > row.start.getTime());

  const slots = [];
  for (let cursor = start.getTime(); cursor + durationMs <= end.getTime() && slots.length < limit; cursor += durationMs) {
    const slotStart = new Date(cursor);
    const slotEnd = new Date(cursor + durationMs);
    const blocked = busy.some((row) => rangesOverlap(slotStart.getTime(), slotEnd.getTime(), row.start.getTime(), row.end.getTime()));
    if (blocked) continue;
    slots.push({
      start: slotStart.toISOString(),
      end: slotEnd.toISOString(),
      label: slotLabel(slotStart, slotEnd, locale, timeZone),
    });
  }
  return slots;
}

/**
 * @param {{ locale?: "zh" | "en", candidateName?: string, packet?: Record<string, unknown>, slots?: Array<{ start?: string, end?: string, label?: string }> }} input
 */
export function buildCalendarSchedulingDraft({
  locale = "zh",
  candidateName = "",
  packet = {},
  slots = [],
} = {}) {
  const isEn = locale === "en";
  const name = cleanString(candidateName) || (isEn ? "the candidate" : "候选人");
  const summary = cleanString(packet?.candidate_reply) || cleanString(packet?.suggested_scheduling_message) || cleanString(packet?.candidate_summary);
  const visibleSlots = (Array.isArray(slots) ? slots : []).slice(0, 3).map((slot) => cleanString(slot?.label)).filter(Boolean);
  const slotLines = visibleSlots.length
    ? visibleSlots.map((slot) => `- ${slot}`).join("\n")
    : (isEn ? "- Calendar availability is not available yet; please ask for 2-3 windows." : "- 暂未读取到可用时间，请候选人提供 2-3 个可选时间。");
  const body = isEn
    ? [
      `Hi ${name},`,
      "",
      summary || "Thanks for your reply and interest in the role.",
      "",
      "A few windows that currently look open on our side:",
      slotLines,
      "",
      "Could you confirm which one works, or share 2-3 alternatives?",
      "No calendar invite or email has been sent; this is a draft for recruiter review.",
    ].join("\n")
    : [
      `${name} 你好，`,
      "",
      summary || "感谢你回复并表达对岗位的兴趣。",
      "",
      "以下是我们这边当前看起来可用的时间：",
      slotLines,
      "",
      "请确认哪个时间方便，或回复 2-3 个备选时间。",
      "不会自动发送日历邀请或邮件；这是供招聘方确认的草稿。",
    ].join("\n");
  return {
    subject: isEn ? `Scheduling options for ${name}` : `${name} 的约面时间建议`,
    body,
    slots: visibleSlots,
  };
}
