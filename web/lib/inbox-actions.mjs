export const INBOX_ACTIONS = ["schedule", "reply", "save_scheduling_draft", "hold_calendar_slot", "confirm_interview_event", "reschedule_interview_event", "cancel_interview_event", "save_follow_up_draft", "follow_up_later", "stop", "review"];
export const INBOX_ACTION_STATUSES = ["pending", "draft_saved", "slot_held", "confirmed", "rescheduled", "canceled", "scheduled", "interview_ready", "stopped", "reviewed", "sent"];

const ACTION_MARKER = "signalhire-inbox-action";

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function validIso(value) {
  const clean = cleanString(value);
  if (!clean) return "";
  const date = new Date(clean);
  return Number.isFinite(date.getTime()) ? date.toISOString() : "";
}

function normalizeCalendarSlot(value = {}) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const start = validIso(source.start || source.starts_at || source.start_time);
  const end = validIso(source.end || source.ends_at || source.end_time);
  const label = cleanString(source.label);
  return {
    start,
    end,
    label,
  };
}

function normalizeInterviewEvent({ status = "", calendar_event_id = "", calendar_slot = {} } = {}) {
  const slot = normalizeCalendarSlot(calendar_slot);
  return {
    status: cleanString(status),
    starts_at: slot.start,
    ends_at: slot.end,
    label: slot.label,
    calendar_event_id: cleanString(calendar_event_id),
  };
}

function hasCalendarSlot(slot) {
  return Boolean(slot?.start || slot?.end || slot?.label);
}

function hasInterviewEvent(event) {
  return Boolean(event?.status || event?.starts_at || event?.ends_at || event?.calendar_event_id);
}

function defaultFollowUpAt(now) {
  const date = new Date(now);
  date.setDate(date.getDate() + 7);
  return date.toISOString();
}

function markerRegex() {
  return new RegExp(`\\n?<!--${ACTION_MARKER}:([^>]*)-->`, "g");
}

export function parseInboxActionState(notes = "") {
  const clean = cleanString(notes);
  let match;
  let last = null;
  const regex = markerRegex();
  while ((match = regex.exec(clean))) {
    last = match[1];
  }
  if (!last) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(last));
    const action = cleanString(parsed.action);
    const action_status = cleanString(parsed.action_status);
    if (!INBOX_ACTIONS.includes(action) || !INBOX_ACTION_STATUSES.includes(action_status)) return null;
    const calendarSlot = normalizeCalendarSlot(parsed.calendar_slot);
    const event = normalizeInterviewEvent({
      status: parsed.interview_event?.status || (["confirmed", "rescheduled", "canceled"].includes(action_status) ? action_status : ""),
      calendar_event_id: parsed.interview_event?.calendar_event_id || parsed.calendar_event_id,
      calendar_slot: parsed.interview_event || parsed.calendar_slot,
    });
    return {
      action,
      action_status,
      action_applied_at: validIso(parsed.action_applied_at),
      reply_draft: cleanString(parsed.reply_draft),
      follow_up_at: validIso(parsed.follow_up_at),
      scheduling_message: cleanString(parsed.scheduling_message),
      ...(hasCalendarSlot(calendarSlot) ? { calendar_slot: calendarSlot } : {}),
      ...(cleanString(parsed.calendar_event_id) ? { calendar_event_id: cleanString(parsed.calendar_event_id) } : {}),
      ...(hasInterviewEvent(event) ? { interview_event: event } : {}),
    };
  } catch {
    return null;
  }
}

export function mergeInboxActionNotes(notes = "", state = {}) {
  const existing = cleanString(notes).replace(markerRegex(), "").trimEnd();
  const payload = encodeURIComponent(JSON.stringify(state));
  const marker = `<!--${ACTION_MARKER}:${payload}-->`;
  return existing ? `${existing}\n${marker}` : marker;
}

export function defaultActionStatus({ action = "", outreachStatus = "" } = {}) {
  const status = cleanString(outreachStatus);
  if (status === "stopped" || status === "bounced") return "stopped";
  if (status === "follow_up_scheduled") return "scheduled";
  if (action === "stop" && (status === "stopped" || status === "bounced")) return "stopped";
  return "pending";
}

export function buildInboxActionPatch({
  action = "",
  notes = "",
  reply_draft = "",
  follow_up_at = "",
  scheduling_message = "",
  calendar_slot = {},
  calendar_event_id = "",
  now = new Date(),
} = {}) {
  const cleanAction = cleanString(action);
  if (!INBOX_ACTIONS.includes(cleanAction)) {
    return { ok: false, error: "invalid_action" };
  }
  const appliedAt = now.toISOString();
  const followUpAt = cleanAction === "follow_up_later"
    ? (validIso(follow_up_at) || defaultFollowUpAt(now))
    : "";
  const slot = normalizeCalendarSlot(calendar_slot);
  const eventId = cleanString(calendar_event_id);
  const actionStatus = {
    schedule: "interview_ready",
    reply: "draft_saved",
    save_scheduling_draft: "draft_saved",
    hold_calendar_slot: "slot_held",
    confirm_interview_event: "confirmed",
    reschedule_interview_event: "rescheduled",
    cancel_interview_event: "canceled",
    save_follow_up_draft: "draft_saved",
    follow_up_later: "scheduled",
    stop: "stopped",
    review: "reviewed",
  }[cleanAction];
  const state = {
    action: cleanAction,
    action_status: actionStatus,
    action_applied_at: appliedAt,
    reply_draft: cleanString(reply_draft),
    follow_up_at: followUpAt,
    scheduling_message: cleanString(scheduling_message),
    calendar_slot: slot,
    calendar_event_id: eventId,
    interview_event: ["confirm_interview_event", "reschedule_interview_event", "cancel_interview_event"].includes(cleanAction)
      ? normalizeInterviewEvent({ status: actionStatus, calendar_event_id: eventId, calendar_slot: slot })
      : normalizeInterviewEvent({ status: cleanAction === "hold_calendar_slot" ? "held" : "", calendar_event_id: eventId, calendar_slot: slot }),
  };
  return {
    ok: true,
    action_state: state,
    patch: {
      status: {
        schedule: "replied",
        reply: "replied",
        save_scheduling_draft: "replied",
        hold_calendar_slot: "replied",
        confirm_interview_event: "interview_ready",
        reschedule_interview_event: "interview_ready",
        cancel_interview_event: "replied",
        save_follow_up_draft: "follow_up_due",
        follow_up_later: "follow_up_scheduled",
        stop: "stopped",
        review: "replied",
      }[cleanAction],
      notes: mergeInboxActionNotes(notes, state),
      next_follow_up_at: cleanAction === "follow_up_later" ? followUpAt : undefined,
      body: (cleanAction === "reply" || cleanAction === "save_follow_up_draft") && state.reply_draft ? state.reply_draft : undefined,
    },
  };
}

export function buildInboxDraftSentPatch({ notes = "", now = new Date() } = {}) {
  const state = parseInboxActionState(notes);
  if (!state || !["reply", "save_follow_up_draft"].includes(state.action) || state.action_status !== "draft_saved") {
    return { ok: false, error: "draft_not_saved" };
  }
  const sentState = {
    ...state,
    action_status: "sent",
    action_applied_at: now.toISOString(),
  };
  return {
    ok: true,
    action_state: sentState,
    patch: {
      status: state.action === "save_follow_up_draft" ? "sent" : "replied",
      notes: mergeInboxActionNotes(notes, sentState),
    },
  };
}
