import { buildClientPortalWorkspaceView } from "@/lib/client-portal-workspace.mjs";
import {
  findClientPortalAuthorizedProject,
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
  if (!user) return Response.json({ error: t(locale, "api.error.unauthorized") }, { status: 401 });

  const projects = await findClientPortalAuthorizedProjects(user);
  const entries = await Promise.all(
    projects.slice(0, 30).map(async (project) => {
      const currentProject = await findClientPortalAuthorizedProject(user, project.id);
      if (!currentProject) return null;
      const detail = await loadClientPortalProjectDetail(currentProject, locale);
      return [currentProject.id, detail] as const;
    }),
  );
  const refreshedEntries = entries.filter((entry): entry is NonNullable<typeof entry> => entry !== null);
  const refreshedProjects = refreshedEntries.map((entry) => entry[1].project);
  const projectDetails = Object.fromEntries(refreshedEntries);
  return Response.json(buildClientPortalWorkspaceView({
    viewer: user,
    projects: refreshedProjects,
    projectDetails,
    locale,
  }));
}
