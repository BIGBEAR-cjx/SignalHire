function whoamiUrl(locale = "zh") {
  return `/api/whoami?locale=${encodeURIComponent(locale)}`;
}

function timeoutResult(ms) {
  return new Promise((resolve) => setTimeout(() => resolve(false), ms));
}

export async function confirmSessionCookie(fetchImpl = globalThis.fetch, locale = "zh", timeoutMs = 1200) {
  try {
    const response = await Promise.race([
      fetchImpl(whoamiUrl(locale)),
      timeoutResult(timeoutMs),
    ]);
    return Boolean(response?.ok);
  } catch {
    return false;
  }
}

export async function writeAndConfirmSessionCookie(accessToken, fetchImpl = globalThis.fetch, locale = "zh", confirmTimeoutMs = 1200) {
  try {
    const token = typeof accessToken === "string" ? accessToken.trim() : "";
    if (!token) return false;
    const response = await fetchImpl("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken: token, locale }),
    });
    if (!response?.ok) return false;
    await confirmSessionCookie(fetchImpl, locale, confirmTimeoutMs);
    return true;
  } catch {
    return false;
  }
}

export async function syncSessionCookieFromTokenManager(authClient, fetchImpl = globalThis.fetch, locale = "zh") {
  try {
    const tm = authClient?.auth?.tokenManager;
    const token = tm?.getAccessToken?.();
    if (!token) return false;
    const response = await fetchImpl("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken: token, locale }),
    });
    return Boolean(response?.ok);
  } catch {
    return false;
  }
}
