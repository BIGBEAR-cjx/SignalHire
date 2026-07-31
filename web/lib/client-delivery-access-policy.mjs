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

function normalizeInvite(value, options = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const email = cleanLower(value.email);
  if (!email) return null;
  const expiresAt = validIso(value.expires_at || value.expiresAt);
  const revokedAt = validIso(value.revoked_at || value.revokedAt);
  const rawStatus = cleanLower(value.status);
  const expired = expiresAt && new Date(expiresAt).getTime() <= nowTime(options);
  return {
    email,
    status: rawStatus === "revoked" ? "revoked" : expired ? "expired" : "active",
    invited_at: validIso(value.invited_at || value.invitedAt),
    last_sent_at: validIso(value.last_sent_at || value.lastSentAt),
    expires_at: expiresAt,
    revoked_at: revokedAt,
  };
}

export function normalizeClientDeliveryAccessPolicy(value = {}, options = {}) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const seen = new Set();
  const invites = (Array.isArray(source.invites) ? source.invites : [])
    .map((item) => normalizeInvite(item, options))
    .filter((item) => {
      if (!item || seen.has(item.email)) return false;
      seen.add(item.email);
      return true;
    });
  return {
    mode: cleanString(source.mode) === "token_or_customer_account" ? "token_or_customer_account" : "token_only",
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
