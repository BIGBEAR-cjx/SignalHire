import test from "node:test";
import assert from "node:assert/strict";
import {
  buildContactProviderConfig,
  buildHunterEmailFinderRequest,
  normalizeHunterEmailFinderResult,
} from "./web/lib/contact-providers.mjs";

test("contact provider config is disabled until Hunter key exists", () => {
  assert.deepEqual(buildContactProviderConfig({}), {
    provider: "hunter",
    enabled: false,
    reason: "missing HUNTER_API_KEY",
  });
  assert.deepEqual(buildContactProviderConfig({ HUNTER_API_KEY: "key-1" }), {
    provider: "hunter",
    enabled: true,
    reason: "",
  });
});

test("builds Hunter Email Finder request without exposing key in client code", () => {
  const request = buildHunterEmailFinderRequest({
    apiKey: "hunter-key",
    candidate: {
      name: "Ada Lovelace",
      company_domain: "example.ai",
    },
  });

  assert.equal(request.url, "https://api.hunter.io/v2/email-finder?full_name=Ada+Lovelace&domain=example.ai&api_key=hunter-key");
  assert.equal(request.redacted_url, "https://api.hunter.io/v2/email-finder?full_name=Ada+Lovelace&domain=example.ai&api_key=REDACTED");
  assert.equal(request.method, "GET");
});

test("normalizes Hunter Email Finder result into sourced contact profile", () => {
  const result = normalizeHunterEmailFinderResult({
    data: {
      email: "ada@example.ai",
      score: 91,
      sources: [{ uri: "https://example.ai/team", last_seen_on: "2026-06-20" }],
    },
    meta: { credits: { used: 1 } },
  });

  assert.equal(result.contact_profile.emails[0].value, "ada@example.ai");
  assert.equal(result.contact_profile.emails[0].source, "hunter");
  assert.equal(result.contact_profile.emails[0].confidence, "high");
  assert.equal(result.contact_profile.emails[0].deliverability_status, "valid");
  assert.equal(result.cost_units, 1);
  assert.equal(result.raw_reference, "https://example.ai/team");
});

test("normalizes low-score Hunter emails as visible but not directly sendable", () => {
  const result = normalizeHunterEmailFinderResult({
    data: { email: "low@example.ai", score: 40 },
  });

  assert.equal(result.contact_profile.emails[0].confidence, "low");
  assert.equal(result.contact_profile.emails[0].deliverability_status, "risky");
});
