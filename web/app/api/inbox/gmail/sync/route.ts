import { syncGmailInboxForProject } from "@/lib/inbox";
import { normalizeLocale, t } from "@/lib/i18n.mjs";
import { getUser } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: { project_id?: unknown; role_brief?: unknown; locale?: unknown } = {};
  try { body = await req.json(); } catch {}
  const locale = normalizeLocale(body.locale);
  const user = await getUser();
  if (!user) return Response.json({ error: t(locale, "api.error.loginRequired") }, { status: 401 });
  if (typeof body.project_id !== "string" || !body.project_id.trim()) {
    return Response.json({ error: t(locale, "api.error.missingId") }, { status: 400 });
  }
  const result = await syncGmailInboxForProject({
    userId: user.id,
    projectId: body.project_id.trim(),
    roleBrief: typeof body.role_brief === "string" ? body.role_brief : "",
  });
  return Response.json(result, { status: result.ok ? 200 : 409 });
}
