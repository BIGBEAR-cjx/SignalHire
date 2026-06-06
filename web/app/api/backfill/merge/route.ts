import { mergeBackfillRuns } from "@/lib/db";
import { normalizeLocale, t } from "@/lib/i18n.mjs";
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
  let body: Record<string, unknown> = {};
  try {
    const parsed = await req.json();
    if (isRecord(parsed)) body = parsed;
  } catch {}
  const locale = normalizeLocale(body.locale);

  const user = await getUser();
  if (!user) return Response.json({ error: t(locale, "api.error.loginRequired") }, { status: 401 });

  const originalRunId = cleanString(body.original_run_id);
  const backfillRunId = cleanString(body.backfill_run_id);
  if (!originalRunId || !backfillRunId) {
    return Response.json({ error: t(locale, "api.error.missingBackfillRunIds") }, { status: 400 });
  }

  const merged = await mergeBackfillRuns({
    originalRunId,
    backfillRunId,
    userId: user.id,
    locale,
  });
  if (!merged) return Response.json({ error: t(locale, "api.error.backfillMergeUnavailable") }, { status: 404 });
  return Response.json({ merged: true, ...merged });
}
