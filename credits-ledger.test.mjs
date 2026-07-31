import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  applyCreditTransition,
  operationIdempotencyKey,
  reservationKey,
  settleTransitionSnapshots,
  validateCreditAmount,
  validateIdempotencyKey,
} from "./web/lib/credits.mjs";

const { createCreditsService } = await import("./web/lib/credits.ts");

const UUIDS = {
  user: "11111111-1111-4111-8111-111111111111",
  actor: "22222222-2222-4222-8222-222222222222",
  run: "33333333-3333-4333-8333-333333333333",
  reservation: "44444444-4444-4444-8444-444444444444",
  ledger: "55555555-5555-4555-8555-555555555555",
};

function rpcResult({ available = 0, reserved = 0, status = "reserved", duplicate = false } = {}) {
  return {
    account_user_id: UUIDS.user,
    available_credits: available,
    reserved_credits: reserved,
    reservation_id: UUIDS.reservation,
    ledger_entry_id: UUIDS.ledger,
    status,
    duplicate,
  };
}

test("reserving Credits moves balance atomically without going negative", () => {
  assert.deepEqual(
    applyCreditTransition({ available: 10, reserved: 0 }, { type: "reserve", amount: 6 }),
    { available: 4, reserved: 6 },
  );
  assert.throws(
    () => applyCreditTransition({ available: 2, reserved: 0 }, { type: "reserve", amount: 3 }),
    /insufficient/i,
  );
});

test("settle and release cannot consume more than a reservation", () => {
  assert.deepEqual(
    applyCreditTransition({ available: 4, reserved: 6 }, { type: "settle", amount: 4 }),
    { available: 4, reserved: 2 },
  );
  assert.deepEqual(
    applyCreditTransition({ available: 4, reserved: 2 }, { type: "release", amount: 2 }),
    { available: 6, reserved: 0 },
  );
  assert.throws(
    () => applyCreditTransition({ available: 4, reserved: 2 }, { type: "settle", amount: 3 }),
    /reserved/i,
  );
});

test("partial settlement records the interim balance before its release snapshot", () => {
  assert.deepEqual(
    settleTransitionSnapshots({ available: 4, reserved: 6 }, { amount: 4, reservationAmount: 6 }),
    {
      settle: { available: 4, reserved: 2 },
      release: { available: 6, reserved: 0 },
    },
  );
  assert.deepEqual(
    settleTransitionSnapshots({ available: 4, reserved: 4 }, { amount: 4, reservationAmount: 4 }),
    {
      settle: { available: 4, reserved: 0 },
      release: { available: 4, reserved: 0 },
    },
  );
  assert.deepEqual(
    settleTransitionSnapshots({ available: 4, reserved: 10 }, { amount: 4, reservationAmount: 6 }),
    {
      settle: { available: 4, reserved: 6 },
      release: { available: 6, reserved: 4 },
    },
  );
  assert.throws(
    () => settleTransitionSnapshots({ available: 4, reserved: 6 }, { amount: 5, reservationAmount: 4 }),
    /reservation/i,
  );
});

test("validates positive whole Credits and opaque idempotency keys", () => {
  assert.equal(validateCreditAmount(3), 3);
  assert.throws(() => validateCreditAmount(0), /positive integer/i);
  assert.throws(() => validateCreditAmount(1.5), /positive integer/i);
  assert.equal(validateIdempotencyKey(" ops-grant-1 "), "ops-grant-1");
  assert.throws(() => validateIdempotencyKey(""), /idempotency key/i);
});

test("derives one stable reservation idempotency key per research run", () => {
  assert.equal(reservationKey({ runId: "run-1" }), "research-run:run-1");
  assert.equal(operationIdempotencyKey({ runId: "run-1", operation: "settle" }), "research-run:run-1:settle");
  assert.equal(operationIdempotencyKey({ runId: "run-1", operation: "release" }), "research-run:run-1:release");
  assert.throws(() => operationIdempotencyKey({ runId: "run-1", operation: "grant" }), /operation/i);
  assert.throws(() => reservationKey({ runId: "" }), /run id/i);
});

test("migration keeps balances non-negative and defines atomic ledger RPCs", () => {
  const migration = readFileSync("migrations/20260731000000_credits_ops_v1.sql", "utf8");

  assert.match(migration, /create table if not exists public\.credit_accounts/i);
  assert.match(migration, /available_credits\s+integer\s+not null\s+default 0/i);
  assert.match(migration, /check \(available_credits >= 0\)/i);
  assert.match(migration, /check \(reserved_credits >= 0\)/i);
  assert.match(migration, /unique \(user_id, idempotency_key\)/i);
  assert.match(migration, /unique \(run_id\)/i);
  for (const functionName of ["grant_credits", "reserve_credits", "settle_credits", "release_credits"]) {
    assert.match(migration, new RegExp(`create or replace function public\\.${functionName}`, "i"));
  }
  assert.match(migration, /for update/i);
});

test("security follow-up limits Credits RPCs and tables to the server service-role model", () => {
  const migration = readFileSync("migrations/20260731010000_credits_ops_security_v1.sql", "utf8");

  assert.match(migration, /revoke all on function public\.grant_credits/i);
  assert.match(migration, /revoke all on table public\.credit_accounts from public/i);
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /grant execute on function public\.grant_credits[\s\S]*service_role/i);
  assert.match(migration, /server-side[\s\S]*service_role client/i);
  assert.match(migration, /deployment access\/concurrency checks/i);
  assert.match(migration, /set search_path = pg_catalog/i);
});

