import { buildEvidenceDrivenOutreachSequence } from "./outreach-draft.mjs";
import { latestFollowUpDraftState } from "./outreach-followups.mjs";
import { buildRoleOutreachSettings, canAutoSendFollowUp } from "./outreach-settings.mjs";

const STOPPED_STATUSES = new Set(["stopped", "replied", "bounced", "not_interested", "hired", "rejected"]);
const FIRST_EMAIL_SENT_STATUSES = new Set(["sent", "contacted", "follow_up_scheduled", "follow_up_due", "replied", "bounced", "stopped", "interviewing", "hired", "rejected"]);
const ACTIVE_FOLLOW_UP_STATUSES = new Set(["sent", "contacted", "follow_up_scheduled", "follow_up_due"]);

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function cleanStringArray(value, limit = 20) {
  return Array.isArray(value) ? value.map(cleanString).filter(Boolean).slice(0, limit) : [];
}

function validDate(value) {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value : null;
  const clean = cleanString(value);
  if (!clean) return null;
  const date = new Date(clean);
  return Number.isFinite(date.getTime()) ? date : null;
}

function bodyPreview(value) {
  return cleanString(value).replace(/\s+/g, " ").slice(0, 240);
}

function candidateFor(item) {
  return isRecord(item?.candidate_snapshot)
    ? item.candidate_snapshot
    : { name: cleanString(item?.candidate_name) || "Candidate" };
}

function sequenceMessagesFor(item) {
  if (Array.isArray(item?.sequence_messages) && item.sequence_messages.some(isRecord)) {
    return item.sequence_messages.filter(isRecord);
  }
  return buildEvidenceDrivenOutreachSequence({
    candidate: candidateFor(item),
    tone: cleanString(item?.tone) || "professional",
    roleBrief: cleanString(item?.role_brief),
  });
}

function messageEvidenceRefs(message) {
  const refs = cleanStringArray(message?.evidence_refs, 8);
  if (refs.length) return refs;
  return cleanStringArray(message?.evidence_hooks, 8);
}

function normalizedAuditEvents(value) {
  const allowed = new Set(["saved", "reviewed", "skipped"]);
  return Array.isArray(value)
    ? value.filter(isRecord).map((event) => ({
      action: cleanString(event.action),
      at: validDate(event.at)?.toISOString() ?? "",
      summary: cleanString(event.summary),
    })).filter((event) => allowed.has(event.action) && event.at && event.summary)
    : [];
}

export function normalizeOutreachSequenceMessages(value = []) {
  const messagesByStep = new Map();
  for (const message of Array.isArray(value) ? value : []) {
    if (!isRecord(message)) continue;
    const step = Number(message.step);
    if (step !== 1 && step !== 2 && step !== 3) continue;
    const next = {
      ...message,
      step,
      subject: cleanString(message.subject),
      body: cleanString(message.body),
      send_mode: step === 1 ? "manual_approval_required" : "draft_for_review",
    };
    const auditEvents = normalizedAuditEvents(message.audit_events);
    if (auditEvents.length) next.audit_events = auditEvents;
    messagesByStep.set(step, next);
  }
  return [1, 2, 3].map((step) => messagesByStep.get(step)).filter(Boolean);
}

function auditActionForPatch(patch) {
  if (patch?.skipped === true) return "skipped";
  if (patch?.reviewed === true) return "reviewed";
  if (patch?.subject !== undefined || patch?.body !== undefined) return "saved";
  return "";
}

function auditSummaryFor(action, step, summary) {
  const clean = cleanString(summary);
  if (clean) return clean;
  if (action === "reviewed") return `Reviewed step ${step}.`;
  if (action === "skipped") return `Skipped step ${step}.`;
  return `Saved step ${step}.`;
}

export function patchOutreachSequenceStep(sequenceMessages = [], patch = {}) {
  const step = Number(patch?.step);
  if (step !== 1 && step !== 2 && step !== 3) return normalizeOutreachSequenceMessages(sequenceMessages);

  const now = validDate(patch?.now) ?? new Date();
  const messages = normalizeOutreachSequenceMessages(sequenceMessages);
  const existing = messages.find((message) => Number(message.step) === step) ?? { step, subject: "", body: "" };
  const next = { ...existing, step };

  if (patch.subject !== undefined) next.subject = cleanString(patch.subject);
  if (patch.body !== undefined) next.body = cleanString(patch.body);
  if (patch.reviewed !== undefined) {
    next.approved = patch.reviewed === true;
    if (patch.reviewed === true) next.reviewed_at = now.toISOString();
    else delete next.reviewed_at;
  }
  if (patch.skipped !== undefined) next.skipped = patch.skipped === true;

  const action = auditActionForPatch(patch);
  if (action) {
    next.audit_events = [
      ...normalizedAuditEvents(next.audit_events),
      {
        action,
        at: now.toISOString(),
        summary: auditSummaryFor(action, step, patch.audit_summary),
      },
    ];
  }

  return normalizeOutreachSequenceMessages([
    ...messages.filter((message) => Number(message.step) !== step),
    next,
  ]);
}

function sendableEmail(contactProfile) {
  const emails = Array.isArray(contactProfile?.emails) ? contactProfile.emails : [];
  return emails.find((email) => {
    if (!isRecord(email)) return false;
    if (!cleanString(email.value) || !cleanString(email.source)) return false;
    if (cleanString(email.deliverability_status).toLowerCase() === "bounced") return false;
    return cleanString(email.confidence).toLowerCase() === "high" || cleanString(email.confidence).toLowerCase() === "medium";
  }) ?? null;
}

