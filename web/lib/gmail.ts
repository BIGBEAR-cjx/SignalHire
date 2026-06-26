import { createClient } from "@insforge/sdk";
import { buildGmailAuthUrl, buildGmailRawMessage, buildGmailSendPayload, decryptTokenBundle, encryptTokenBundle, validateInboxDraftSend, validateOutreachSend } from "./gmail-outreach.mjs";
import { refreshGmailTokenBundle } from "./gmail-token.mjs";
import { buildInboxDraftSentPatch } from "./inbox-actions.mjs";
import { getOutreachThread, updateOutreachThread, type OutreachThread } from "./outreach-threads";

const BASE = process.env.INSFORGE_API_BASE_URL;
const KEY = process.env.INSFORGE_API_KEY;
const client = BASE && KEY ? createClient({ baseUrl: BASE, anonKey: KEY, isServerMode: true }) : null;
const TABLE = "gmail_connections";
const GMAIL_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";
const GMAIL_THREAD_URL = "https://gmail.googleapis.com/gmail/v1/users/me/threads";

type GmailTokenBundle = {
  access_token?: string;
  refresh_token?: string;
  expires_at?: string;
  token_type?: string;
  scope?: string;
};

export type GmailConnection = {
  id: string;
  user_id: string;
  gmail_address: string;
  encrypted_token_bundle: string;
  scope: string;
  expires_at: string | null;
  connected_at: string;
  updated_at: string;
};

export type GmailThreadMessage = {
  id: string;
  threadId: string;
  snippet: string;
  from: string;
  date: string;
  bodyText: string;
};

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function safeState(userId: string) {
  return Buffer.from(JSON.stringify({ userId, ts: Date.now() }), "utf8").toString("base64url");
}

function stateUserId(value: string) {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    return typeof parsed.userId === "string" ? parsed.userId : "";
  } catch {
    return "";
  }
}

async function findConnection(userId: string): Promise<GmailConnection | null> {
  if (!client) return null;
  try {
    const { data, error } = await client.database
      .from(TABLE)
      .select("*")
      .eq("user_id", userId)
      .limit(1);
    if (error || !data || data.length === 0) return null;
    return (data as GmailConnection[])[0];
  } catch {
    return null;
  }
}

async function saveConnection(input: {
  userId: string;
  gmailAddress: string;
  encryptedTokenBundle: string;
  scope: string;
  expiresAt: string | null;
}) {
  if (!client) return false;
  const existing = await findConnection(input.userId);
  const row = {
    gmail_address: input.gmailAddress,
    encrypted_token_bundle: input.encryptedTokenBundle,
    scope: input.scope,
    expires_at: input.expiresAt,
    updated_at: new Date().toISOString(),
  };
  try {
    if (existing) {
      const { data, error } = await client.database
        .from(TABLE)
        .update(row)
        .eq("id", existing.id)
        .eq("user_id", input.userId)
        .select("id");
      return !error && Boolean(data?.length);
    }
    const { data, error } = await client.database
      .from(TABLE)
      .insert({ user_id: input.userId, ...row })
      .select("id");
    return !error && Boolean(data?.length);
  } catch {
    return false;
  }
}

export async function getGmailConnectionStatus(userId: string) {
  const configured = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REDIRECT_URI && process.env.GMAIL_TOKEN_ENCRYPTION_KEY);
  const connection = await findConnection(userId);
  return {
    configured,
    connected: Boolean(connection),
    gmail_address: connection?.gmail_address ?? "",
    scope: connection?.scope ?? "",
    can_read_inbox: Boolean(connection?.scope?.includes("gmail.readonly")),
    expires_at: connection?.expires_at ?? null,
  };
}

export function buildConnectUrl(userId: string) {
  return buildGmailAuthUrl({
    clientId: requiredEnv("GOOGLE_CLIENT_ID"),
    redirectUri: requiredEnv("GOOGLE_REDIRECT_URI"),
    state: safeState(userId),
  });
}

