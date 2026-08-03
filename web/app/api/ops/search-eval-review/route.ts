import fixture from "../../../../../docs/evals/search-eval-v1-cases.json";
import { insforgeAdmin } from "../../../../lib/insforge-admin.mjs";
import { authorizeOpsUser } from "../../../../lib/ops-auth";
import {
  parseIndependentReviewSubmission,
  projectSearchEvalCases,
  searchEvalFixtureVersion,
  summarizeIndependentReview,
} from "../../../../lib/search-eval-review.mjs";
import { getUser } from "../../../../lib/session";

export const runtime = "nodejs";

type SearchEvalReviewCase = {
  id: string;
  difficulty: string;
  brief: string;
  requiredConditions: string[];
  excludedConditions: string[];
  candidate: { name: string; canonicalUrl: string };
  evidenceUrls: string[];
};

const cases = projectSearchEvalCases(fixture) as SearchEvalReviewCase[];
const caseIds = cases.map((item) => item.id);
const fixtureVersion = searchEvalFixtureVersion(fixture);

function failure(status: number, error: string) {
  return Response.json({ error }, { status });
}

function firstRow(value: unknown) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function projectEntry(value: Record<string, unknown>) {
  return {
    case_id: typeof value.case_id === "string" ? value.case_id : "",
    verdict: typeof value.verdict === "string" ? value.verdict : "",
    notes: typeof value.notes === "string" ? value.notes : "",
  };
}

async function readLatestReview() {
  if (!insforgeAdmin) throw new Error("Search Eval review storage is not configured");
  const { data: sessionRows, error: sessionError } = await insforgeAdmin.database
    .from("search_eval_independent_review_sessions")
    .select("id,reviewer_name,submitted_by_email,submitted_at,fixture_version")
    .order("submitted_at", { ascending: false })
    .limit(1);
  if (sessionError) throw new Error("Search Eval review lookup failed");
  const session = firstRow(sessionRows) as Record<string, unknown> | null;
  if (!session || typeof session.id !== "string") return null;

  const { data: entryRows, error: entryError } = await insforgeAdmin.database
    .from("search_eval_independent_review_entries")
    .select("case_id,verdict,notes")
    .eq("review_session_id", session.id)
    .order("case_id", { ascending: true });
  if (entryError) throw new Error("Search Eval review entries lookup failed");
  const entries = Array.isArray(entryRows) ? entryRows.map((entry) => projectEntry(entry as Record<string, unknown>)) : [];
  const summary = summarizeIndependentReview(entries.map((entry) => ({
    caseId: entry.case_id,
    verdict: entry.verdict,
  })), caseIds);

  const { data: confirmationRows, error: confirmationError } = await insforgeAdmin.database
    .from("search_eval_review_promotions")
    .select("confirmed_by_email,confirmed_at")
    .eq("review_session_id", session.id)
    .limit(1);
  if (confirmationError) throw new Error("Search Eval review confirmation lookup failed");
  const confirmation = firstRow(confirmationRows) as Record<string, unknown> | null;

  return {
    id: session.id,
    reviewer_name: typeof session.reviewer_name === "string" ? session.reviewer_name : "",
    submitted_by_email: typeof session.submitted_by_email === "string" ? session.submitted_by_email : "",
    submitted_at: typeof session.submitted_at === "string" ? session.submitted_at : "",
    fixture_version: typeof session.fixture_version === "string" ? session.fixture_version : "",
    entries,
    summary,
    promotion: confirmation ? {
      confirmed_by_email: typeof confirmation.confirmed_by_email === "string" ? confirmation.confirmed_by_email : "",
      confirmed_at: typeof confirmation.confirmed_at === "string" ? confirmation.confirmed_at : "",
    } : null,
  };
}

export async function GET() {
  const authorization = authorizeOpsUser(await getUser());
  if (authorization.status !== 200) return failure(authorization.status, authorization.status === 401 ? "login_required" : "forbidden");
  try {
    return Response.json({ cases, fixture_version: fixtureVersion, latest_review: await readLatestReview() });
  } catch {
    return failure(500, "search_eval_review_lookup_failed");
  }
}

export async function POST(request: Request) {
  const authorization = authorizeOpsUser(await getUser());
  if (authorization.status !== 200 || !authorization.user) return failure(authorization.status, authorization.status === 401 ? "login_required" : "forbidden");
  if (!insforgeAdmin) return failure(500, "search_eval_review_storage_not_configured");

  let body: unknown;
  try { body = await request.json(); } catch { return failure(400, "invalid_json"); }
  const input = parseIndependentReviewSubmission(body, { caseIds, fixtureVersion });
  if (!input) return failure(400, "invalid_review_submission");

  try {
    const { data: sessionRows, error: sessionError } = await insforgeAdmin.database
      .from("search_eval_independent_review_sessions")
      .insert([{
        reviewer_name: input.reviewerName,
        submitted_by_user_id: authorization.user.id,
        submitted_by_email: authorization.user.email,
        fixture_version: fixtureVersion,
      }])
      .select("id")
      .limit(1);
    if (sessionError) throw new Error("Search Eval review session could not be stored");
    const session = firstRow(sessionRows) as Record<string, unknown> | null;
    if (!session || typeof session.id !== "string") throw new Error("Search Eval review session has no id");

    const { error: entriesError } = await insforgeAdmin.database
      .from("search_eval_independent_review_entries")
      .insert(input.entries.map((entry) => ({
        review_session_id: session.id,
        case_id: entry.caseId,
        verdict: entry.verdict,
        notes: entry.notes,
      })));
    if (entriesError) throw new Error("Search Eval review entries could not be stored");
    return Response.json({ review: await readLatestReview() }, { status: 201 });
  } catch {
    return failure(500, "search_eval_review_store_failed");
  }
}
