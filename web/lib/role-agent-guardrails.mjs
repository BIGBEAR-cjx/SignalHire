import { buildRoleOutreachSettings, canAutoSendFollowUp } from "./outreach-settings.mjs";
import { buildSequenceAnalyticsView } from "./sequence-analytics.mjs";

const ROLE_STATUSES = new Set(["draft", "active", "paused", "review_required"]);
const STOP_STATUSES = new Set(["replied", "bounced", "stopped", "not_interested"]);
const BLOCKED_DELIVERABILITY = new Set(["bounced", "invalid", "undeliverable", "failed"]);
const CAPACITY_GOAL_KEYS = ["contacted", "replied", "interested", "interview_ready"];

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function cleanString(value) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function cleanStatus(value) {
  return cleanString(value).toLowerCase();
}

function asNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function validDate(value) {
  const clean = cleanString(value);
  if (!clean) return null;
  const date = new Date(clean);
  return Number.isFinite(date.getTime()) ? date : null;
}

function threadStep(thread) {
  const source = isRecord(thread) ? thread : {};
  const step = Number(source.sequence_step ?? source.current_sequence_step ?? source.step ?? 1);
  return [1, 2, 3].includes(step) ? step : 1;
}

function threadStatus(thread) {
  return cleanStatus(isRecord(thread) ? thread.status : "");
}

function firstEmail(thread) {
  const source = isRecord(thread) ? thread : {};
  const profile = isRecord(source.contact_profile) ? source.contact_profile : isRecord(source.contactProfile) ? source.contactProfile : {};
  const emails = Array.isArray(profile.emails) ? profile.emails : [];
  const email = emails.find((item) => isRecord(item) && cleanString(item.value)) || emails.find(isRecord) || {};
  if (isRecord(email)) return email;
  return {};
}

function hasContactValue(thread) {
  const source = isRecord(thread) ? thread : {};
  return Boolean(cleanString(firstEmail(source).value || source.email));
}

function hasEvidence(thread) {
  const source = isRecord(thread) ? thread : {};
  return Boolean(cleanString(
    source.evidence_angle
      || source.evidenceAngle
      || source.contact_angle
      || source.contactAngle
      || source.evidence_summary
      || source.evidenceSummary,
  ));
}

function evidenceNeedsReview(thread) {
  const source = isRecord(thread) ? thread : {};
  const status = cleanStatus(source.evidence_status || source.evidenceStatus || source.evidence_quality || source.evidenceQuality);
  return source.evidence_needs_verification === true
    || source.needs_verification === true
    || ["low", "needs_verification", "review_required", "missing"].includes(status);
}

function isInterested(thread) {
  const source = isRecord(thread) ? thread : {};
  const status = threadStatus(source);
  const classification = cleanStatus(source.inbox_classification || source.classification);
  return ["interested", "interviewing", "interview_ready", "hired"].includes(status) || classification === "interested";
}

function isContacted(thread) {
  const source = isRecord(thread) ? thread : {};
  const status = threadStatus(source);
  return ["sent", "contacted", "follow_up_scheduled", "follow_up_due", "replied", "bounced", "interviewing", "interview_ready", "hired"].includes(status)
    || Boolean(validDate(source.sent_at || source.sentAt || source.last_contacted_at || source.lastContactedAt));
}

function isInterviewReady(thread) {
  const source = isRecord(thread) ? thread : {};
  const status = threadStatus(source);
  const classification = cleanStatus(source.inbox_classification || source.classification);
  return ["interview_ready", "interviewing", "hired"].includes(status) || classification === "interview_ready";
}

function addReason(reasons, code, label, count = 1) {
  if (count <= 0) return;
  const existing = reasons.get(code);
  if (existing) {
    existing.count += count;
    return;
  }
  reasons.set(code, { code, label, count });
}

function capacityGoal(role, inputGoal) {
  const source = isRecord(role) ? role : {};
  const raw = inputGoal ?? source.capacity_goal ?? source.capacityGoal ?? source.target_candidates ?? source.targetCandidates;
  return buildRoleOutreachSettings({ capacity_goal: raw }).capacity_goal;
}

function persistedCapacityGoal(rawSettings, normalizedSettings) {
  const source = isRecord(rawSettings) ? rawSettings : {};
  if (Object.hasOwn(source, "capacity_goal") || Object.hasOwn(source, "capacityGoal")) {
    return normalizedSettings.capacity_goal;
  }
  return null;
}

function buildCurrentCounts(threads, sequenceAnalytics) {
  const summary = isRecord(sequenceAnalytics?.summary) ? sequenceAnalytics.summary : {};
  return {
    contacted: Math.max(asNumber(summary.sent), threads.filter(isContacted).length),
    replied: Math.max(asNumber(summary.replied), threads.filter((thread) => threadStatus(thread) === "replied").length),
    interested: Math.max(asNumber(summary.interested), threads.filter(isInterested).length),
    interview_ready: threads.filter(isInterviewReady).length,
  };
}

