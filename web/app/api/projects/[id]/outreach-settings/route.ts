import { updateProjectOutreachSettings } from "@/lib/projects";
import { normalizeLocale, t } from "@/lib/i18n.mjs";
import { getUser } from "@/lib/session";

export const runtime = "nodejs";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  let body: { settings?: unknown; locale?: unknown } = {};
  try { body = await req.json(); } catch {}
  const locale = normalizeLocale(body.locale);
  const user = await getUser();
  if (!user) return Response.json({ error: t(locale, "api.error.loginRequired") }, { status: 401 });
  const { id } = await ctx.params;
  if (!id) return Response.json({ error: t(locale, "api.error.missingId") }, { status: 400 });

  const settings = await updateProjectOutreachSettings({
    userId: user.id,
    id,
    settings: body.settings ?? {},
  });
  if (!settings) return Response.json({ error: t(locale, "api.error.projectUpdateUnavailable") }, { status: 404 });
  return Response.json({ settings });
}
