import { defaultActionStatus, parseInboxActionState } from "./inbox-actions.mjs";

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function excerpt(text, limit = 220) {
  const clean = cleanString(text).replace(/\s+/g, " ");
  return clean.length > limit ? `${clean.slice(0, limit - 1)}...` : clean;
}

function matchReason(text, patterns) {
  for (const pattern of patterns) {
    const matched = text.match(pattern);
    if (matched?.[0]) return matched[0];
  }
  return "";
}

function draftDetailsReply({ candidateName, roleBrief }) {
  const name = cleanString(candidateName) || "there";
  const role = cleanString(roleBrief) || "the role";
  return `Hi ${name}, happy to share more context. The role is focused on ${role}. Which part would be most useful to dig into first?`;
}

const RULES = [
  {
    classification: "bounced",
    patterns: [/delivery status notification/i, /mail delivery failed/i, /undeliverable/i, /\bbounced?\b/i],
  },
  {
    classification: "out_of_office",
    patterns: [/\bout of office\b/i, /\booo\b/i, /away until/i, /vacation/i],
  },
  {
    classification: "not_interested",
    patterns: [/not interested/i, /no thanks/i, /stop contacting/i, /unsubscribe/i, /not a fit/i],
  },
  {
    classification: "later",
    patterns: [/circle back/i, /\blater\b/i, /next month/i, /september/i, /after planning/i, /not now/i],
  },
  {
    classification: "ask_for_details",
    patterns: [/more details/i, /compensation/i, /salary/i, /\bteam\b/i, /\brole\b/i, /job description/i, /\bjd\b/i, /tell me more/i],
  },
  {
    classification: "interested",
    patterns: [/\binterested\b/i, /happy to chat/i, /open to chat/i, /let'?s talk/i, /book time/i, /available/i],
  },
];

export function classifyInboxReply({ text = "", candidateName = "", roleBrief = "" } = {}) {
  const sourceText = cleanString(text);
  const matchedRule = RULES.find((rule) => matchReason(sourceText, rule.patterns));
  const classification = matchedRule?.classification ?? "needs_human_reply";
  const phrase = matchedRule ? matchReason(sourceText, matchedRule.patterns) : "";
  const classification_reason = phrase ? `Matched reply phrase: ${phrase}` : "No decisive reply phrase matched.";
  const last_message_excerpt = excerpt(sourceText);
  const suggested_reply = classification === "ask_for_details"
    ? draftDetailsReply({ candidateName, roleBrief })
    : classification === "later"
      ? `Thanks for the context. I can follow up later unless there is a better timing window.`
      : classification === "needs_human_reply"
        ? `Review this reply before sending a response.`
        : "";
  return { classification, classification_reason, last_message_excerpt, suggested_reply };
}

export function shouldStopFollowUp(classification) {
  return classification === "not_interested" || classification === "bounced";
}

function needsHumanReply(item) {
  return ["ask_for_details", "later", "needs_human_reply"].includes(item.classification);
}

function listFrom(value, limit = 3) {
  return Array.isArray(value) ? value.map(cleanString).filter(Boolean).slice(0, limit) : [];
}

function validIso(value) {
  const clean = cleanString(value);
  if (!clean) return "";
  const date = new Date(clean);
  return Number.isFinite(date.getTime()) ? date.toISOString() : "";
}

function sequenceMessages(value) {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function followUpDraft(item) {
  const messages = sequenceMessages(item.sequence_messages);
  const sequenced = messages.find((message) => Number(message.step) === 2 || Number(message.step) === 3);
  const sequencedBody = cleanString(sequenced?.body);
  if (sequencedBody) return sequencedBody;

  const snapshot = isRecord(item.candidate_snapshot) ? item.candidate_snapshot : {};
  const candidateName = cleanString(item.candidate_name) || "there";
  const hooks = [
    ...listFrom(snapshot.strongest_evidence || snapshot.strongest_signals, 2),
    cleanString(snapshot.outreach_angle),
    cleanString(item.role_brief),
  ].filter(Boolean);
  const hook = hooks[0] || "your recent work";
  return `Hi ${candidateName}, quick follow-up because ${hook} looked relevant to the role. Would it be worth a short conversation?`;
}

function actionForClassification(item) {
  const classification = cleanString(item.classification) || "needs_human_reply";
  if (classification === "interested") {
    return {
      next_action: "schedule",
      action_label: "Prepare scheduling handoff",
      priority: "high",
      reply_draft: "",
      scheduling_prompt: "Confirm interest, share interview context, and propose 2-3 time windows.",
    };
  }
  if (classification === "no_reply_follow_up") {
    return {
      next_action: "save_follow_up_draft",
      action_label: "Save follow-up draft",
      priority: "medium",
      reply_draft: followUpDraft(item),
      scheduling_prompt: "",
    };
  }
  if (classification === "ask_for_details") {
    return {
      next_action: "reply",
      action_label: "Reply with role details",
      priority: "high",
      reply_draft: cleanString(item.suggested_reply),
      scheduling_prompt: "",
    };
  }
  if (classification === "later" || classification === "out_of_office") {
    return {
      next_action: "follow_up_later",
      action_label: "Follow up later",
      priority: "medium",
      reply_draft: cleanString(item.suggested_reply),
      scheduling_prompt: "",
    };
  }
  if (classification === "not_interested" || classification === "bounced") {
    return {
      next_action: "stop",
      action_label: "Stop follow-up",
      priority: "low",
      reply_draft: "",
      scheduling_prompt: "",
    };
  }
  return {
    next_action: "review",
    action_label: "Review manually",
    priority: "medium",
    reply_draft: cleanString(item.suggested_reply),
    scheduling_prompt: "",
  };
}

function todayQueueRank(item) {
  if (item.next_action === "schedule" && item.action_status !== "interview_ready") return 1;
  if (item.next_action === "reply" && item.action_status === "pending") return 2;
  if (item.next_action === "save_follow_up_draft" && item.action_status === "pending") return 3;
  if (item.next_action === "review" && item.action_status === "pending") return 4;
  if (item.next_action === "follow_up_later" && item.action_status !== "scheduled") return 5;
  return 0;
}

function todayQueueReason(item, rank) {
  if (rank === 1) return "Schedule next: candidate replied with interest.";
  if (rank === 2) return "Reply next: candidate asked for role details.";
  if (rank === 3) return "Follow up next: no reply and follow-up is due.";
  if (rank === 4) return "Review next: reply needs human judgment.";
  if (rank === 5) return "Follow up later: candidate asked to defer or is out of office.";
  return "";
}

function buildTodayQueue(items) {
  return items
    .map((item) => {
      const todayRank = todayQueueRank(item);
      return {
        ...item,
        today_rank: todayRank,
        today_reason: todayQueueReason(item, todayRank),
      };
    })
    .filter((item) => item.today_rank > 0)
    .sort((a, b) => a.today_rank - b.today_rank || String(b.updated_at).localeCompare(String(a.updated_at)));
}

function schedulingPacket(item) {
  const candidateName = cleanString(item.candidate_name) || "Candidate";
  const snapshot = isRecord(item.candidate_snapshot) ? item.candidate_snapshot : {};
  const audit = isRecord(snapshot.evidence_audit) ? snapshot.evidence_audit : {};
  const strongestEvidence = listFrom(snapshot.strongest_evidence || snapshot.strongest_signals);
  const riskFlags = listFrom(snapshot.risk_flags || audit.risk_flags);
  const unverifiedClaims = listFrom(audit.unverified_claims);
  const replyExcerpt = cleanString(item.last_message_excerpt);
  const evidenceSummary = strongestEvidence.join("; ") || "Evidence still needs hiring review.";
  const riskSummary = [...riskFlags, ...unverifiedClaims].join("; ") || "No major risks recorded yet.";
  const candidateReply = [
    `Thanks for the reply${replyExcerpt ? ` — I saw: "${replyExcerpt}"` : ""}.`,
    `The role looks potentially relevant because ${evidenceSummary}`,
    "Could you share 2-3 time windows that would work for a short intro conversation?",
  ].join(" ");
  return {
    candidate_summary: `${candidateName} replied with interest.`,
    reply_excerpt: replyExcerpt,
    strongest_evidence: strongestEvidence,
    risk_flags: riskFlags,
    unverified_claims: unverifiedClaims,
    claim_status_summary: "Verified evidence and unverified claims are separated for hiring review.",
    handoff_title: `Interview-ready handoff for ${candidateName}`,
    hiring_manager_note: `${candidateName} is ready for scheduling review. Strongest evidence: ${evidenceSummary} Risks or open questions: ${riskSummary}`,
    verified_summary: evidenceSummary,
    risk_summary: riskSummary,
    candidate_reply: candidateReply,
    suggested_scheduling_message: `Thanks for the reply. I can share 2-3 time windows and a short role brief so we can see whether the conversation is worthwhile.`,
    interview_questions: [
      "What work are you most interested in discussing for this role?",
      "Which recent project best represents your fit for this team?",
      "What timing and process would make an interview worthwhile?",
    ],
  };
}

export function buildInboxQueue({ threads = [] } = {}) {
  const items = [...threads]
    .map((thread) => {
      const actionState = parseInboxActionState(thread.notes || thread.action_notes);
      const item = {
        id: cleanString(thread.id),
        candidate_name: cleanString(thread.candidate_name) || "Unknown candidate",
        classification: cleanString(thread.classification) || "needs_human_reply",
        classification_reason: cleanString(thread.classification_reason),
        last_message_excerpt: cleanString(thread.last_message_excerpt),
        suggested_reply: cleanString(thread.suggested_reply),
        candidate_snapshot: isRecord(thread.candidate_snapshot) ? thread.candidate_snapshot : {},
        sequence_messages: sequenceMessages(thread.sequence_messages),
        role_brief: cleanString(thread.role_brief),
        updated_at: cleanString(thread.updated_at),
        gmail_thread_id: cleanString(thread.gmail_thread_id),
        outreach_thread_id: cleanString(thread.outreach_thread_id),
        action_state: actionState,
        action_status: actionState?.action_status || defaultActionStatus({
          action: actionState?.action,
          outreachStatus: thread.outreach_status || thread.status,
        }),
      };
      return { ...item, ...actionForClassification(item) };
    })
    .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
  const interested_candidates = items
    .filter((item) => item.classification === "interested")
    .map((item) => ({
      ...item,
      readiness: "needs_scheduling",
      recommended_next_step: item.scheduling_prompt || "Prepare a scheduling handoff for hiring review.",
      scheduling_packet: schedulingPacket(item),
    }));
  return {
    summary: {
      total: items.length,
      interested: interested_candidates.length,
      needs_human_reply: items.filter(needsHumanReply).length,
      needs_scheduling: items.filter((item) => item.next_action === "schedule" && item.action_status !== "interview_ready").length,
      needs_reply: items.filter((item) => item.next_action === "reply" && item.action_status === "pending").length,
      due_follow_up: items.filter((item) => item.next_action === "save_follow_up_draft" && item.action_status === "pending").length,
      follow_up_later: items.filter((item) => item.next_action === "follow_up_later" && item.action_status !== "scheduled").length,
      stopped: items.filter((item) => item.action_status === "stopped").length,
      review_required: items.filter((item) => item.next_action === "review" && item.action_status === "pending").length,
    },
    items,
    today_queue: buildTodayQueue(items),
    interested_candidates,
  };
}

const FOLLOW_UP_ACTIVE_STATUSES = new Set(["sent", "contacted", "follow_up_later", "follow_up_scheduled", "follow_up_due"]);
const FOLLOW_UP_STOPPED_STATUSES = new Set(["stopped", "bounced", "rejected", "hired"]);

function followUpIsDue(thread, now) {
  const status = cleanString(thread?.status);
  if (FOLLOW_UP_STOPPED_STATUSES.has(status)) return false;
  if (!cleanString(thread?.gmail_thread_id)) return false;
  if (status === "follow_up_due") return true;
  if (!FOLLOW_UP_ACTIVE_STATUSES.has(status)) return false;
  const dueAt = validIso(thread?.next_follow_up_at);
  return Boolean(dueAt && new Date(dueAt).getTime() <= now.getTime());
}

export function mergeInboxThreadsWithDueFollowUps({
  inboxThreads = [],
  outreachThreads = [],
  now = new Date(),
} = {}) {
  const repliedOutreachIds = new Set(
    inboxThreads.map((thread) => cleanString(thread.outreach_thread_id)).filter(Boolean),
  );
  const repliedGmailThreadIds = new Set(
    inboxThreads.map((thread) => cleanString(thread.gmail_thread_id)).filter(Boolean),
  );
  const followUps = outreachThreads
    .filter((thread) => followUpIsDue(thread, now))
    .filter((thread) => !repliedOutreachIds.has(cleanString(thread.id)))
    .filter((thread) => !repliedGmailThreadIds.has(cleanString(thread.gmail_thread_id)))
    .map((thread) => ({
      id: `followup-${cleanString(thread.id)}`,
      candidate_name: cleanString(thread.candidate_name) || "Unknown candidate",
      classification: "no_reply_follow_up",
      classification_reason: "No candidate reply before the scheduled follow-up.",
      last_message_excerpt: "No candidate reply yet; follow-up is due.",
      suggested_reply: "",
      candidate_snapshot: isRecord(thread.candidate_snapshot) ? thread.candidate_snapshot : {},
      sequence_messages: sequenceMessages(thread.sequence_messages),
      role_brief: cleanString(thread.role_brief),
      updated_at: validIso(thread.next_follow_up_at) || cleanString(thread.updated_at),
      gmail_thread_id: cleanString(thread.gmail_thread_id),
      outreach_thread_id: cleanString(thread.id),
      outreach_status: "follow_up_due",
      original_outreach_status: cleanString(thread.status),
      notes: cleanString(thread.notes),
    }));

  return [...inboxThreads, ...followUps];
}
