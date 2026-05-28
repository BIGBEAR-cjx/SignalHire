import { retryRun } from "@/lib/db";

export const runtime = "nodejs";

// POST /api/retry { id } → reset a failed research run back to queued.
export async function POST(req: Request) {
  let id = "";
  try { ({ id } = await req.json()); } catch {}
  if (!id) return Response.json({ error: "缺少 id" }, { status: 400 });
  const status = await retryRun(id);
  if (!status) return Response.json({ error: "任务不存在或队列暂不可用" }, { status: 404 });
  if (status.status !== "queued") return Response.json({ error: "任务当前不可重试", status }, { status: 409 });
  return Response.json({ retried: true, runId: id, ...status });
}
