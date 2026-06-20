import { createOutreachThread, ensureOutreachRelationshipAccess, listOutreachQueue, listOutreachThreads } from "@/lib/outreach-threads";
import { normalizeLocale, t } from "@/lib/i18n.mjs";
import { getUser } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const locale = normalizeLocale(url.searchParams.get("locale"));
  const user = await getUser();
  if (!user) return Response.json({ error: t(locale, "api.error.loginRequired") }, { status: 401 });
  const projectId = url.searchParams.get("project");
  const shortlistItemId = url.searchParams.get("shortlist");
  const threads = await listOutreachThreads({
    userId: user.id,
    projectId: projectId || undefined,
    shortlistItemId: shortlistItemId || undefined,
  });
  const queue = await listOutreachQueue({ userId: user.id, projectId: projectId || undefined });
  return Response.json({ threads, queue });
}

export async function POST(req: Request) {
  let body: {
    project_id?: unknown;
    shortlist_item_id?: unknown;
    candidate?: unknown;
    tone?: unknown;
    role_brief?: unknown;
    subject?: unknown;
    body?: unknown;
    status?: unknown;
    next_follow_up_at?: unknown;
    locale?: unknown;
  } = {};
  try { body = await req.json(); } catch {}
  const locale = normalizeLocale(body.locale);
  const user = await getUser();
  if (!user) return Response.json({ error: t(locale, "api.error.loginRequired") }, { status: 401 });
  if (!body.candidate || typeof body.candidate !== "object") {
    return Response.json({ error: t(locale, "api.error.missingCandidate") }, { status: 400 });
  }
  if (typeof body.subject !== "string" || typeof body.body !== "string") {
    return Response.json({ error: t(locale, "api.error.outreachFailed") }, { status: 400 });
  }
  const projectId = typeof body.project_id === "string" ? body.project_id : null;
  const shortlistItemId = typeof body.shortlist_item_id === "string" ? body.shortlist_item_id : null;
  if (!(await ensureOutreachRelationshipAccess({ userId: user.id, projectId, shortlistItemId }))) {
    return Response.json({ error: t(locale, "api.error.shortlistUpdateUnavailable") }, { status: 404 });
  }
  const thread = await createOutreachThread({
    userId: user.id,
    projectId,
    shortlistItemId,
    candidate: body.candidate,
    tone: typeof body.tone === "string" ? body.tone : "professional",
    roleBrief: typeof body.role_brief === "string" ? body.role_brief : "",
    subject: body.subject,
    body: body.body,
    status: typeof body.status === "string" ? body.status : "drafted",
    nextFollowUpAt: typeof body.next_follow_up_at === "string" ? body.next_follow_up_at : null,
  });
  if (!thread) return Response.json({ error: t(locale, "api.error.outreachFailed") }, { status: 500 });
  return Response.json({ thread });
}
