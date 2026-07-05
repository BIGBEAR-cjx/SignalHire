import {
  buildProjectCandidateGraphView,
  getProject,
  listClientDeliveryAuditEvents,
  listClientPortalCandidateProjects,
  listProjectClientDeliveryWeeklyArchives,
  projectRuns,
  recordProjectRoleAgentEvent,
  type ProjectWithKpi,
} from "./projects";
import { buildProjectInboxQueueView } from "./inbox";
import { listOutreachQueue } from "./outreach-threads";
import { buildRoleOutreachSettings } from "./outreach-settings.mjs";
import { buildRoleAgentWorkspaceView } from "./role-agent-workspace.mjs";
import {
  verifyClientPortalProjectAccess,
} from "./client-portal-workspace.mjs";

type Viewer = { id?: string | null; email?: string | null } | null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function findClientPortalAuthorizedProjects(viewer: Viewer) {
  const projects = await listClientPortalCandidateProjects(300);
  return projects.filter((project) => verifyClientPortalProjectAccess(project, viewer).allowed);
}

export async function findClientPortalAuthorizedProject(viewer: Viewer, projectId: string) {
  const projects = await findClientPortalAuthorizedProjects(viewer);
  return projects.find((project) => project.id === projectId) ?? null;
}

export async function loadClientPortalProjectDetail(project: ProjectWithKpi, locale: "zh" | "en" = "zh") {
  const ownerId = project.user_id;
  const projectId = project.id;
  const [fullProject, candidateGraph, outreachQueue, inboxQueue, reports, weeklyArchives, auditEvents] = await Promise.all([
    getProject(ownerId, projectId),
    buildProjectCandidateGraphView(ownerId, projectId),
    listOutreachQueue({ userId: ownerId, projectId }),
    buildProjectInboxQueueView(ownerId, projectId),
    projectRuns(ownerId, projectId, 20),
    listProjectClientDeliveryWeeklyArchives({ userId: ownerId, projectId, limit: 20 }),
    listClientDeliveryAuditEvents({ userId: ownerId, projectId, limit: 80 }),
  ]);
  const currentProject = fullProject ?? project;
  const latestReport = reports.find((run) => run.kind === "search") ?? reports[0] ?? null;
  const settings = buildRoleOutreachSettings(currentProject.outreach_settings);
  const workspace = buildRoleAgentWorkspaceView({
    role: { id: projectId, status: currentProject.status },
    settings,
    candidateGraph,
    outreachQueue,
    inboxQueue,
    smartReport: latestReport?.result,
    clientDeliveryAuditEvents: auditEvents,
    locale,
  }) as unknown as {
    delivery_summary?: unknown;
    inbox_pipeline?: {
      interview_ready_queue?: unknown[];
      interested_queue?: unknown[];
    };
  };

  return {
    project: currentProject,
    reports: reports.filter((run) => run.kind === "search"),
    weeklyArchives,
    auditEvents,
    deliverySummary: isRecord(workspace.delivery_summary) ? workspace.delivery_summary : {},
    candidateQueue: [
      ...((Array.isArray(workspace.inbox_pipeline?.interview_ready_queue) ? workspace.inbox_pipeline?.interview_ready_queue : []) ?? []),
    ],
  };
}

export async function findLatestClientPortalReport(project: ProjectWithKpi) {
  const reports = await projectRuns(project.user_id, project.id, 10);
  return reports.find((run) => run.kind === "search") ?? null;
}

export function clientPortalReportHref(report: { id?: string } | null, locale: "zh" | "en") {
  const id = cleanString(report?.id);
  if (!id) return "";
  const params = new URLSearchParams({ lang: locale });
  return `/r/${encodeURIComponent(id)}?${params.toString()}`;
}

export async function recordClientPortalProjectView(project: ProjectWithKpi, viewer: Viewer) {
  const userId = cleanString(project?.user_id);
  const projectId = cleanString(project?.id);
  if (!userId || !projectId) return false;
  const href = `/client/projects/${encodeURIComponent(projectId)}`;
  const actor = cleanString(viewer?.email) || "Client";
  try {
    await recordProjectRoleAgentEvent({
      userId,
      id: projectId,
      event: {
        event_type: "client_report_view",
        action_type: "client_portal_project_view",
        actor,
        report_href: href,
        detail: `Client portal project viewed by ${actor} (${href})`,
        at: new Date().toISOString(),
      },
    });
    return true;
  } catch {
    return false;
  }
}
