import { buildContactProviderConfig as defaultBuildContactProviderConfig, resolveHunterContact as defaultResolveHunterContact } from "./contact-providers.mjs";
import {
  buildContactResolutionResult,
  buildSkippedContactResolutionResult,
  contactResolutionEligibility,
} from "./contact-resolution.mjs";

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

function forceRefresh(body) {
  return Boolean(isRecord(body) && body.force_refresh === true);
}

function normalizeProviderError(error) {
  const source = isRecord(error) ? error : {};
  const status = Number(source.status ?? source.statusCode ?? 0);
  const message = error instanceof Error ? error.message : cleanString(error);
  if (status === 401 || status === 403 || /hunter_40[13]|unauthorized|forbidden|invalid[_ -]?key/i.test(message)) {
    return new Error("provider_auth_error");
  }
  if (status === 429 || /hunter_429|rate[_ -]?limit|too many requests/i.test(message)) {
    return new Error("provider_rate_limited");
  }
  if (status === 402 || /quota|credit|payment/i.test(message)) {
    return new Error("provider_quota_exceeded");
  }
  return new Error("provider_error");
}

async function resolveThreadContact({
  thread,
  userId,
  providerConfig,
  env,
  updateOutreachThread,
  resolveHunterContact,
  force = false,
} = {}) {
  const id = cleanString(thread?.id);
  const candidate = candidateWithThreadContact(thread);
  const eligibility = contactResolutionEligibility({ candidate, forceRefresh: force });
  if (!eligibility.eligible) {
    return buildSkippedContactResolutionResult({
      candidateId: id,
      candidate,
      provider: providerConfig.provider,
      reason: eligibility.reason,
    });
  }

  let providerResult = null;
  let providerError = null;
  try {
    providerResult = await resolveHunterContact({
      apiKey: env.HUNTER_API_KEY,
      candidate,
    });
  } catch (error) {
    providerError = normalizeProviderError(error);
  }

  const result = buildContactResolutionResult({
    candidateId: id,
    candidate,
    provider: providerConfig.provider,
    enabled: providerConfig.enabled,
    reason: providerConfig.reason,
    providerResult,
    error: providerError,
  });

  if (result.status === "resolved" || result.status === "not_found" || result.status === "error") {
    const updated = await updateOutreachThread({
      userId,
      id,
      contact_profile: result.contact_profile,
      send_error: result.send_eligibility.can_send ? "" : (result.status === "error" ? result.reason : result.send_eligibility.reason),
    });
    if (!updated) return null;
  }

  return result;
}

/**
 * @param {{
 *   body?: { outreach_thread_id?: unknown, force_refresh?: unknown };
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

  if (!config.enabled) {
    const result = buildContactResolutionResult({
      candidateId: id,
      candidate,
      provider: config.provider,
      enabled: false,
      reason: config.reason,
    });
    return { status: 200, body: result };
  }

  const result = await resolveThreadContact({
    thread: { ...thread, id },
    userId: user.id,
    providerConfig: config,
    env,
    updateOutreachThread,
    resolveHunterContact,
    force: forceRefresh(body),
  });
  if (!result) return { status: 404, body: { error: notFound } };
  return { status: 200, body: result };
}

function emptySummary() {
  return { resolved: 0, skipped: 0, failed: 0, cost_units: 0 };
}

function summarizeItem(result) {
  return {
    id: cleanString(result?.candidate_id),
    status: cleanString(result?.status),
    reason: cleanString(result?.reason),
    can_send: Boolean(result?.send_eligibility?.can_send),
    cost_units: Number(result?.audit?.cost_units ?? result?.contact_profile?.resolution?.cost_units ?? 0) || 0,
  };
}

/**
 * @param {{
 *   body?: { project_id?: unknown, force_refresh?: unknown };
 *   user?: { id?: string } | null;
 *   env?: object;
 *   listOutreachThreads?: (input: { userId: string; projectId: string }) => Promise<unknown[]>;
 *   updateOutreachThread?: (input: { userId: string; id: string; contact_profile: unknown; send_error: string }) => Promise<unknown>;
 *   buildContactProviderConfig?: (env: object) => { provider: string; enabled: boolean; reason: string };
 *   resolveHunterContact?: (input: { apiKey?: string; candidate: unknown }) => Promise<unknown>;
 *   messages?: { loginRequired?: string; missingId?: string };
 *   maxProviderCalls?: number;
 * }} input
 */
export async function runBulkContactResolution({
  body = {},
  user = null,
  env = {},
  listOutreachThreads = async () => [],
  updateOutreachThread = async () => null,
  buildContactProviderConfig = defaultBuildContactProviderConfig,
  resolveHunterContact = defaultResolveHunterContact,
  messages = {},
  maxProviderCalls = 10,
} = {}) {
  const loginRequired = messages.loginRequired || "login_required";
  const missingId = messages.missingId || "missing_id";
  if (!user?.id) return { status: 401, body: { error: loginRequired } };
  const projectId = cleanString(body.project_id);
  if (!projectId) return { status: 400, body: { error: missingId } };

  const config = buildContactProviderConfig(env);
  if (!config.enabled) {
    return {
      status: 200,
      body: {
        ok: false,
        status: "disabled",
        provider: config.provider,
        reason: config.reason,
        summary: emptySummary(),
        items: [],
      },
    };
  }

  const threads = await listOutreachThreads({ userId: user.id, projectId });
  const summary = emptySummary();
  const items = [];
  let providerCalls = 0;

  for (const thread of threads) {
    const id = cleanString(thread?.id);
    const candidate = candidateWithThreadContact(thread);
    const eligibility = contactResolutionEligibility({ candidate, forceRefresh: forceRefresh(body) });
    if (!eligibility.eligible) {
      const skipped = buildSkippedContactResolutionResult({
        candidateId: id,
        candidate,
        provider: config.provider,
        reason: eligibility.reason,
      });
      summary.skipped += 1;
      items.push(summarizeItem(skipped));
      continue;
    }
    if (providerCalls >= maxProviderCalls) {
      const skipped = buildSkippedContactResolutionResult({
        candidateId: id,
        candidate,
        provider: config.provider,
        reason: "cost_guard_limit",
      });
      summary.skipped += 1;
      items.push(summarizeItem(skipped));
      continue;
    }
    providerCalls += 1;
    const result = await resolveThreadContact({
      thread,
      userId: user.id,
      providerConfig: config,
      env,
      updateOutreachThread,
      resolveHunterContact,
      force: true,
    });
    if (!result || result.status === "error") summary.failed += 1;
    else if (result.status === "resolved") summary.resolved += 1;
    else if (result.status === "not_found" || result.status === "skipped") summary.skipped += 1;
    summary.cost_units += Number(result?.audit?.cost_units ?? 0) || 0;
    items.push(summarizeItem(result));
  }

  return {
    status: 200,
    body: {
      ok: summary.failed === 0,
      status: "ok",
      provider: config.provider,
      reason: "",
      summary,
      items,
    },
  };
}
