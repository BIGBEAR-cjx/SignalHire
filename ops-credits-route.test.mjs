import test from "node:test";
import assert from "node:assert/strict";

const { createOpsCreditsHandler, createOpsFailedReservationsHandler, createOpsLedgerHandler, projectOpsAccount } = await import("./web/lib/ops-credits-handlers.mjs");
const { authorizeOpsUser } = await import("./web/lib/ops-auth.ts");

const IDS = {
  admin: "11111111-1111-4111-8111-111111111111",
  user: "22222222-2222-4222-8222-222222222222",
  ledger: "33333333-3333-4333-8333-333333333333",
};

function handlerFor({ user = null, configuredEmail = "ops@example.com" } = {}) {
  const calls = [];
  return {
    calls,
    handler: createOpsCreditsHandler({
      getUser: async () => user,
      configuredEmail,
      authorizeUser: authorizeOpsUser,
      findAccounts: async () => [{
        userId: IDS.user,
        email: "target@example.com",
        labelSource: "ops_recorded",
        available: 6,
        reserved: 2,
      }],
      grant: async (input) => {
        calls.push(input);
        return {
          userId: input.userId,
          available: 11,
          reserved: 2,
          reservationId: null,
          ledgerEntryId: IDS.ledger,
          status: "granted",
          duplicate: false,
        };
      },
      recordIdentity: async ({ userId, email }) => ({ userId, email, source: "ops_recorded", duplicate: false }),
    }),
  };
}

test("returns 401 for anonymous operations grant attempts", async () => {
  const { handler } = handlerFor();
  const response = await handler.POST(new Request("http://ops.example/api/ops/credits", {
    method: "POST",
    body: JSON.stringify({ user_id: IDS.user, amount: 5, reason: "pilot", idempotency_key: "g-1" }),
  }));
  assert.equal(response.status, 401);
});

test("returns 403 for authenticated non-operations users", async () => {
  const { handler } = handlerFor({ user: { id: IDS.admin, email: "person@example.com" } });
  const response = await handler.POST(new Request("http://ops.example/api/ops/credits", {
    method: "POST",
    body: JSON.stringify({ user_id: IDS.user, amount: 5, reason: "pilot", idempotency_key: "g-1" }),
  }));
  assert.equal(response.status, 403);
});

test("calls the Credits service with the authenticated official actor and only returns a safe grant summary", async () => {
  const { handler, calls } = handlerFor({ user: { id: IDS.admin, email: "OPS@EXAMPLE.COM" } });
  const response = await handler.POST(new Request("http://ops.example/api/ops/credits", {
    method: "POST",
    body: JSON.stringify({ user_id: IDS.user, amount: 5, reason: "pilot allowance", idempotency_key: " grant-1 " }),
  }));
  assert.equal(response.status, 200);
  assert.deepEqual(calls, [{
    userId: IDS.user,
    amount: 5,
    idempotencyKey: "grant-1",
    actorUserId: IDS.admin,
    note: "pilot allowance",
  }]);
  assert.deepEqual(await response.json(), {
    grant: {
      user_id: IDS.user,
      available_credits: 11,
      reserved_credits: 2,
      ledger_entry_id: IDS.ledger,
      status: "granted",
      duplicate: false,
    },
  });
});

test("rejects incomplete or invalid grant input before the Credits service", async () => {
  const { handler, calls } = handlerFor({ user: { id: IDS.admin, email: "ops@example.com" } });
  const response = await handler.POST(new Request("http://ops.example/api/ops/credits", {
    method: "POST",
    body: JSON.stringify({ user_id: IDS.user, amount: 1.5, reason: "", idempotency_key: "" }),
  }));
  assert.equal(response.status, 400);
  assert.equal(calls.length, 0);
});

test("account lookup projects only identifiers, email, and balances", async () => {
  const { handler } = handlerFor({ user: { id: IDS.admin, email: "ops@example.com" } });
  const response = await handler.GET(new Request(`http://ops.example/api/ops/credits?user_id=${IDS.user}`));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    accounts: [{
      user_id: IDS.user,
      email: "target@example.com",
      identity_label_source: "ops_recorded",
      available_credits: 6,
      reserved_credits: 2,
    }],
  });
});

