import type { ContactEmail } from "./contact-profile.mjs";

export const GMAIL_SEND_SCOPE: string;
export const GMAIL_READONLY_SCOPE: string;
export function encryptTokenBundle(bundle: unknown, secret: string): string;
export function decryptTokenBundle(value: string, secret: string): unknown;
export function buildGmailAuthUrl(input: { clientId: string; redirectUri: string; state: string }): string;
export function buildGmailRawMessage(input: { from: string; to: string; subject: string; body: string }): string;
export function validateOutreachSend(input: { thread?: unknown; gmailConnected: boolean }): { ok: false; reason: string } | { ok: true; email: ContactEmail };
