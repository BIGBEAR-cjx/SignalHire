import { buildRoleOutreachSettings } from "./outreach-settings.mjs";

const FOLLOW_UP_MARKER = "signalhire-follow-up-draft";
const STOPPED_STATUSES = new Set(["stopped", "replied", "bounced", "not_interested", "hired", "rejected"]);
const ACTIVE_STATUSES = new Set(["sent", "contacted", "follow_up_scheduled", "follow_up_due"]);

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function validDate(value) {
  const clean = cleanString(value);
  if (!clean) return null;
  const date = new Date(clean);
  return Number.isFinite(date.getTime()) ? date : null;
}

function sequenceMessages(value) {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function messageForStep(thread, step) {
  return sequenceMessages(thread?.sequence_messages).find((message) => Number(message.step) === step) ?? null;
}

function markerFor(state) {
  return `<!--${FOLLOW_UP_MARKER}:${encodeURIComponent(JSON.stringify(state))}-->`;
}

export function latestFollowUpDraftState(notes = "") {
  const regex = new RegExp(`<!--${FOLLOW_UP_MARKER}:([^>]*)-->`, "g");
  let last = "";
  let match;
  while ((match = regex.exec(cleanString(notes)))) last = match[1];
  if (!last) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(last));
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function nextStepFor(thread) {
  const latest = latestFollowUpDraftState(thread?.notes);
  const latestStep = Number(latest?.step);
  if (latestStep >= 2) return latestStep + 1;
  return 2;
}

export function buildDueFollowUpDraftPatch({ thread = {}, settings = {}, now = new Date() } = {}) {
  const normalized = buildRoleOutreachSettings(settings);
  if (!normalized.auto_follow_up_only) return { ok: false, reason: "auto_follow_up_disabled" };

  const source = isRecord(thread) ? thread : {};
  const status = cleanString(source.status);
  if (STOPPED_STATUSES.has(status)) return { ok: false, reason: "thread_stopped" };
  if (!ACTIVE_STATUSES.has(status)) return { ok: false, reason: "inactive_status" };

  const dueAt = validDate(source.next_follow_up_at);
  if (!dueAt || dueAt.getTime() > now.getTime()) return { ok: false, reason: "not_due" };
  if (!cleanString(source.gmail_thread_id)) return { ok: false, reason: "missing_gmail_thread_id" };

  const pending = latestFollowUpDraftState(source.notes);
  if (status === "follow_up_due" && cleanString(pending?.action_status) === "draft_saved") {
    return { ok: false, reason: "draft_already_pending" };
  }

  const step = nextStepFor(source);
  if (step < 2) return { ok: false, reason: "first_email_never_auto_scheduled" };
  if (step > 3) return { ok: false, reason: "sequence_complete" };

  const message = messageForStep(source, step);
  if (!message || cleanString(message.send_mode) !== "draft_for_review") {
    return { ok: false, reason: "follow_up_message_unavailable" };
  }

  const state = {
    step,
    action: "save_follow_up_draft",
    action_status: "draft_saved",
    drafted_at: now.toISOString(),
  };
  const notes = [cleanString(source.notes), markerFor(state)].filter(Boolean).join("\n");
  return {
    ok: true,
    step,
    patch: {
      status: "follow_up_due",
      subject: cleanString(message.subject),
      body: cleanString(message.body),
      notes,
      next_follow_up_at: null,
      send_error: "",
    },
  };
}

export function buildFollowUpDraftRunSummary(items = []) {
  const rows = Array.isArray(items) ? items : [];
  const reasons = {};
  for (const item of rows) {
    const reason = cleanString(item?.reason);
    if (reason) reasons[reason] = (reasons[reason] ?? 0) + 1;
  }
  return {
    scanned: rows.length,
    drafted: rows.filter((item) => item?.status === "drafted").length,
    skipped: rows.filter((item) => item?.status === "skipped").length,
    failed: rows.filter((item) => item?.status === "failed").length,
    reasons,
  };
}
