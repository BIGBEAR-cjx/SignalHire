// /api/projects
//   GET → 当前用户全部项目 + KPI
//   POST { name, brief? } → 创建 → { project }
import { createProject, listProjects } from "@/lib/projects";
import { normalizeLocale, t } from "@/lib/i18n.mjs";
import { getUser } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const locale = normalizeLocale(new URL(req.url).searchParams.get("locale"));
  const user = await getUser();
  if (!user) return Response.json({ error: t(locale, "api.error.loginRequired") }, { status: 401 });
  const projects = await listProjects(user.id);
  return Response.json({ projects });
}

export async function POST(req: Request) {
  let body: { name?: unknown; brief?: unknown; locale?: unknown } = {};
  try { body = await req.json(); } catch {}
  const locale = normalizeLocale(body.locale);

  const user = await getUser();
  if (!user) return Response.json({ error: t(locale, "api.error.loginRequired") }, { status: 401 });

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return Response.json({ error: t(locale, "api.error.missingProjectName") }, { status: 400 });
  const brief = typeof body.brief === "string" ? body.brief : null;

  const project = await createProject({ userId: user.id, name: name.slice(0, 120), brief });
  if (!project) return Response.json({ error: t(locale, "api.error.projectCreateFailed") }, { status: 500 });
  return Response.json({ project });
}
