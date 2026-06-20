export const OUTREACH_THREAD_STATUSES = [
  "drafted",
  "contacted",
  "follow_up_due",
  "replied",
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
  return {
    shortlist_item_id: shortlistItemId,
    project_id: projectId,
    candidate_name: cleanString(candidate?.name) || "Unknown candidate",
    candidate_snapshot: candidate ?? {},
    tone: cleanString(tone) || "professional",
    role_brief: cleanString(roleBrief),
    subject: cleanString(generatedDraft?.subject),
    body: cleanString(generatedDraft?.body),
    status: normalizedStatus,
    next_follow_up_at: validIso(nextFollowUpAt),
    last_contacted_at: normalizedStatus === "contacted" ? now.toISOString() : null,
  };
}

export function normalizeOutreachThreadPatch(input = {}, { now = new Date() } = {}) {
  const patch = {};
  if (input.status !== undefined && OUTREACH_THREAD_STATUSES.includes(input.status)) {
    patch.status = input.status;
    if (input.status === "contacted" && !input.last_contacted_at) {
      patch.last_contacted_at = now.toISOString();
    }
  }
  if (input.subject !== undefined) patch.subject = cleanString(input.subject);
  if (input.body !== undefined) patch.body = cleanString(input.body);
  if (input.notes !== undefined) patch.notes = cleanString(input.notes);
  if (input.next_follow_up_at !== undefined) patch.next_follow_up_at = validIso(input.next_follow_up_at);
  if (input.last_contacted_at !== undefined) patch.last_contacted_at = validIso(input.last_contacted_at);
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
      drafted: items.filter((item) => item.queue_state === "draft").length,
      active: items.filter((item) => !["rejected", "hired"].includes(item.status)).length,
    },
    items,
  };
}
