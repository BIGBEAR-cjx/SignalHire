import { updateOutreachThread } from "@/lib/outreach-threads";
import { normalizeLocale, t } from "@/lib/i18n.mjs";
import { getUser } from "@/lib/session";

export const runtime = "nodejs";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  let body: {
    status?: unknown;
    subject?: unknown;
    body?: unknown;
    notes?: unknown;
    next_follow_up_at?: unknown;
    last_contacted_at?: unknown;
    locale?: unknown;
  } = {};
  try { body = await req.json(); } catch {}
  const locale = normalizeLocale(body.locale);
  const user = await getUser();
  if (!user) return Response.json({ error: t(locale, "api.error.loginRequired") }, { status: 401 });
  const { id } = await ctx.params;
  const thread = await updateOutreachThread({
    userId: user.id,
    id,
    status: typeof body.status === "string" ? body.status : undefined,
    subject: typeof body.subject === "string" ? body.subject : undefined,
    body: typeof body.body === "string" ? body.body : undefined,
    notes: typeof body.notes === "string" ? body.notes : undefined,
    next_follow_up_at: typeof body.next_follow_up_at === "string" || body.next_follow_up_at === null ? body.next_follow_up_at : undefined,
    last_contacted_at: typeof body.last_contacted_at === "string" || body.last_contacted_at === null ? body.last_contacted_at : undefined,
  });
  if (!thread) return Response.json({ error: t(locale, "api.error.shortlistUpdateUnavailable") }, { status: 404 });
  return Response.json({ thread });
}
