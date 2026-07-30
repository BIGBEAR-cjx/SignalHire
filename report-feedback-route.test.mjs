import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  normalizeClientReportFeedbackForShareAccess,
} from "./web/lib/client-report-feedback.mjs";
import { verifyClientDeliveryShareAccess } from "./web/lib/report-share-access.mjs";

const feedback = {
  sentiment: "ready_to_interview",
  note: "Strong evidence",
  reviewer: "forged@client.ai",
};

test("direct report feedback derives an account actor from the session", () => {
  const normalized = normalizeClientReportFeedbackForShareAccess({ feedback }, {
    shareAccess: { allowed: true, reason: "valid_customer_account" },
    user: { id: "customer-1", email: "real@client.ai" },
    reportId: "report-1",
  });

  assert.deepEqual(normalized, {
    sentiment: "ready_to_interview",
    note: "Strong evidence",
    actor: "real@client.ai",
    report_id: "report-1",
  });
});

test("direct report feedback ignores a forged reviewer for the report owner", () => {
  const normalized = normalizeClientReportFeedbackForShareAccess({ feedback }, {
    shareAccess: { allowed: true, reason: "owner_account" },
    user: { id: "owner-1", email: "owner@signalhire.ai" },
    reportId: "report-1",
  });

  assert.deepEqual(normalized, {
    sentiment: "ready_to_interview",
    note: "Strong evidence",
    actor: "owner@signalhire.ai",
    report_id: "report-1",
  });
});

test("direct report feedback rejects an unauthorized customer account", () => {
  const shareAccess = verifyClientDeliveryShareAccess({
    id: "report-1",
    kind: "search",
    user_id: "owner-1",
    project_id: "project-1",
    updated_at: "2026-07-30T08:00:00.000Z",
  }, "", {
    viewer: { id: "customer-2", email: "outsider@client.ai" },
    accessPolicy: {
      mode: "token_or_customer_account",
      allowed_emails: ["real@client.ai"],
      allowed_domains: [],
    },
  });
  const route = readFileSync("web/app/api/reports/[id]/feedback/route.ts", "utf8");

  assert.equal(shareAccess.allowed, false);
  assert.match(route, /if \(!row \|\| !shareAccess\.allowed\)/);
});

test("direct report token feedback keeps the legacy anonymous contract", () => {
  const normalized = normalizeClientReportFeedbackForShareAccess({ feedback }, {
    shareAccess: { allowed: true, reason: "valid_share_token" },
    user: null,
    reportId: "report-1",
  });

  assert.equal(normalized.actor, undefined);
  assert.equal(normalized.reviewer, "forged@client.ai");
});

test("direct report feedback form does not send a client reviewer", () => {
  const source = readFileSync("web/components/ClientReportFeedbackForm.tsx", "utf8");

  assert.match(source, /feedback: \{ sentiment, note \}/);
  assert.doesNotMatch(source, /feedback: \{[^}]*reviewer/);
});
