import { getGmailConnectionStatus } from "@/lib/gmail";
import { normalizeLocale, t } from "@/lib/i18n.mjs";
import { getUser } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const locale = normalizeLocale(url.searchParams.get("locale"));
  const user = await getUser();
  if (!user) return Response.json({ error: t(locale, "api.error.loginRequired") }, { status: 401 });
  return Response.json(await getGmailConnectionStatus(user.id));
}