export async function exchangeGmailCodeForTokens(input: { userId: string; userEmail: string; code: string; state: string }) {
  if (stateUserId(input.state) !== input.userId) throw new Error("Invalid Gmail OAuth state");
  const body = new URLSearchParams({
    code: input.code,
    client_id: requiredEnv("GOOGLE_CLIENT_ID"),
    client_secret: requiredEnv("GOOGLE_CLIENT_SECRET"),
    redirect_uri: requiredEnv("GOOGLE_REDIRECT_URI"),
    grant_type: "authorization_code",
  });
  const response = await fetch(GMAIL_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) throw new Error(`Gmail token exchange failed ${response.status}`);
  const token = await response.json() as Record<string, unknown>;
  const expiresIn = Number(token.expires_in ?? 0);
  const expiresAt = expiresIn > 0 ? new Date(Date.now() + expiresIn * 1000).toISOString() : null;
  const bundle: GmailTokenBundle = {
    access_token: typeof token.access_token === "string" ? token.access_token : "",
    refresh_token: typeof token.refresh_token === "string" ? token.refresh_token : "",
    token_type: typeof token.token_type === "string" ? token.token_type : "",
    scope: typeof token.scope === "string" ? token.scope : "",
    expires_at: expiresAt ?? undefined,
  };
  if (!bundle.access_token) throw new Error("Gmail token exchange did not return access token");
  return saveConnection({
    userId: input.userId,
    gmailAddress: input.userEmail,
    encryptedTokenBundle: encryptTokenBundle(bundle, requiredEnv("GMAIL_TOKEN_ENCRYPTION_KEY")),
    scope: bundle.scope ?? "",
    expiresAt,
  });
}

export async function disconnectGmail(userId: string) {
  if (!client) return false;
  try {
    const { error } = await client.database
      .from(TABLE)
      .delete()
      .eq("user_id", userId);
    return !error;
  } catch {
    return false;
  }
}

async function accessTokenFor(connection: GmailConnection) {
  const bundle = decryptTokenBundle(connection.encrypted_token_bundle, requiredEnv("GMAIL_TOKEN_ENCRYPTION_KEY")) as GmailTokenBundle;
  const result = await refreshGmailTokenBundle({
    bundle,
    clientId: requiredEnv("GOOGLE_CLIENT_ID"),
    clientSecret: requiredEnv("GOOGLE_CLIENT_SECRET"),
  });
  if (result.refreshed) {
    const refreshedBundle = result.bundle as GmailTokenBundle;
    await saveConnection({
      userId: connection.user_id,
      gmailAddress: connection.gmail_address,
      encryptedTokenBundle: encryptTokenBundle(refreshedBundle, requiredEnv("GMAIL_TOKEN_ENCRYPTION_KEY")),
      scope: refreshedBundle.scope ?? connection.scope,
      expiresAt: refreshedBundle.expires_at ?? connection.expires_at,
    });
  }
  if (result.accessToken) return result.accessToken;
  throw new Error("gmail_reconnect_required");
}