test("email lookup resolves only an operator-recorded identity label", async () => {
  const seen = [];
  const { handler } = handlerFor({ user: { id: IDS.admin, email: "ops@example.com" } });
  const emailHandler = createOpsCreditsHandler({
    getUser: async () => ({ id: IDS.admin, email: "ops@example.com" }),
    configuredEmail: "ops@example.com",
    authorizeUser: authorizeOpsUser,
    findAccounts: async (query) => { seen.push(query); return [{ userId: IDS.user, email: "target@example.com", labelSource: "ops_recorded", available: 0, reserved: 0 }]; },
    grant: async () => { throw new Error("not used"); },
    recordIdentity: async () => { throw new Error("not used"); },
  });
  const response = await emailHandler.GET(new Request("http://ops.example/api/ops/credits?email=TARGET%40EXAMPLE.COM"));
  assert.equal(response.status, 200);
  assert.deepEqual(seen, [{ userId: null, email: "target@example.com" }]);
  assert.deepEqual(await response.json(), { accounts: [{
    user_id: IDS.user,
    email: "target@example.com",
    identity_label_source: "ops_recorded",
    available_credits: 0,
    reserved_credits: 0,
  }] });
  const ambiguous = await handler.GET(new Request(`http://ops.example/api/ops/credits?user_id=${IDS.user}&email=target@example.com`));
  assert.equal(ambiguous.status, 400);
});

test("optional operator identity label is recorded before the idempotent grant", async () => {
  const calls = [];
  const handler = createOpsCreditsHandler({
    getUser: async () => ({ id: IDS.admin, email: "ops@example.com" }),
    configuredEmail: "ops@example.com",
    authorizeUser: authorizeOpsUser,
    findAccounts: async () => [],
    recordIdentity: async (input) => {
      calls.push({ kind: "label", input });
      return { userId: input.userId, email: input.email, source: "ops_recorded", duplicate: false };
    },
    grant: async (input) => {
      calls.push({ kind: "grant", input });
      return { userId: input.userId, available: 5, reserved: 0, reservationId: null, ledgerEntryId: IDS.ledger, status: "granted", duplicate: false };
    },
  });
  const response = await handler.POST(new Request("http://ops.example/api/ops/credits", {
    method: "POST",
    body: JSON.stringify({ user_id: IDS.user, email: "target@example.com", amount: 5, reason: "pilot", idempotency_key: "labelled-grant-1" }),
  }));
  assert.equal(response.status, 200);
  assert.deepEqual(calls.map((call) => call.kind), ["label", "grant"]);
  assert.deepEqual((await response.json()).identity_label, { email: "target@example.com", source: "ops_recorded" });
});

test("identity label failure prevents the grant callback", async () => {
  let grants = 0;
  const handler = createOpsCreditsHandler({
    getUser: async () => ({ id: IDS.admin, email: "ops@example.com" }),
    configuredEmail: "ops@example.com",
    authorizeUser: authorizeOpsUser,
    findAccounts: async () => [],
    recordIdentity: async () => { throw new Error("identity conflict"); },
    grant: async () => { grants += 1; throw new Error("must not run"); },
  });
  const response = await handler.POST(new Request("http://ops.example/api/ops/credits", {
    method: "POST",
    body: JSON.stringify({ user_id: IDS.user, email: "target@example.com", amount: 5, reason: "pilot", idempotency_key: "labelled-grant-failure" }),
  }));
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: "identity_label_failed" });
  assert.equal(grants, 0);
});

test("invalid long idempotency keys fail before identity-label persistence or grant", async () => {
  for (const email of [undefined, "target@example.com"]) {
    let labels = 0;
    let grants = 0;
    const handler = createOpsCreditsHandler({
      getUser: async () => ({ id: IDS.admin, email: "ops@example.com" }),
      configuredEmail: "ops@example.com",
      authorizeUser: authorizeOpsUser,
      findAccounts: async () => [],
      recordIdentity: async () => { labels += 1; },
      grant: async () => { grants += 1; },
    });
    const response = await handler.POST(new Request("http://ops.example/api/ops/credits", {
      method: "POST",
      body: JSON.stringify({
        user_id: IDS.user,
        ...(email ? { email } : {}),
        amount: 5,
        reason: "pilot",
        idempotency_key: "x".repeat(201),
      }),
    }));
    assert.equal(response.status, 400);
    assert.equal(labels, 0);
    assert.equal(grants, 0);
  }
});

