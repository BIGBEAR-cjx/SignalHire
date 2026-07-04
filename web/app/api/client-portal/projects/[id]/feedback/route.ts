import { buildClientReportFeedbackEvent, normalizeClientReportFeedback } from "@/lib/client-report-feedback.mjs";
import {
  clientPortalReportHref,
  findClientPortalAuthorizedProject,
  findLatestClientPortalReport,
} from "@/lib/client-portal";
import { recordProjectRoleAgentEvent } from "@/lib/projects";
import { normalizeLocale, t } from "@/lib/i18n.mjs";
import { getUser } from "@/lib/session";

export const runtime = "nodejs";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  let body: Record<string, unknown> = {};
  try {
    const parsed = await req.json();
    if (isRecord(parsed)) body = parsed;
  } catch {}
  const locale = normalizeLocale(body.locale);
  if (!user) return Response.json({ error: t(locale, "api.error.unauthorized") }, { status: 401 });

  const { id } = await ctx.params;
  const project = await findClientPortalAuthorizedProject(user, id);
  if (!project) return Response.json({ error: t(locale, "api.error.jobUnavailable") }, { status: 404 });

  const report = await findLatestClientPortalReport(project);
  if (!report) {
    return Response.json({
      error: locale === "en" ? "No client delivery report is available yet." : "当前项目还没有可绑定的客户交付报告。",
    }, { status: 400 });
  }

  const feedback = normalizeClientReportFeedback(body.feedback ?? body);
  if (!feedback) return Response.json({ error: t(locale, "api.error.invalidFeedback") }, { status: 400 });

  const event = buildClientReportFeedbackEvent({
    feedback,
    reportHref: clientPortalReportHref(report, locale),
    now: new Date(),
  });
  if (!event || event.action_type !== "client_delivery_feedback") {
    return Response.json({ error: t(locale, "api.error.invalidFeedback") }, { status: 400 });
  }

  const metrics = await recordProjectRoleAgentEvent({
    userId: project.user_id,
    id: project.id,
    event,
  });
  if (!metrics) return Response.json({ error: t(locale, "api.error.projectUpdateUnavailable") }, { status: 404 });

  return Response.json({ saved: true, feedback, event, metrics });
}
