import test from "node:test";
import assert from "node:assert/strict";
import { buildClientDeliveryAuditEvent } from "./web/lib/client-delivery-audit.mjs";

test("builds a persistent audit event for client report views", () => {
  const audit = buildClientDeliveryAuditEvent({
    userId: "user-1",
    projectId: "project-1",
    event: {
      event_type: "client_report_view",
      action_type: "shareable_client_delivery_loop",
      detail: "/r/run-1?lang=en&t=token-1",
      at: "2026-07-03T14:00:00.000Z",
    },
  });

  assert.deepEqual(audit, {
    user_id: "user-1",
    project_id: "project-1",
    event_type: "report_view",
    action_type: "shareable_client_delivery_loop",
    report_href: "/r/run-1?lang=en&t=token-1",
    actor: "Client",
    sentiment: "",
    note: "",
    detail: "/r/run-1?lang=en&t=token-1",
    event_at: "2026-07-03T14:00:00.000Z",
  });
});

test("builds a persistent audit event for client portal project views", () => {
  const audit = buildClientDeliveryAuditEvent({
    userId: "user-1",
    projectId: "project-1",
    event: {
      event_type: "client_report_view",
      action_type: "client_portal_project_view",
      actor: "hiring@client.ai",
      report_href: "/client/projects/project-1",
      detail: "Client portal project viewed by hiring@client.ai (/client/projects/project-1)",
      at: "2026-07-05T08:00:00.000Z",
    },
  });

  assert.equal(audit?.event_type, "report_view");
  assert.equal(audit?.action_type, "client_portal_project_view");
  assert.equal(audit?.report_href, "/client/projects/project-1");
  assert.equal(audit?.actor, "hiring@client.ai");
  assert.equal(audit?.event_at, "2026-07-05T08:00:00.000Z");
});

test("builds a persistent audit event for client delivery feedback", () => {
  const audit = buildClientDeliveryAuditEvent({
    userId: "user-1",
    projectId: "project-1",
    event: {
      event_type: "manager_feedback",
      action_type: "client_delivery_feedback",
      detail: "Client feedback: needs_more_candidates by Client - Need more staff engineers. (/r/run-2?lang=en&t=token-2)",
      at: "2026-07-03T14:05:00.000Z",
    },
  });

  assert.equal(audit?.event_type, "feedback");
  assert.equal(audit?.action_type, "client_delivery_feedback");
  assert.equal(audit?.report_href, "/r/run-2?lang=en&t=token-2");
  assert.equal(audit?.actor, "Client");
  assert.equal(audit?.sentiment, "needs_more_candidates");
  assert.equal(audit?.note, "Need more staff engineers.");
  assert.equal(audit?.event_at, "2026-07-03T14:05:00.000Z");
});

test("builds persistent audit events for client portal access changes", () => {
  const audit = buildClientDeliveryAuditEvent({
    userId: "user-1",
    projectId: "project-1",
    event: {
      event_type: "client_portal_access",
      action_type: "client_portal_invite_sent",
      actor: "owner@signalhire.ai",
      sentiment: "sent",
      note: "Client portal invite sent to hiring@client.ai.",
      detail: "Client portal invite sent to hiring@client.ai.",
      at: "2026-07-05T09:00:00.000Z",
    },
  });

  assert.equal(audit?.event_type, "access");
  assert.equal(audit?.action_type, "client_portal_invite_sent");
  assert.equal(audit?.actor, "owner@signalhire.ai");
  assert.equal(audit?.sentiment, "sent");
  assert.equal(audit?.note, "Client portal invite sent to hiring@client.ai.");
  assert.doesNotMatch(JSON.stringify(audit), /role_agent|execution_log|debug|internal/i);
});

test("ignores non-client-delivery role agent events", () => {
  const audit = buildClientDeliveryAuditEvent({
    userId: "user-1",
    projectId: "project-1",
    event: {
      event_type: "next_action_click",
      action_type: "resolve_contacts",
      at: "2026-07-03T14:10:00.000Z",
    },
  });

  assert.equal(audit, null);
});
