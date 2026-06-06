import { cancelRun } from "@/lib/db";
import { normalizeLocale, t } from "@/lib/i18n.mjs";
import { getUser } from "@/lib/session";

export const runtime = "nodejs";

// POST /api/cancel { id } -> 停止当前用户的 queued/running/retrying 任务。
export async function POST(req: Request) {
  let id = "";
  let locale: string | undefined;
  try { ({ id, locale } = await req.json()); } catch {}
  locale = normalizeLocale(locale);

  const user = await getUser();
  if (!user) return Response.json({ error: t(locale, "api.error.loginRequired") }, { status: 401 });
  if (!id) return Response.json({ error: t(locale, "api.error.missingId") }, { status: 400 });

  const status = await cancelRun(id, user.id);
  if (!status) return Response.json({ error: t(locale, "api.error.jobUnavailable") }, { status: 404 });
  if (status.status !== "canceled") return Response.json({ error: t(locale, "api.error.jobNotCancelable"), status }, { status: 409 });
  return Response.json({ canceled: true, runId: id, ...status });
}
