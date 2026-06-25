export const OUTREACH_THREAD_STATUSES = [
  "drafted",
  "approved",
  "sent",
  "follow_up_scheduled",
  "contacted",
  "follow_up_due",
  "replied",
  "bounced",
  "stopped",
  "interviewing",
  "rejected",
  "hired",
];

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function validIso(value) {
  const clean = cleanString(value);
  if (!clean) return null;
  const date = new Date(clean);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function stringList(value, limit = 4) {
  return Array.isArray(value) ? value.map(cleanString).filter(Boolean).slice(0, limit) : [];
}

export function buildOutreachSequenceMessages({ subject = "", body = "", candidate = {} } = {}) {
  const source = isRecord(candidate) ? candidate : {};
  const hooks = [
    ...stringList(source.strongest_signals, 3),
    cleanString(source.outreach_angle),
  ].filter(Boolean).slice(0, 4);
  const candidateName = cleanString(source.name) || "there";
  const primaryHook = hooks[0] || "your recent work";
  return [
    {
      step: 1,
      subject: cleanString(subject),
      body: cleanString(body),
      evidence_hooks: hooks,
    },
    {
      step: 2,
      subject: `Re: ${cleanString(subject) || "Following up"}`,
      body: `Hi ${candidateName}, quick follow-up because ${primaryHook} looked especially relevant to the role. Would it be worth a short conversation?`,
      evidence_hooks: hooks,
    },
    {
      step: 3,
      subject: `Re: ${cleanString(subject) || "Following up"}`,
      body: `Last note from me. If now is not the right time, I can close the loop. The reason I reached out was ${primaryHook}.`,
      evidence_hooks: hooks,
    },
  ];
}

export function buildOutreachThreadDraft({
  candidate,
  shortlistItemId = null,
  projectId = null,
  tone = "professional",
  roleBrief = "",
  generatedDraft,
  status = "drafted",
  nextFollowUpAt = null,
  now = new Date(),
}) {
  const normalizedStatus = OUTREACH_THREAD_STATUSES.includes(status) ? status : "drafted";
  const sequenceMessages = buildOutreachSequenceMessages({
    subject: generatedDraft?.subject,
    body: generatedDraft?.body,
    candidate,
  });
  return {
    shortlist_item_id: shortlistItemId,
    project_id: projectId,
    candidate_name: cleanString(candidate?.name) || "Unknown candidate",
    candidate_snapshot: candidate ?? {},
    contact_profile: candidate?.contact_profile ?? { emails: [], phones: [], linkedin_url: "", contactability_score: 0 },
    sequence_messages: sequenceMessages,
    tone: cleanString(tone) || "professional",
    role_brief: cleanString(roleBrief),
    subject: cleanString(generatedDraft?.subject),
    body: cleanString(generatedDraft?.body),
    status: normalizedStatus,
    next_follow_up_at: validIso(nextFollowUpAt),
    approved_at: normalizedStatus === "approved" ? now.toISOString() : null,
    sent_at: normalizedStatus === "sent" || normalizedStatus === "contacted" ? now.toISOString() : null,
    last_contacted_at: normalizedStatus === "contacted" || normalizedStatus === "sent" ? now.toISOString() : null,
    gmail_message_id: "",
    gmail_thread_id: "",
    send_error: "",
  };
}

export function normalizeOutreachThreadPatch(input = {}, { now = new Date() } = {}) {
  const patch = {};
  if (input.status !== undefined && OUTREACH_THREAD_STATUSES.includes(input.status)) {
    patch.status = input.status;
    if (input.status === "contacted" && !input.last_contacted_at) {
      patch.last_contacted_at = now.toISOString();
    }
    if (input.status === "approved" && !input.approved_at) {
      patch.approved_at = now.toISOString();
    }
    if (input.status === "sent" && !input.sent_at) {
      patch.sent_at = now.toISOString();
      patch.last_contacted_at = now.toISOString();
    }
  }
  if (input.subject !== undefined) patch.subject = cleanString(input.subject);
  if (input.body !== undefined) patch.body = cleanString(input.body);
  if (input.notes !== undefined) patch.notes = cleanString(input.notes);
  if (input.contact_profile !== undefined) patch.contact_profile = isRecord(input.contact_profile) ? input.contact_profile : {};
  if (input.sequence_messages !== undefined) patch.sequence_messages = Array.isArray(input.sequence_messages) ? input.sequence_messages : [];
  if (input.next_follow_up_at !== undefined) patch.next_follow_up_at = validIso(input.next_follow_up_at);
  if (input.last_contacted_at !== undefined) patch.last_contacted_at = validIso(input.last_contacted_at);
  if (input.approved_at !== undefined) patch.approved_at = validIso(input.approved_at);
  if (input.sent_at !== undefined) patch.sent_at = validIso(input.sent_at);
  if (input.gmail_message_id !== undefined) patch.gmail_message_id = cleanString(input.gmail_message_id);
  if (input.gmail_thread_id !== undefined) patch.gmail_thread_id = cleanString(input.gmail_thread_id);
  if (input.send_error !== undefined) patch.send_error = cleanString(input.send_error);
  return patch;
}

function queueState(thread, now) {
  if (thread?.status === "drafted") return "draft";
  const followUp = validIso(thread?.next_follow_up_at);
  if (followUp && new Date(followUp).getTime() <= now.getTime()) return "due";
  if (followUp) return "scheduled";
  return "active";
}

const QUEUE_WEIGHT = { due: 0, draft: 1, scheduled: 2, active: 3 };

export function buildOutreachQueue({ threads = [], now = new Date() } = {}) {
  const items = threads.map((thread) => ({
    ...thread,
    queue_state: queueState(thread, now),
  })).sort((a, b) => {
    const byState = (QUEUE_WEIGHT[a.queue_state] ?? 9) - (QUEUE_WEIGHT[b.queue_state] ?? 9);
    if (byState) return byState;
    return String(a.next_follow_up_at ?? a.updated_at ?? "").localeCompare(String(b.next_follow_up_at ?? b.updated_at ?? ""));
  });
  return {
    summary: {
      due: items.filter((item) => item.queue_state === "due").length,
      drafted: items.filter((item) => item.queue_state === "draft" || item.status === "approved").length,
      active: items.filter((item) => !["rejected", "hired"].includes(item.status)).length,
    },
    items,
  };
}
