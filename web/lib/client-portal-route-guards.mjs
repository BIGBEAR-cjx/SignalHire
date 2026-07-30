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

/** @param {{ viewer?: unknown, locale?: string, dependencies?: Record<string, unknown> }} input */
export async function loadClientPortalWorkspaceDetails({ viewer, locale = "zh", dependencies = {} } = {}) {
  const findAuthorizedProjects = requireDependency(dependencies, "findAuthorizedProjects");
  const loadProjectDetail = requireDependency(dependencies, "loadProjectDetail");
  const projects = await findAuthorizedProjects(viewer);
  const entries = await Promise.all(
    (Array.isArray(projects) ? projects : []).slice(0, 30).map(async (project) => {
      const detail = await loadProjectDetail(project, locale);
      return [project.id, detail];
    }),
  );
  return {
    projects: Array.isArray(projects) ? projects.slice(0, 30) : [],
    projectDetails: Object.fromEntries(entries),
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
