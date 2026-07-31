import { buildRoleOutreachSettings } from "./outreach-settings.mjs";
import { buildSmartReportView } from "./smart-report.mjs";

const ACTION_ORDER = [
  "review_interested_candidates",
  "resolve_contacts",
  "approve_or_send_outreach",
  "retry_failed_outreach",
  "follow_up",
  "refresh_live_signals",
  "review_preview_leads",
  "run_sourcing",
];

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function cleanString(value) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function asNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function arrayOf(value) {
  return Array.isArray(value) ? value : [];
}

function summaryOf(value) {
  return isRecord(value?.summary) ? value.summary : {};
}

function primaryEmail(contactProfile) {
  const emails = arrayOf(contactProfile?.emails);
  return emails.find((email) => {
    if (!isRecord(email) || !cleanString(email.value)) return false;
    const confidence = cleanString(email.confidence).toLowerCase();
    const deliverability = cleanString(email.deliverability_status || email.deliverability).toLowerCase();
    return ["high", "medium"].includes(confidence) && !["bounced", "invalid", "undeliverable", "failed"].includes(deliverability);
  }) ?? null;
}

function contactEmails(contactProfile) {
  return arrayOf(contactProfile?.emails).filter((email) => isRecord(email) && cleanString(email.value));
}

function hasLowConfidenceContact(contactProfile) {
  return contactEmails(contactProfile).some((email) => cleanString(email.confidence).toLowerCase() === "low");
}

function queueItems(queue) {
  return arrayOf(queue?.items).filter(isRecord);
}

function itemStatus(item) {
  return cleanString(item?.status || item?.outreach_status).toLowerCase();
}

function itemClassification(item) {
  return cleanString(item?.classification || item?.inbox_classification).toLowerCase();
}

function contactedOutreachItem(item) {
  const status = itemStatus(item);
  return [
    "sent",
    "contacted",
    "follow_up_scheduled",
    "follow_up_due",
    "replied",
    "bounced",
    "interested",
    "interviewing",
    "interview_ready",
    "hired",
  ].includes(status) || Boolean(cleanString(item?.sent_at || item?.sentAt || item?.last_contacted_at || item?.lastContactedAt));
}

function repliedOutreachItem(item) {
  return itemStatus(item) === "replied";
}

function interestedOutreachItem(item) {
  const status = itemStatus(item);
  const classification = itemClassification(item);
  return ["interested", "interviewing", "interview_ready", "hired"].includes(status) || classification === "interested";
}

function interviewReadyOutreachItem(item) {
  const status = itemStatus(item);
  const classification = itemClassification(item);
  return ["interview_ready", "interviewing", "hired"].includes(status) || classification === "interview_ready";
}

function inboxInterestedItems(inboxQueue) {
  const explicit = arrayOf(inboxQueue?.interested_candidates).filter(isRecord);
  if (explicit.length) return explicit;
  return arrayOf(inboxQueue?.items).filter((item) => cleanString(item?.classification).toLowerCase() === "interested");
}

function inboxReviewCandidateCount(inboxQueue) {
  const summary = summaryOf(inboxQueue);
  const scheduledItems = arrayOf(inboxQueue?.items).filter((item) => {
    const classification = cleanString(item?.classification).toLowerCase();
    const readiness = cleanString(item?.readiness).toLowerCase();
    const nextAction = cleanString(item?.next_action).toLowerCase();
    const actionStatus = cleanString(item?.action_status).toLowerCase();
    return classification === "interested"
      || readiness === "needs_scheduling"
      || (nextAction === "schedule" && actionStatus !== "interview_ready");
  }).length;
  return Math.max(
    asNumber(summary.interested),
    asNumber(summary.needs_scheduling),
    inboxInterestedItems(inboxQueue).length,
    scheduledItems,
  );
}

function inboxNeedsHumanReply(inboxQueue) {
  if (asNumber(summaryOf(inboxQueue).needs_human_reply) > 0) return true;
  return arrayOf(inboxQueue?.items).some((item) => {
    const classification = cleanString(item?.classification || item?.readiness || item?.status).toLowerCase();
    return classification === "needs_human_reply";
  });
}

function dueFollowUpCount({ sequenceAnalytics, outreachItems, inboxQueue }) {
  const inboxItems = arrayOf(inboxQueue?.items).filter((item) => {
    const classification = cleanString(item?.classification).toLowerCase();
    const nextAction = cleanString(item?.next_action).toLowerCase();
    const actionStatus = cleanString(item?.action_status).toLowerCase();
    return classification === "no_reply_follow_up"
      || (nextAction === "save_follow_up_draft" && actionStatus !== "draft_saved");
  }).length;
  return Math.max(
    asNumber(summaryOf(sequenceAnalytics).due_follow_up),
    outreachItems.filter((item) => itemStatus(item) === "follow_up_due").length,
    asNumber(summaryOf(inboxQueue).due_follow_up),
    inboxItems,
  );
}

function latestIsoFrom(values) {
  return values.reduce((latest, value) => newerIso(latest, value), "");
}

function isWithinDays(value, anchor, days) {
  const iso = validIso(value);
  const anchorIso = validIso(anchor);
  if (!iso || !anchorIso) return false;
  const at = new Date(iso).getTime();
  const end = new Date(anchorIso).getTime();
  const start = end - days * 24 * 60 * 60 * 1000;
  return at >= start && at <= end;
}

function buildWeeklyDeliveryProgress({ candidateGraph, outreachItems, inboxQueue, locale }) {
  const candidateItems = arrayOf(candidateGraph?.candidates).filter(isRecord);
  const inboxItems = uniqueInboxPipelineItems(inboxQueue);
  const anchor = latestIsoFrom([
    ...candidateItems.map((item) => item.updated_at || item.created_at || item.sourced_at || item.first_seen_at),
    ...outreachItems.map((item) => item.sent_at || item.last_contacted_at || item.updated_at),
    ...inboxItems.map((item) => item.updated_at || item.received_at || item.last_message_at),
  ]);
  const newCandidates = candidateItems.filter((item) => isWithinDays(item.updated_at || item.created_at || item.sourced_at || item.first_seen_at, anchor, 7)).length;
  const contacted = outreachItems.filter((item) => isWithinDays(item.sent_at || item.last_contacted_at, anchor, 7)).length;
  const replied = inboxItems.filter((item) => isWithinDays(item.updated_at || item.received_at || item.last_message_at, anchor, 7)).length;
  const interviewReady = inboxItems.filter((item) => isInterviewReadyInboxItem(item) && isWithinDays(item.updated_at || item.received_at || item.last_message_at, anchor, 7)).length;
  const confirmed = inboxItems.filter((item) => inboxPipelineSchedulingState(item, locale).status === "confirmed" && isWithinDays(item.updated_at || item.received_at || item.last_message_at, anchor, 7)).length;
  return {
    window_label: locale === "zh" ? "最近 7 天" : "Last 7 days",
    metrics: {
      new_candidates: newCandidates,
      contacted,
      replied,
      interview_ready: interviewReady,
      confirmed,
    },
  };
}

function buildClientDeliveryLoop({ weeklyProgress, risks, nextActions, locale }) {
  const zh = locale === "zh";
  const metricLabels = {
    new_candidates: zh ? "本周新增" : "New candidates",
    contacted: zh ? "已联系" : "Contacted",
    replied: zh ? "已回复" : "Replied",
    interview_ready: zh ? "可约面" : "Interview-ready",
    confirmed: zh ? "已确认" : "Confirmed",
  };
  const metricOrder = ["new_candidates", "contacted", "replied", "interview_ready", "confirmed"];
  const metrics = metricOrder.map((key) => ({
    key,
    label: metricLabels[key],
    value: asNumber(weeklyProgress?.metrics?.[key]),
  }));
  const cleanRisks = arrayOf(risks).map(cleanString).filter(Boolean).slice(0, 3);
  const cleanNextSteps = arrayOf(nextActions).map(cleanString).filter(Boolean).slice(0, 3);
  return {
    title: zh ? "客户交付循环" : "Client delivery loop",
    window_label: cleanString(weeklyProgress?.window_label),
    metrics,
    risks: cleanRisks.length ? cleanRisks : [zh ? "暂无明显交付风险。" : "No major delivery risk recorded."],
    next_steps: cleanNextSteps.length ? cleanNextSteps : [zh ? "继续推进候选人、外联和约面。" : "Keep progressing candidates, outreach, and interviews."],
  };
}

function deliverySummaryFrom({ smartReport, candidateGraph, outreachItems, inboxQueue, locale }) {
  if (!isRecord(smartReport)) return null;
  const view = buildSmartReportView(smartReport, { locale });
  if (view.metrics.candidates <= 0 && view.next_actions.length === 0 && view.risks.length === 0) return null;
  const weeklyProgress = buildWeeklyDeliveryProgress({ candidateGraph, outreachItems, inboxQueue, locale });
  const risks = view.risks.slice(0, 3);
  const nextActions = view.next_actions.slice(0, 3);
  return {
    title: view.title,
    brief_summary: view.brief_summary,
    metrics: view.metrics,
    weekly_progress: weeklyProgress,
    client_delivery_loop: buildClientDeliveryLoop({ weeklyProgress, risks, nextActions, locale }),
    source_mix: view.source_mix.slice(0, 4).map((item) => ({ label: item.label, count: item.count })),
    risks,
    next_actions: nextActions,
  };
}

function contactGapCount({ goals, counts, candidateGraph, outreachItems }) {
  const missingFromOutreach = outreachItems.filter((item) => !primaryEmail(item.contact_profile)).length;
  if (missingFromOutreach > 0) return missingFromOutreach;
  const graphSummary = summaryOf(candidateGraph);
  const candidateTarget = Math.max(1, goals.contacted || goals.interested || goals.interview_ready || 0);
  const candidatesToContact = Math.min(counts.candidates, candidateTarget);
  return Math.max(0, candidatesToContact - asNumber(graphSummary.contactable_count));
}

function outreachReadyCount({ outreachQueue, outreachItems }) {
  const readyItems = outreachItems.filter((item) => {
    const status = cleanString(item.status).toLowerCase();
    return ["drafted", "approved"].includes(status) && primaryEmail(item.contact_profile) && !cleanString(item.send_error);
  }).length;
  return Math.max(readyItems, asNumber(summaryOf(outreachQueue).drafted));
}

function latestRunStatus(run) {
  return cleanString(run?.status).toLowerCase();
}

function hasActiveSearch({ latestRun, searchTasks }) {
  const runStatus = latestRunStatus(latestRun);
  if (["queued", "running", "retrying"].includes(runStatus)) return true;
  return arrayOf(searchTasks).some((task) => cleanString(task?.status).toLowerCase() === "active");
}

function buildCounts({ settings, candidateGraph, leadPreview, outreachItems, sequenceAnalytics, inboxQueue }) {
  const graphSummary = summaryOf(candidateGraph);
  const previewSummary = summaryOf(leadPreview);
  const sequenceSummary = summaryOf(sequenceAnalytics);
  const goals = buildRoleOutreachSettings(settings).capacity_goal;
  return {
    goals,
    counts: {
      candidates: asNumber(graphSummary.candidate_count),
      preview_leads: asNumber(previewSummary.item_count),
      contacted: Math.max(asNumber(sequenceSummary.sent), outreachItems.filter(contactedOutreachItem).length),
      replied: Math.max(asNumber(sequenceSummary.replied), outreachItems.filter(repliedOutreachItem).length),
      interested: Math.max(asNumber(sequenceSummary.interested), outreachItems.filter(interestedOutreachItem).length, inboxReviewCandidateCount(inboxQueue)),
      interview_ready: Math.max(asNumber(graphSummary.interview_ready_count), outreachItems.filter(interviewReadyOutreachItem).length),
    },
  };
}

