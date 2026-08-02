import { buildRoleOutreachSettings } from "./outreach-settings.mjs";

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanLower(value) {
  return cleanString(value).toLowerCase();
}

function uniqueList(values) {
  return Array.from(new Set((Array.isArray(values) ? values : []).map(cleanLower).filter(Boolean)));
}

const DEFAULT_PUBLIC_APP_ORIGIN = "https://evidenthire.work";

function absoluteBaseUrl(value) {
  return (cleanString(value) || cleanString(process.env.PUBLIC_APP_ORIGIN)).replace(/\/+$/, "") || DEFAULT_PUBLIC_APP_ORIGIN;
}

function safeProjectName(value) {
  return cleanString(value).slice(0, 120) || "your recruiting project";
}

export function upsertClientDeliveryInvite(settings = {}, { email = "", now = new Date().toISOString() } = {}) {
  const normalized = buildRoleOutreachSettings(settings);
  const cleanEmail = cleanLower(email);
  if (!cleanEmail) return normalized;
  const sentAt = new Date(now);
  const lastSentAt = Number.isFinite(sentAt.getTime()) ? sentAt.toISOString() : new Date().toISOString();
  const expiresAt = new Date(Date.parse(lastSentAt) + 30 * 24 * 60 * 60 * 1000).toISOString();
  const currentAccess = normalized.client_delivery_access;
  const existing = currentAccess.invites.find((invite) => invite.email === cleanEmail);
  return buildRoleOutreachSettings({
    ...normalized,
    client_delivery_access: {
      ...currentAccess,
      mode: "token_or_customer_account",
      allowed_emails: uniqueList([...currentAccess.allowed_emails, cleanEmail]),
      invites: [
        ...currentAccess.invites.filter((invite) => invite.email !== cleanEmail),
        {
          email: cleanEmail,
          status: "active",
          invited_at: existing?.invited_at || lastSentAt,
          last_sent_at: lastSentAt,
          expires_at: existing?.expires_at || expiresAt,
          revoked_at: "",
        },
      ],
    },
  });
}

export function buildClientPortalInviteEmail({
  email = "",
  projectName = "",
  baseUrl = "",
  locale = "en",
} = {}) {
  const to = cleanLower(email);
  const base = absoluteBaseUrl(baseUrl);
  const name = safeProjectName(projectName);
  const registerUrl = `${base}/register?next=/client`;
  const portalUrl = `${base}/client`;
  const subject = locale === "zh" ? `邀请查看 ${name} 的客户交付` : `Invitation to review ${name} delivery`;
  const text = locale === "zh"
    ? `你已被邀请在 SignalHire 客户门户查看「${name}」。\n\n请使用 ${to} 注册，并完成邮箱验证码验证：\n${registerUrl}\n\n验证后打开客户工作台：\n${portalUrl}`
    : `You have been invited to review ${name} in SignalHire Client Portal.\n\nUse ${to} to sign up and verify your email code:\n${registerUrl}\n\nAfter verification, open your client workspace:\n${portalUrl}`;
  return { to, subject, text };
}

export async function sendClientPortalInviteEmail({
  email = "",
  projectName = "",
  baseUrl = "",
  allowedEmails = [],
  allowedDomains = [],
  locale = "en",
  env = process.env,
  fetchImpl = globalThis.fetch,
} = {}) {
  const apiKey = cleanString(env.RESEND_API_KEY);
  const from = cleanString(env.CLIENT_PORTAL_INVITE_FROM || env.RESEND_FROM_EMAIL);
  if (!apiKey || !from) {
    return { status: "blocked", provider: "", error: "email_provider_not_configured" };
  }
  const message = buildClientPortalInviteEmail({ email, projectName, baseUrl, allowedEmails, allowedDomains, locale });
  let response;
  try {
    response = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: message.to,
        subject: message.subject,
        text: message.text,
      }),
    });
  } catch {
    return { status: "failed", provider: "resend", error: "email_send_failed" };
  }
  if (!response?.ok) {
    return { status: "failed", provider: "resend", error: "email_send_failed" };
  }
  const data = typeof response.json === "function" ? await response.json().catch(() => ({})) : {};
  return { status: "sent", provider: "resend", id: cleanString(data?.id) };
}
