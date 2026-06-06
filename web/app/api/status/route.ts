import { getStatus } from "@/lib/db";
import { getUser } from "@/lib/session";

export const runtime = "nodejs";

// GET /api/status?id=<jobId> → 前端轮询异步任务状态/进度/结果。
// 多租户: 需登录, 非本人任务一律返 404 (不泄露 id 是否存在)。
export async function GET(req: Request) {
  const user = await getUser();
  if (!user) return Response.json({ error: "请先登录" }, { status: 401 });

  const params = new URL(req.url).searchParams;
  const id = params.get("id");
  const locale = params.get("locale") || undefined;
  if (!id) return Response.json({ error: "缺少 id" }, { status: 400 });

  const s = await getStatus(id, user.id, locale);
  if (!s) return Response.json({ status: "unknown" }, { status: 404 });
  return Response.json({ runId: id, ...s });
}
