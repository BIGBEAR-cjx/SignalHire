function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
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

export function buildInboxQueue({ threads = [] } = {}) {
  const items = [...threads]
    .map((thread) => ({
      id: cleanString(thread.id),
      candidate_name: cleanString(thread.candidate_name) || "Unknown candidate",
      classification: cleanString(thread.classification) || "needs_human_reply",
      classification_reason: cleanString(thread.classification_reason),
      last_message_excerpt: cleanString(thread.last_message_excerpt),
      suggested_reply: cleanString(thread.suggested_reply),
      updated_at: cleanString(thread.updated_at),
      gmail_thread_id: cleanString(thread.gmail_thread_id),
      outreach_thread_id: cleanString(thread.outreach_thread_id),
    }))
    .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
  const interested_candidates = items
    .filter((item) => item.classification === "interested")
    .map((item) => ({
      ...item,
      readiness: "needs_scheduling",
      recommended_next_step: "Review and schedule interview.",
    }));
  return {
    summary: {
      total: items.length,
      interested: interested_candidates.length,
      needs_human_reply: items.filter(needsHumanReply).length,
    },
    items,
    interested_candidates,
  };
}
