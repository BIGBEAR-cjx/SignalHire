import { buildMonitorView, getSearchTask, updateSearchTask } from "@/lib/search-tasks";
import { normalizeLocale, t } from "@/lib/i18n.mjs";
import { getUser } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const locale = normalizeLocale(new URL(req.url).searchParams.get("locale"));
  const user = await getUser();
  if (!user) return Response.json({ error: t(locale, "api.error.loginRequired") }, { status: 401 });
  const { id } = await ctx.params;
  const task = await getSearchTask(user.id, id);
  if (!task) return Response.json({ error: t(locale, "api.error.projectNotFound") }, { status: 404 });
  return Response.json({ task: buildMonitorView(task) });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  let body: {
    name?: unknown; brief?: unknown; frequency?: unknown; status?: unknown;
    candidate_batch_size?: unknown; timezone?: unknown; schedule_time?: unknown;
    monthly_credit_limit?: unknown; notification_enabled?: unknown; pause_reason?: unknown; locale?: unknown;
  } = {};
  try { body = await req.json(); } catch {}
  const locale = normalizeLocale(body.locale);
  const user = await getUser();
  if (!user) return Response.json({ error: t(locale, "api.error.loginRequired") }, { status: 401 });
  const { id } = await ctx.params;
  const task = await updateSearchTask({
    userId: user.id,
    id,
    name: typeof body.name === "string" ? body.name : undefined,
    brief: typeof body.brief === "string" ? body.brief : undefined,
    frequency: typeof body.frequency === "string" ? body.frequency : undefined,
    status: typeof body.status === "string" ? body.status : undefined,
    candidate_batch_size: typeof body.candidate_batch_size === "number" ? body.candidate_batch_size : undefined,
    timezone: typeof body.timezone === "string" ? body.timezone : undefined,
    schedule_time: typeof body.schedule_time === "string" ? body.schedule_time : undefined,
    monthly_credit_limit: typeof body.monthly_credit_limit === "number" ? body.monthly_credit_limit : undefined,
    notification_enabled: typeof body.notification_enabled === "boolean" ? body.notification_enabled : undefined,
    pause_reason: typeof body.pause_reason === "string" || body.pause_reason === null ? body.pause_reason : undefined,
  });
  if (!task) return Response.json({ error: t(locale, "api.error.projectNotFound") }, { status: 404 });
  return Response.json({ task: buildMonitorView(task) });
}
