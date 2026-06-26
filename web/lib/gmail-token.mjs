const GMAIL_TOKEN_URL = "https://oauth2.googleapis.com/token";
const REFRESH_BUFFER_MS = 60 * 1000;

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function validDateMs(value) {
  const clean = cleanString(value);
  if (!clean) return 0;
  const date = new Date(clean);
  return Number.isFinite(date.getTime()) ? date.getTime() : 0;
}

export function tokenBundleNeedsRefresh(bundle = {}, now = new Date()) {
  const source = isRecord(bundle) ? bundle : {};
  if (!cleanString(source.access_token)) return true;
  const expiresAt = validDateMs(source.expires_at);
  if (!expiresAt) return false;
  return expiresAt - now.getTime() <= REFRESH_BUFFER_MS;
}

export function buildGmailRefreshRequest({ clientId = "", clientSecret = "", refreshToken = "" } = {}) {
  const body = new URLSearchParams({
    client_id: cleanString(clientId),
    client_secret: cleanString(clientSecret),
    refresh_token: cleanString(refreshToken),
    grant_type: "refresh_token",
  });
  const redactedBody = new URLSearchParams(body);
  redactedBody.set("client_secret", "REDACTED");
  redactedBody.set("refresh_token", "REDACTED");
  return {
    url: GMAIL_TOKEN_URL,
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    redacted_body: redactedBody.toString(),
  };
}

export function gmailReconnectRequired(error) {
  return error instanceof Error && error.message === "gmail_reconnect_required";
}

export async function refreshGmailTokenBundle({
  bundle = {},
  clientId = "",
  clientSecret = "",
  now = new Date(),
  fetchImpl = fetch,
} = {}) {
  const source = isRecord(bundle) ? bundle : {};
  if (!tokenBundleNeedsRefresh(source, now)) {
    return { accessToken: cleanString(source.access_token), bundle: source, refreshed: false };
  }
  const refreshToken = cleanString(source.refresh_token);
  if (!refreshToken) throw new Error("gmail_reconnect_required");

  const request = buildGmailRefreshRequest({ clientId, clientSecret, refreshToken });
  const response = await fetchImpl(request.url, {
    method: request.method,
    headers: request.headers,
    body: request.body,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error("gmail_reconnect_required");

  const accessToken = cleanString(payload.access_token);
  if (!accessToken) throw new Error("gmail_reconnect_required");
  const expiresIn = Number(payload.expires_in ?? 0);
  const expiresAt = expiresIn > 0 ? new Date(now.getTime() + expiresIn * 1000).toISOString() : cleanString(source.expires_at);
  const nextBundle = {
    ...source,
    access_token: accessToken,
    refresh_token: cleanString(payload.refresh_token) || refreshToken,
    token_type: cleanString(payload.token_type) || cleanString(source.token_type),
    scope: cleanString(payload.scope) || cleanString(source.scope),
    expires_at: expiresAt,
  };
  return { accessToken, bundle: nextBundle, refreshed: true };
}
