import { getStatus } from "@/lib/db";

export const runtime = "nodejs";

// GET /api/status?id=<jobId> → 前端轮询异步任务状态/进度/结果。
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return Response.json({ error: "缺少 id" }, { status: 400 });
  const s = await getStatus(id);
  if (!s) return Response.json({ status: "unknown" }, { status: 404 });
  return Response.json({ runId: id, ...s });
}
