import { retryRun } from "@/lib/db";
import { getUser } from "@/lib/session";

export const runtime = "nodejs";

// POST /api/retry { id } → 把当前用户的失败任务重新入队。
export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return Response.json({ error: "请先登录" }, { status: 401 });

  let id = "";
  try { ({ id } = await req.json()); } catch {}
  if (!id) return Response.json({ error: "缺少 id" }, { status: 400 });

  const status = await retryRun(id, user.id);
  if (!status) return Response.json({ error: "任务不存在或队列暂不可用" }, { status: 404 });
  if (status.status !== "queued") return Response.json({ error: "任务当前不可重试", status }, { status: 409 });
  return Response.json({ retried: true, runId: id, ...status });
}
