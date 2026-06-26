import { classifyInboxReply } from "./inbox-agent.mjs";
import { buildInboxActionPatch, mergeInboxActionNotes } from "./inbox-actions.mjs";

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function latestCandidateMessage(messages, senderEmail) {
  const ownEmail = cleanString(senderEmail).toLowerCase();
  for (const message of [...messages].reverse()) {
    const from = cleanString(message?.from).toLowerCase();
    if (!ownEmail || !from.includes(ownEmail)) return message;
  }
  return null;
}

function actionStatePatch({ action, actionStatus = "pending", notes = "", replyDraft = "", now = new Date() }) {
  return {
    notes: mergeInboxActionNotes(notes, {
      action,
      action_status: actionStatus,
      action_applied_at: now.toISOString(),
      reply_draft: cleanString(replyDraft),
      follow_up_at: "",
      scheduling_message: "",
    }),
  };
}

export function buildSyncStatusPatch({ thread = {}, classification = "", suggestedReply = "", now = new Date() } = {}) {
  const notes = cleanString(thread.notes);
  if (classification === "interested") {
    return { status: "replied" };
  }
  if (classification === "ask_for_details") {
    return {
      status: "needs_reply",
      ...actionStatePatch({
        action: "reply",
        actionStatus: "pending",
        notes,
        replyDraft: suggestedReply,
        now,
      }),
    };
  }
  if (classification === "later" || classification === "out_of_office") {
    const patch = buildInboxActionPatch({ action: "follow_up_later", notes, now });
    return { ...(patch.ok ? patch.patch : {}), status: "follow_up_later" };
  }
  if (classification === "not_interested") {
    const patch = buildInboxActionPatch({ action: "stop", notes, now });
    return { ...(patch.ok ? patch.patch : {}), status: "stopped" };
  }
  if (classification === "bounced") {
    const patch = buildInboxActionPatch({ action: "stop", notes, now });
    return { ...(patch.ok ? patch.patch : {}), status: "bounced" };
  }
  return {};
}

export async function syncGmailInboxForProjectCore({
  userId = "",
  projectId = "",
  roleBrief = "",
  getGmailConnectionStatus,
  listRoleRelatedOutreachThreads,
  getGmailThreadMessages,
  saveInboxThread,
  updateOutreachThread,
  now = new Date(),
} = {}) {
  const lastSyncedAt = now.toISOString();
  const status = await getGmailConnectionStatus(userId);
  const connected = Boolean(status?.connected);
  const canReadInbox = Boolean(status?.can_read_inbox);
  if (!connected || !canReadInbox) {
    return {
      ok: false,
      connected,
      can_read_inbox: canReadInbox,
      synced: 0,
      scanned: 0,
      skipped_reason: connected ? "gmail_readonly_scope_missing" : "gmail_not_connected",
      last_synced_at: lastSyncedAt,
      errors: [],
    };
  }

  const threads = await listRoleRelatedOutreachThreads({ userId, projectId });
  let synced = 0;
  const errors = [];
  let skippedReason = "";
  for (const thread of threads) {
    try {
      const messages = await getGmailThreadMessages({ userId, threadId: thread.gmail_thread_id });
      const message = latestCandidateMessage(messages, status.gmail_address);
      if (!message) continue;
      const classification = classifyInboxReply({
        text: message.bodyText || message.snippet,
        candidateName: thread.candidate_name,
        roleBrief: roleBrief || thread.role_brief,
      });
      const saved = await saveInboxThread({
        userId,
        projectId,
        outreachThread: thread,
        message,
        classification,
      });
      if (!saved) continue;
      synced += 1;
      const patch = buildSyncStatusPatch({
        thread,
        classification: classification.classification,
        suggestedReply: classification.suggested_reply,
        now,
      });
      if (patch.status) {
        await updateOutreachThread({
          userId,
          id: thread.id,
          ...patch,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "sync_failed";
      if (message === "gmail_reconnect_required") skippedReason = "gmail_reconnect_required";
      errors.push({ outreach_thread_id: thread.id, error: message });
    }
  }
  return {
    ok: errors.length === 0,
    connected: true,
    can_read_inbox: true,
    synced,
    scanned: threads.length,
    skipped_reason: skippedReason,
    last_synced_at: lastSyncedAt,
    errors,
  };
}
