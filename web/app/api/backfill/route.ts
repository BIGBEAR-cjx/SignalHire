import { flatten } from "@/lib/cache";
import { enqueue } from "@/lib/db";
import { normalizeLocale, t } from "@/lib/i18n.mjs";
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
  let body: Record<string, unknown> = {};
  try {
    const parsed = await req.json();
    if (isRecord(parsed)) body = parsed;
  } catch {}
  const locale = normalizeLocale(body.locale);

  const user = await getUser();
  if (!user) return Response.json({ error: t(locale, "api.error.loginRequired") }, { status: 401 });

  const job = body.job ?? body.backfill_job;
  if (!isRecord(job)) return Response.json({ error: t(locale, "api.error.missingBackfillJob") }, { status: 400 });

  const originalQuery = cleanString(body.original_query);
  const sourceRunId = cleanString(body.source_run_id);
  const projectId = cleanString(body.project_id) || null;
  const queryText = buildBackfillSearchInput({ job, originalQuery, locale });
  const missingSourceType = cleanString(job.missing_source_type) || "source";
  const coverageGroup = cleanString(job.coverage_group) || "coverage";
  const gapId = cleanString(job.gap_id) || `${coverageGroup}-${missingSourceType}`;
  const label = t(locale, "run.label.backfill", { coverage: coverageGroup, source: missingSourceType });
  const flatKey = flatten(["backfill", sourceRunId, gapId, queryText].filter(Boolean).join(" "));
  const platformLanguage = locale === "en" ? "English" : "Chinese (Simplified)";

  const jobId = await enqueue({
    kind: "search",
    flatKey,
    queryText,
    label,
    userId: user.id,
    projectId,
    platformLanguage,
  });
  if (!jobId) return Response.json({ error: t(locale, "api.error.queueUnavailableRetry") }, { status: 503 });
  return Response.json({ queued: true, jobId });
}