function actionText(type, locale) {
  const zh = locale === "zh";
  const labels = {
    run_sourcing: zh ? "运行搜索" : "Run sourcing",
    review_preview_leads: zh ? "复核预览线索" : "Review preview leads",
    resolve_contacts: zh ? "解析联系方式" : "Resolve contacts",
    approve_or_send_outreach: zh ? "批准或发送外联" : "Approve or send outreach",
    retry_failed_outreach: zh ? "重试失败外联" : "Retry failed outreach",
    follow_up: zh ? "处理跟进" : "Follow up",
    refresh_live_signals: zh ? "刷新实时信号" : "Refresh live signals",
    review_interested_candidates: zh ? "复核有意向候选人" : "Review interested candidates",
  };
  const reasons = {
    run_sourcing: zh ? "候选人池不足，需要继续搜人。" : "The role needs more candidates in the pipeline.",
    review_preview_leads: zh ? "搜索中已有未复核线索，可以先判断方向。" : "Preview leads are available for direction review.",
    resolve_contacts: zh ? "有候选人缺少可发送联系方式。" : "Missing contact details block outreach for some candidates.",
    approve_or_send_outreach: zh ? "已有外联草稿或批准项可以推进。" : "Drafted or approved outreach is ready for review.",
    retry_failed_outreach: zh ? "有发送失败的外联可以恢复重试。" : "Failed outreach can be recovered and retried.",
    follow_up: zh ? "已有到期跟进需要处理。" : "Due follow-ups need action.",
    refresh_live_signals: zh ? "有候选人的实时信号已过期或变旧，需要刷新后再判断 why now。" : "Some candidate live signals are stale or expired and should be refreshed before why-now prioritization.",
    review_interested_candidates: zh ? "已有候选人回复有意向，需要推进约面。" : "Interested replies need interview-ready review.",
  };
  const ctas = {
    run_sourcing: zh ? "开始搜人" : "Start sourcing",
    review_preview_leads: zh ? "查看线索" : "Review leads",
    resolve_contacts: zh ? "解析联系方式" : "Resolve contacts",
    approve_or_send_outreach: zh ? "处理外联" : "Handle outreach",
    retry_failed_outreach: zh ? "重试发送" : "Retry sends",
    follow_up: zh ? "处理跟进" : "Handle follow-up",
    refresh_live_signals: zh ? "刷新信号" : "Refresh signals",
    review_interested_candidates: zh ? "推进约面" : "Move to interview",
  };
  return { label: labels[type], reason: reasons[type], cta: ctas[type] };
}

function makeAction(type, affectedCount, locale, blockedReason = "") {
  const text = actionText(type, locale);
  return {
    type,
    label: text.label,
    reason: text.reason,
    affected_count: Math.max(0, affectedCount),
    cta: text.cta,
    ...(blockedReason ? { blocked_reason: blockedReason } : {}),
  };
}

function buildNextActions({ status, goals, counts, health, candidateGraph, leadPreview, outreachQueue, outreachItems, sequenceAnalytics, inboxQueue, latestRun, searchTasks, signalRefresh, locale }) {
  const actions = [];
  const pausedBlock = status === "paused" ? "agent_paused" : "";
  const previewCount = asNumber(summaryOf(leadPreview).item_count);
  const activeSearch = hasActiveSearch({ latestRun, searchTasks });
  const candidateTarget = Math.max(1, goals.contacted || goals.interested || goals.interview_ready || 0);
  const candidateShortfall = counts.candidates + previewCount < candidateTarget;
  const interestedCount = inboxReviewCandidateCount(inboxQueue);
  const missingContacts = contactGapCount({ goals, counts, candidateGraph, outreachItems });
  const outreachReady = outreachReadyCount({ outreachQueue, outreachItems });
  const failedSends = outreachItems.filter((item) => cleanString(item.send_error) && itemStatus(item) === "approved").length;
  const dueFollowUps = dueFollowUpCount({ sequenceAnalytics, outreachItems, inboxQueue });

  if (interestedCount > 0) actions.push(makeAction("review_interested_candidates", interestedCount, locale, pausedBlock));
  if (missingContacts > 0) actions.push(makeAction("resolve_contacts", missingContacts, locale, pausedBlock));
  if (outreachReady > 0) actions.push(makeAction("approve_or_send_outreach", outreachReady, locale, pausedBlock));
  if (failedSends > 0) actions.push(makeAction("retry_failed_outreach", failedSends, locale, pausedBlock));
  if (dueFollowUps > 0) actions.push(makeAction("follow_up", dueFollowUps, locale, pausedBlock));
  if (asNumber(signalRefresh?.due_count) > 0) {
    const blockedReason = pausedBlock || (cleanString(signalRefresh?.status) === "blocked" ? "provider_not_configured" : "");
    actions.push(makeAction("refresh_live_signals", signalRefresh.due_count, locale, blockedReason));
  }
  if (previewCount > 0) actions.push(makeAction("review_preview_leads", previewCount, locale, pausedBlock));
  if (candidateShortfall) {
    const blockedReason = pausedBlock || (activeSearch ? "active_search_running" : "");
    if (health.candidate_gap || blockedReason) actions.push(makeAction("run_sourcing", 1, locale, blockedReason));
  }

  return actions
    .sort((a, b) => ACTION_ORDER.indexOf(a.type) - ACTION_ORDER.indexOf(b.type))
    .slice(0, 5);
}

function buildHealth({ goals, counts, candidateGraph, leadPreview, outreachItems, sequenceAnalytics, inboxQueue, latestRun, searchTasks, signalRefresh }) {
  const graphSummary = summaryOf(candidateGraph);
  const previewCount = asNumber(summaryOf(leadPreview).item_count);
  const activeSearch = hasActiveSearch({ latestRun, searchTasks });
  const candidateTarget = Math.max(1, goals.contacted || goals.interested || goals.interview_ready || 0);
  const candidateGap = counts.candidates + previewCount < candidateTarget && !activeSearch;
  const contactGap = outreachItems.some((item) => !primaryEmail(item.contact_profile))
    || asNumber(graphSummary.contactable_count) < Math.min(counts.candidates, candidateTarget);
  const lowConfidenceContact = outreachItems.some((item) => hasLowConfidenceContact(item.contact_profile));
  const unapprovedDraft = outreachItems.some((item) => cleanString(item.status).toLowerCase() === "drafted");
  const replyGap = goals.replied > 0 ? counts.replied < goals.replied : counts.contacted > 0 && counts.replied === 0;
  const interestedCount = inboxReviewCandidateCount(inboxQueue) || counts.interested;
  const interviewGap = goals.interview_ready > 0
    ? counts.interview_ready < goals.interview_ready && interestedCount > 0
    : interestedCount > 0 && counts.interview_ready === 0;
  const needsHumanReply = inboxNeedsHumanReply(inboxQueue);
  const blocked = [];
  if (candidateGap) blocked.push("candidate_gap");
  if (contactGap) blocked.push("missing_contact");
  if (lowConfidenceContact) blocked.push("low_confidence_contact");
  if (unapprovedDraft) blocked.push("unapproved_draft");
  if (candidateGap && previewCount === 0) blocked.push("no_preview_leads");
  if (candidateGap && !activeSearch) blocked.push("no_active_search_task");
  if (replyGap) blocked.push("reply_gap");
  if (interviewGap) blocked.push("interview_gap");
  if (dueFollowUpCount({ sequenceAnalytics, outreachItems, inboxQueue }) > 0) blocked.push("due_follow_up");
  if (needsHumanReply) blocked.push("needs_human_reply");
  if (asNumber(signalRefresh?.due_count) > 0) blocked.push("stale_live_signals");
  return {
    candidate_gap: candidateGap,
    contact_gap: contactGap,
    reply_gap: replyGap,
    interview_gap: interviewGap,
    blocked_actions: [...new Set(blocked)],
  };
}

function validIso(value) {
  const clean = cleanString(value);
  if (!clean) return "";
  const date = new Date(clean);
  return Number.isFinite(date.getTime()) ? date.toISOString() : "";
}

function metricActionLabel(type, locale) {
  const zh = locale === "zh";
  const labels = {
    run_sourcing: zh ? "运行搜索" : "Run sourcing",
    review_preview_leads: zh ? "复核预览线索" : "Review preview leads",
    resolve_contacts: zh ? "解析联系方式" : "Resolve contacts",
    approve_or_send_outreach: zh ? "处理外联" : "Handle outreach",
    follow_up: zh ? "处理跟进" : "Handle follow-up",
    review_interested_candidates: zh ? "推进约面" : "Review interested candidates",
    refresh_live_signals: zh ? "刷新实时信号" : "Refresh live signals",
    agent_status: zh ? "Agent 状态" : "Agent status",
    approval_mode: zh ? "审批模式" : "Approval mode",
    capacity_goal: zh ? "容量目标" : "Capacity goals",
    client_delivery_visibility: zh ? "客户可见报告字段" : "Client-visible report fields",
  };
  return labels[type] ?? type;
}

function roleAgentMetricActivity(event, locale) {
  const eventType = cleanString(event?.event_type);
  const actionType = cleanString(event?.action_type);
  const actionStatus = cleanString(event?.action_status);
  const detail = cleanString(event?.detail);
  if (eventType === "manager_feedback") {
    const feedback = parseClientFeedbackDetail(detail);
    return {
      at: validIso(event.at),
      label: locale === "zh" ? "客户反馈" : "Manager feedback",
      context: feedback ? `${feedback.reviewer} · ${feedback.sentiment}` : detail,
      status: eventType,
    };
  }
  if (eventType === "settings_update") {
    return {
      at: validIso(event.at),
      label: locale === "zh" ? "Role Agent 设置更新" : "Role Agent settings update",
      context: metricActionLabel(actionType, locale),
      status: eventType,
    };
  }
  if (eventType === "next_action_execution") {
    const labels = {
      started: locale === "zh" ? "Role Agent 动作开始" : "Role Agent action started",
      succeeded: locale === "zh" ? "Role Agent 动作完成" : "Role Agent action completed",
      failed: locale === "zh" ? "Role Agent 动作失败" : "Role Agent action failed",
      blocked: locale === "zh" ? "Role Agent 动作阻塞" : "Role Agent action blocked",
    };
    const actionLabel = metricActionLabel(actionType, locale);
    return {
      at: validIso(event.at),
      label: labels[actionStatus] ?? (locale === "zh" ? "Role Agent 动作更新" : "Role Agent action update"),
      context: detail ? `${actionLabel} · ${detail}` : actionLabel,
      status: actionStatus ? `${eventType}:${actionStatus}` : eventType,
    };
  }
  if (eventType === "next_action_click") {
    return {
      at: validIso(event.at),
      label: locale === "zh" ? "Role Agent 下一步" : "Role Agent next action",
      context: metricActionLabel(actionType, locale),
      status: eventType,
    };
  }
  if (eventType === "panel_view") {
    return {
      at: validIso(event.at),
      label: locale === "zh" ? "Role Agent 面板查看" : "Role Agent panel viewed",
      context: "Role Agent",
      status: eventType,
    };
  }
  return null;
}

function roleAgentRecentEvents(roleAgentMetrics) {
  const direct = arrayOf(roleAgentMetrics?.recent_events);
  if (direct.length) return direct;
  return arrayOf(roleAgentMetrics?.role_agent_metrics?.recent_events);
}

function roleAgentExecutionLog(roleAgentMetrics) {
  const direct = arrayOf(roleAgentMetrics?.execution_log);
  if (direct.length) return direct;
  return arrayOf(roleAgentMetrics?.role_agent_metrics?.execution_log);
}

