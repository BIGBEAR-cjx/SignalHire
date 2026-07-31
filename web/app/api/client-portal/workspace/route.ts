import { buildClientPortalWorkspaceView } from "@/lib/client-portal-workspace.mjs";
import { loadClientPortalWorkspaceDetails, normalizeClientPortalWorkspaceOffset } from "@/lib/client-portal-route-guards.mjs";
import {
  findClientPortalAuthorizedProjects,
  loadClientPortalProjectDetail,
} from "@/lib/client-portal";
import { normalizeLocale, t } from "@/lib/i18n.mjs";
import { getUser } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const user = await getUser();
  const url = new URL(req.url);
  const locale = normalizeLocale(url.searchParams.get("locale") || url.searchParams.get("lang"));
  const offset = normalizeClientPortalWorkspaceOffset(url.searchParams.get("offset"));
  if (!user) return Response.json({ error: t(locale, "api.error.unauthorized") }, { status: 401 });

  const { projects, projectDetails, pagination } = await loadClientPortalWorkspaceDetails({
    viewer: user,
    locale,
    offset,
    dependencies: {
      findAuthorizedProjects: findClientPortalAuthorizedProjects,
      loadProjectDetail: loadClientPortalProjectDetail,
    },
  });
  return Response.json(buildClientPortalWorkspaceView({
    viewer: user,
    projects,
    projectDetails,
    pagination,
    locale,
  }));
}
