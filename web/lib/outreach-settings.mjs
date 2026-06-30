const STOPPED_THREAD_STATUSES = new Set(["stopped", "replied", "bounced", "not_interested"]);

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export function buildRoleOutreachSettings(source = {}) {
  const settings = asObject(source);
  return {
    auto_follow_up_only: settings.auto_follow_up_only === true,
    follow_up_interval_days: 7,
    client_visible_digest: settings.client_visible_digest !== false,
  };
}

export function canAutoSendFollowUp({ settings = {}, message = {}, thread = {} } = {}) {
  const normalized = buildRoleOutreachSettings(settings);
  const sourceMessage = asObject(message);
  const sourceThread = asObject(thread);
  const step = Number(sourceMessage.step);
  const status = cleanString(sourceThread.status).toLowerCase();

  if (!normalized.auto_follow_up_only) return false;
  if (step !== 2 && step !== 3) return false;
  if (sourceMessage.approved !== true) return false;
  if (STOPPED_THREAD_STATUSES.has(status)) return false;
  return sourceMessage.send_mode === "draft_for_review";
}
