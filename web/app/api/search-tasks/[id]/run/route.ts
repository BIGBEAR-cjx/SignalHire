import { runSearchTaskNow } from "@/lib/search-tasks";
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
  const queued = await runSearchTaskNow({ userId: user.id, id });
  if (!queued) return Response.json({ error: t(locale, "api.error.queueUnavailableTrySample") }, { status: 503 });
  return Response.json({ queued: true, jobId: queued.jobId, task: queued.task });
}
