import type { ContactEmail } from "./contact-profile.mjs";

export const GMAIL_SEND_SCOPE: string;
export const GMAIL_READONLY_SCOPE: string;
export const GOOGLE_CALENDAR_FREEBUSY_SCOPE: string;
export function encryptTokenBundle(bundle: unknown, secret: string): string;
export function decryptTokenBundle(value: string, secret: string): unknown;
export function buildGmailAuthUrl(input: { clientId: string; redirectUri: string; state: string }): string;
export function buildGmailRawMessage(input: { from: string; to: string; subject: string; body: string }): string;
export function buildGmailSendPayload(input: { raw: string; threadId?: string }): { raw: string; threadId?: string };
export function validateOutreachSend(input: { thread?: unknown; gmailConnected: boolean }): { ok: false; reason: string } | { ok: true; email: ContactEmail };
export function validateInboxDraftSend(input: { thread?: unknown; gmailConnected: boolean }): { ok: false; reason: string } | { ok: true; email: ContactEmail; action: string };
