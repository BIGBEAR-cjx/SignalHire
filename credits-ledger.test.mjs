import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  applyCreditTransition,
  reservationKey,
  validateCreditAmount,
  validateIdempotencyKey,
} from "./web/lib/credits.mjs";

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

test("validates positive whole Credits and opaque idempotency keys", () => {
  assert.equal(validateCreditAmount(3), 3);
  assert.throws(() => validateCreditAmount(0), /positive integer/i);
  assert.throws(() => validateCreditAmount(1.5), /positive integer/i);
  assert.equal(validateIdempotencyKey(" ops-grant-1 "), "ops-grant-1");
  assert.throws(() => validateIdempotencyKey(""), /idempotency key/i);
});

test("derives one stable reservation idempotency key per research run", () => {
  assert.equal(reservationKey({ runId: "run-1" }), "research-run:run-1");
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
