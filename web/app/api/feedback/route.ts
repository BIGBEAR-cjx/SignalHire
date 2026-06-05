import { saveSearchFeedback } from "@/lib/db";
import { getUser } from "@/lib/session";

export const runtime = "nodejs";

type FeedbackField = "precision" | "satisfaction" | "issue" | "focus";

const ALLOWED: Record<FeedbackField, Set<string>> = {
  precision: new Set(["accurate", "partial", "off"]),
  satisfaction: new Set(["satisfied", "mixed", "unsatisfied"]),
  issue: new Set(["", "too_broad", "wrong_seniority", "wrong_direction", "weak_evidence", "wrong_location", "too_few", "too_many", "other"]),
  focus: new Set(["", "stricter_match", "expand_sources", "stronger_evidence", "adjacent_pools", "higher_seniority", "location_fit"]),
};

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeFeedback(value: unknown) {
  const source = isRecord(value) ? value : {};
  const feedback = {
    precision: cleanString(source.precision),
    satisfaction: cleanString(source.satisfaction),
    issue: cleanString(source.issue),
    focus: cleanString(source.focus),
  };

  if (!ALLOWED.precision.has(feedback.precision)) return null;
  if (!ALLOWED.satisfaction.has(feedback.satisfaction)) return null;
  if (!ALLOWED.issue.has(feedback.issue)) return null;
  if (!ALLOWED.focus.has(feedback.focus)) return null;
  return feedback;
}

// POST /api/feedback { run_id, feedback }
// 将本轮 shortlist 选择题反馈持久化到 research_runs.result.search_feedback。
export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return Response.json({ error: "请先登录" }, { status: 401 });

  let body: Record<string, unknown> = {};
  try {
    const parsed = await req.json();
    if (isRecord(parsed)) body = parsed;
  } catch {}

  const runId = cleanString(body.run_id);
  if (!runId) return Response.json({ error: "缺少 run_id" }, { status: 400 });

  const feedback = normalizeFeedback(body.feedback);
  if (!feedback) return Response.json({ error: "反馈选项无效" }, { status: 400 });

  const saved = await saveSearchFeedback({
    runId,
    userId: user.id,
    feedback,
  });
  if (!saved) return Response.json({ error: "反馈保存失败或本轮搜索不存在" }, { status: 404 });

  return Response.json({ saved: true, ...saved });
}
