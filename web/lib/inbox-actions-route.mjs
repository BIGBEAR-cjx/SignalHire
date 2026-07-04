import { buildInboxActionPatch } from "./inbox-actions.mjs";

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * @param {{
 *   body?: Record<string, unknown>;
 *   user?: { id: string } | null;
 *   getOutreachThread: Function;
 *   updateOutreachThread: Function;
 *   createCalendarEvent?: Function;
 *   updateCalendarEvent?: Function;
 *   cancelCalendarEvent?: Function;
 *   now?: Date;
 * }} input
 */
export async function runInboxAction({
  body = {},
  user = null,
  getOutreachThread,
  updateOutreachThread,
  createCalendarEvent,
  updateCalendarEvent,
  cancelCalendarEvent,
  now = new Date(),
} = {}) {
  if (!user?.id) return { status: 401, body: { error: "login_required" } };
  const id = cleanString(body.outreach_thread_id || body.thread_id);
  if (!id) return { status: 400, body: { error: "missing_outreach_thread_id" } };
  const thread = await getOutreachThread({ userId: user.id, id });
  if (!thread) return { status: 404, body: { error: "thread_not_found" } };
  let calendarEventId = cleanString(body.calendar_event_id);
  if (body.action === "confirm_interview_event" && typeof createCalendarEvent === "function") {
    const created = await createCalendarEvent({
      userId: user.id,
      thread,
      calendar_slot: body.calendar_slot,
      scheduling_message: body.scheduling_message,
    });
    if (!created?.ok) return { status: 400, body: { error: created?.error || "calendar_event_create_failed" } };
    calendarEventId = cleanString(created.event?.id) || calendarEventId;
  }
  if (body.action === "reschedule_interview_event" && typeof updateCalendarEvent === "function") {
    const updated = await updateCalendarEvent({
      userId: user.id,
      thread,
      calendar_event_id: calendarEventId,
      calendar_slot: body.calendar_slot,
      scheduling_message: body.scheduling_message,
    });
    if (!updated?.ok) return { status: 400, body: { error: updated?.error || "calendar_event_update_failed" } };
    calendarEventId = cleanString(updated.event?.id) || calendarEventId;
  }
  if (body.action === "cancel_interview_event" && typeof cancelCalendarEvent === "function") {
    const canceled = await cancelCalendarEvent({
      userId: user.id,
      thread,
      calendar_event_id: calendarEventId,
    });
    if (!canceled?.ok) return { status: 400, body: { error: canceled?.error || "calendar_event_cancel_failed" } };
    calendarEventId = cleanString(canceled.event?.id) || calendarEventId;
  }
  const result = buildInboxActionPatch({
    action: body.action,
    notes: thread.notes,
    reply_draft: body.reply_draft,
    follow_up_at: body.follow_up_at,
    scheduling_message: body.scheduling_message,
    calendar_slot: body.calendar_slot,
    calendar_event_id: calendarEventId,
    now,
  });
  if (!result.ok) return { status: 400, body: { error: result.error } };
  const updated = await updateOutreachThread({
    userId: user.id,
    id,
    ...result.patch,
  });
  if (!updated) return { status: 404, body: { error: "thread_update_failed" } };
  return {
    status: 200,
    body: {
      ok: true,
      action_state: result.action_state,
      thread: updated,
    },
  };
}
