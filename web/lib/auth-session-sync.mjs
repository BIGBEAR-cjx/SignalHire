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