function buildCapacitySummary(goal, counts) {
  const capacity = isRecord(goal) ? goal : buildRoleOutreachSettings({ capacity_goal: goal }).capacity_goal;
  const remainingByStage = Object.fromEntries(
    CAPACITY_GOAL_KEYS.map((key) => [key, Math.max(0, asNumber(capacity[key]) - asNumber(counts[key]))]),
  );
  const legacyGoal = capacity.interested > 0 ? capacity.interested : null;
  const remaining = legacyGoal == null ? null : remainingByStage.interested;
  let pressure = "not_set";
  if (legacyGoal != null) {
    const ratio = counts.interested / legacyGoal;
    pressure = ratio >= 1 ? "met" : ratio >= 0.6 ? "on_track" : "needs_pipeline";
  }
  return {
    goal: legacyGoal,
    capacity_goal: capacity,
    contacted: counts.contacted,
    replied: counts.replied,
    interested: counts.interested,
    interview_ready: counts.interview_ready,
    remaining_by_stage: remainingByStage,
    remaining_to_goal: remaining,
    pressure,
  };
}

function buildActivityLog(threads, limit) {
  return threads
    .map((thread, index) => {
      const source = isRecord(thread) ? thread : {};
      const timestamp = validDate(
        source.last_activity_at
          || source.lastActivityAt
          || source.updated_at
          || source.updatedAt
          || source.sent_at
          || source.sentAt,
      );
      const candidate = cleanString(source.candidate_name || source.candidateName || source.name) || "Unknown candidate";
      const status = threadStatus(source) || "draft";
      return {
        id: cleanString(source.id) || `activity-${index + 1}`,
        candidate,
        status,
        label: `${candidate}: ${status}`,
        detail: cleanString(source.reply_summary || source.replySummary || source.evidence_angle || source.evidenceAngle || source.last_activity || source.lastActivity),
        occurred_at: timestamp ? timestamp.toISOString() : "",
        order: timestamp ? timestamp.getTime() : -index,
      };
    })
    .sort((a, b) => b.order - a.order)
    .slice(0, limit)
    .map(({ order, ...entry }) => entry);
}

function normalizeApprovalMode(settings, locale = "en") {
  const isZh = locale === "zh";
  const highConfidenceRequested = settings.auto_high_confidence === true
    || settings.autoHighConfidence === true
    || cleanStatus(settings.approval_mode || settings.approvalMode) === "auto_high_confidence";
  const normalized = buildRoleOutreachSettings(settings);

  if (highConfidenceRequested) {
    return {
      mode: "manual_all",
      label: isZh ? "需要人工批准" : "Manual approval required",
      first_email_manual: true,
      auto_follow_up_only: false,
      high_confidence_auto_send_blocked: true,
    };
  }

  if (normalized.approval_mode === "auto_follow_up_only") {
    return {
      mode: "auto_follow_up_only",
      label: isZh ? "跟进草稿复核" : "Follow-up review drafts",
      first_email_manual: true,
      auto_follow_up_only: true,
      high_confidence_auto_send_blocked: false,
    };
  }

  return {
    mode: "manual_all",
    label: isZh ? "需要人工批准" : "Manual approval required",
    first_email_manual: true,
    auto_follow_up_only: false,
    high_confidence_auto_send_blocked: false,
  };
}

function buildBlockedReasons({ threads, settings, approvalMode }) {
  const reasons = new Map();

  addReason(reasons, "first_email_manual", "First email manual approval and send", 1);
  if (approvalMode.high_confidence_auto_send_blocked) {
    addReason(reasons, "high_confidence_auto_send_blocked", "High-confidence auto-send is blocked in this phase", 1);
  }

  for (const thread of threads) {
    const status = threadStatus(thread);
    const step = threadStep(thread);
    const email = firstEmail(thread);
    const confidence = cleanStatus(email.confidence);
    const deliverability = cleanStatus(email.deliverability_status || email.deliverability);
    const source = cleanString(email.source);

    if (STOP_STATUSES.has(status)) addReason(reasons, "candidate_stop_state", "Replied, bounced, stopped, or not interested candidates stop automation");
    if (!hasContactValue(thread)) addReason(reasons, "missing_contact", "Missing contact stays review-only");
    if (confidence === "low") addReason(reasons, "low_confidence_contact", "Low-confidence contact blocks automation");
    if (hasContactValue(thread) && !source) addReason(reasons, "source_less_contact", "Source-less contact blocks automation");
    if (BLOCKED_DELIVERABILITY.has(deliverability)) addReason(reasons, "contact_not_sendable", "Bounced or invalid contact blocks automation");
    if (evidenceNeedsReview(thread)) addReason(reasons, "evidence_review_required", "Low evidence or needs verification stays review-only");
    if (step === 1) addReason(reasons, "first_email_candidates_manual", "Step 1 candidates require manual first email");
    if (step > 1 && !canAutoSendFollowUp({
      settings,
      message: {
        step,
        send_mode: cleanString(isRecord(thread) ? thread.send_mode || thread.sendMode : ""),
        approved: isRecord(thread) ? thread.approved === true : false,
      },
      thread,
    })) {
      addReason(reasons, "follow_up_not_auto_eligible", "Follow-up review draft requires enabled setting, approved message, and active thread");
    }
  }

  return Array.from(reasons.values());
}

