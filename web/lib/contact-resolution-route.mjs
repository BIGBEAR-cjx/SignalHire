import { buildContactProviderConfig as defaultBuildContactProviderConfig, resolveHunterContact as defaultResolveHunterContact } from "./contact-providers.mjs";
import { buildContactResolutionResult } from "./contact-resolution.mjs";

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function candidateWithThreadContact(thread) {
  const source = isRecord(thread?.candidate_snapshot) ? thread.candidate_snapshot : {};
  return { ...source, contact_profile: thread?.contact_profile };
}

/**
 * @param {{
 *   body?: { outreach_thread_id?: unknown };
 *   user?: { id?: string } | null;
 *   env?: object;
 *   getOutreachThread?: (input: { userId: string; id: string }) => Promise<unknown>;
 *   updateOutreachThread?: (input: { userId: string; id: string; contact_profile: unknown; send_error: string }) => Promise<unknown>;
 *   buildContactProviderConfig?: (env: object) => { provider: string; enabled: boolean; reason: string };
 *   resolveHunterContact?: (input: { apiKey?: string; candidate: unknown }) => Promise<unknown>;
 *   messages?: { loginRequired?: string; missingId?: string; notFound?: string };
 * }} input
 */
export async function runContactResolution({
  body = {},
  user = null,
  env = {},
  getOutreachThread = async () => null,
  updateOutreachThread = async () => null,
  buildContactProviderConfig = defaultBuildContactProviderConfig,
  resolveHunterContact = defaultResolveHunterContact,
  messages = {},
} = {}) {
  const loginRequired = messages.loginRequired || "login_required";
  const missingId = messages.missingId || "missing_id";
  const notFound = messages.notFound || "not_found";

  if (!user?.id) return { status: 401, body: { error: loginRequired } };
  const id = cleanString(body.outreach_thread_id);
  if (!id) return { status: 400, body: { error: missingId } };

  const thread = await getOutreachThread({ userId: user.id, id });
  if (!thread) return { status: 404, body: { error: notFound } };

  const config = buildContactProviderConfig(env);
  const candidate = candidateWithThreadContact(thread);
  let providerResult = null;
  let providerError = null;
  if (config.enabled) {
    try {
      providerResult = await resolveHunterContact({
        apiKey: env.HUNTER_API_KEY,
        candidate,
      });
    } catch (error) {
      providerError = error;
    }
  }

  const result = buildContactResolutionResult({
    candidateId: id,
    candidate,
    provider: config.provider,
    enabled: config.enabled,
    reason: config.reason,
    providerResult,
    error: providerError,
  });

  if (result.status === "resolved") {
    const updated = await updateOutreachThread({
      userId: user.id,
      id,
      contact_profile: result.contact_profile,
      send_error: result.send_eligibility.can_send ? "" : result.send_eligibility.reason,
    });
    if (!updated) return { status: 404, body: { error: notFound } };
  }

  return { status: 200, body: result };
}
