import { sendInboxDraftThread } from "@/lib/gmail";
import { normalizeLocale, t } from "@/lib/i18n.mjs";
import { getUser } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: { outreach_thread_id?: unknown; locale?: unknown } = {};
  try { body = await req.json(); } catch {}
  const locale = normalizeLocale(body.locale);
  const user = await getUser();
  if (!user) return Response.json({ error: t(locale, "api.error.loginRequired") }, { status: 401 });
  const threadId = typeof body.outreach_thread_id === "string" ? body.outreach_thread_id.trim() : "";
  if (!threadId) return Response.json({ error: "missing_outreach_thread_id" }, { status: 400 });
  const result = await sendInboxDraftThread({ userId: user.id, threadId });
  if (!result.ok) {
    const error = result.error || "inbox_draft_send_failed";
    if (result.error === "thread_not_found") return Response.json({ error }, { status: 404 });
    return Response.json({ error }, { status: 400 });
  }
  return Response.json({ thread: result.thread });
}
