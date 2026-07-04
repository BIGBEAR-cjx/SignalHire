import { parseInboxActionState } from "./inbox-actions.mjs";

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function validIso(value) {
  const clean = cleanString(value);
  if (!clean) return "";
  const date = new Date(clean);
  return Number.isFinite(date.getTime()) ? date.toISOString() : "";
}

function excerpt(value, limit = 500) {
  const clean = cleanString(value).replace(/\s+/g, " ");
  return clean.length > limit ? `${clean.slice(0, limit - 1)}...` : clean;
}

function directionForMessage(message, actorEmail) {
  const from = cleanString(message.from).toLowerCase();
  const actor = cleanString(actorEmail).toLowerCase();
  return actor && from.includes(actor) ? "outbound" : "inbound";
}

function messageFromGmail(message, actorEmail) {
  return {
    id: cleanString(message.id),
    direction: directionForMessage(message, actorEmail),
    status: "sent",
    subject: "",
    body: excerpt(message.bodyText || message.snippet),
    at: validIso(message.date),
    source: "gmail",
  };
}

function fallbackOutbound(outreachThread) {
  if (!cleanString(outreachThread.sent_at) && !cleanString(outreachThread.gmail_message_id)) return null;
  const at = validIso(outreachThread.sent_at || outreachThread.updated_at || outreachThread.created_at);
  const body = excerpt(outreachThread.body);
  if (!body) return null;
  return {
    id: cleanString(outreachThread.gmail_message_id) || `outbound-${cleanString(outreachThread.id)}`,
    direction: "outbound",
    status: cleanString(outreachThread.sent_at) ? "sent" : "draft",
    subject: cleanString(outreachThread.subject),
    body,
    at,
    source: "outreach_thread",
  };
}

function fallbackInbound(inboxThread) {
  const body = excerpt(inboxThread.last_message_excerpt);
  if (!body) return null;
  return {
    id: cleanString(inboxThread.gmail_message_id) || `inbound-${cleanString(inboxThread.id)}`,
    direction: "inbound",
    status: "received",
    subject: "",
    body,
    at: validIso(inboxThread.updated_at || inboxThread.created_at),
    source: "inbox_thread",
  };
}

function savedDraftMessage(outreachThread) {
  const actionState = parseInboxActionState(cleanString(outreachThread.notes || outreachThread.action_notes));
  const body = excerpt(actionState?.reply_draft || actionState?.scheduling_message);
  if (!body) return null;
  return {
    id: `draft-${cleanString(outreachThread.id) || cleanString(actionState.action_applied_at)}`,
    direction: "system",
    status: cleanString(actionState.action_status) || "draft_saved",
    subject: "",
    body,
    at: validIso(actionState.action_applied_at || outreachThread.updated_at),
    source: "inbox_action",
  };
}

export function buildTwoSidedMessageHistory({
  outreachThread = {},
  inboxThread = {},
  gmailMessages = [],
  actorEmail = "",
} = {}) {
  const messages = [];
  for (const message of Array.isArray(gmailMessages) ? gmailMessages : []) {
    if (isRecord(message)) messages.push(messageFromGmail(message, actorEmail));
  }
  if (!messages.some((message) => message.direction === "outbound")) {
    const outbound = fallbackOutbound(outreachThread);
    if (outbound) messages.push(outbound);
  }
  if (!messages.some((message) => message.direction === "inbound")) {
    const inbound = fallbackInbound(inboxThread);
    if (inbound) messages.push(inbound);
  }
  const draft = savedDraftMessage(outreachThread);
  if (draft) messages.push(draft);

  const byKey = new Map();
  for (const message of messages) {
    const key = cleanString(message.id) || `${message.direction}:${message.at}:${message.body}`;
    if (!byKey.has(key)) byKey.set(key, message);
  }
  const deduped = Array.from(byKey.values())
    .filter((message) => message.body)
    .sort((a, b) => String(a.at).localeCompare(String(b.at)));
  return {
    summary: {
      outbound: deduped.filter((message) => message.direction === "outbound").length,
      inbound: deduped.filter((message) => message.direction === "inbound").length,
      system: deduped.filter((message) => message.direction === "system").length,
      total: deduped.length,
    },
    messages: deduped,
  };
}