function roleAgentRuns(roleAgentMetrics) {
  const direct = arrayOf(roleAgentMetrics?.role_agent_runs);
  if (direct.length) return direct;
  return arrayOf(roleAgentMetrics?.role_agent_metrics?.role_agent_runs);
}

function parseClientFeedbackDetail(detail) {
  const clean = cleanString(detail);
  const match = clean.match(/^Client feedback:\s*([a-z_]+)(?:\s+by\s+(.+?))?\s+-\s+(.+)$/i);
  if (!match) return null;
  const rawNote = cleanString(match[3]);
  const hrefMatch = rawNote.match(/\((\/r\/[^)\s]+|https?:\/\/[^)]+)\)\s*$/i);
  const note = rawNote.replace(/\s+\((?:\/r\/|https?:\/\/)[^)]*\)$/i, "").trim();
  return {
    sentiment: cleanString(match[1]),
    reviewer: cleanString(match[2]) || "Hiring manager",
    note,
    report_href: cleanString(hrefMatch?.[1]),
  };
}

function clientFeedbackAudit(roleAgentMetrics) {
  const history = roleAgentRecentEvents(roleAgentMetrics)
    .filter((event) => cleanString(event?.event_type) === "manager_feedback" && cleanString(event?.action_type) === "client_delivery_feedback")
    .map((event) => {
      const feedback = parseClientFeedbackDetail(event.detail);
      if (!feedback) return null;
      return {
        ...feedback,
        at: validIso(event.at),
      };
    })
    .filter(Boolean)
    .sort((a, b) => String(b.at).localeCompare(String(a.at)));
  const count = Math.max(asNumber(roleAgentMetrics?.manager_feedback_count), history.length);
  return {
    count,
    latest: history.slice(0, 5),
    history,
  };
}

function reportHrefFromDetail(detail) {
  const clean = cleanString(detail);
  const hrefMatch = clean.match(/(\/r\/[^\s)]+|https?:\/\/[^\s)]+)/i);
  return cleanString(hrefMatch?.[1]);
}

function persistedClientDeliveryAuditEntries(events, locale) {
  const zh = locale === "zh";
  return arrayOf(events)
    .filter(isRecord)
    .map((event) => {
      const type = cleanString(event.event_type);
      const reportHref = cleanString(event.report_href) || reportHrefFromDetail(event.detail);
      const at = validIso(event.event_at || event.at || event.created_at);
      if (type === "report_view") {
        return {
          type: "report_view",
          label: zh ? "客户报告查看" : "Report viewed",
          actor: cleanString(event.actor) || (zh ? "客户" : "Client"),
          report_href: reportHref,
          detail: cleanString(event.detail) || reportHref,
          at,
        };
      }
      if (type === "feedback") {
        const sentiment = cleanString(event.sentiment);
        const note = cleanString(event.note);
        return {
          type: "feedback",
          label: zh ? "客户反馈" : "Client feedback",
          actor: cleanString(event.actor) || (zh ? "客户" : "Client"),
          report_href: reportHref,
          detail: [sentiment, note].filter(Boolean).join(": "),
          at,
        };
      }
      return null;
    })
    .filter((entry) => entry && (entry.report_href || entry.detail || entry.at));
}

function dedupeAuditTimeline(entries) {
  const seen = new Set();
  const rows = [];
  for (const entry of entries) {
    const key = [
      cleanString(entry.type),
      validIso(entry.at),
      cleanString(entry.report_href),
      cleanString(entry.detail),
    ].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(entry);
  }
  return rows;
}

function clientDeliveryAudit(roleAgentMetrics, locale, clientDeliveryAuditEvents = []) {
  const zh = locale === "zh";
  const events = roleAgentRecentEvents(roleAgentMetrics);
  const reportViews = events
    .filter((event) => cleanString(event?.event_type) === "client_report_view" && cleanString(event?.action_type) === "shareable_client_delivery_loop")
    .map((event) => {
      const reportHref = reportHrefFromDetail(event.detail);
      return {
        type: "report_view",
        label: zh ? "客户报告查看" : "Report viewed",
        actor: zh ? "客户" : "Client",
        report_href: reportHref,
        detail: reportHref,
        at: validIso(event.at),
      };
    })
    .filter((entry) => entry.report_href || entry.at);
  const feedback = clientFeedbackAudit(roleAgentMetrics).history.map((entry) => ({
    type: "feedback",
    label: zh ? "客户反馈" : "Client feedback",
    actor: entry.reviewer,
    report_href: entry.report_href,
    detail: `${entry.sentiment}: ${entry.note}`,
    at: entry.at,
  }));
  const persistedEntries = persistedClientDeliveryAuditEntries(clientDeliveryAuditEvents, locale);
  const combined = dedupeAuditTimeline([...persistedEntries, ...reportViews, ...feedback]);
  const reportViewCount = Math.max(
    asNumber(roleAgentMetrics?.client_report_views),
    combined.filter((entry) => entry.type === "report_view").length,
  );
  const feedbackCount = Math.max(
    asNumber(roleAgentMetrics?.manager_feedback_count),
    combined.filter((entry) => entry.type === "feedback").length,
  );
  const timeline = combined
    .sort((a, b) => String(b.at).localeCompare(String(a.at)))
    .slice(0, 12);
  const latestReportHref = timeline.find((entry) => entry.report_href)?.report_href || "";
  return {
    summary: zh
      ? `${reportViewCount} 次报告查看，${feedbackCount} 条客户反馈。`
      : `${reportViewCount} report views, ${feedbackCount} feedback events.`,
    counts: {
      report_views: reportViewCount,
      feedback: feedbackCount,
    },
    latest_report_href: latestReportHref,
    timeline,
  };
}

function followUpSummaryActivity(roleAgentMetrics, locale) {
  const summary = isRecord(roleAgentMetrics?.outreach_followup_summary) ? roleAgentMetrics.outreach_followup_summary : {};
  const at = validIso(summary.last_run_at);
  if (!at) return null;
  const scanned = asNumber(summary.scanned);
  const drafted = asNumber(summary.drafted);
  const failed = asNumber(summary.failed);
  const context = locale === "zh"
    ? `扫描 ${scanned}，生成 ${drafted} 个草稿${failed ? `，失败 ${failed}` : ""}`
    : `scanned ${scanned}, drafted ${drafted}${failed ? `, failed ${failed}` : ""}`;
  return {
    at,
    label: locale === "zh" ? "跟进调度" : "Follow-up scheduler",
    context,
    status: "followup_summary",
  };
}

function sequenceAuditActivityRows(item, locale) {
  const candidate = cleanString(item?.candidate_name) || "Candidate";
  const actionLabels = {
    saved: locale === "zh" ? "Sequence 已保存" : "Sequence saved",
    reviewed: locale === "zh" ? "Sequence 已复核" : "Sequence reviewed",
    skipped: locale === "zh" ? "Sequence 已跳过" : "Sequence skipped",
  };
  const rows = [];
  for (const message of arrayOf(item?.sequence_messages).filter(isRecord)) {
    for (const event of arrayOf(message.audit_events).filter(isRecord)) {
      const action = cleanString(event.action).toLowerCase();
      if (!actionLabels[action]) continue;
      rows.push({
        at: validIso(event.at),
        label: actionLabels[action],
        context: candidate,
        status: "sequence_audit",
      });
    }
  }
  return rows;
}

function candidateDisplayName(value) {
  return cleanString(value?.candidate_name || value?.canonical_name || value?.name || value?.full_name || value?.title) || "Candidate";
}

function candidateIdentityKey(value) {
  return cleanString(value?.candidate_id || value?.id || value?.canonical_name || value?.candidate_name || value?.name).toLowerCase();
}

function sourceTypeList(value) {
  return arrayOf(value?.source_types).map(cleanString).filter(Boolean);
}

function sequenceMessages(item) {
  return arrayOf(item?.sequence_messages).filter(isRecord);
}

function approvedFollowUpCount(item) {
  return sequenceMessages(item).filter((message) => {
    const step = Number(message.step);
    return (step === 2 || step === 3) && message.approved === true && cleanString(message.send_mode || "draft_for_review") === "draft_for_review";
  }).length;
}

function uniquePush(list, value) {
  const clean = cleanString(value);
  if (clean && !list.includes(clean)) list.push(clean);
}

function newerIso(current, next) {
  const cleanNext = validIso(next);
  if (!cleanNext) return current;
  const cleanCurrent = validIso(current);
  return !cleanCurrent || cleanNext > cleanCurrent ? cleanNext : cleanCurrent;
}

function maybeIso(value) {
  const clean = cleanString(value);
  if (!clean) return "";
  const date = new Date(clean);
  return Number.isFinite(date.getTime()) ? date.toISOString() : "";
}

