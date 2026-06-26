import { buildCalendarSchedulingDraft, defaultAvailabilityWindow } from "@/lib/calendar-availability.mjs";
import { getCalendarAvailability } from "@/lib/gmail";
import { normalizeLocale, t } from "@/lib/i18n.mjs";
import { getUser } from "@/lib/session";

export const runtime = "nodejs";

type CalendarSlot = { start: string; end: string; label: string };

export async function POST(req: Request) {
  const user = await getUser();
  const body = await req.json().catch(() => ({}));
  const locale = normalizeLocale(body.locale);
  if (!user) return Response.json({ error: t(locale, "api.error.loginRequired") }, { status: 401 });
  const window = body.time_min && body.time_max
    ? { timeMin: String(body.time_min), timeMax: String(body.time_max) }
    : defaultAvailabilityWindow();
  const availability = await getCalendarAvailability({
    userId: user.id,
    timeMin: window.timeMin,
    timeMax: window.timeMax,
    durationMinutes: Number(body.duration_minutes ?? 30),
    maxSlots: Number(body.max_slots ?? 3),
    locale,
    timeZone: typeof body.time_zone === "string" ? body.time_zone : "UTC",
  });
  const slots = availability.slots as CalendarSlot[];
  const draft = buildCalendarSchedulingDraft({
    locale,
    candidateName: typeof body.candidate_name === "string" ? body.candidate_name : "",
    packet: typeof body.scheduling_packet === "object" && body.scheduling_packet ? body.scheduling_packet : {},
    slots,
  });
  return Response.json({
    project_id: typeof body.project_id === "string" ? body.project_id : "",
    ok: availability.ok,
    skipped_reason: availability.skipped_reason,
    slots,
    draft,
  });
}
