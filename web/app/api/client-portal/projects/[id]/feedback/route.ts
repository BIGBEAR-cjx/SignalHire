import { handleClientPortalFeedbackPost } from "@/lib/client-report-feedback.mjs";
import {
  clientPortalReportHref,
  findClientPortalAuthorizedProject,
} from "@/lib/client-portal";
import { projectRuns, recordProjectRoleAgentEvent } from "@/lib/projects";
import { normalizeLocale, t } from "@/lib/i18n.mjs";
import { getUser } from "@/lib/session";

export const runtime = "nodejs";

async function findClientPortalProjectReport(project: { user_id: string; id: string }, reportId: string) {
  const reports = await projectRuns(project.user_id, project.id, 100);
  return reports.find((report) => report.id === reportId && report.kind === "search") ?? null;
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return handleClientPortalFeedbackPost({
    req,
    projectId: id,
    dependencies: {
      getUser,
      findAuthorizedProject: findClientPortalAuthorizedProject,
      recheckAuthorizedProject: findClientPortalAuthorizedProject,
      findProjectReport: findClientPortalProjectReport,
      clientPortalReportHref,
      recordProjectRoleAgentEvent,
      normalizeLocale,
      t,
      expectedAction: "client_delivery_feedback",
    },
  });
}
