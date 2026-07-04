import { buildClientPortalWorkspaceView } from "@/lib/client-portal-workspace.mjs";
import { findClientPortalAuthorizedProjects, loadClientPortalProjectDetail } from "@/lib/client-portal";
import { normalizeLocale, t } from "@/lib/i18n.mjs";
import { getUser } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const user = await getUser();
  const url = new URL(req.url);
  const locale = normalizeLocale(url.searchParams.get("locale") || url.searchParams.get("lang"));
  if (!user) return Response.json({ error: t(locale, "api.error.unauthorized") }, { status: 401 });

  const projects = await findClientPortalAuthorizedProjects(user);
  const entries = await Promise.all(
    projects.slice(0, 30).map(async (project) => {
      const detail = await loadClientPortalProjectDetail(project, locale);
      return [project.id, detail] as const;
    }),
  );
  const projectDetails = Object.fromEntries(entries);
  return Response.json(buildClientPortalWorkspaceView({
    viewer: user,
    projects,
    projectDetails,
    locale,
  }));
}
