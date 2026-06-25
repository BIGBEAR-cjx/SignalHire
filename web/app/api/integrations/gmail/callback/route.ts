import { exchangeGmailCodeForTokens } from "@/lib/gmail";
import { normalizeLocale, t } from "@/lib/i18n.mjs";
import { getUser } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const locale = normalizeLocale(url.searchParams.get("locale"));
  const user = await getUser();
  if (!user) return Response.json({ error: t(locale, "api.error.loginRequired") }, { status: 401 });
  const code = url.searchParams.get("code") ?? "";
  const state = url.searchParams.get("state") ?? "";
  if (!code || !state) return Response.json({ error: t(locale, "api.error.outreachFailed") }, { status: 400 });
  try {
    const ok = await exchangeGmailCodeForTokens({ userId: user.id, userEmail: user.email, code, state });
    if (!ok) return Response.json({ error: t(locale, "api.error.outreachFailed") }, { status: 500 });
    return Response.redirect(new URL("/app/projects", url.origin));
  } catch (error) {
    const message = error instanceof Error ? error.message : t(locale, "api.error.outreachFailed");
    return Response.json({ error: message }, { status: 500 });
  }
}
