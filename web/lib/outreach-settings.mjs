const STOPPED_THREAD_STATUSES = new Set(["stopped", "replied", "bounced", "not_interested"]);
const CAPACITY_GOAL_KEYS = ["contacted", "replied", "interested", "interview_ready"];

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanStatus(value) {
  return cleanString(value).toLowerCase();
}

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function safeNonNegativeInteger(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.floor(number)));
}

function normalizeCapacityGoal(value) {
  if (typeof value === "number" || typeof value === "string") {
    return {
      contacted: 0,
      replied: 0,
      interested: safeNonNegativeInteger(value),
      interview_ready: 0,
    };
  }

  const source = asObject(value);
  return Object.fromEntries(
    CAPACITY_GOAL_KEYS.map((key) => [key, safeNonNegativeInteger(source[key])]),
  );
}

function normalizeApprovalSettings(settings) {
  const mode = cleanStatus(settings.approval_mode || settings.approvalMode);
  const highConfidenceRequested = mode === "auto_high_confidence"
    || settings.auto_high_confidence === true
    || settings.autoHighConfidence === true;

  if (highConfidenceRequested) {
    return { approval_mode: "manual_all", auto_follow_up_only: false };
  }

  if (mode === "manual_all") {
    return { approval_mode: "manual_all", auto_follow_up_only: false };
  }

  if (mode === "auto_follow_up_only" || settings.auto_follow_up_only === true) {
    return { approval_mode: "auto_follow_up_only", auto_follow_up_only: true };
  }

  return { approval_mode: "manual_all", auto_follow_up_only: false };
}

export function buildRoleOutreachSettings(source = {}) {
  const settings = asObject(source);
  const approval = normalizeApprovalSettings(settings);
  const agentStatus = cleanStatus(settings.agent_status || settings.agentStatus);
  return {
    auto_follow_up_only: approval.auto_follow_up_only,
    follow_up_interval_days: 7,
    client_visible_digest: settings.client_visible_digest !== false,
    agent_status: agentStatus === "paused" ? "paused" : "active",
    approval_mode: approval.approval_mode,
    capacity_goal: normalizeCapacityGoal(settings.capacity_goal ?? settings.capacityGoal),
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
