import fixture from "../../../../../../docs/evals/search-eval-v1-cases.json";
import { insforgeAdmin } from "../../../../../lib/insforge-admin.mjs";
import { authorizeOpsUser } from "../../../../../lib/ops-auth";
import { projectSearchEvalCases, summarizeIndependentReview } from "../../../../../lib/search-eval-review.mjs";
import { getUser } from "../../../../../lib/session";

export const runtime = "nodejs";

const caseIds = (projectSearchEvalCases(fixture) as Array<{ id: string }>).map((item) => item.id);

function failure(status: number, error: string) {
  return Response.json({ error }, { status });
}

function reviewId(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const input = body as Record<string, unknown>;
  const value = typeof input.review_id === "string" ? input.review_id.trim() : "";
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) ? value : null;
}

export async function POST(request: Request) {
  const authorization = authorizeOpsUser(await getUser());
  if (authorization.status !== 200 || !authorization.user) return failure(authorization.status, authorization.status === 401 ? "login_required" : "forbidden");
  if (!insforgeAdmin) return failure(500, "search_eval_review_storage_not_configured");

  let body: unknown;
  try { body = await request.json(); } catch { return failure(400, "invalid_json"); }
  const id = reviewId(body);
  if (!id) return failure(400, "invalid_review_id");

  try {
    const { data: reviewRows, error: reviewError } = await insforgeAdmin.database
      .from("search_eval_independent_review_entries")
      .select("case_id,verdict")
      .eq("review_session_id", id);
    const summary = summarizeIndependentReview(Array.isArray(reviewRows) ? reviewRows.map((entry) => ({
      caseId: typeof entry?.case_id === "string" ? entry.case_id : "",
      verdict: typeof entry?.verdict === "string" ? entry.verdict : "",
    })) : [], caseIds);
    if (reviewError || !summary.allPass) {
      return failure(409, "review_is_not_ready_for_promotion");
    }

    const { error: confirmationError } = await insforgeAdmin.database
      .from("search_eval_review_promotions")
      .insert([{
        review_session_id: id,
        confirmed_by_user_id: authorization.user.id,
        confirmed_by_email: authorization.user.email,
      }]);
    if (confirmationError) return failure(409, "review_confirmation_failed");
    return Response.json({ status: "ready_for_source_promotion" }, { status: 201 });
  } catch {
    return failure(500, "search_eval_review_confirmation_failed");
  }
}
