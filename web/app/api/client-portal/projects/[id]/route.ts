import { buildClientPortalProjectView } from "@/lib/client-portal-workspace.mjs";
import { verifyClientPortalProjectAccess } from "@/lib/client-portal-workspace.mjs";
import {
  findClientPortalAuthorizedProject,
  findClientPortalCandidateProject,
  loadClientPortalProjectDetail,
  recordClientPortalAccessDenied,
  recordClientPortalProjectView,
} from "@/lib/client-portal";
import { normalizeLocale, t } from "@/lib/i18n.mjs";
import { getUser } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  const url = new URL(req.url);
  const locale = normalizeLocale(url.searchParams.get("locale") || url.searchParams.get("lang"));
  if (!user) return Response.json({ error: t(locale, "api.error.unauthorized") }, { status: 401 });

  const { id } = await ctx.params;
  const project = await findClientPortalAuthorizedProject(user, id);
  if (!project) {
    const candidate = await findClientPortalCandidateProject(id);
    if (candidate) await recordClientPortalAccessDenied(candidate, user, "unauthorized_customer_account");
    return Response.json({ error: t(locale, "api.error.jobUnavailable") }, { status: 404 });
  }
  const access = verifyClientPortalProjectAccess(project, user);
  if (!access.allowed) {
    await recordClientPortalAccessDenied(project, user, access.reason);
    return Response.json({ error: t(locale, "api.error.jobUnavailable") }, { status: 403 });
  }

  await recordClientPortalProjectView(project, user);
  const detail = await loadClientPortalProjectDetail(project, locale);
  return Response.json(buildClientPortalProjectView({
    viewer: user,
    project: detail.project,
    reports: detail.reports,
    weeklyArchives: detail.weeklyArchives,
    deliverySummary: detail.deliverySummary,
    candidateQueue: detail.candidateQueue,
    auditEvents: detail.auditEvents,
    locale,
  }));
}
