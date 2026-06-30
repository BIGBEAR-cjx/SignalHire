import { saveGmailDraftForThread } from "@/lib/gmail";
import { normalizeLocale, t } from "@/lib/i18n.mjs";
import { getUser } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  let body: { locale?: unknown } = {};
  try { body = await req.json(); } catch {}
  const locale = normalizeLocale(body.locale);
  const user = await getUser();
  if (!user) return Response.json({ error: t(locale, "api.error.loginRequired") }, { status: 401 });
  const { id } = await ctx.params;
  const result = await saveGmailDraftForThread({ userId: user.id, threadId: id });
  if (!result.ok) return Response.json({ error: result.error || t(locale, "api.error.outreachFailed") }, { status: 400 });
  return Response.json({ thread: result.thread });
}
