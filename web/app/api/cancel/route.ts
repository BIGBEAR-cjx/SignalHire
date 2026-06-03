import { cancelRun } from "@/lib/db";
import { getUser } from "@/lib/session";

export const runtime = "nodejs";

// POST /api/cancel { id } -> 停止当前用户的 queued/running/retrying 任务。
export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return Response.json({ error: "请先登录" }, { status: 401 });

  let id = "";
  try { ({ id } = await req.json()); } catch {}
  if (!id) return Response.json({ error: "缺少 id" }, { status: 400 });

  const status = await cancelRun(id, user.id);
  if (!status) return Response.json({ error: "任务不存在或队列暂不可用" }, { status: 404 });
  if (status.status !== "canceled") return Response.json({ error: "任务当前不可停止", status }, { status: 409 });
  return Response.json({ canceled: true, runId: id, ...status });
}