test("security follow-up audits grants and scopes deterministic settlement keys to one run", () => {
  const migration = readFileSync("migrations/20260731010000_credits_ops_security_v1.sql", "utf8");

  assert.match(migration, /insert into public\.ops_audit_events/i);
  assert.match(migration, /on conflict \(credit_ledger_entry_id\) do nothing/i);
  assert.match(migration, /create unique index if not exists ops_audit_events_ledger_entry_unique/i);
  assert.match(migration, /research-run:' \|\| p_run_id::text \|\| ':settle'/i);
  assert.match(migration, /research-run:' \|\| p_run_id::text \|\| ':release'/i);
  assert.match(migration, /idempotency key does not match the run settlement operation/i);
  assert.match(migration, /idempotency key does not match the run release operation/i);
});

test("settlement snapshot follow-up preserves per-entry balances and exact duplicate amounts", () => {
  const migration = readFileSync("migrations/20260731020000_credits_settle_snapshot_v1.sql", "utf8");

  assert.match(migration, /v_settle_available integer/i);
  assert.match(migration, /v_settle_reserved integer/i);
  assert.match(migration, /v_settlement_amount integer/i);
  assert.match(migration, /v_reservation\.settled_amount <> p_amount/i);
  assert.match(migration, /v_existing_entry_amount <> p_amount/i);
  assert.match(migration, /v_settle_available, v_settle_reserved, v_settle_key/i);
  assert.match(migration, /v_account\.available_credits, v_account\.reserved_credits, v_release_key/i);
});

test("server-only Credits service uses injected RPCs and preserves grant idempotency", async () => {
  const calls = [];
  const service = createCreditsService({
    rpc: async (name, args) => {
      calls.push({ name, args });
      return calls.length === 1
        ? rpcResult({ available: 10, status: "granted" })
        : rpcResult({ available: 10, status: "granted", duplicate: true });
    },
    readBalance: async () => ({ available_credits: 10, reserved_credits: 0 }),
  });

  const input = {
    userId: UUIDS.user,
    amount: 10,
    idempotencyKey: "ops-grant-1",
    actorUserId: UUIDS.actor,
    note: "launch allowance",
  };
  assert.deepEqual(await service.grant(input), {
    userId: UUIDS.user,
    available: 10,
    reserved: 0,
    reservationId: UUIDS.reservation,
    ledgerEntryId: UUIDS.ledger,
    status: "granted",
    duplicate: false,
  });
  assert.equal((await service.grant(input)).duplicate, true);
  assert.deepEqual(calls[0], {
    name: "grant_credits",
    args: {
      p_user_id: UUIDS.user,
      p_amount: 10,
      p_idempotency_key: "ops-grant-1",
      p_actor_user_id: UUIDS.actor,
      p_note: "launch allowance",
    },
  });
  assert.deepEqual(await service.readBalance({ userId: UUIDS.user }), {
    userId: UUIDS.user,
    available: 10,
    reserved: 0,
  });
});

test("server-only Credits service releases a run exactly through its deterministic key", async () => {
  const calls = [];
  const service = createCreditsService({
    rpc: async (name, args) => {
      calls.push({ name, args });
      return rpcResult({ available: 10, reserved: 0, status: "released" });
    },
    readBalance: async () => null,
  });

  assert.deepEqual(await service.release({ runId: UUIDS.run }), {
    userId: UUIDS.user,
    available: 10,
    reserved: 0,
    reservationId: UUIDS.reservation,
    ledgerEntryId: UUIDS.ledger,
    status: "released",
    duplicate: false,
  });
  assert.deepEqual(calls, [{
    name: "release_credits",
    args: {
      p_run_id: UUIDS.run,
      p_idempotency_key: `research-run:${UUIDS.run}:release`,
    },
  }]);
});

test("server-only Credits service rejects invalid UUIDs, amounts, and idempotency keys before RPC", async () => {
  let calls = 0;
  const service = createCreditsService({
    rpc: async () => {
      calls += 1;
      return rpcResult();
    },
    readBalance: async () => null,
  });

  await assert.rejects(
    service.grant({ userId: "not-a-uuid", amount: 1, idempotencyKey: "grant-1" }),
    /user id must be a UUID/i,
  );
  await assert.rejects(
    service.reserve({ userId: UUIDS.user, runId: UUIDS.run, amount: 0, idempotencyKey: "reserve-1" }),
    /positive integer/i,
  );
  await assert.rejects(
    service.settle({ runId: UUIDS.run, amount: 1, idempotencyKey: "" }),
    /idempotency key/i,
  );
  assert.equal(calls, 0);
});

test("Credits service stays server-only and does not bypass its service-role RPC gate", () => {
  const source = readFileSync("web/lib/credits.ts", "utf8");

  assert.match(source, /typeof window !== "undefined"/);
  assert.match(source, /INSFORGE_CREDITS_SERVICE_ROLE_KEY/);
  assert.match(source, /isServerMode:\s*true/);
  assert.doesNotMatch(source, /NEXT_PUBLIC_/);
  assert.doesNotMatch(source, /\.from\(\s*["']credit_accounts["']\s*\)\s*\.update\(/);
});