function buildNextTasks({ threads, sequenceAnalytics, capacity, blockedReasons, locale = "en" }) {
  const isZh = locale === "zh";
  const tasks = [];
  const analyticsActions = Array.isArray(sequenceAnalytics?.next_actions) ? sequenceAnalytics.next_actions : [];
  analyticsActions.slice(0, 3).forEach((action, index) => {
    const label = cleanString(action);
    if (label) tasks.push({ id: `sequence-${index + 1}`, label, source: "sequence_analytics" });
  });

  const missingEvidence = threads.filter((thread) => !hasEvidence(thread) || evidenceNeedsReview(thread)).length;
  if (missingEvidence > 0) {
    tasks.push({
      id: "review-evidence-gaps",
      label: isZh
        ? `复核 ${missingEvidence} 位候选人的证据缺口`
        : `Review evidence gaps for ${missingEvidence} candidate${missingEvidence === 1 ? "" : "s"}`,
      source: "evidence_gaps",
    });
  }

  if (capacity.goal != null && capacity.remaining_to_goal > 0) {
    tasks.push({
      id: "add-candidates-to-capacity",
      label: isZh
        ? `补充 ${capacity.remaining_to_goal} 位有意向候选人以达到目标`
        : `Add ${capacity.remaining_to_goal} interested candidate${capacity.remaining_to_goal === 1 ? "" : "s"} to meet capacity goal`,
      source: "capacity",
    });
  }

  if (tasks.length === 0 && blockedReasons.length > 0) {
    tasks.push({
      id: "review-guardrails",
      label: isZh ? "继续前先复核自动化护栏" : "Review blocked automation before continuing",
      source: "guardrails",
    });
  }

  return tasks.slice(0, 5);
}

function hasPersistedAgentStatus(settings) {
  const source = isRecord(settings) ? settings : {};
  return Object.hasOwn(source, "agent_status") || Object.hasOwn(source, "agentStatus");
}

function viewStatus(role, settings, approvalMode, blockedReasons, threads) {
  const source = isRecord(role) ? role : {};
  const normalizedSettings = buildRoleOutreachSettings(settings);
  if (hasPersistedAgentStatus(settings) && normalizedSettings.agent_status === "paused") return "paused";
  const explicit = cleanStatus(source.status);
  if (approvalMode.high_confidence_auto_send_blocked) return "review_required";
  if (hasPersistedAgentStatus(settings) && normalizedSettings.agent_status === "active") return "active";
  if (explicit === "paused" || source.paused === true) return "paused";
  if (blockedReasons.some((reason) => !["first_email_manual", "first_email_candidates_manual"].includes(reason.code))) return "review_required";
  if (ROLE_STATUSES.has(explicit)) return explicit;
  return threads.length > 0 ? "active" : "draft";
}

export function buildRoleAgentGuardrailsView({
  role = {},
  roleId = "",
  settings = {},
  threads = [],
  sequenceAnalytics = null,
  capacityGoal: inputCapacityGoal = null,
  activityLimit = 5,
  now = new Date(),
  locale = "en",
} = {}) {
  const rows = Array.isArray(threads) ? threads : [];
  const sourceRole = isRecord(role) ? role : {};
  const id = cleanString(roleId || sourceRole.id || sourceRole.role_id || sourceRole.roleId);
  const normalizedLocale = locale === "zh" ? "zh" : "en";
  const rawSettings = isRecord(settings) ? settings : {};
  const normalizedSettings = buildRoleOutreachSettings(rawSettings);
  const approvalMode = normalizeApprovalMode(rawSettings, normalizedLocale);
  const safeSettings = approvalMode.high_confidence_auto_send_blocked ? { ...normalizedSettings, auto_follow_up_only: false } : normalizedSettings;
  const analytics = isRecord(sequenceAnalytics)
    ? sequenceAnalytics
    : buildSequenceAnalyticsView({ roleId: id, threads: rows, now, locale });
  const counts = buildCurrentCounts(rows, analytics);
  const capacity = buildCapacitySummary(persistedCapacityGoal(rawSettings, normalizedSettings) ?? capacityGoal(sourceRole, inputCapacityGoal), counts);
  const blockedReasons = buildBlockedReasons({ threads: rows, settings: safeSettings, approvalMode });
  const nextTasks = buildNextTasks({ threads: rows, sequenceAnalytics: analytics, capacity, blockedReasons, locale: normalizedLocale });

  return {
    panel_title: "Role Agent Guardrails",
    role_id: id,
    status: viewStatus(sourceRole, rawSettings, approvalMode, blockedReasons, rows),
    approval_mode: approvalMode,
    capacity_summary: capacity,
    current_counts: counts,
    next_tasks: nextTasks,
    blocked_automation_reasons: blockedReasons,
    activity_log: buildActivityLog(rows, Math.max(1, asNumber(activityLimit, 5))),
    sequence_analytics: analytics,
    controlled_workflow_copy: "SignalHire is running a controlled workflow, not a black-box sender.",
  };
}