function safeHttpsUrl(value) {
  const clean = cleanString(value);
  if (!clean) return "";
  try {
    const url = new URL(clean);
    if (url.protocol !== "https:" || !url.hostname || url.username || url.password) return "";
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

function signalConfidence(value) {
  const clean = cleanString(value).toLowerCase();
  if (["high", "medium", "low"].includes(clean)) return clean;
  return "unknown";
}

function signalFreshness({ at, expiresAt, now }) {
  const nowTime = new Date(maybeIso(now) || new Date().toISOString()).getTime();
  const expiresTime = maybeIso(expiresAt) ? new Date(maybeIso(expiresAt)).getTime() : 0;
  if (expiresTime && expiresTime <= nowTime) return "expired";
  const atTime = maybeIso(at) ? new Date(maybeIso(at)).getTime() : 0;
  if (atTime && nowTime - atTime > 1000 * 60 * 60 * 24 * 30) return "stale";
  return "fresh";
}

function normalizedSignal(row, fallbackType, now) {
  const source = cleanString(row.source || row.provider || row.type || fallbackType);
  const type = cleanString(row.type || fallbackType);
  const label = cleanString(row.label || row.summary || row.status || row.type);
  const at = maybeIso(row.at || row.observed_at || row.updated_at || row.refreshed_at || row.created_at);
  const expiresAt = maybeIso(row.expires_at || row.expiresAt);
  if (!label) return null;
  return {
    type,
    source,
    label,
    confidence: signalConfidence(row.confidence),
    freshness: signalFreshness({ at, expiresAt, now }),
    at,
    expires_at: expiresAt,
    source_url: row.persisted_live_signal === true
      ? safeHttpsUrl(row.source_url || row.sourceUrl)
      : "",
  };
}

function firstIso(row, keys) {
  for (const key of keys) {
    const value = maybeIso(row?.[key]);
    if (value) return value;
  }
  return "";
}

function signalSourceFromEvidence(row) {
  return cleanString(row.source || row.source_type || row.sourceType || row.provider || row.host || row.domain);
}

function evidenceSignalType(row) {
  const sourceType = cleanString(row.source_type || row.sourceType || row.type || row.source).toLowerCase();
  if (["blog", "article", "paper", "publication", "talk", "podcast", "interview", "media"].includes(sourceType)) return "recent_content";
  if (["github", "code", "project", "huggingface", "dataset", "benchmark", "community"].includes(sourceType)) return "candidate_activity";
  return "";
}

function inferredEvidenceSignals(candidate, now) {
  const directEvidence = [
    ...arrayOf(candidate?.source_evidence),
    ...arrayOf(candidate?.evidence_sources),
    ...arrayOf(candidate?.evidence_items),
    ...arrayOf(candidate?.evidence),
  ];
  const claimEvidence = arrayOf(candidate?.claims).filter(isRecord).flatMap((claim) => {
    return arrayOf(claim.evidence).filter(isRecord).map((row) => ({
      title: cleanString(row.title || row.label || row.summary) || cleanString(claim.claim),
      ...row,
    }));
  });
  return [...directEvidence, ...claimEvidence].filter(isRecord).map((row) => {
    const type = evidenceSignalType(row);
    const at = firstIso(row, ["at", "updated_at", "updatedAt", "published_at", "publishedAt", "created_at", "createdAt", "observed_at", "observedAt"]);
    const label = cleanString(row.label || row.title || row.summary || row.claim || row.description);
    if (!type || !at || !label) return null;
    return normalizedSignal({
      type,
      source: signalSourceFromEvidence(row) || type,
      label,
      confidence: row.confidence || "medium",
      at,
      expires_at: row.expires_at || row.expiresAt,
    }, type, now);
  }).filter(Boolean);
}

function inferredProfileFreshnessSignal(candidate, now) {
  const refreshedAt = firstIso(candidate, ["profile_updated_at", "profileUpdatedAt", "profile_refreshed_at", "profileRefreshedAt"]);
  if (!refreshedAt) return null;
  return normalizedSignal({
    type: "profile_freshness",
    source: "profile",
    label: "Profile refreshed",
    confidence: "medium",
    refreshed_at: refreshedAt,
  }, "profile_freshness", now);
}

function inferredCompanySignals(candidate, now) {
  return [
    ...arrayOf(candidate?.company_open_roles),
    ...arrayOf(candidate?.companyOpenRoles),
    ...arrayOf(candidate?.hiring_signals),
    ...arrayOf(candidate?.company_hiring_roles),
  ].filter(isRecord).map((row) => {
    const at = firstIso(row, ["at", "updated_at", "updatedAt", "posted_at", "postedAt", "created_at", "createdAt"]);
    const title = cleanString(row.title || row.role || row.job_title || row.label || row.summary);
    const company = cleanString(row.company || row.company_name || candidate?.current_company);
    if (!at || !title) return null;
    return normalizedSignal({
      type: "company_hiring",
      source: row.source || "company_hiring",
      label: company ? `${company} opened ${title}` : `Company opened ${title}`,
      confidence: row.confidence || "medium",
      at,
      expires_at: row.expires_at || row.expiresAt,
    }, "company_hiring", now);
  }).filter(Boolean);
}

function inferredTechStackSignals(candidate, now) {
  return [
    ...arrayOf(candidate?.tech_stack),
    ...arrayOf(candidate?.technologies),
    ...arrayOf(candidate?.skills),
  ].filter(isRecord).map((row) => {
    const at = firstIso(row, ["at", "updated_at", "updatedAt", "detected_at", "detectedAt", "observed_at", "observedAt"]);
    const name = cleanString(row.name || row.technology || row.skill || row.label || row.summary);
    if (!at || !name) return null;
    return normalizedSignal({
      type: "tech_stack",
      source: row.source || "profile",
      label: `Recent ${name} stack mention`,
      confidence: row.confidence || "medium",
      at,
      expires_at: row.expires_at || row.expiresAt,
    }, "tech_stack", now);
  }).filter(Boolean);
}

function dedupeSignals(signals) {
  const seen = new Set();
  const rows = [];
  for (const signal of signals) {
    if (!signal) continue;
    const key = `${signal.type}:${signal.source}:${signal.label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(signal);
  }
  return rows;
}

function liveSignalRows(candidate, now = new Date().toISOString()) {
  const rows = [];
  for (const signal of arrayOf(candidate?.live_signals).filter(isRecord)) {
    const observedAt = maybeIso(signal.observed_at || signal.observedAt);
    const expiresAt = maybeIso(signal.expires_at || signal.expiresAt);
    if (!observedAt || !expiresAt || new Date(expiresAt).getTime() <= new Date(now).getTime()) continue;
    rows.push(normalizedSignal({
      type: signal.type,
      source: signal.provider,
      label: signal.summary,
      confidence: signal.confidence,
      observed_at: observedAt,
      expires_at: expiresAt,
      source_url: signal.source_url,
      persisted_live_signal: true,
    }, "candidate_activity", now));
  }
  for (const signal of arrayOf(candidate?.activity_signals).filter(isRecord)) {
    rows.push(normalizedSignal(signal, "candidate_activity", now));
  }
  rows.push(...inferredEvidenceSignals(candidate, now));
  if (isRecord(candidate?.profile_freshness)) {
    rows.push(normalizedSignal({ source: "profile", label: "Profile refreshed", ...candidate.profile_freshness }, "profile_freshness", now));
  } else {
    rows.push(inferredProfileFreshnessSignal(candidate, now));
  }
  for (const signal of arrayOf(candidate?.company_signals).filter(isRecord)) {
    rows.push(normalizedSignal(signal, "company_hiring", now));
  }
  rows.push(...inferredCompanySignals(candidate, now));
  for (const signal of arrayOf(candidate?.tech_stack_signals).filter(isRecord)) {
    rows.push(normalizedSignal(signal, "tech_stack", now));
  }
  rows.push(...inferredTechStackSignals(candidate, now));
  for (const signal of arrayOf(candidate?.recent_updates).filter(isRecord)) {
    rows.push(normalizedSignal(signal, "recent_content", now));
  }
  return dedupeSignals(rows.filter(Boolean));
}

function effectiveLiveSignals(signals) {
  return arrayOf(signals).filter((signal) => signal.freshness !== "expired");
}

function liveSignalScore(signal) {
  if (signal.freshness === "expired") return 0;
  const base = signal.freshness === "stale" ? 5 : 15;
  if (signal.confidence === "high") return base;
  if (signal.confidence === "medium") return Math.max(5, base - 3);
  if (signal.confidence === "low") return Math.max(3, base - 7);
  return Math.max(5, base - 5);
}

function liveSignalRefreshTarget(candidate, now) {
  const signals = liveSignalRows(candidate, now);
  const staleSignals = signals.filter((signal) => signal.freshness === "stale");
  const expiredSignals = signals.filter((signal) => signal.freshness === "expired");
  if (staleSignals.length === 0 && expiredSignals.length === 0) return null;
  const status = expiredSignals.length > 0 ? "expired" : "stale";
  const lastSignalAt = latestIsoFrom(signals.map((signal) => signal.at));
  return {
    candidate_id: cleanString(candidate?.candidate_id || candidate?.id),
    candidate_name: candidateDisplayName(candidate),
    status,
    stale_count: staleSignals.length,
    expired_count: expiredSignals.length,
    last_signal_at: lastSignalAt,
    refresh_reason: status === "expired" ? "expired_live_signal" : "stale_live_signal",
  };
}

function signalRefreshLastRun(roleAgentMetrics) {
  const run = roleAgentRuns(roleAgentMetrics)
    .filter((entry) => cleanString(entry?.action_type) === "refresh_live_signals")
    .map(autopilotRun)
    .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))[0];
  if (run) return run;
  const entry = autopilotExecutionLog(roleAgentMetrics)
    .filter((item) => item.action_type === "refresh_live_signals")
    .sort((a, b) => String(b.at).localeCompare(String(a.at)))[0];
  return entry ? {
    run_id: "",
    action_type: entry.action_type,
    workflow_step: "refresh_live_signals",
    status: entry.status,
    detail: entry.detail,
    targets: entry.targets,
    result: entry.result,
    failed_items: entry.failed_items,
    retryable: entry.retryable,
    guardrail: "",
    started_at: "",
    finished_at: entry.at,
    updated_at: entry.at,
  } : null;
}

function buildSignalRefresh({ candidateGraph, roleAgentMetrics, now, locale }) {
  const zh = locale === "zh";
  const targets = arrayOf(candidateGraph?.candidates)
    .filter(isRecord)
    .map((candidate) => liveSignalRefreshTarget(candidate, now))
    .filter(Boolean)
    .sort((a, b) => {
      const statusOrder = { expired: 0, stale: 1 };
      return (statusOrder[a.status] ?? 2) - (statusOrder[b.status] ?? 2)
        || String(a.last_signal_at).localeCompare(String(b.last_signal_at));
    })
    .slice(0, 10);
  const staleCount = targets.reduce((total, target) => total + asNumber(target.stale_count), 0);
  const expiredCount = targets.reduce((total, target) => total + asNumber(target.expired_count), 0);
  const dueCount = targets.length;
  const providerStatus = cleanString(candidateGraph?.live_signal_provider_status).toLowerCase() === "ready"
    ? "ready"
    : "not_configured";
  const blocked = dueCount > 0 && providerStatus !== "ready";
  return {
    status: dueCount > 0 ? (blocked ? "blocked" : "due") : "idle",
    provider_status: providerStatus,
    due_count: dueCount,
    stale_count: staleCount,
    expired_count: expiredCount,
    summary: blocked
      ? (zh ? `${dueCount} 个候选人的实时信号需要刷新，但尚未配置 provider。` : `${dueCount} candidates have live signals due for refresh, but no provider is configured.`)
      : dueCount > 0
        ? (zh ? `${dueCount} 个候选人的实时信号需要刷新。` : `${dueCount} candidates have live signals due for refresh.`)
      : (zh ? "实时信号暂无刷新任务。" : "No live signal refresh is due."),
    targets,
    last_run: signalRefreshLastRun(roleAgentMetrics),
  };
}

function contactTimingFromScore(score, reason, locale) {
  const normalizedScore = Math.max(0, Math.min(100, Math.round(asNumber(score))));
  const urgency = normalizedScore >= 85 ? "now" : normalizedScore >= 40 ? "this_week" : "later";
  return {
    urgency,
    score: normalizedScore,
    reason: cleanString(reason) || (locale === "zh" ? "有可解释信号支持本周联系。" : "Signals support outreach this week."),
  };
}

function contactTimingFromCandidate(candidate, liveSignals, locale) {
  const zh = locale === "zh";
  const signalTypes = new Set(arrayOf(liveSignals).filter((signal) => signal.freshness !== "expired").map((signal) => cleanString(signal.type)));
  const hasActivity = signalTypes.has("candidate_activity") || signalTypes.has("recent_content");
  const hasProfile = signalTypes.has("profile_freshness");
  const hasCompany = signalTypes.has("company_hiring");
  const hasTech = signalTypes.has("tech_stack");
  let score = 0;
  if (hasActivity) score += 35;
  if (hasCompany) score += 25;
  if (hasTech) score += 25;
  if (hasProfile) score += 15;
  if (!liveSignals.length) {
    if (cleanString(candidate.readiness).toLowerCase() === "ready_for_outreach") score += 20;
    if (asNumber(candidate.contactability_score) >= 80) score += 20;
    if (cleanString(candidate.evidence_quality).toLowerCase() === "strong") score += 15;
  }
  if (hasActivity && hasCompany && hasTech) {
    return contactTimingFromScore(
      score,
      zh ? "近期活动、公司动态和技术栈变化同时出现。" : "Recent activity, company signal, and tech stack change create a contact window.",
      locale,
    );
  }
  if (liveSignals.length) {
    return contactTimingFromScore(
      score,
      zh ? "近期公开信号支持现在联系。" : "Recent live signals support outreach now.",
      locale,
    );
  }
  return contactTimingFromScore(
    score,
    zh ? "候选人可触达且证据较强，适合本周联系。" : "The candidate is contactable with strong evidence, suitable for this week.",
    locale,
  );
}

function contactTimingFromAction(type, locale) {
  const zh = locale === "zh";
  if (type === "review_interested_candidates") {
    return contactTimingFromScore(100, zh ? "候选人已经回复有意向，需要现在推进。" : "The candidate replied with interest and should be advanced now.", locale);
  }
  if (type === "follow_up") {
    return contactTimingFromScore(90, zh ? "跟进已经到期，需要现在处理。" : "The follow-up is due and should be handled now.", locale);
  }
  if (type === "resolve_contacts") {
    return contactTimingFromScore(70, zh ? "联系方式问题正在阻塞外联。" : "A contact issue is blocking outreach.", locale);
  }
  if (type === "retry_failed_outreach") {
    return contactTimingFromScore(85, zh ? "发送失败正在阻塞外联恢复。" : "A failed send is blocking outreach recovery.", locale);
  }
  if (type === "approve_or_send_outreach") {
    return contactTimingFromScore(60, zh ? "外联已准备好，适合本周推进。" : "Outreach is prepared and suitable this week.", locale);
  }
  if (type === "refresh_live_signals") {
    return contactTimingFromScore(45, zh ? "信号需要刷新后再判断联系窗口。" : "Signals should be refreshed before deciding the contact window.", locale);
  }
  return contactTimingFromScore(30, zh ? "可稍后复核。" : "Can be reviewed later.", locale);
}

function upsertWhyNowCandidate(map, source, patch) {
  const key = candidateIdentityKey(source);
  if (!key) return;
  const previous = map.get(key) ?? {
    candidate_id: cleanString(source?.candidate_id || source?.id || key),
    candidate_name: candidateDisplayName(source),
    score: 0,
    why_now: "",
    signals: [],
    signal_sources: [],
    signal_contract: [],
    contact_timing: contactTimingFromAction("review_preview_leads", "en"),
    next_best_action: "review_preview_leads",
    updated_at: "",
  };
  const signals = [...previous.signals];
  for (const signal of arrayOf(patch.signals).map(cleanString).filter(Boolean)) {
    uniquePush(signals, signal);
  }
  const signalSources = [...previous.signal_sources];
  for (const sourceName of arrayOf(patch.signal_sources)) {
    uniquePush(signalSources, sourceName);
  }
  const signalContract = [...previous.signal_contract];
  for (const signal of arrayOf(patch.signal_contract).filter(isRecord)) {
    const key = `${cleanString(signal.type)}:${cleanString(signal.source)}:${cleanString(signal.label)}`;
    if (key !== "::" && !signalContract.some((item) => `${item.type}:${item.source}:${item.label}` === key)) {
      signalContract.push({
        type: cleanString(signal.type),
        source: cleanString(signal.source),
        label: cleanString(signal.label),
        confidence: signalConfidence(signal.confidence),
        freshness: cleanString(signal.freshness) || "fresh",
        at: maybeIso(signal.at),
        expires_at: maybeIso(signal.expires_at),
        source_url: safeHttpsUrl(signal.source_url),
      });
    }
  }
  const updatedAt = validIso(patch.updated_at) || previous.updated_at;
  const score = previous.score + asNumber(patch.score);
  const nextBestAction = asNumber(patch.score) >= asNumber(previous.action_score) ? cleanString(patch.next_best_action) || previous.next_best_action : previous.next_best_action;
  const incomingTiming = isRecord(patch.contact_timing) ? patch.contact_timing : contactTimingFromAction(nextBestAction, "en");
  const contactTiming = asNumber(incomingTiming.score) >= asNumber(previous.contact_timing?.score) ? incomingTiming : previous.contact_timing;
  map.set(key, {
    ...previous,
    candidate_id: cleanString(source?.candidate_id || source?.id || previous.candidate_id),
    candidate_name: previous.candidate_name === "Candidate" ? candidateDisplayName(source) : previous.candidate_name,
    score,
    why_now: signals.slice(0, 2).join(" · "),
    signals,
    signal_sources: signalSources,
    signal_contract: signalContract.slice(0, 8),
    contact_timing: contactTiming,
    next_best_action: nextBestAction,
    action_score: Math.max(asNumber(previous.action_score), asNumber(patch.score)),
    updated_at: updatedAt,
  });
}

function buildWhyNow({ candidateGraph, outreachItems, inboxQueue, locale, now }) {
  const zh = locale === "zh";
  const rows = new Map();
  for (const candidate of arrayOf(candidateGraph?.candidates).filter(isRecord)) {
    const signals = [];
    const signalSources = [];
    let score = 0;
    let updatedAt = candidate.updated_at || candidate.profile_updated_at || candidate.last_seen_at;
    const liveSignals = liveSignalRows(candidate, now);
    const activeLiveSignals = effectiveLiveSignals(liveSignals);
    if (liveSignals.length) {
      score += Math.min(60, activeLiveSignals.reduce((total, signal) => total + liveSignalScore(signal), 0));
      for (const signal of activeLiveSignals) {
        uniquePush(signals, signal.label);
        uniquePush(signalSources, signal.source);
        updatedAt = newerIso(updatedAt, signal.at);
      }
    }
    if (cleanString(candidate.readiness).toLowerCase() === "ready_for_outreach") {
      score += 30;
      signals.push(zh ? "已可外联" : "Ready for outreach");
    }
    if (asNumber(candidate.contactability_score) >= 80) {
      score += 25;
      signals.push(zh ? "联系方式置信度高" : "High contactability");
    }
    if (cleanString(candidate.evidence_quality).toLowerCase() === "strong") {
      score += 15;
      signals.push(zh ? "证据强" : "Strong evidence");
    }
    const sourceTypes = sourceTypeList(candidate);
    if (sourceTypes.some((type) => ["github", "paper", "company_page", "personal_site"].includes(type))) {
      score += 10;
      signals.push(zh ? "有近期公开证据" : "Fresh public evidence");
    }
    if (validIso(candidate.updated_at || candidate.profile_updated_at || candidate.last_seen_at)) {
      score += 5;
      signals.push(zh ? "Profile 最近刷新" : "Profile recently refreshed");
    }
    if (score > 0) {
      upsertWhyNowCandidate(rows, candidate, {
        score,
        signals,
        signal_sources: signalSources,
        signal_contract: liveSignals,
        contact_timing: contactTimingFromCandidate(candidate, activeLiveSignals, locale),
        next_best_action: "approve_or_send_outreach",
        updated_at: updatedAt,
      });
    }
  }
  for (const item of outreachItems) {
    const status = itemStatus(item);
    if (cleanString(item.send_error) && status === "approved") {
      upsertWhyNowCandidate(rows, item, {
        score: 90,
        signals: [zh ? "发送失败待恢复" : "Failed send needs recovery"],
        contact_timing: contactTimingFromAction("retry_failed_outreach", locale),
        next_best_action: "retry_failed_outreach",
        updated_at: item.updated_at,
      });
    } else if (status === "follow_up_due") {
      upsertWhyNowCandidate(rows, item, {
        score: 80,
        signals: [zh ? "跟进已到期" : "Follow-up is due"],
        contact_timing: contactTimingFromAction("follow_up", locale),
        next_best_action: "follow_up",
        updated_at: item.updated_at || item.next_follow_up_at,
      });
    } else if (["drafted", "approved"].includes(status)) {
      upsertWhyNowCandidate(rows, item, {
        score: 35,
        signals: [zh ? "外联已准备" : "Outreach is prepared"],
        contact_timing: contactTimingFromAction("approve_or_send_outreach", locale),
        next_best_action: "approve_or_send_outreach",
        updated_at: item.updated_at,
      });
    } else if (["bounced", "failed"].includes(status)) {
      upsertWhyNowCandidate(rows, item, {
        score: 50,
        signals: [zh ? "联系方式或发送失败" : "Contact or send failed"],
        contact_timing: contactTimingFromAction("resolve_contacts", locale),
        next_best_action: "resolve_contacts",
        updated_at: item.updated_at,
      });
    }
  }
  for (const item of [...arrayOf(inboxQueue?.items), ...arrayOf(inboxQueue?.interested_candidates)].filter(isRecord)) {
    const classification = cleanString(item.classification).toLowerCase();
    const readiness = cleanString(item.readiness).toLowerCase();
    if (classification === "interested" || readiness === "needs_scheduling" || readiness === "interview_ready") {
      upsertWhyNowCandidate(rows, item, {
        score: 120,
        signals: [zh ? "候选人已表达兴趣" : "Interested reply", zh ? "可以推进约面" : "Ready to move toward interview"],
        contact_timing: contactTimingFromAction("review_interested_candidates", locale),
        next_best_action: "review_interested_candidates",
        updated_at: item.updated_at,
      });
    } else if (cleanString(item.next_action).toLowerCase() === "follow_up") {
      upsertWhyNowCandidate(rows, item, {
        score: 70,
        signals: [zh ? "Inbox 需要跟进" : "Inbox follow-up needed"],
        contact_timing: contactTimingFromAction("follow_up", locale),
        next_best_action: "follow_up",
        updated_at: item.updated_at,
      });
    }
  }
  return [...rows.values()]
    .map((row) => {
      const next = { ...row };
      delete next.action_score;
      return next;
    })
    .filter((row) => row.why_now)
    .sort((a, b) => b.score - a.score || String(b.updated_at).localeCompare(String(a.updated_at)))
    .slice(0, 5);
}

function autopilotStage(type, label, count, cta, status, extra = {}) {
  return {
    type,
    label,
    count,
    cta,
    status,
    ...extra,
  };
}

function autopilotTarget(item) {
  return {
    id: cleanString(item?.id || item?.candidate_id || item?.outreach_thread_id),
    candidate_name: candidateDisplayName(item),
  };
}

function autopilotWorkflowStep({ type, label, items, canAutoExecute, guardrail }) {
  const targets = items.map(autopilotTarget).filter((target) => target.id || target.candidate_name).slice(0, 5);
  const status = items.length === 0 ? "done" : canAutoExecute ? "ready" : "blocked";
  return {
    type,
    label,
    count: items.length,
    status,
    can_auto_execute: Boolean(canAutoExecute),
    guardrail: cleanString(guardrail),
    targets,
  };
}

function buildAutopilotWorkflow({ missingContacts, approvalReady, sendReady, failedSends, followUpDue, autoEligibleFollowUps, settings, locale }) {
  const zh = locale === "zh";
  const autoEligibleFollowUpIds = new Set(autoEligibleFollowUps.map((item) => cleanString(item.id || item.candidate_id || item.outreach_thread_id)).filter(Boolean));
  const followUpCanAutoExecute = followUpDue.length > 0
    && autoEligibleFollowUps.length > 0
    && followUpDue.every((item) => autoEligibleFollowUpIds.has(cleanString(item.id || item.candidate_id || item.outreach_thread_id)));
  const steps = [
    autopilotWorkflowStep({
      type: "resolve_contacts",
      label: zh ? "解析联系方式" : "Resolve contacts",
      items: missingContacts,
      canAutoExecute: missingContacts.length > 0,
    }),
    autopilotWorkflowStep({
      type: "approve_drafts",
      label: zh ? "批准草稿" : "Approve drafts",
      items: approvalReady,
      canAutoExecute: approvalReady.length > 0,
    }),
    autopilotWorkflowStep({
      type: "send_first_email",
      label: zh ? "发送首封" : "Send first email",
      items: sendReady,
      canAutoExecute: false,
      guardrail: sendReady.length > 0 ? (zh ? "首封邮件仍需要人工确认发送。" : "First-email send still requires manual Gmail confirmation.") : "",
    }),
    autopilotWorkflowStep({
      type: "retry_failures",
      label: zh ? "恢复失败" : "Retry failures",
      items: failedSends,
      canAutoExecute: failedSends.length > 0,
    }),
    autopilotWorkflowStep({
      type: "follow_up",
      label: zh ? "跟进" : "Follow up",
      items: followUpDue,
      canAutoExecute: followUpCanAutoExecute,
      guardrail: followUpDue.length > 0 && !followUpCanAutoExecute
        ? (zh ? "只有已批准的跟进草稿符合自动跟进条件。" : "Only approved follow-up drafts are auto-eligible.")
        : "",
    }),
  ];
  const actionableSteps = steps.filter((step) => step.count > 0);
  const nextStep = actionableSteps.find((step) => step.status === "ready") || actionableSteps[0] || null;
  const blockedCount = actionableSteps.filter((step) => step.status === "blocked").length;
  return {
    mode: cleanString(settings.approval_mode) || "manual_all",
    next_step: nextStep?.type || "",
    blocked_count: blockedCount,
    summary: zh
      ? `${actionableSteps.length} 个自动推进步骤，${blockedCount} 个受保护条件限制。`
      : `${actionableSteps.length} autopilot steps, ${blockedCount} blocked by guardrails.`,
    steps,
  };
}

function buildAutopilotPath({ outreachItems, settings, locale }) {
  const zh = locale === "zh";
  const missingContacts = outreachItems.filter((item) => !primaryEmail(item.contact_profile) && !["sent", "contacted", "replied", "interested", "interview_ready", "hired", "rejected", "stopped"].includes(itemStatus(item)));
  const approvalReady = outreachItems.filter((item) => itemStatus(item) === "drafted" && primaryEmail(item.contact_profile));
  const sendReady = outreachItems.filter((item) => itemStatus(item) === "approved" && primaryEmail(item.contact_profile) && !cleanString(item.send_error));
  const failedSends = outreachItems.filter((item) => cleanString(item.send_error));
  const followUpDue = outreachItems.filter((item) => itemStatus(item) === "follow_up_due");
  const autoEligibleFollowUps = settings.auto_follow_up_only
    ? followUpDue.filter((item) => primaryEmail(item.contact_profile) && approvedFollowUpCount(item) > 0)
    : [];
  const actionableCount = missingContacts.length + approvalReady.length + sendReady.length + followUpDue.length;
  const status = failedSends.length > 0 ? "needs_recovery" : actionableCount > 0 ? "ready" : "idle";
  const summary = zh
    ? `${missingContacts.length} 个待解析联系方式，${approvalReady.length} 个待批准，${sendReady.length} 个待发送，${failedSends.length} 个可恢复失败。`
    : `${missingContacts.length} contact gaps, ${approvalReady.length} approvals, ${sendReady.length} ready to send, ${failedSends.length} recovery items.`;

  return {
    status,
    summary,
    recoverable_count: failedSends.length,
    workflow: buildAutopilotWorkflow({ missingContacts, approvalReady, sendReady, failedSends, followUpDue, autoEligibleFollowUps, settings, locale }),
    stages: [
      autopilotStage(
        "resolve_contacts",
        zh ? "解析联系方式" : "Resolve contacts",
        missingContacts.length,
        zh ? "批量解析" : "Bulk resolve",
        missingContacts.length > 0 ? "ready" : "done",
      ),
      autopilotStage(
        "approve_drafts",
        zh ? "批准草稿" : "Approve drafts",
        approvalReady.length,
        zh ? "批准可发送草稿" : "Approve ready drafts",
        approvalReady.length > 0 ? "ready" : "done",
      ),
      autopilotStage(
        "send_first_email",
        zh ? "发送首封" : "Send first email",
        sendReady.length,
        zh ? "打开 Gmail 发送" : "Open Gmail send",
        sendReady.length > 0 ? "ready" : "done",
      ),
      autopilotStage(
        "retry_failures",
        zh ? "恢复失败" : "Retry failures",
        failedSends.length,
        zh ? "重试失败发送" : "Retry failed sends",
        failedSends.length > 0 ? "ready" : "done",
      ),
      autopilotStage(
        "follow_up",
        zh ? "跟进" : "Follow up",
        followUpDue.length,
        zh ? "复核跟进" : "Review follow-ups",
        followUpDue.length > 0 ? "ready" : "done",
        { auto_eligible_count: autoEligibleFollowUps.length },
      ),
    ],
  };
}

function recoveryRow(type, at, candidateName, label, status) {
  return {
    type,
    at: validIso(at),
    candidate_name: cleanString(candidateName) || "Candidate",
    label,
    status,
  };
}

function autopilotLastRun(roleAgentMetrics) {
  const executionLog = autopilotExecutionLog(roleAgentMetrics);
  if (executionLog.length > 0) {
    const entry = executionLog[0];
    return {
      action_type: entry.action_type,
      status: entry.status,
      detail: entry.detail,
      at: entry.at,
    };
  }
  const event = roleAgentRecentEvents(roleAgentMetrics).find((entry) => {
    return cleanString(entry?.event_type) === "next_action_execution"
      && cleanString(entry?.action_type) === "retry_failed_outreach"
      && ["succeeded", "failed"].includes(cleanString(entry?.action_status));
  });
  if (!event) return null;
  return {
    action_type: "retry_failed_outreach",
    status: cleanString(event.action_status),
    detail: cleanString(event.detail),
    at: validIso(event.at),
  };
}

function executionLogEntry(entry) {
  const failedItems = arrayOf(entry?.failed_items).filter(isRecord).map((item) => ({
    id: cleanString(item.id),
    candidate_name: cleanString(item.candidate_name || item.name) || "Candidate",
    error: cleanString(item.error || item.reason),
  })).filter((item) => item.id || item.candidate_name || item.error).slice(0, 10);
  const targets = arrayOf(entry?.targets).filter(isRecord).map((target) => ({
    id: cleanString(target.id),
    candidate_name: cleanString(target.candidate_name || target.name) || "Candidate",
  })).filter((target) => target.id || target.candidate_name).slice(0, 10);
  return {
    action_type: cleanString(entry?.action_type),
    status: cleanString(entry?.status || entry?.action_status),
    detail: cleanString(entry?.detail),
    targets,
    result: isRecord(entry?.result) ? entry.result : {},
    failed_items: failedItems,
    retryable: Boolean(entry?.retryable) || failedItems.length > 0,
    at: validIso(entry?.at),
  };
}

function autopilotExecutionLog(roleAgentMetrics) {
  return roleAgentExecutionLog(roleAgentMetrics)
    .map(executionLogEntry)
    .filter((entry) => entry.action_type && entry.status)
    .sort((a, b) => String(b.at).localeCompare(String(a.at)))
    .slice(0, 5);
}

function autopilotRun(entry) {
  const failedItems = arrayOf(entry?.failed_items).filter(isRecord).map((item) => ({
    id: cleanString(item.id),
    candidate_name: cleanString(item.candidate_name || item.name) || "Candidate",
    error: cleanString(item.error || item.reason),
  })).filter((item) => item.id || item.candidate_name || item.error).slice(0, 10);
  const targets = arrayOf(entry?.targets).filter(isRecord).map((target) => ({
    id: cleanString(target.id),
    candidate_name: cleanString(target.candidate_name || target.name) || "Candidate",
  })).filter((target) => target.id || target.candidate_name).slice(0, 10);
  return {
    run_id: cleanString(entry?.run_id),
    action_type: cleanString(entry?.action_type),
    workflow_step: cleanString(entry?.workflow_step),
    status: cleanString(entry?.status || entry?.action_status),
    detail: cleanString(entry?.detail),
    targets,
    result: isRecord(entry?.result) ? entry.result : {},
    failed_items: failedItems,
    retryable: Boolean(entry?.retryable) || failedItems.length > 0,
    guardrail: cleanString(entry?.guardrail),
    started_at: validIso(entry?.started_at),
    finished_at: validIso(entry?.finished_at),
    updated_at: validIso(entry?.updated_at),
  };
}

function autopilotRuns(roleAgentMetrics) {
  return roleAgentRuns(roleAgentMetrics)
    .map(autopilotRun)
    .filter((entry) => entry.run_id && entry.action_type && entry.status)
    .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))
    .slice(0, 5);
}

function buildAutopilotRecovery({ outreachItems, roleAgentMetrics, locale }) {
  const zh = locale === "zh";
  const counts = {
    contacts_resolved: 0,
    drafts_saved: 0,
    sent: 0,
    failed: 0,
  };
  const history = [];
  for (const item of outreachItems) {
    const candidateName = cleanString(item.candidate_name) || "Candidate";
    const resolution = isRecord(item.contact_profile?.resolution) ? item.contact_profile.resolution : {};
    if (cleanString(resolution.status).toLowerCase() === "resolved") {
      counts.contacts_resolved += 1;
      history.push(recoveryRow(
        "contact_resolved",
        resolution.searched_at,
        candidateName,
        zh ? "联系方式已解析" : "Contact resolved",
        cleanString(resolution.provider) || "resolved",
      ));
    }
    if (validIso(item.gmail_draft_updated_at)) {
      counts.drafts_saved += 1;
      history.push(recoveryRow(
        "draft_saved",
        item.gmail_draft_updated_at,
        candidateName,
        zh ? "Gmail 草稿已保存" : "Gmail draft saved",
        "draft_saved",
      ));
    }
    if (validIso(item.sent_at || item.last_contacted_at)) {
      counts.sent += 1;
      history.push(recoveryRow(
        "first_email_sent",
        item.sent_at || item.last_contacted_at,
        candidateName,
        zh ? "首封已发送" : "First email sent",
        itemStatus(item) || "sent",
      ));
    }
    if (cleanString(item.send_error)) {
      counts.failed += 1;
      history.push(recoveryRow(
        "send_failed",
        item.updated_at || item.gmail_draft_updated_at || item.last_contacted_at,
        candidateName,
        zh ? "发送失败待恢复" : "Send failed; recovery needed",
        cleanString(item.send_error),
      ));
    }
  }
  const summary = zh
    ? `${counts.contacts_resolved} 个联系方式已解析，${counts.drafts_saved} 个草稿已保存，${counts.sent} 个已发送，${counts.failed} 个失败待恢复。`
    : `${counts.contacts_resolved} contacts resolved, ${counts.drafts_saved} drafts saved, ${counts.sent} sent, ${counts.failed} failed.`;
  const executionLog = autopilotExecutionLog(roleAgentMetrics);
  const retryableItems = executionLog
    .filter((entry) => entry.retryable)
    .flatMap((entry) => entry.failed_items.map((item) => ({
      action_type: entry.action_type,
      candidate_name: item.candidate_name,
      error: item.error,
      at: entry.at,
    })))
    .slice(0, 10);
  return {
    summary,
    counts,
    last_run: autopilotLastRun(roleAgentMetrics),
    runs: autopilotRuns(roleAgentMetrics),
    execution_log: executionLog,
    retryable_items: retryableItems,
    history: history
      .filter((row) => row.at)
      .sort((a, b) => String(b.at).localeCompare(String(a.at)))
      .slice(0, 6),
  };
}

function inboxPipelineActionFor(type, item) {
  const action = type === "stop_sequence"
    ? "stop"
    : type === "follow_up"
      ? "save_follow_up_draft"
      : type === "reply_with_details"
        ? "reply"
        : cleanString(item?.next_action);
  const actionTargetId = cleanString(item?.outreach_thread_id || item?.thread_id);
  const actionStatus = cleanString(item?.action_status).toLowerCase() || "pending";
  return {
    action,
    action_target_id: actionTargetId,
    can_apply: Boolean(actionTargetId && action && ["pending", "draft_saved"].includes(actionStatus)),
  };
}

function inboxPipelineHandoff(item) {
  const packet = isRecord(item?.scheduling_packet) ? item.scheduling_packet : {};
  const title = cleanString(packet.handoff_title || packet.candidate_summary || item?.action_label);
  const candidateReply = cleanString(item?.saved_scheduling_draft || packet.candidate_reply || packet.suggested_scheduling_message);
  const managerNote = cleanString(packet.hiring_manager_note || packet.candidate_summary || packet.verified_summary);
  if (!title && !candidateReply && !managerNote) return null;
  return {
    title,
    candidate_reply: candidateReply,
    manager_note: managerNote,
  };
}

function inboxPipelineCalendarStatus(item) {
  const source = isRecord(item?.calendar_availability) ? item.calendar_availability : {};
  const status = cleanString(source.status || source.skipped_reason || (item?.saved_scheduling_draft ? "draft_saved" : ""));
  if (!status) return null;
  return {
    status,
    slots_count: asNumber(source.slots_count ?? source.available_slots_count ?? source.slots?.length),
    last_checked_at: validIso(source.last_checked_at || source.checked_at || source.updated_at),
  };
}

function inboxPipelineInterviewEvent(item) {
  const source = isRecord(item?.interview_event) ? item.interview_event : {};
  const status = cleanString(source.status || source.event_status || (cleanString(item?.action_status).toLowerCase() === "scheduled" ? "confirmed" : ""));
  const startsAt = validIso(source.starts_at || source.start_time || source.scheduled_at);
  if (!status && !startsAt) return null;
  return {
    status: status || "confirmed",
    starts_at: startsAt,
    calendar_event_id: cleanString(source.calendar_event_id || source.event_id),
  };
}

function inboxPipelineInterviewEventUpdatedAt(item) {
  const source = isRecord(item?.interview_event) ? item.interview_event : {};
  return validIso(source.updated_at || source.updatedAt || source.created_at || source.createdAt || item?.updated_at);
}

function slotFrom(value) {
  if (isRecord(value)) {
    const startsAt = validIso(value.starts_at || value.start || value.start_time);
    const endsAt = validIso(value.ends_at || value.end || value.end_time);
    if (!startsAt && !endsAt) return null;
    return {
      starts_at: startsAt,
      ends_at: endsAt,
      label: cleanString(value.label),
    };
  }
  const startsAt = validIso(value);
  return startsAt ? { starts_at: startsAt, ends_at: "", label: "" } : null;
}

function timeWindowsFrom(value) {
  return arrayOf(value).map(slotFrom).filter(Boolean).slice(0, 5);
}

function inboxPipelineNegotiationState(item, locale) {
  const zh = locale === "zh";
  const source = isRecord(item?.scheduling_negotiation)
    ? item.scheduling_negotiation
    : isRecord(item?.time_negotiation)
      ? item.time_negotiation
      : {};
  const candidateWindows = timeWindowsFrom(source.candidate_windows || source.candidateWindows || item?.candidate_time_windows);
  const managerWindows = timeWindowsFrom(source.manager_windows || source.managerWindows || item?.manager_time_windows);
  const proposedSlot = slotFrom(source.proposed_slot || source.proposedSlot || source.selected_slot || source.selectedSlot);
  const candidateConfirmedSlot = slotFrom(source.candidate_confirmed_slot || source.candidateConfirmedSlot);
  const managerConfirmedSlot = slotFrom(source.manager_confirmed_slot || source.managerConfirmedSlot);
  const lastActor = cleanString(source.last_actor || source.lastActor).toLowerCase();
  let status = "";
  if (candidateConfirmedSlot && managerConfirmedSlot) {
    status = "ready_to_confirm";
  } else if (proposedSlot && lastActor === "candidate") {
    status = "waiting_on_manager";
  } else if (proposedSlot && lastActor === "manager") {
    status = "waiting_on_candidate";
  } else if (proposedSlot && candidateWindows.length && managerWindows.length) {
    status = "ready_to_confirm";
  } else if (candidateWindows.length && !managerWindows.length) {
    status = "waiting_on_manager";
  } else if (managerWindows.length && !candidateWindows.length) {
    status = "waiting_on_candidate";
  } else if (candidateWindows.length && managerWindows.length) {
    status = "aligning_times";
  }
  if (!status) return null;
  const labels = {
    waiting_on_candidate: zh ? "等待候选人确认时间" : "Waiting on candidate",
    waiting_on_manager: zh ? "等待 manager 确认时间" : "Waiting on manager",
    aligning_times: zh ? "正在对齐双方时间" : "Aligning times",
    ready_to_confirm: zh ? "双方时间已对齐" : "Ready to confirm",
  };
  return {
    status,
    label: labels[status] || status,
    candidate_windows: candidateWindows,
    manager_windows: managerWindows,
    proposed_slot: proposedSlot,
    updated_at: validIso(source.updated_at || source.updatedAt || item?.updated_at),
  };
}

function inboxPipelineSchedulingState(item, locale) {
  const zh = locale === "zh";
  const calendar = inboxPipelineCalendarStatus(item);
  const event = inboxPipelineInterviewEvent(item);
  const negotiation = inboxPipelineNegotiationState(item, locale);
  const readiness = cleanString(item?.readiness).toLowerCase();
  const actionStatus = cleanString(item?.action_status).toLowerCase();
  const hasDraft = Boolean(cleanString(item?.saved_scheduling_draft));
  const recoveryStatuses = new Set(["calendar_scope_missing", "calendar_freebusy_failed", "calendar_disconnected", "calendar_error"]);
  let status = "needs_scheduling";
  if (event?.status === "canceled" || actionStatus === "canceled") {
    status = "canceled";
  } else if (event?.status === "rescheduled" || actionStatus === "rescheduled") {
    status = "rescheduled";
  } else if (event?.status === "confirmed" || actionStatus === "scheduled") {
    status = "confirmed";
  } else if (actionStatus === "confirmed") {
    status = "confirmed";
  } else if (calendar && recoveryStatuses.has(calendar.status)) {
    status = "needs_recovery";
  } else if (negotiation) {
    status = negotiation.status;
  } else if (actionStatus === "slot_held" || calendar?.status === "slot_held") {
    status = "slot_held";
  } else if (hasDraft || calendar?.status === "draft_saved") {
    status = "draft_saved";
  } else if (readiness === "interview_ready" || actionStatus === "interview_ready") {
    status = "interview_ready";
  }
  const labels = {
    needs_scheduling: zh ? "待约面" : "Needs scheduling",
    draft_saved: zh ? "约面草稿已保存" : "Scheduling draft saved",
    slot_held: zh ? "已暂留时间" : "Slot held",
    rescheduled: zh ? "面试已改期" : "Interview rescheduled",
    interview_ready: zh ? "可约面" : "Interview-ready",
    confirmed: zh ? "面试已确认" : "Interview confirmed",
    canceled: zh ? "面试已取消" : "Interview canceled",
    needs_recovery: zh ? "约面需恢复" : "Scheduling needs recovery",
    waiting_on_candidate: zh ? "等待候选人确认时间" : "Waiting on candidate",
    waiting_on_manager: zh ? "等待 manager 确认时间" : "Waiting on manager",
    aligning_times: zh ? "正在对齐双方时间" : "Aligning times",
    ready_to_confirm: zh ? "双方时间已对齐" : "Ready to confirm",
  };
  return {
    status,
    label: labels[status] || status,
    event,
  };
}

function inboxPipelineRecoveryNextStep(item, locale) {
  const zh = locale === "zh";
  const schedulingState = inboxPipelineSchedulingState(item, locale);
  if (schedulingState.status === "confirmed") {
    return zh ? "面试已确认；把确认状态同步到客户交付页。" : "Interview confirmed; sync the confirmation into client delivery.";
  }
  if (schedulingState.status === "rescheduled") {
    return zh ? "面试已改期；确认客户交付页展示最新时间。" : "Interview rescheduled; make sure client delivery shows the latest time.";
  }
  if (schedulingState.status === "canceled") {
    return zh ? "面试已取消；准备重新约面或停止推进。" : "Interview canceled; reschedule or stop progression.";
  }
  if (schedulingState.status === "slot_held") {
    return zh ? "确认暂留时间，或把约面草稿发给候选人。" : "Confirm the held slot or send the scheduling draft to the candidate.";
  }
  if (schedulingState.status === "ready_to_confirm") {
    return zh ? "双方时间已对齐；创建日历事件并发送确认。" : "Times are aligned; create the calendar event and send confirmation.";
  }
  if (schedulingState.status === "waiting_on_candidate") {
    return zh ? "把 manager 可约时间发给候选人并等待确认。" : "Share manager availability with the candidate and wait for confirmation.";
  }
  if (schedulingState.status === "waiting_on_manager") {
    return zh ? "复核候选人可约时间，并请 manager 选择可确认时间。" : "Review candidate availability and ask the manager to pick a confirmable slot.";
  }
  if (schedulingState.status === "aligning_times") {
    return zh ? "对齐候选人与 manager 的时间窗口，选出可确认 slot。" : "Align candidate and manager time windows and pick a confirmable slot.";
  }
  const calendar = inboxPipelineCalendarStatus(item);
  if (cleanString(item?.saved_scheduling_draft)) {
    return zh ? "复核已保存的约面草稿，并分享可约时间。" : "Review saved scheduling draft and share calendar options.";
  }
  if (calendar?.status === "calendar_scope_missing") {
    return zh ? "重新授权 Google Calendar 后生成可约时间草稿。" : "Reconnect Google Calendar, then generate a scheduling draft.";
  }
  if (calendar?.status === "calendar_freebusy_failed") {
    return zh ? "重试读取 Calendar 可用时间，或手动提供候选时间。" : "Retry Calendar availability or provide manual time windows.";
  }
  return zh ? "准备约面交付包，并确认下一步沟通。" : "Prepare the interview handoff and confirm the next message.";
}

function timelineEvent(type, at, label, detail, status) {
  const eventAt = validIso(at);
  if (!eventAt) return null;
  return {
    type,
    at: eventAt,
    label: cleanString(label),
    detail: cleanString(detail),
    status: cleanString(status),
  };
}

function inboxPipelineActivityTimeline(item, locale) {
  const zh = locale === "zh";
  const rows = [];
  const schedulingState = inboxPipelineSchedulingState(item, locale);
  const negotiation = inboxPipelineNegotiationState(item, locale);
  const calendar = inboxPipelineCalendarStatus(item);
  const event = inboxPipelineInterviewEvent(item);
  const classification = cleanString(item?.classification).toLowerCase();
  if (classification === "interested") {
    rows.push(timelineEvent(
      "interested_reply",
      item?.received_at || item?.last_message_at || item?.updated_at,
      zh ? "候选人有意向" : "Interested reply",
      item?.classification_reason || item?.reply_excerpt || item?.snippet,
      "interested",
    ));
  }
  if (cleanString(item?.saved_scheduling_draft)) {
    rows.push(timelineEvent(
      "scheduling_draft_saved",
      item?.scheduling_draft_saved_at || item?.gmail_draft_updated_at || item?.updated_at,
      zh ? "约面草稿已保存" : "Scheduling draft saved",
      item?.saved_scheduling_draft,
      "draft_saved",
    ));
  }
  if (negotiation) {
    const candidateCount = negotiation.candidate_windows.length;
    const managerCount = negotiation.manager_windows.length;
    rows.push(timelineEvent(
      "time_negotiation",
      negotiation.updated_at || item?.updated_at,
      negotiation.label,
      zh
        ? `${candidateCount} 个候选人时间，${managerCount} 个 manager 时间。`
        : `${candidateCount} candidate windows, ${managerCount} manager windows.`,
      negotiation.status,
    ));
  }
  if (calendar?.status === "slot_held" || schedulingState.status === "slot_held") {
    rows.push(timelineEvent(
      "slot_held",
      calendar?.last_checked_at || item?.slot_held_at || item?.updated_at,
      zh ? "已暂留时间" : "Slot held",
      calendar?.slots_count ? (zh ? `${calendar.slots_count} 个可约时间。` : `${calendar.slots_count} available slots.`) : "",
      "slot_held",
    ));
  }
  if (event) {
    const eventLabels = {
      confirmed: zh ? "面试已确认" : "Interview confirmed",
      rescheduled: zh ? "面试已改期" : "Interview rescheduled",
      canceled: zh ? "面试已取消" : "Interview canceled",
    };
    rows.push(timelineEvent(
      event.status === "rescheduled" ? "interview_rescheduled" : event.status === "canceled" ? "interview_canceled" : "interview_confirmed",
      inboxPipelineInterviewEventUpdatedAt(item),
      eventLabels[event.status] || event.status,
      event.starts_at ? (zh ? `面试时间 ${event.starts_at}` : `Interview time ${event.starts_at}`) : event.calendar_event_id,
      event.status,
    ));
  }
  return rows
    .filter(Boolean)
    .sort((a, b) => String(b.at).localeCompare(String(a.at)))
    .slice(0, 8);
}

function inboxPipelineItem(item, { type = "", cta = "", detail = "", locale }) {
  const zh = locale === "zh";
  const candidateName = candidateDisplayName(item);
  const itemDetail = cleanString(detail)
    || cleanString(item?.saved_scheduling_draft)
    || cleanString(item?.reply_draft)
    || cleanString(item?.suggested_reply)
    || cleanString(item?.action_label)
    || cleanString(item?.classification_reason)
    || (zh ? "等待下一步处理。" : "Waiting for the next action.");
  return {
    id: cleanString(item?.id || item?.candidate_id || item?.gmail_thread_id || candidateName),
    candidate_name: candidateName,
    detail: itemDetail,
    cta,
    status: cleanString(item?.action_status || item?.readiness || item?.classification || item?.status),
    updated_at: validIso(item?.updated_at || item?.received_at || item?.last_message_at),
    ...inboxPipelineActionFor(type, item),
    handoff: inboxPipelineHandoff(item),
    calendar_status: inboxPipelineCalendarStatus(item),
    scheduling_state: inboxPipelineSchedulingState(item, locale),
    negotiation_state: inboxPipelineNegotiationState(item, locale),
    activity_timeline: inboxPipelineActivityTimeline(item, locale),
    recovery_next_step: inboxPipelineRecoveryNextStep(item, locale),
    message_history: isRecord(item?.message_history) ? item.message_history : {
      summary: { outbound: 0, inbound: 0, system: 0, total: 0 },
      messages: [],
    },
    ...(type ? { type } : {}),
  };
}

function uniqueInboxPipelineItems(inboxQueue) {
  const seen = new Set();
  const rows = [];
  for (const item of [...arrayOf(inboxQueue?.items), ...arrayOf(inboxQueue?.interested_candidates)].filter(isRecord)) {
    const key = cleanString(item?.id || item?.candidate_id || item?.gmail_thread_id || item?.candidate_name || item?.name).toLowerCase();
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    rows.push(item);
  }
  return rows;
}

function inboxPipelineStepType(item) {
  const classification = cleanString(item?.classification).toLowerCase();
  const nextAction = cleanString(item?.next_action).toLowerCase();
  if (nextAction === "stop" || ["not_interested", "bounced"].includes(classification)) return "stop_sequence";
  if (nextAction === "save_follow_up_draft" || classification === "no_reply_follow_up") return "follow_up";
  if (nextAction === "reply" || classification === "ask_for_details") return "reply_with_details";
  return "";
}

function inboxPipelineStepText(type, locale) {
  const zh = locale === "zh";
  const labels = {
    stop_sequence: zh ? "停止序列" : "Stop sequence",
    follow_up: zh ? "保存跟进草稿" : "Save follow-up draft",
    reply_with_details: zh ? "回复补充信息" : "Reply with details",
  };
  return labels[type] ?? type;
}

function isInterviewReadyInboxItem(item) {
  const readiness = cleanString(item?.readiness).toLowerCase();
  const actionStatus = cleanString(item?.action_status).toLowerCase();
  const classification = cleanString(item?.classification).toLowerCase();
  return readiness === "interview_ready" || ["interview_ready", "confirmed", "rescheduled", "canceled", "scheduled"].includes(actionStatus) || classification === "interview_ready";
}

function isInterestedInboxItem(item) {
  const classification = cleanString(item?.classification).toLowerCase();
  const readiness = cleanString(item?.readiness).toLowerCase();
  const nextAction = cleanString(item?.next_action).toLowerCase();
  return classification === "interested" || readiness === "needs_scheduling" || nextAction === "schedule";
}

function buildInboxPipeline({ inboxQueue, locale }) {
  const zh = locale === "zh";
  const items = uniqueInboxPipelineItems(inboxQueue);
  const interestedQueue = items
    .filter((item) => isInterestedInboxItem(item) && !isInterviewReadyInboxItem(item))
    .sort((a, b) => String(validIso(b?.updated_at)).localeCompare(String(validIso(a?.updated_at))))
    .slice(0, 5)
    .map((item) => inboxPipelineItem(item, {
      cta: zh ? "推进约面" : "Move to interview",
      detail: cleanString(item?.saved_scheduling_draft) || cleanString(item?.scheduling_packet?.handoff_title) || cleanString(item?.action_label),
      locale,
    }));
  const interviewReadyQueue = items
    .filter(isInterviewReadyInboxItem)
    .sort((a, b) => String(validIso(b?.updated_at)).localeCompare(String(validIso(a?.updated_at))))
    .slice(0, 5)
    .map((item) => inboxPipelineItem(item, {
      cta: zh ? "查看可约面候选人" : "Review interview-ready",
      detail: cleanString(item?.saved_scheduling_draft) || cleanString(item?.scheduling_packet?.candidate_reply) || cleanString(item?.action_label),
      locale,
    }));
  const priority = { stop_sequence: 1, follow_up: 2, reply_with_details: 3 };
  const nextSteps = items
    .map((item) => ({ item, type: inboxPipelineStepType(item) }))
    .filter((row) => row.type)
    .sort((a, b) => priority[a.type] - priority[b.type] || String(validIso(b.item?.updated_at)).localeCompare(String(validIso(a.item?.updated_at))))
    .slice(0, 6)
    .map(({ item, type }) => inboxPipelineItem(item, {
      type,
      cta: inboxPipelineStepText(type, locale),
      detail: cleanString(item?.reply_draft) || cleanString(item?.suggested_reply) || cleanString(item?.action_label),
      locale,
    }));
  const schedulingItems = [...interestedQueue, ...interviewReadyQueue];
  return {
    summary: {
      interested: interestedQueue.length,
      scheduling: schedulingItems.filter((item) => item.scheduling_state.status === "needs_scheduling").length,
      interview_ready: interviewReadyQueue.length,
      confirmed: schedulingItems.filter((item) => item.scheduling_state.status === "confirmed").length,
      canceled: schedulingItems.filter((item) => item.scheduling_state.status === "canceled").length,
      needs_recovery: schedulingItems.filter((item) => item.scheduling_state.status === "needs_recovery").length,
      waiting_on_candidate: schedulingItems.filter((item) => item.scheduling_state.status === "waiting_on_candidate").length,
      waiting_on_manager: schedulingItems.filter((item) => item.scheduling_state.status === "waiting_on_manager").length,
      ready_to_confirm: schedulingItems.filter((item) => item.scheduling_state.status === "ready_to_confirm").length,
      needs_reply: nextSteps.filter((step) => step.type === "reply_with_details").length,
      due_follow_up: nextSteps.filter((step) => step.type === "follow_up").length,
      stop_sequence: nextSteps.filter((step) => step.type === "stop_sequence").length,
    },
    interested_queue: interestedQueue,
    interview_ready_queue: interviewReadyQueue,
    next_steps: nextSteps,
  };
}

function buildActivity({ latestRun, outreachItems, inboxQueue, roleAgentMetrics, limit, locale }) {
  const rows = [];
  if (isRecord(latestRun)) {
    rows.push({
      at: validIso(latestRun.updated_at || latestRun.created_at),
      label: `Search ${cleanString(latestRun.status) || "run"}`,
      context: cleanString(latestRun.label || latestRun.summary || "Latest search"),
      status: cleanString(latestRun.status),
    });
  }
  for (const item of outreachItems) {
    rows.push({
      at: validIso(item.updated_at || item.last_contacted_at),
      label: `Outreach ${cleanString(item.status) || "thread"}`,
      context: cleanString(item.candidate_name) || "Candidate",
      status: cleanString(item.status),
    });
    rows.push(...sequenceAuditActivityRows(item, locale));
  }
  for (const item of [...arrayOf(inboxQueue?.items), ...arrayOf(inboxQueue?.interested_candidates)].filter(isRecord)) {
    rows.push({
      at: validIso(item.updated_at),
      label: `Inbox ${cleanString(item.classification) || "reply"}`,
      context: cleanString(item.candidate_name) || "Candidate",
      status: cleanString(item.classification || item.readiness),
    });
  }
  const followUpRow = followUpSummaryActivity(roleAgentMetrics, locale);
  if (followUpRow) rows.push(followUpRow);
  for (const event of roleAgentRecentEvents(roleAgentMetrics)) {
    const row = roleAgentMetricActivity(event, locale);
    if (row) rows.push(row);
  }
  return rows
    .filter((row) => row.label || row.context || row.status)
    .sort((a, b) => String(b.at).localeCompare(String(a.at)))
    .slice(0, Math.max(1, asNumber(limit, 5)));
}

export function buildRoleAgentWorkspaceView({
  role = {},
  settings = {},
  leadPreview = {},
  candidateGraph = {},
  outreachQueue = {},
  sequenceAnalytics = {},
  inboxQueue = {},
  smartReport = null,
  roleAgentMetrics = {},
  clientDeliveryAuditEvents = [],
  searchTasks = [],
  latestRun = null,
  activityLimit = 5,
  now = new Date().toISOString(),
  locale = "en",
} = {}) {
  const normalizedLocale = locale === "zh" ? "zh" : "en";
  const normalizedSettings = buildRoleOutreachSettings(settings);
  const roleStatus = cleanString(role?.status).toLowerCase();
  const baseStatus = normalizedSettings.agent_status === "paused" || roleStatus === "paused" ? "paused" : "active";
  const outreachItems = queueItems(outreachQueue);
  const { goals, counts } = buildCounts({ settings: normalizedSettings, candidateGraph, leadPreview, outreachItems, sequenceAnalytics, inboxQueue });
  const signalRefresh = buildSignalRefresh({ candidateGraph, roleAgentMetrics, now, locale: normalizedLocale });
  const health = buildHealth({
    goals,
    counts,
    candidateGraph,
    leadPreview,
    outreachItems,
    sequenceAnalytics,
    inboxQueue,
    latestRun,
    searchTasks,
    signalRefresh,
  });
  const status = baseStatus === "paused" ? "paused" : health.blocked_actions.length > 0 ? "review_required" : "active";

  return {
    status,
    goals_configured: normalizedSettings.capacity_goal_configured,
    goals,
    counts,
    health,
    next_actions: buildNextActions({
      status,
      goals,
      counts,
      health,
      candidateGraph,
      leadPreview,
      outreachQueue,
      outreachItems,
      sequenceAnalytics,
      inboxQueue,
      latestRun,
      searchTasks,
      signalRefresh,
      locale: normalizedLocale,
    }),
    why_now: buildWhyNow({ candidateGraph, outreachItems, inboxQueue, locale: normalizedLocale, now }),
    signal_refresh: signalRefresh,
    autopilot_path: buildAutopilotPath({ outreachItems, settings: normalizedSettings, locale: normalizedLocale }),
    autopilot_recovery: buildAutopilotRecovery({ outreachItems, roleAgentMetrics, locale: normalizedLocale }),
    inbox_pipeline: buildInboxPipeline({ inboxQueue, locale: normalizedLocale }),
    delivery_summary: deliverySummaryFrom({ smartReport, candidateGraph, outreachItems, inboxQueue, locale: normalizedLocale }),
    client_feedback_audit: clientFeedbackAudit(roleAgentMetrics),
    client_delivery_audit: clientDeliveryAudit(roleAgentMetrics, normalizedLocale, clientDeliveryAuditEvents),
    activity: buildActivity({ latestRun, outreachItems, inboxQueue, roleAgentMetrics, limit: activityLimit, locale: normalizedLocale }),
  };
}
