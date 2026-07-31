import test from "node:test";
import assert from "node:assert/strict";

const { createOpsCreditsHandler } = await import("./web/app/api/ops/credits/route.ts");
const { createOpsLedgerHandler } = await import("./web/app/api/ops/credits/[userId]/ledger/route.ts");

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
      findAccounts: async () => [{
        userId: IDS.user,
        email: "target@example.com",
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
    idempotencyKey: " grant-1 ",
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
      available_credits: 6,
      reserved_credits: 2,
    }],
  });
});

test("ledger lookup rejects non-ops users and only returns ledger summaries", async () => {
  const handler = createOpsLedgerHandler({
    getUser: async () => ({ id: IDS.admin, email: "ops@example.com" }),
    configuredEmail: "ops@example.com",
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
