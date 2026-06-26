export const GOOGLE_CALENDAR_FREEBUSY_SCOPE: "https://www.googleapis.com/auth/calendar.freebusy";
export function calendarScopeStatus(scope?: string): { can_read_calendar: boolean; missing_reason: string };
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