function contactBlockReason(contactProfile) {
  const emails = Array.isArray(contactProfile?.emails) ? contactProfile.emails.filter(isRecord) : [];
  if (sendableEmail(contactProfile)) return "";
  if (emails.length === 0) return "no_email";
  if (emails.every((email) => cleanString(email.deliverability_status).toLowerCase() === "bounced")) return "bounced_email";
  if (emails.every((email) => cleanString(email.confidence).toLowerCase() === "low")) return "low_confidence_email";
  return "no_sendable_email";
}

function currentStepFor(item) {
  const status = cleanString(item?.status).toLowerCase();
  const latestFollowUpStep = Number(latestFollowUpDraftState(item?.notes)?.step);
  if (status === "follow_up_due" && (latestFollowUpStep === 2 || latestFollowUpStep === 3)) return latestFollowUpStep;
  if (ACTIVE_FOLLOW_UP_STATUSES.has(status) && latestFollowUpStep === 2) return 3;
  if (ACTIVE_FOLLOW_UP_STATUSES.has(status)) return 2;
  return 1;
}

function firstStepState({ step, item, blocked }) {
  const status = cleanString(item?.status).toLowerCase();
  if (FIRST_EMAIL_SENT_STATUSES.has(status)) return "sent";
  if (blocked) return "blocked";
  if (status === "approved") return "ready";
  return "review";
}

function followUpStepState({ step, currentStep, stopped, blocked }) {
  if (stopped) return "sent";
  if (step < currentStep) return "sent";
  if (step === currentStep) return blocked ? "blocked" : "review";
  return "blocked";
}

function nextActionFor({ item, blockReasons, currentStep }) {
  const status = cleanString(item?.status).toLowerCase();
  if (blockReasons.some((reason) => reason === "no_email" || reason === "low_confidence_email" || reason === "bounced_email" || reason === "no_sendable_email")) {
    return "resolve contact";
  }
  if (STOPPED_STATUSES.has(status)) return "stop sequence";
  if (currentStep === 1) return status === "approved" ? "send first email" : "approve draft";
  return "review follow-up";
}

function normalizedMessage(message, step) {
  return normalizeOutreachSequenceMessages([{ ...message, step }])[0] ?? { step, subject: "", body: "", send_mode: step === 1 ? "manual_approval_required" : "draft_for_review" };
}

export function buildOutreachSequenceWorkspaceItem({ item = {}, settings = {} } = {}) {
  const source = isRecord(item) ? item : {};
  const normalizedSettings = buildRoleOutreachSettings(settings);
  const status = cleanString(source.status).toLowerCase();
  const contactReason = contactBlockReason(source.contact_profile);
  const blockReasons = [];
  if (contactReason) blockReasons.push(contactReason);
  if (status !== "approved" && !FIRST_EMAIL_SENT_STATUSES.has(status)) blockReasons.push("unapproved_thread");
  if (status === "bounced" && !blockReasons.includes("bounced_email")) blockReasons.push("bounced_email");

  const currentStep = currentStepFor(source);
  const messages = sequenceMessagesFor(source);
  const evidenceRefs = [];
  const stopped = STOPPED_STATUSES.has(status);

  const hardBlocked = Boolean(contactReason) || status === "bounced";
  const steps = [1, 2, 3].map((step) => {
    const message = normalizedMessage(messages.find((candidate) => Number(candidate?.step) === step) ?? {}, step);
    const refs = messageEvidenceRefs(message);
    for (const ref of refs) {
      if (!evidenceRefs.includes(ref)) evidenceRefs.push(ref);
    }
    return {
      step,
      subject: cleanString(message.subject),
      body_preview: bodyPreview(message.body),
      evidence_refs: refs,
      delay_days: step === 1 ? undefined : Number(message.delay_days) || normalizedSettings.follow_up_interval_days,
      send_mode: message.send_mode,
      approved: message.approved === true,
      reviewed: message.approved === true || Boolean(cleanString(message.reviewed_at)),
      skipped: message.skipped === true,
      audit_events: normalizedAuditEvents(message.audit_events),
      state: step === 1
        ? firstStepState({ step, item: source, blocked: hardBlocked })
        : (message.skipped === true ? "skipped" : followUpStepState({ step, currentStep, stopped, blocked: hardBlocked })),
      auto_sendable: step === 1 || hardBlocked || message.skipped === true ? false : canAutoSendFollowUp({
        settings: normalizedSettings,
        message,
        thread: source,
      }),
    };
  });

  return {
    id: cleanString(source.id),
    candidate_name: cleanString(source.candidate_name) || cleanString(candidateFor(source).name) || "Candidate",
    status: cleanString(source.status),
    queue_state: cleanString(source.queue_state),
    current_step: currentStep,
    next_action: nextActionFor({ item: source, blockReasons, currentStep }),
    block_reasons: blockReasons,
    sendable_contact: !contactReason,
    evidence_refs: evidenceRefs,
    evidence_ref_count: evidenceRefs.length,
    steps,
  };
}

export function buildOutreachSequenceWorkspace({
  queue = {},
  settings = {},
  digest = null,
  sequenceAnalytics = null,
} = {}) {
  const normalizedSettings = buildRoleOutreachSettings(settings);
  const items = (Array.isArray(queue?.items) ? queue.items : []).map((item) => buildOutreachSequenceWorkspaceItem({
    item,
    settings: normalizedSettings,
  }));

  return {
    settings: normalizedSettings,
    summary: {
      total: items.length,
      ready: items.filter((item) => item.steps.some((step) => step.state === "ready")).length,
      review: items.filter((item) => item.steps.some((step) => step.state === "review")).length,
      blocked: items.filter((item) => item.block_reasons.length > 0).length,
    },
    queue_summary: isRecord(queue?.summary) ? queue.summary : {},
    role_context: {
      digest,
      sequence_analytics: sequenceAnalytics,
    },
    items,
  };
}
