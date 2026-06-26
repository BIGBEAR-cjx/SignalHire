import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { primarySendableEmail } from "./contact-profile.mjs";

export const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";
export const GMAIL_READONLY_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function latestInboxActionState(notes = "") {
  const marker = "signalhire-inbox-action";
  const regex = new RegExp(`<!--${marker}:([^>]*)-->`, "g");
  let last = "";
  let match;
  while ((match = regex.exec(cleanString(notes)))) last = match[1];
  if (!last) return null;
  try {
    return JSON.parse(decodeURIComponent(last));
  } catch {
    return null;
  }
}

function encryptionKey(secret) {
  const clean = cleanString(secret);
  if (!clean) throw new Error("Missing Gmail token encryption key");
  return createHash("sha256").update(clean).digest();
}

export function encryptTokenBundle(bundle, secret) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(secret), iv);
  const plaintext = JSON.stringify(bundle ?? {});
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((part) => part.toString("base64url")).join(".");
}

export function decryptTokenBundle(value, secret) {
  const [ivText, tagText, encryptedText] = cleanString(value).split(".");
  if (!ivText || !tagText || !encryptedText) throw new Error("Invalid encrypted token bundle");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(secret), Buffer.from(ivText, "base64url"));
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedText, "base64url")),
    decipher.final(),
  ]).toString("utf8");
  return JSON.parse(decrypted);
}

export function buildGmailAuthUrl({ clientId, redirectUri, state }) {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", cleanString(clientId));
  url.searchParams.set("redirect_uri", cleanString(redirectUri));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", `${GMAIL_SEND_SCOPE} ${GMAIL_READONLY_SCOPE}`);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", cleanString(state));
  return url.toString();
}

function encodeHeader(value) {
  return cleanString(value).replace(/\r?\n/g, " ");
}

export function buildGmailRawMessage({ from, to, subject, body }) {
  const message = [
    `From: ${encodeHeader(from)}`,
    `To: ${encodeHeader(to)}`,
    `Subject: ${encodeHeader(subject)}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "",
    cleanString(body),
  ].join("\r\n");
  return Buffer.from(message, "utf8").toString("base64url");
}

export function buildGmailSendPayload({ raw, threadId }) {
  const payload = { raw: cleanString(raw) };
  const cleanThreadId = cleanString(threadId);
  if (cleanThreadId) payload.threadId = cleanThreadId;
  return payload;
}

export function validateOutreachSend({ thread, gmailConnected }) {
  const source = isRecord(thread) ? thread : {};
  if (!gmailConnected) return { ok: false, reason: "gmail_not_connected" };
  if (source.status !== "approved") return { ok: false, reason: "not_approved" };
  const email = primarySendableEmail(source.contact_profile);
  if (!email) return { ok: false, reason: "missing_sendable_email" };
  if (!cleanString(source.subject) || !cleanString(source.body)) return { ok: false, reason: "missing_message" };
  return { ok: true, email };
}

export function validateInboxDraftSend({ thread, gmailConnected }) {
  const source = isRecord(thread) ? thread : {};
  if (!gmailConnected) return { ok: false, reason: "gmail_not_connected" };
  const state = latestInboxActionState(source.notes);
  const action = cleanString(state?.action);
  const actionStatus = cleanString(state?.action_status);
  if (!["reply", "save_follow_up_draft"].includes(action) || actionStatus !== "draft_saved") {
    return { ok: false, reason: "draft_not_saved" };
  }
  if (!cleanString(source.gmail_thread_id)) return { ok: false, reason: "missing_gmail_thread_id" };
  const email = primarySendableEmail(source.contact_profile);
  if (!email) return { ok: false, reason: "missing_sendable_email" };
  if (!cleanString(source.subject) || !cleanString(source.body)) return { ok: false, reason: "missing_message" };
  return { ok: true, email, action };
}
