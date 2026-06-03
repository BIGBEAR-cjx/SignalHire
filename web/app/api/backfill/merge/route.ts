import { mergeBackfillRuns } from "@/lib/db";
import { getUser } from "@/lib/session";

export const runtime = "nodejs";

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

// POST /api/backfill/merge { original_run_id, backfill_run_id }
// 将已完成的补搜 run 合并回原始 search run，更新原始 research_runs.result。
export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return Response.json({ error: "请先登录" }, { status: 401 });

  let body: Record<string, unknown> = {};
  try {
    const parsed = await req.json();
    if (isRecord(parsed)) body = parsed;
  } catch {}

  const originalRunId = cleanString(body.original_run_id);
  const backfillRunId = cleanString(body.backfill_run_id);
  if (!originalRunId || !backfillRunId) {
    return Response.json({ error: "缺少 original_run_id 或 backfill_run_id" }, { status: 400 });
  }

  const merged = await mergeBackfillRuns({
    originalRunId,
    backfillRunId,
    userId: user.id,
  });
  if (!merged) return Response.json({ error: "原报告或补搜结果不存在，或队列暂不可用" }, { status: 404 });
  return Response.json({ merged: true, ...merged });
}
