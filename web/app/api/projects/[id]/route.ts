// /api/projects/[id]
//   GET → 项目详情 + KPI + 候选人按状态分布 + 历史搜索
//   PATCH { name?, brief?, status?, color? } → 编辑
//   DELETE → 删除 (关联候选人/历史 project_id 置 NULL, 不删除)
import {
  deleteProject,
  getProject,
  projectCandidateBreakdown,
  projectRuns,
  PROJECT_STATUSES,
  updateProject,
  type ProjectStatus,
} from "@/lib/projects";
import { getUser } from "@/lib/session";

export const runtime = "nodejs";

const VALID_STATUSES = new Set<string>(PROJECT_STATUSES);

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) return Response.json({ error: "请先登录" }, { status: 401 });
  const { id } = await ctx.params;
  if (!id) return Response.json({ error: "缺少 id" }, { status: 400 });

  const [project, breakdown, runs] = await Promise.all([
    getProject(user.id, id),
    projectCandidateBreakdown(user.id, id),
    projectRuns(user.id, id, 30),
  ]);
  if (!project) return Response.json({ error: "项目不存在" }, { status: 404 });

  return Response.json({ project, breakdown, runs });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) return Response.json({ error: "请先登录" }, { status: 401 });
  const { id } = await ctx.params;

  let body: { name?: unknown; brief?: unknown; status?: unknown; color?: unknown } = {};
  try { body = await req.json(); } catch {}

  const patch: {
    name?: string; brief?: string | null; status?: ProjectStatus; color?: string | null;
  } = {};
  if (body.name !== undefined) {
    if (typeof body.name !== "string" || !body.name.trim()) return Response.json({ error: "name 非法" }, { status: 400 });
    patch.name = body.name.trim().slice(0, 120);
  }
  if (body.brief !== undefined) {
    if (body.brief !== null && typeof body.brief !== "string") return Response.json({ error: "brief 非法" }, { status: 400 });
    patch.brief = body.brief as string | null;
  }
  if (body.status !== undefined) {
    if (typeof body.status !== "string" || !VALID_STATUSES.has(body.status)) return Response.json({ error: "status 非法" }, { status: 400 });
    patch.status = body.status as ProjectStatus;
  }
  if (body.color !== undefined) {
    if (body.color !== null && typeof body.color !== "string") return Response.json({ error: "color 非法" }, { status: 400 });
    patch.color = body.color as string | null;
  }
  if (Object.keys(patch).length === 0) return Response.json({ error: "没有可更新的字段" }, { status: 400 });

  const ok = await updateProject({ userId: user.id, id, ...patch });
  if (!ok) return Response.json({ error: "更新失败或项目不存在" }, { status: 404 });
  return Response.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) return Response.json({ error: "请先登录" }, { status: 401 });
  const { id } = await ctx.params;
  const ok = await deleteProject(user.id, id);
  if (!ok) return Response.json({ error: "删除失败或项目不存在" }, { status: 404 });
  return Response.json({ ok: true });
}