test("transient identity-label errors fail as 5xx before grant", async () => {
  let grants = 0;
  const handler = createOpsCreditsHandler({
    getUser: async () => ({ id: IDS.admin, email: "ops@example.com" }),
    configuredEmail: "ops@example.com",
    authorizeUser: authorizeOpsUser,
    findAccounts: async () => [],
    recordIdentity: async () => { throw new Error("database unavailable"); },
    grant: async () => { grants += 1; },
  });
  const response = await handler.POST(new Request("http://ops.example/api/ops/credits", {
    method: "POST",
    body: JSON.stringify({ user_id: IDS.user, email: "target@example.com", amount: 5, reason: "pilot", idempotency_key: "identity-transient" }),
  }));
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: "identity_label_failed" });
  assert.equal(grants, 0);
});

test("malformed service-role account balances fail closed instead of becoming free Credits", () => {
  assert.throws(
    () => projectOpsAccount({
      userId: IDS.user,
      email: null,
      labelSource: null,
      account: { available_credits: "not-a-number", reserved_credits: 0 },
    }),
    /invalid available balance/i,
  );
});

test("ledger lookup rejects non-ops users and only returns ledger summaries", async () => {
  const handler = createOpsLedgerHandler({
    getUser: async () => ({ id: IDS.admin, email: "ops@example.com" }),
    configuredEmail: "ops@example.com",
    authorizeUser: authorizeOpsUser,
    listLedger: async () => [{
      id: IDS.ledger,
      entryType: "grant",
      amount: 5,
      available: 11,
      reserved: 2,
      createdAt: "2026-07-31T00:00:00.000Z",
    }],
  });
  const response = await handler(new Request("http://ops.example/api/ops/credits/user/ledger"), {
    params: Promise.resolve({ userId: IDS.user }),
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ledger: [{
      id: IDS.ledger,
      entry_type: "grant",
      amount: 5,
      available_credits: 11,
      reserved_credits: 2,
      created_at: "2026-07-31T00:00:00.000Z",
    }],
  });
});

test("failed reservation lookup is ops-only and projects the minimum safe failure fields", async () => {
  const handler = createOpsFailedReservationsHandler({
    getUser: async () => ({ id: IDS.admin, email: "ops@example.com" }),
    configuredEmail: "ops@example.com",
    authorizeUser: authorizeOpsUser,
    listFailedReservations: async () => [{
      id: "44444444-4444-4444-8444-444444444444",
      userId: IDS.user,
      email: "target@example.com",
      runId: "55555555-5555-4555-8555-555555555555",
      taskId: "66666666-6666-4666-8666-666666666666",
      status: "released",
      amount: 5,
      updatedAt: "2026-07-31T00:00:00.000Z",
      failureReason: "monitor_run_failed",
      rawError: "must not leak",
    }],
  });
  const response = await handler(new Request("http://ops.example/api/ops/credits/failed-reservations"));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { reservations: [{
    reservation_id: "44444444-4444-4444-8444-444444444444",
    user_id: IDS.user,
    email: "target@example.com",
    run_id: "55555555-5555-4555-8555-555555555555",
    task_id: "66666666-6666-4666-8666-666666666666",
    status: "released",
    amount: 5,
    updated_at: "2026-07-31T00:00:00.000Z",
    failure_reason: "monitor_run_failed",
  }] });
});

test("failed reservation lookup rejects non-ops users and fails closed on storage errors", async () => {
  const denied = createOpsFailedReservationsHandler({
    getUser: async () => null,
    configuredEmail: "ops@example.com",
    authorizeUser: authorizeOpsUser,
    listFailedReservations: async () => [],
  });
  assert.equal((await denied(new Request("http://ops.example/api/ops/credits/failed-reservations"))).status, 401);

  const broken = createOpsFailedReservationsHandler({
    getUser: async () => ({ id: IDS.admin, email: "ops@example.com" }),
    configuredEmail: "ops@example.com",
    authorizeUser: authorizeOpsUser,
    listFailedReservations: async () => { throw new Error("database unavailable"); },
  });
  const response = await broken(new Request("http://ops.example/api/ops/credits/failed-reservations"));
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: "failed_reservations_lookup_failed" });
});
