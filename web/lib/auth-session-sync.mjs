function whoamiUrl(locale = "zh") {
  return `/api/whoami?locale=${encodeURIComponent(locale)}`;
}

export async function confirmSessionCookie(fetchImpl = globalThis.fetch, locale = "zh") {
  try {
    const response = await fetchImpl(whoamiUrl(locale));
    return Boolean(response?.ok);
  } catch {
    return false;
  }
}

export async function writeAndConfirmSessionCookie(accessToken, fetchImpl = globalThis.fetch, locale = "zh") {
  try {
    const token = typeof accessToken === "string" ? accessToken.trim() : "";
    if (!token) return false;
    const response = await fetchImpl("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken: token, locale }),
    });
    if (!response?.ok) return false;
    return await confirmSessionCookie(fetchImpl, locale);
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
