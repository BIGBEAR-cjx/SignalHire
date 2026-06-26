export const INBOX_ACTIONS = ["schedule", "reply", "save_follow_up_draft", "follow_up_later", "stop", "review"];
export const INBOX_ACTION_STATUSES = ["pending", "draft_saved", "scheduled", "interview_ready", "stopped", "reviewed", "sent"];

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
    return {
      action,
      action_status,
      action_applied_at: validIso(parsed.action_applied_at),
      reply_draft: cleanString(parsed.reply_draft),
      follow_up_at: validIso(parsed.follow_up_at),
      scheduling_message: cleanString(parsed.scheduling_message),
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
  const state = {
    action: cleanAction,
    action_status: {
      schedule: "interview_ready",
      reply: "draft_saved",
      save_follow_up_draft: "draft_saved",
      follow_up_later: "scheduled",
      stop: "stopped",
      review: "reviewed",
    }[cleanAction],
    action_applied_at: appliedAt,
    reply_draft: cleanString(reply_draft),
    follow_up_at: followUpAt,
    scheduling_message: cleanString(scheduling_message),
  };
  return {
    ok: true,
    action_state: state,
    patch: {
      status: {
        schedule: "replied",
        reply: "replied",
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
