import { flatten } from "@/lib/cache";
import { enqueue } from "@/lib/db";
import { getUser } from "@/lib/session";
import { buildBackfillSearchInput } from "@/lib/talent-profile.mjs";

export const runtime = "nodejs";

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

// POST /api/backfill { job, original_query?, source_run_id?, project_id? }
// 把 coverage_backfill.jobs 里的一个缺口转成新的 focused search 任务。
export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return Response.json({ error: "请先登录" }, { status: 401 });

  let body: Record<string, unknown> = {};
  try {
    const parsed = await req.json();
    if (isRecord(parsed)) body = parsed;
  } catch {}

  const job = body.job ?? body.backfill_job;
  if (!isRecord(job)) return Response.json({ error: "缺少补搜任务" }, { status: 400 });

  const originalQuery = cleanString(body.original_query);
  const sourceRunId = cleanString(body.source_run_id);
  const projectId = cleanString(body.project_id) || null;
  const queryText = buildBackfillSearchInput({ job, originalQuery });
  const missingSourceType = cleanString(job.missing_source_type) || "source";
  const coverageGroup = cleanString(job.coverage_group) || "coverage";
  const gapId = cleanString(job.gap_id) || `${coverageGroup}-${missingSourceType}`;
  const label = `补搜 ${coverageGroup}/${missingSourceType}`;
  const flatKey = flatten(["backfill", sourceRunId, gapId, queryText].filter(Boolean).join(" "));

  const jobId = await enqueue({
    kind: "search",
    flatKey,
    queryText,
    label,
    userId: user.id,
    projectId,
  });
  if (!jobId) return Response.json({ error: "队列暂不可用 (DB 未配置)，请稍后重试" }, { status: 503 });
  return Response.json({ queued: true, jobId });
}
