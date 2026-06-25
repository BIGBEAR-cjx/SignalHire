import test from "node:test";
import assert from "node:assert/strict";
import {
  buildContactProfile,
  primarySendableEmail,
} from "./web/lib/contact-profile.mjs";

test("contact profile accepts only emails with source and confidence", () => {
  const profile = buildContactProfile({
    contact_profile: {
      emails: [
        { value: "ada@example.ai", source: "internal_resume", confidence: "high" },
        { value: "guessed@example.ai", confidence: "high" },
        { value: "unknown@example.ai", source: "manual_upload" },
      ],
      phones: [{ value: "+1 555 0100", source: "internal_resume", confidence: "medium" }],
      linkedin_url: "https://linkedin.com/in/ada",
    },
  });

  assert.deepEqual(profile.emails, [
    {
      value: "ada@example.ai",
      type: "unknown",
      source: "internal_resume",
      confidence: "high",
      last_verified_at: "",
      deliverability_status: "unknown",
    },
  ]);
  assert.equal(profile.phones.length, 1);
  assert.equal(profile.linkedin_url, "https://linkedin.com/in/ada");
  assert.equal(profile.contactability_score, 100);
});

test("contact profile can use top-level internal resume contact rows when sourced", () => {
  const profile = buildContactProfile({
    email: "grace@example.com",
    email_source: "internal_resume",
    email_confidence: "medium",
    phone: "+1 555 0101",
    phone_source: "manual_upload",
    phone_confidence: "medium",
  });

  assert.equal(profile.emails[0].value, "grace@example.com");
  assert.equal(profile.emails[0].source, "internal_resume");
  assert.equal(profile.phones[0].source, "manual_upload");
  assert.equal(primarySendableEmail(profile)?.value, "grace@example.com");
});

test("contact profile extracts sourced emails from internal resume snapshots", () => {
  const profile = buildContactProfile({
    candidate_snapshot: {
      internal_resume: {
        contact: {
          email: "resume@example.ai",
          phone: "+1 555 0102",
        },
      },
    },
  });

  assert.equal(profile.emails[0].value, "resume@example.ai");
  assert.equal(profile.emails[0].source, "internal_resume");
  assert.equal(profile.emails[0].confidence, "medium");
  assert.equal(profile.phones[0].source, "internal_resume");
});

test("contact profile extracts provider raw rows with provider provenance", () => {
  const profile = buildContactProfile({
    provider: "pdl",
    work_email: "pdl@example.ai",
    phone_numbers: [{ raw_number: "+1 555 0103" }],
    linkedin_url: "linkedin.com/in/pdl",
  });

  assert.equal(profile.emails[0].value, "pdl@example.ai");
  assert.equal(profile.emails[0].source, "pdl");
  assert.equal(profile.emails[0].confidence, "medium");
  assert.equal(primarySendableEmail(profile)?.value, "pdl@example.ai");
});

test("low confidence emails are visible but not sendable", () => {
  const profile = buildContactProfile({
    contact_profile: {
      emails: [{ value: "low@example.com", source: "people_api", confidence: "low" }],
    },
  });

  assert.equal(profile.emails.length, 1);
  assert.equal(primarySendableEmail(profile), null);
});
