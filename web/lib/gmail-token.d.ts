export type GmailTokenBundle = {
  access_token?: string;
  refresh_token?: string;
  expires_at?: string;
  token_type?: string;
  scope?: string;
};

export function tokenBundleNeedsRefresh(bundle?: GmailTokenBundle, now?: Date): boolean;
export function buildGmailRefreshRequest(input?: {
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
}): {
  url: string;
  method: "POST";
  headers: { "Content-Type": "application/x-www-form-urlencoded" };
  body: string;
  redacted_body: string;
};
export function gmailReconnectRequired(error: unknown): boolean;
export function refreshGmailTokenBundle(input?: {
  bundle?: GmailTokenBundle;
  clientId?: string;
  clientSecret?: string;
  now?: Date;
  fetchImpl?: typeof fetch;
}): Promise<{ accessToken: string; bundle: GmailTokenBundle; refreshed: boolean }>;
