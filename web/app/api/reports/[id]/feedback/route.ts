import { getRunById } from "@/lib/db";
import { getProject, recordProjectRoleAgentEvent } from "@/lib/projects";
import { buildClientReportFeedbackEvent, normalizeClientReportFeedbackForShareAccess } from "@/lib/client-report-feedback.mjs";
import { buildClientDeliveryShareHref, verifyClientDeliveryShareAccess } from "@/lib/report-share-access.mjs";
import { buildRoleOutreachSettings } from "@/lib/outreach-settings.mjs";
import { normalizeLocale, t } from "@/lib/i18n.mjs";
import { getUser } from "@/lib/session";

export const runtime = "nodejs";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let body: Record<string, unknown> = {};
  try {
    const parsed = await req.json();
    if (isRecord(parsed)) body = parsed;
  } catch {}
  const locale = normalizeLocale(body.locale);
  if (!id) return Response.json({ error: t(locale, "api.error.missingId") }, { status: 400 });

  const row = await getRunById(id);
  const token = cleanString(body.token) || cleanString(new URL(req.url).searchParams.get("t"));
  const viewer = await getUser();
  const project = row?.user_id && row?.project_id ? await getProject(row.user_id, row.project_id) : null;
  const accessPolicy = buildRoleOutreachSettings(project?.outreach_settings).client_delivery_access;
  const shareAccess = verifyClientDeliveryShareAccess(row ? { ...row, id } : null, token, { viewer, accessPolicy });
  if (!row || !shareAccess.allowed) {
    const status = shareAccess.reason === "missing_report" ? 404 : 403;
    return Response.json({ error: t(locale, status === 404 ? "api.error.jobUnavailable" : "api.error.invalidFeedback") }, { status });
  }

  if (row.kind !== "search" || !row.user_id || !row.project_id) {
    return Response.json({ error: t(locale, "api.error.invalidFeedback") }, { status: 400 });
  }

  const feedback = normalizeClientReportFeedbackForShareAccess(body, {
    shareAccess,
    user: viewer,
    reportId: id,
  });
  if (!feedback) return Response.json({ error: t(locale, "api.error.invalidFeedback") }, { status: 400 });

  const event = buildClientReportFeedbackEvent({
    feedback,
    reportHref: buildClientDeliveryShareHref({ ...row, id }, { locale }),
    now: new Date(),
  });
  if (!event) return Response.json({ error: t(locale, "api.error.invalidFeedback") }, { status: 400 });
  if (event.action_type !== "client_delivery_feedback") {
    return Response.json({ error: t(locale, "api.error.invalidFeedback") }, { status: 400 });
  }

  const metrics = await recordProjectRoleAgentEvent({
    userId: row.user_id,
    id: row.project_id,
    event,
  });
  if (!metrics) return Response.json({ error: t(locale, "api.error.projectUpdateUnavailable") }, { status: 404 });

  return Response.json({ saved: true, feedback, event, metrics });
}
