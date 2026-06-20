import { createSearchTask, ensureSearchTaskProjectAccess, listSearchTasks } from "@/lib/search-tasks";
import { normalizeLocale, t } from "@/lib/i18n.mjs";
import { getUser } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const locale = normalizeLocale(url.searchParams.get("locale"));
  const user = await getUser();
  if (!user) return Response.json({ error: t(locale, "api.error.loginRequired") }, { status: 401 });
  const projectId = url.searchParams.get("project");
  const tasks = await listSearchTasks({ userId: user.id, projectId: projectId || undefined });
  return Response.json({ tasks });
}

export async function POST(req: Request) {
  let body: { project_id?: unknown; name?: unknown; brief?: unknown; frequency?: unknown; status?: unknown; locale?: unknown } = {};
  try { body = await req.json(); } catch {}
  const locale = normalizeLocale(body.locale);
  const user = await getUser();
  if (!user) return Response.json({ error: t(locale, "api.error.loginRequired") }, { status: 401 });
  if (typeof body.brief !== "string" || !body.brief.trim()) {
    return Response.json({ error: t(locale, "api.error.missingQuery") }, { status: 400 });
  }
  const projectId = typeof body.project_id === "string" ? body.project_id : null;
  if (!(await ensureSearchTaskProjectAccess(user.id, projectId))) {
    return Response.json({ error: t(locale, "api.error.invalidProjectId") }, { status: 404 });
  }
  const task = await createSearchTask({
    userId: user.id,
    projectId,
    name: typeof body.name === "string" ? body.name : undefined,
    brief: body.brief,
    frequency: typeof body.frequency === "string" ? body.frequency : undefined,
    status: typeof body.status === "string" ? body.status : undefined,
  });
  if (!task) return Response.json({ error: t(locale, "api.error.queueUnavailableTrySample") }, { status: 500 });
  return Response.json({ task });
}
