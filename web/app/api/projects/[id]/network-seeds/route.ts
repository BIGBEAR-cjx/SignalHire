import { updateProjectNetworkSeeds } from "@/lib/projects";
import { normalizeLocale, t } from "@/lib/i18n.mjs";
import { getUser } from "@/lib/session";

export const runtime = "nodejs";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  let body: { network_seeds?: unknown; locale?: unknown } = {};
  try { body = await req.json(); } catch {}
  const locale = normalizeLocale(body.locale);
  const user = await getUser();
  if (!user) return Response.json({ error: t(locale, "api.error.loginRequired") }, { status: 401 });
  const { id } = await ctx.params;
  if (!id) return Response.json({ error: t(locale, "api.error.missingId") }, { status: 400 });

  const networkSeeds = await updateProjectNetworkSeeds({
    userId: user.id,
    id,
    networkSeeds: body.network_seeds ?? [],
  });
  if (!networkSeeds) return Response.json({ error: t(locale, "api.error.projectUpdateUnavailable") }, { status: 404 });
  return Response.json({ network_seeds: networkSeeds });
}
