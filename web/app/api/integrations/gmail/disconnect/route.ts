import { disconnectGmail } from "@/lib/gmail";
import { normalizeLocale, t } from "@/lib/i18n.mjs";
import { getUser } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: { locale?: unknown } = {};
  try { body = await req.json(); } catch {}
  const locale = normalizeLocale(body.locale);
  const user = await getUser();
  if (!user) return Response.json({ error: t(locale, "api.error.loginRequired") }, { status: 401 });
  const ok = await disconnectGmail(user.id);
  if (!ok) return Response.json({ error: t(locale, "api.error.outreachFailed") }, { status: 500 });
  return Response.json({ ok: true });
}
