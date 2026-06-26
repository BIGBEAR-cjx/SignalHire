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

function schedulingPacket(item) {
  const candidateName = cleanString(item.candidate_name) || "Candidate";
  const snapshot = isRecord(item.candidate_snapshot) ? item.candidate_snapshot : {};
  const audit = isRecord(snapshot.evidence_audit) ? snapshot.evidence_audit : {};
  return {
    candidate_summary: `${candidateName} replied with interest.`,
    reply_excerpt: cleanString(item.last_message_excerpt),
    strongest_evidence: listFrom(snapshot.strongest_evidence || snapshot.strongest_signals),
    risk_flags: listFrom(snapshot.risk_flags || audit.risk_flags),
    unverified_claims: listFrom(audit.unverified_claims),
    claim_status_summary: "Verified evidence and unverified claims are separated for hiring review.",
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
      follow_up_later: items.filter((item) => item.next_action === "follow_up_later" && item.action_status !== "scheduled").length,
      stopped: items.filter((item) => item.action_status === "stopped").length,
      review_required: items.filter((item) => item.next_action === "review" && item.action_status === "pending").length,
    },
    items,
    interested_candidates,
  };
}
