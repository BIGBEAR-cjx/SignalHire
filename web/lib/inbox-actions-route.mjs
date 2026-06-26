import { buildInboxActionPatch } from "./inbox-actions.mjs";

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * @param {{
 *   body?: Record<string, unknown>;
 *   user?: { id: string } | null;
 *   getOutreachThread: Function;
 *   updateOutreachThread: Function;
 *   now?: Date;
 * }} input
 */
export async function runInboxAction({
  body = {},
  user = null,
  getOutreachThread,
  updateOutreachThread,
  now = new Date(),
} = {}) {
  if (!user?.id) return { status: 401, body: { error: "login_required" } };
  const id = cleanString(body.outreach_thread_id || body.thread_id);
  if (!id) return { status: 400, body: { error: "missing_outreach_thread_id" } };
  const thread = await getOutreachThread({ userId: user.id, id });
  if (!thread) return { status: 404, body: { error: "thread_not_found" } };
  const result = buildInboxActionPatch({
    action: body.action,
    notes: thread.notes,
    reply_draft: body.reply_draft,
    follow_up_at: body.follow_up_at,
    scheduling_message: body.scheduling_message,
    now,
  });
  if (!result.ok) return { status: 400, body: { error: result.error } };
  const updated = await updateOutreachThread({
    userId: user.id,
    id,
    ...result.patch,
  });
  if (!updated) return { status: 404, body: { error: "thread_update_failed" } };
  return {
    status: 200,
    body: {
      ok: true,
      action_state: result.action_state,
      thread: updated,
    },
  };
}
