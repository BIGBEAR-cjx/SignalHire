function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function cleanString(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function validDate(value) {
  const clean = cleanString(value);
  if (!clean) return null;
  const date = new Date(clean);
  return Number.isFinite(date.getTime()) ? date : null;
}

function threadStatus(thread) {
  return cleanString(isRecord(thread) ? thread.status : "").toLowerCase();
}

function threadStep(thread) {
  const source = isRecord(thread) ? thread : {};
  const step = Number(source.sequence_step ?? source.current_sequence_step ?? source.step ?? 1);
  return [1, 2, 3].includes(step) ? step : 1;
}

function isSentLike(thread) {
  const status = threadStatus(thread);
  return ["sent", "contacted", "follow_up_scheduled", "follow_up_due", "replied", "bounced", "interviewing", "hired"].includes(status)
    || Boolean(validDate(isRecord(thread) ? thread.sent_at || thread.last_contacted_at : ""));
}

function isInterested(thread) {
  const source = isRecord(thread) ? thread : {};
  const status = threadStatus(thread);
  const classification = cleanString(source.inbox_classification || source.classification).toLowerCase();
  return ["interested", "interviewing", "hired"].includes(status) || classification === "interested";
}

function isDueFollowUp(thread, now) {
  const status = threadStatus(thread);
  if (status === "follow_up_due") return true;
  const due = validDate(isRecord(thread) ? thread.next_follow_up_at || thread.nextFollowUpAt : "");
  return Boolean(due && due.getTime() <= now.getTime() && !["replied", "bounced", "stopped", "hired", "rejected"].includes(status));
}

function emptyStep(step) {
  return { step, drafted: 0, sent: 0, replied: 0, interested: 0, bounced: 0 };
}

function labels(locale) {
  if (locale === "zh") {
    return {
      openUnavailable: "Open tracking 不可用",
      reviewDue: "复核到期跟进草稿",
      stopBounced: "停止 bounced 候选人",
      scheduleInterested: "安排 interested 候选人",
      keepReviewing: "继续审阅已批准外联",
    };
  }
  return {
    openUnavailable: "Open tracking unavailable",
    reviewDue: "Review due follow-up drafts",
    stopBounced: "Stop bounced candidates",
    scheduleInterested: "Schedule interested candidates",
    keepReviewing: "Keep reviewing approved outreach",
  };
}

export function buildSequenceAnalyticsView({ roleId = "", threads = [], now = new Date(), locale = "en" } = {}) {
  const rows = Array.isArray(threads) ? threads : [];
  const normalizedNow = now instanceof Date ? now : new Date(now);
  const safeNow = Number.isFinite(normalizedNow.getTime()) ? normalizedNow : new Date();
  const copy = labels(locale === "zh" ? "zh" : "en");
  const summary = {
    drafted: 0,
    approved: 0,
    sent: 0,
    opened: null,
    replied: 0,
    interested: 0,
    bounced: 0,
    stopped: 0,
    due_follow_up: 0,
    open_tracking_available: false,
  };
  const byStep = new Map([[1, emptyStep(1)], [2, emptyStep(2)], [3, emptyStep(3)]]);

  for (const thread of rows) {
    const status = threadStatus(thread);
    const step = byStep.get(threadStep(thread)) ?? byStep.get(1);
    if (status === "drafted") {
      summary.drafted += 1;
      step.drafted += 1;
    }
    if (status === "approved") summary.approved += 1;
    if (isSentLike(thread)) {
      summary.sent += 1;
      step.sent += 1;
    }
    if (status === "replied") {
      summary.replied += 1;
      step.replied += 1;
    }
    if (isInterested(thread)) {
      summary.interested += 1;
      step.interested += 1;
    }
    if (status === "bounced") {
      summary.bounced += 1;
      step.bounced += 1;
    }
    if (status === "stopped") summary.stopped += 1;
    if (isDueFollowUp(thread, safeNow)) summary.due_follow_up += 1;
  }

  const nextActions = [];
  if (summary.due_follow_up > 0) nextActions.push(copy.reviewDue);
  if (summary.bounced > 0) nextActions.push(copy.stopBounced);
  if (summary.interested > 0) nextActions.push(copy.scheduleInterested);
  if (nextActions.length === 0 && summary.approved > 0) nextActions.push(copy.keepReviewing);

  return {
    role_id: cleanString(roleId),
    summary,
    opened: null,
    open_tracking_available: false,
    open_tracking_label: copy.openUnavailable,
    step_performance: [byStep.get(1), byStep.get(2), byStep.get(3)],
    next_actions: nextActions,
  };
}
