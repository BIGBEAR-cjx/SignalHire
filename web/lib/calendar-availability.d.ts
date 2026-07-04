export const GOOGLE_CALENDAR_FREEBUSY_SCOPE: "https://www.googleapis.com/auth/calendar.freebusy";
export const GOOGLE_CALENDAR_EVENTS_SCOPE: "https://www.googleapis.com/auth/calendar.events";
export function calendarScopeStatus(scope?: string): { can_read_calendar: boolean; can_create_calendar_event: boolean; missing_reason: string };
export function buildCalendarFreeBusyRequest(input?: {
  accessToken?: string;
  timeMin?: string;
  timeMax?: string;
  calendarId?: string;
  url?: string;
}): {
  url: string;
  method: "POST";
  headers: { Authorization: string; "Content-Type": string };
  body: string;
};
export function buildCalendarEventInsertRequest(input?: {
  accessToken?: string;
  calendarId?: string;
  url?: string;
  candidateName?: string;
  candidateEmail?: string;
  calendarSlot?: { start?: string; end?: string; label?: string };
  description?: string;
  sendUpdates?: string;
}): {
  url: string;
  method: "POST";
  headers: { Authorization: string; "Content-Type": string };
  body: string;
};
export function buildCalendarEventPatchRequest(input?: {
  accessToken?: string;
  calendarId?: string;
  calendarEventId?: string;
  url?: string;
  calendarSlot?: { start?: string; end?: string; label?: string };
  description?: string;
  sendUpdates?: string;
}): {
  url: string;
  method: "PATCH";
  headers: { Authorization: string; "Content-Type": string };
  body: string;
};
export function buildCalendarEventDeleteRequest(input?: {
  accessToken?: string;
  calendarId?: string;
  calendarEventId?: string;
  url?: string;
  sendUpdates?: string;
}): {
  url: string;
  method: "DELETE";
  headers: { Authorization: string; "Content-Type": string };
};
export function defaultAvailabilityWindow(now?: Date): { timeMin: string; timeMax: string };
export function slotsFromFreeBusy(input?: {
  response?: unknown;
  timeMin?: string;
  timeMax?: string;
  durationMinutes?: number;
  maxSlots?: number;
  locale?: "zh" | "en" | string;
  timeZone?: string;
}): Array<{ start: string; end: string; label: string }>;
export function buildCalendarSchedulingDraft(input?: {
  locale?: "zh" | "en";
  candidateName?: string;
  packet?: Record<string, unknown>;
  slots?: Array<{ start?: string; end?: string; label?: string }>;
}): { subject: string; body: string; slots: string[] };
