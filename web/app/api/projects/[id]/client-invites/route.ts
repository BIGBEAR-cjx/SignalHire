import { getProject, recordProjectClientDeliveryAuditEvent, updateProjectOutreachSettings } from "@/lib/projects";
import { normalizeLocale, t } from "@/lib/i18n.mjs";
import { getUser } from "@/lib/session";
import { sendClientPortalInviteEmail, upsertClientDeliveryInvite } from "@/lib/client-portal-invites.mjs";

export const runtime = "nodejs";

const sendInviteEmail = sendClientPortalInviteEmail as (input: {
  email: string;
  projectName: string;
  baseUrl: string;
  allowedEmails: string[];
  allowedDomains: string[];
  locale: string;
}) => Promise<unknown>;

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  let body: { email?: unknown; locale?: unknown } = {};
  try { body = await req.json(); } catch {}
  const locale = normalizeLocale(body.locale);
  const email = cleanString(body.email).toLowerCase();
  if (!email || !validEmail(email)) return Response.json({ error: "invalid_invite_email" }, { status: 400 });

  const user = await getUser();
  if (!user) return Response.json({ error: t(locale, "api.error.loginRequired") }, { status: 401 });
  const { id } = await ctx.params;
  if (!id) return Response.json({ error: t(locale, "api.error.missingId") }, { status: 400 });

  const project = await getProject(user.id, id);
  if (!project) return Response.json({ error: t(locale, "api.error.projectNotFound") }, { status: 404 });

  const currentSettings = project.outreach_settings && typeof project.outreach_settings === "object"
    ? project.outreach_settings as Record<string, unknown>
    : {};
  const currentAccess = currentSettings.client_delivery_access && typeof currentSettings.client_delivery_access === "object" && !Array.isArray(currentSettings.client_delivery_access)
    ? currentSettings.client_delivery_access as { invites?: Array<{ email?: string }> }
    : {};
  const isResend = Array.isArray(currentAccess.invites)
    ? currentAccess.invites.some((invite) => cleanString(invite.email).toLowerCase() === email)
    : false;
  const settings = upsertClientDeliveryInvite(currentSettings, { email });
  const savedSettings = await updateProjectOutreachSettings({ userId: user.id, id, settings });
  if (!savedSettings) return Response.json({ error: t(locale, "api.error.projectUpdateUnavailable") }, { status: 404 });

  const access = (savedSettings as ReturnType<typeof upsertClientDeliveryInvite>).client_delivery_access;
  const origin = new URL(req.url).origin;
  const email_status = await sendInviteEmail({
    email,
    projectName: project.name,
    baseUrl: origin,
    allowedEmails: access.allowed_emails,
    allowedDomains: access.allowed_domains,
    locale,
  });
  await recordProjectClientDeliveryAuditEvent({
    userId: user.id,
    projectId: id,
    event: {
      event_type: "client_portal_access",
      action_type: isResend ? "client_portal_invite_resend" : "client_portal_invite_sent",
      actor: cleanString(user.email) || "Team",
      sentiment: String((email_status as { status?: unknown })?.status || ""),
      note: `Client portal invite ${isResend ? "resent" : "sent"} to ${email}.`,
      detail: `Client portal invite ${isResend ? "resent" : "sent"} to ${email}.`,
      at: new Date().toISOString(),
    },
  });

  return Response.json({ settings: savedSettings, email_status });
}
