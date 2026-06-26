import test from "node:test";
import assert from "node:assert/strict";
import {
  buildContactResolutionResult,
  contactResolutionEligibility,
} from "./web/lib/contact-resolution.mjs";

const now = new Date("2026-06-26T10:00:00.000Z");

test("disabled contact provider keeps existing contacts", () => {
  const result = buildContactResolutionResult({
    candidateId: "c1",
    candidate: {
      name: "Ada",
      contact_profile: {
        emails: [{ value: "ada@example.ai", source: "internal_resume", confidence: "high", deliverability_status: "valid" }],
      },
    },
    provider: "hunter",
    enabled: false,
    reason: "missing HUNTER_API_KEY",
    now,
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, "disabled");
  assert.equal(result.reason, "missing HUNTER_API_KEY");
  assert.equal(result.contact_profile.emails[0].value, "ada@example.ai");
  assert.equal(result.send_eligibility.can_send, true);
  assert.equal(result.audit.searched_at, "2026-06-26T10:00:00.000Z");
});

test("contact resolution rejects provider emails without source and confidence", () => {
  const result = buildContactResolutionResult({
    candidateId: "c2",
    candidate: { name: "Grace" },
    provider: "hunter",
    enabled: true,
    providerResult: {
      contact_profile: {
        emails: [
          { value: "missing-source@example.ai", confidence: "high" },
          { value: "missing-confidence@example.ai", source: "hunter" },
        ],
      },
      cost_units: 1,
    },
    now,
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, "not_found");
  assert.deepEqual(result.contact_profile.emails, []);
  assert.equal(result.send_eligibility.reason, "no_email");
});

test("valid medium or high confidence provider emails become sendable", () => {
  const result = buildContactResolutionResult({
    candidateId: "c3",
    candidate: { name: "Lin", current_company: "Example Labs", linkedin_url: "https://linkedin.com/in/lin" },
    provider: "hunter",
    enabled: true,
    providerResult: {
      contact_profile: {
        emails: [{ value: "lin@example.ai", source: "hunter", confidence: "medium", deliverability_status: "valid" }],
      },
      cost_units: 2,
      request_id: "req-1",
    },
    now,
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, "resolved");
  assert.equal(result.contact_profile.emails[0].source, "hunter");
  assert.equal(result.send_eligibility.can_send, true);
  assert.equal(result.send_eligibility.primary_email.value, "lin@example.ai");
  assert.equal(result.audit.cost_units, 2);
  assert.deepEqual(result.audit.input_fields, ["name", "current_company", "linkedin_url"]);
});

test("low confidence and bounced provider emails are not sendable", () => {
  const low = buildContactResolutionResult({
    candidateId: "c4",
    provider: "hunter",
    enabled: true,
    providerResult: {
      contact_profile: {
        emails: [{ value: "low@example.ai", source: "hunter", confidence: "low", deliverability_status: "valid" }],
      },
    },
  });
  const bounced = buildContactResolutionResult({
    candidateId: "c5",
    provider: "hunter",
    enabled: true,
    providerResult: {
      contact_profile: {
        emails: [{ value: "bounce@example.ai", source: "hunter", confidence: "high", deliverability_status: "bounced" }],
      },
    },
  });

  assert.equal(low.send_eligibility.can_send, false);
  assert.equal(low.send_eligibility.reason, "low_confidence_email");
  assert.equal(bounced.send_eligibility.can_send, false);
  assert.equal(bounced.send_eligibility.reason, "bounced_email");
});

test("provider errors preserve existing contact profile", () => {
  const result = buildContactResolutionResult({
    candidateId: "c6",
    candidate: {
      contact_profile: {
        emails: [{ value: "existing@example.ai", source: "manual_upload", confidence: "medium" }],
      },
    },
    provider: "hunter",
    enabled: true,
    error: new Error("provider timeout"),
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, "error");
  assert.equal(result.reason, "provider timeout");
  assert.equal(result.contact_profile.emails[0].value, "existing@example.ai");
});

test("sendable existing email is skipped unless force refresh is requested", () => {
  const candidate = {
    contact_profile: {
      emails: [{ value: "existing@example.ai", source: "internal_resume", confidence: "high", deliverability_status: "valid" }],
    },
  };

  assert.deepEqual(contactResolutionEligibility({ candidate }), {
    eligible: false,
    status: "skipped",
    reason: "already_sendable",
  });
  assert.deepEqual(contactResolutionEligibility({ candidate, forceRefresh: true }), {
    eligible: true,
    status: "eligible",
    reason: "",
  });
});

test("recent not-found resolution is skipped without force refresh", () => {
  const candidate = {
    contact_profile: {
      emails: [],
      resolution: {
        provider: "hunter",
        status: "not_found",
        reason: "no_contact_found",
        searched_at: "2026-06-26T09:30:00.000Z",
        cost_units: 1,
      },
    },
  };

  const result = contactResolutionEligibility({ candidate, now });

  assert.equal(result.eligible, false);
  assert.equal(result.status, "skipped");
  assert.equal(result.reason, "recent_not_found");
});

test("provider result writes resolution metadata", () => {
  const result = buildContactResolutionResult({
    candidateId: "c7",
    candidate: { name: "Ada", company_domain: "example.ai" },
    provider: "hunter",
    enabled: true,
    providerResult: {
      contact_profile: {
        emails: [{ value: "ada@example.ai", source: "hunter", confidence: "high", deliverability_status: "valid" }],
      },
      cost_units: 1,
      raw_reference: "https://example.ai/team",
    },
    now,
  });

  assert.equal(result.contact_profile.resolution.provider, "hunter");
  assert.equal(result.contact_profile.resolution.status, "resolved");
  assert.equal(result.contact_profile.resolution.cost_units, 1);
  assert.equal(result.contact_profile.resolution.raw_reference, "https://example.ai/team");
});
