export function confirmSessionCookie(
  fetchImpl?: typeof fetch,
  locale?: string,
): Promise<boolean>;

export function syncSessionCookieFromTokenManager(
  authClient: unknown,
  fetchImpl?: typeof fetch,
  locale?: string,
): Promise<boolean>;

export function writeAndConfirmSessionCookie(
  accessToken: string,
  fetchImpl?: typeof fetch,
  locale?: string,
): Promise<boolean>;