async function sendViaGmail(input: { accessToken: string; raw: string; threadId?: string }) {
  const response = await fetch(GMAIL_SEND_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(buildGmailSendPayload({ raw: input.raw, threadId: input.threadId })),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Gmail send failed ${response.status}`);
  return json as { id?: string; threadId?: string };
}

function gmailHeader(headers: Array<{ name?: string; value?: string }> | undefined, name: string) {
  return headers?.find((header) => header.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function decodeBodyData(value: unknown) {
  if (typeof value !== "string" || !value) return "";
  try {
    return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
  } catch {
    return "";
  }
}

function bodyTextFromPayload(payload: Record<string, unknown> | undefined): string {
  if (!payload || typeof payload !== "object") return "";
  const body = payload.body as { data?: unknown } | undefined;
  const direct = decodeBodyData(body?.data);
  if (direct) return direct;
  const parts = Array.isArray(payload.parts) ? payload.parts : [];
  const textPart = parts.find((part) => {
    const source = part as { mimeType?: string };
    return source.mimeType === "text/plain";
  }) as { body?: { data?: unknown } } | undefined;
  return decodeBodyData(textPart?.body?.data);
}

export async function getGmailThreadMessages(input: { userId: string; threadId: string }): Promise<GmailThreadMessage[]> {
  const connection = await findConnection(input.userId);
  if (!connection || !input.threadId.trim()) return [];
  const response = await fetch(`${GMAIL_THREAD_URL}/${encodeURIComponent(input.threadId)}?format=full`, {
    headers: { Authorization: `Bearer ${await accessTokenFor(connection)}` },
  });
  if (!response.ok) throw new Error(`Gmail thread read failed ${response.status}`);
  const json = await response.json() as { messages?: unknown[] };
  return (json.messages ?? []).map((message) => {
    const source = (message ?? {}) as Record<string, unknown>;
    const payload = source.payload as Record<string, unknown> | undefined;
    const headers = payload?.headers as Array<{ name?: string; value?: string }> | undefined;
    return {
      id: typeof source.id === "string" ? source.id : "",
      threadId: typeof source.threadId === "string" ? source.threadId : input.threadId,
      snippet: typeof source.snippet === "string" ? source.snippet : "",
      from: gmailHeader(headers, "From"),
      date: gmailHeader(headers, "Date"),
      bodyText: bodyTextFromPayload(payload),
    };
  }).filter((message) => message.id || message.snippet || message.bodyText);
}

export async function sendApprovedOutreachThread(input: { userId: string; threadId: string }) {
  const [connection, thread] = await Promise.all([
    findConnection(input.userId),
    getOutreachThread({ userId: input.userId, id: input.threadId }),
  ]);
  if (!thread) return { ok: false, error: "thread_not_found" };
  const validation = validateOutreachSend({ thread, gmailConnected: Boolean(connection) });
  if (!validation.ok) {
    await updateOutreachThread({ userId: input.userId, id: input.threadId, send_error: validation.reason });
    return { ok: false, error: validation.reason };
  }
  try {
    const raw = buildGmailRawMessage({
      from: connection?.gmail_address || "me",
      to: validation.email.value,
      subject: thread.subject,
      body: thread.body,
    });
    const result = await sendViaGmail({ accessToken: await accessTokenFor(connection as GmailConnection), raw });
    const updated = await updateOutreachThread({
      userId: input.userId,
      id: input.threadId,
      status: "sent",
      gmail_message_id: result.id ?? "",
      gmail_thread_id: result.threadId ?? "",
      send_error: "",
    });
    if (!updated) return { ok: false, error: "send_state_update_failed" };
    return { ok: true, thread: updated };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gmail send failed";
    await updateOutreachThread({ userId: input.userId, id: input.threadId, send_error: message });
    return { ok: false, error: message };
  }
}

export async function sendInboxDraftThread(input: { userId: string; threadId: string }) {
  const [connection, thread] = await Promise.all([
    findConnection(input.userId),
    getOutreachThread({ userId: input.userId, id: input.threadId }),
  ]);
  if (!thread) return { ok: false, error: "thread_not_found" };
  const validation = validateInboxDraftSend({ thread, gmailConnected: Boolean(connection) });
  if (!validation.ok) {
    await updateOutreachThread({ userId: input.userId, id: input.threadId, send_error: validation.reason });
    return { ok: false, error: validation.reason };
  }
  try {
    const raw = buildGmailRawMessage({
      from: connection?.gmail_address || "me",
      to: validation.email.value,
      subject: thread.subject,
      body: thread.body,
    });
    const result = await sendViaGmail({
      accessToken: await accessTokenFor(connection as GmailConnection),
      raw,
      threadId: thread.gmail_thread_id,
    });
    const sentPatch = buildInboxDraftSentPatch({ notes: thread.notes });
    if (!sentPatch.ok) {
      await updateOutreachThread({ userId: input.userId, id: input.threadId, send_error: sentPatch.error });
      return { ok: false, error: sentPatch.error };
    }
    const updated = await updateOutreachThread({
      userId: input.userId,
      id: input.threadId,
      ...sentPatch.patch,
      gmail_message_id: result.id ?? "",
      gmail_thread_id: result.threadId ?? thread.gmail_thread_id,
      send_error: "",
    });
    if (!updated) return { ok: false, error: "send_state_update_failed" };
    return { ok: true, thread: updated };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gmail send failed";
    await updateOutreachThread({ userId: input.userId, id: input.threadId, send_error: message });
    return { ok: false, error: message };
  }
}

export function canSendThread(thread: OutreachThread | null, connected: boolean) {
  return validateOutreachSend({ thread: thread ?? {}, gmailConnected: connected });
}
