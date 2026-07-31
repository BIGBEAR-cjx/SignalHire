const CLIENT_PORTAL_PAGE_SIZE = 30;
const CLIENT_PORTAL_MAX_OFFSET = 10_000;

function cleanId(value) {
  return typeof value === "string" ? value.trim().slice(0, 160) : "";
}

function sameProject(project, projectId) {
  return cleanId(project?.id) === cleanId(projectId);
}

function requireDependency(dependencies, name) {
  if (typeof dependencies?.[name] !== "function") {
    throw new Error(`client_portal_route_guard_dependency_missing:${name}`);
  }
  return dependencies[name];
}

export function normalizeClientPortalWorkspaceOffset(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, CLIENT_PORTAL_MAX_OFFSET) : 0;
}

/** @param {{ viewer?: unknown, locale?: string, offset?: number, dependencies?: Record<string, unknown> }} input */
export async function loadClientPortalWorkspaceDetails({ viewer, locale = "zh", offset = 0, dependencies = {} } = {}) {
  const findAuthorizedProjects = requireDependency(dependencies, "findAuthorizedProjects");
  const loadProjectDetail = requireDependency(dependencies, "loadProjectDetail");
  const foundProjects = await findAuthorizedProjects(viewer);
  const authorizedProjects = Array.isArray(foundProjects) ? foundProjects : [];
  const safeOffset = normalizeClientPortalWorkspaceOffset(offset);
  const projects = authorizedProjects.slice(safeOffset, safeOffset + CLIENT_PORTAL_PAGE_SIZE);
  const entries = await Promise.all(
    projects.map(async (project) => {
      const detail = await loadProjectDetail(project, locale);
      return [project.id, detail];
    }),
  );
  return {
    projects,
    projectDetails: Object.fromEntries(entries),
    pagination: {
      offset: safeOffset,
      total: authorizedProjects.length,
      has_more: safeOffset + projects.length < authorizedProjects.length,
      next_offset: safeOffset + projects.length < authorizedProjects.length ? safeOffset + projects.length : null,
    },
  };
}

/** @param {{ viewer?: unknown, projectId?: unknown, locale?: string, dependencies?: Record<string, unknown> }} input */
export async function resolveClientPortalProjectDetail({ viewer, projectId, locale = "zh", dependencies = {} } = {}) {
  const findInitialAuthorizedProject = requireDependency(dependencies, "findInitialAuthorizedProject");
  const recheckAuthorizedProject = requireDependency(dependencies, "recheckAuthorizedProject");
  const verifyProjectAccess = requireDependency(dependencies, "verifyProjectAccess");
  const loadProjectDetail = requireDependency(dependencies, "loadProjectDetail");
  const id = cleanId(projectId);
  const initialProject = id ? await findInitialAuthorizedProject(viewer, id) : null;
  if (!sameProject(initialProject, id) || !verifyProjectAccess(initialProject, viewer)?.allowed) {
    return { status: "not_found", project: null, detail: null };
  }

  const currentProject = await recheckAuthorizedProject(viewer, id);
  if (!sameProject(currentProject, id) || !verifyProjectAccess(currentProject, viewer)?.allowed) {
    return { status: "revoked", project: initialProject, detail: null };
  }

  const detail = await loadProjectDetail(currentProject, locale);
  return { status: "allowed", project: currentProject, detail };
}
