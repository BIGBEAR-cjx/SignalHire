// /api/shortlist/[id]
//   PATCH { status?, notes?, candidate? } → 改状态/备注/候选人快照
//   DELETE → 移出候选池
import { deleteItem, updateItem, STATUSES, type ShortlistStatus } from "@/lib/shortlist";
import { getUser } from "@/lib/session";

export const runtime = "nodejs";

function isStatus(s: unknown): s is ShortlistStatus {
  return typeof s === "string" && (STATUSES as string[]).includes(s);
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) return Response.json({ error: "请先登录" }, { status: 401 });
  const { id } = await ctx.params;
  if (!id) return Response.json({ error: "缺少 id" }, { status: 400 });

  let body: { status?: unknown; notes?: unknown; project_id?: unknown; candidate?: unknown } = {};
  try { body = await req.json(); } catch {}

  const patch: { status?: ShortlistStatus; notes?: string | null; projectId?: string | null; candidate?: unknown } = {};
  if (body.status !== undefined) {
    if (!isStatus(body.status)) return Response.json({ error: "status 取值非法" }, { status: 400 });
    patch.status = body.status;
  }
  if (body.notes !== undefined) {
    if (body.notes !== null && typeof body.notes !== "string") return Response.json({ error: "notes 必须是字符串" }, { status: 400 });
    patch.notes = body.notes as string | null;
  }
  if (body.project_id !== undefined) {
    if (body.project_id !== null && typeof body.project_id !== "string") return Response.json({ error: "project_id 必须是 uuid 或 null" }, { status: 400 });
    patch.projectId = body.project_id as string | null;
  }
  if (body.candidate !== undefined) {
    if (body.candidate === null || typeof body.candidate !== "object" || Array.isArray(body.candidate)) {
      return Response.json({ error: "candidate 必须是对象" }, { status: 400 });
    }
    patch.candidate = body.candidate;
  }
  if (patch.status === undefined && patch.notes === undefined && patch.projectId === undefined && patch.candidate === undefined) {
    return Response.json({ error: "没有可更新的字段" }, { status: 400 });
  }

  const ok = await updateItem({ userId: user.id, id, ...patch });
  if (!ok) return Response.json({ error: "更新失败或条目不存在" }, { status: 404 });
  return Response.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) return Response.json({ error: "请先登录" }, { status: 401 });
  const { id } = await ctx.params;
  if (!id) return Response.json({ error: "缺少 id" }, { status: 400 });

  const ok = await deleteItem(user.id, id);
  if (!ok) return Response.json({ error: "删除失败或条目不存在" }, { status: 404 });
  return Response.json({ ok: true });
}
