import { createHmac, timingSafeEqual } from "node:crypto";

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanLower(value) {
  return cleanString(value).toLowerCase();
}

function uniqueCleanList(value) {
  return Array.from(new Set(
    (Array.isArray(value) ? value : [])
      .map(cleanLower)
      .filter(Boolean),
  ));
}

function validIso(value) {
  const clean = cleanString(value);
  if (!clean) return "";
  const date = new Date(clean);
  return Number.isFinite(date.getTime()) ? date.toISOString() : "";
}

function nowTime(options = {}) {
  const date = options.now ? new Date(options.now) : new Date();
  return Number.isFinite(date.getTime()) ? date.getTime() : Date.now();
}

function normalizeClientDeliveryInvite(value, options = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const email = cleanLower(value.email);
  if (!email) return null;
  const expiresAt = validIso(value.expires_at || value.expiresAt);
  const revokedAt = validIso(value.revoked_at || value.revokedAt);
  const rawStatus = cleanLower(value.status);
  const expired = expiresAt && new Date(expiresAt).getTime() <= nowTime(options);
  const status = rawStatus === "revoked"
    ? "revoked"
    : expired
      ? "expired"
      : "active";
  return {
    email,
    status,
    invited_at: validIso(value.invited_at || value.invitedAt),
    last_sent_at: validIso(value.last_sent_at || value.lastSentAt),
    expires_at: expiresAt,
    revoked_at: revokedAt,
  };
}

function normalizeClientDeliveryInvites(value, options = {}) {
  const seen = new Set();
  return (Array.isArray(value) ? value : [])
    .map((item) => normalizeClientDeliveryInvite(item, options))
    .filter((item) => {
      if (!item || seen.has(item.email)) return false;
      seen.add(item.email);
      return true;
    });
}

function shareSecret(options = {}) {
  return cleanString(options.secret)
    || cleanString(process.env.SIGNALHIRE_REPORT_SHARE_SECRET)
    || cleanString(process.env.INSFORGE_API_KEY)
    || "signalhire-local-report-share";
}

function tokenBasis(row = {}) {
  return [
    cleanString(row.id),
    cleanString(row.kind),
    cleanString(row.user_id),
    cleanString(row.project_id),
    cleanString(row.updated_at),
  ].join(":");
}

export function requiresClientDeliveryShareToken(row = {}) {
  return cleanString(row.kind) === "search" && Boolean(cleanString(row.user_id) && cleanString(row.project_id));
}

export function buildClientDeliveryShareToken(row = {}, options = {}) {
  if (!requiresClientDeliveryShareToken(row)) return "";
  return createHmac("sha256", shareSecret(options))
    .update(tokenBasis(row))
    .digest("base64url");
}

export function verifyClientDeliveryShareAccess(row, token, options = {}) {
  if (!row) return { allowed: false, reason: "missing_report" };
  if (!requiresClientDeliveryShareToken(row)) return { allowed: true, reason: "legacy_public_report" };
  const expected = buildClientDeliveryShareToken(row, options);
  const actual = cleanString(token);
  if (expected && actual) {
    const expectedBuffer = Buffer.from(expected);
    const actualBuffer = Buffer.from(actual);
    if (expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer)) {
      return { allowed: true, reason: "valid_share_token" };
    }
  }
  const customerAccess = verifyClientDeliveryCustomerAccountAccess(row, options.viewer, options.accessPolicy);
  if (customerAccess.allowed) return customerAccess;
  if (!expected || !actual) return { allowed: false, reason: "missing_share_token" };
  return { allowed: false, reason: "invalid_share_token" };
}

export function canSubmitAccountFeedback({ authorized = false } = {}) {
  return Boolean(authorized);
}

export function buildClientDeliveryShareHref(row = {}, options = {}) {
  const id = cleanString(row.id);
  if (!id) return "";
  const locale = cleanString(options.locale);
  const token = buildClientDeliveryShareToken(row, options);
  const params = new URLSearchParams();
  if (locale) params.set("lang", locale);
  if (token) params.set("t", token);
  const query = params.toString();
  return `/r/${encodeURIComponent(id)}${query ? `?${query}` : ""}`;
}

export function normalizeClientDeliveryAccessPolicy(value = {}, options = {}) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const mode = cleanString(source.mode) === "token_or_customer_account" ? "token_or_customer_account" : "token_only";
  const invites = normalizeClientDeliveryInvites(source.invites, options);
  return {
    mode,
    allowed_emails: uniqueCleanList([
      ...(Array.isArray(source.allowed_emails || source.allowedEmails) ? source.allowed_emails || source.allowedEmails : []),
      ...invites.filter((invite) => invite.status === "active").map((invite) => invite.email),
    ]),
    allowed_domains: uniqueCleanList(source.allowed_domains || source.allowedDomains)
      .map((domain) => domain.replace(/^@+/, ""))
      .filter(Boolean),
    invites,
  };
}

export function verifyClientDeliveryCustomerAccountAccess(row, viewer, policy = {}) {
  if (!row) return { allowed: false, reason: "missing_report" };
  const viewerId = cleanString(viewer?.id);
  const viewerEmail = cleanLower(viewer?.email);
  if (viewerId && viewerId === cleanString(row.user_id)) return { allowed: true, reason: "owner_account" };
  const normalizedPolicy = normalizeClientDeliveryAccessPolicy(policy);
  if (normalizedPolicy.mode !== "token_or_customer_account") return { allowed: false, reason: "customer_account_not_enabled" };
  if (!viewerEmail) return { allowed: false, reason: "missing_customer_account" };
  const domain = viewerEmail.includes("@") ? viewerEmail.split("@").pop() : "";
  if (normalizedPolicy.allowed_emails.includes(viewerEmail)) return { allowed: true, reason: "valid_customer_account" };
  if (domain && normalizedPolicy.allowed_domains.includes(domain)) return { allowed: true, reason: "valid_customer_account" };
  return { allowed: false, reason: "customer_account_not_allowed" };
}
