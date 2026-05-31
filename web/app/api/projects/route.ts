// /api/projects
//   GET → 当前用户全部项目 + KPI
//   POST { name, brief? } → 创建 → { project }
import { createProject, listProjects } from "@/lib/projects";
import { getUser } from "@/lib/session";

export const runtime = "nodejs";

export async function GET() {
  const user = await getUser();
  if (!user) return Response.json({ error: "请先登录" }, { status: 401 });
  const projects = await listProjects(user.id);
  return Response.json({ projects });
}

export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return Response.json({ error: "请先登录" }, { status: 401 });

  let body: { name?: unknown; brief?: unknown } = {};
  try { body = await req.json(); } catch {}

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return Response.json({ error: "项目名称必填" }, { status: 400 });
  const brief = typeof body.brief === "string" ? body.brief : null;

  const project = await createProject({ userId: user.id, name: name.slice(0, 120), brief });
  if (!project) return Response.json({ error: "创建失败" }, { status: 500 });
  return Response.json({ project });
}
