import { insforgeAdmin } from "./insforge-admin.mjs";
import {
  operationIdempotencyKey,
  validateCreditAmount,
  validateIdempotencyKey,
} from "./credits.mjs";

type RpcResult = unknown;
type CreditBalanceRow = {
  available_credits?: unknown;
  reserved_credits?: unknown;
};

export type CreditsRpc = (functionName: string, args: Record<string, unknown>) => Promise<RpcResult>;
export type CreditsBalanceReader = (userId: string) => Promise<CreditBalanceRow | null>;

export type CreditBalance = {
  userId: string;
  available: number;
  reserved: number;
};

export type CreditOperationSummary = CreditBalance & {
  reservationId: string | null;
  ledgerEntryId: string | null;
  status: string;
  duplicate: boolean;
};

export type OpsCreditIdentityLabel = {
  userId: string;
  email: string;
  source: "ops_recorded";
  duplicate: boolean;
};

export type CreditsService = {
  readBalance(input: { userId: string }): Promise<CreditBalance>;
  grant(input: {
    userId: string;
    amount: number;
    idempotencyKey: string;
    actorUserId?: string;
    note?: string;
  }): Promise<CreditOperationSummary>;
  reserve(input: {
    userId: string;
    runId: string;
    amount: number;
    idempotencyKey: string;
  }): Promise<CreditOperationSummary>;
  settle(input: { runId: string; amount: number; idempotencyKey?: string }): Promise<CreditOperationSummary>;
  release(input: { runId: string; idempotencyKey?: string }): Promise<CreditOperationSummary>;
  recordOpsIdentityLabel(input: { userId: string; email: string }): Promise<OpsCreditIdentityLabel>;
};

export type CreditsServiceDependencies = {
  rpc: CreditsRpc;
  readBalance: CreditsBalanceReader;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const client = insforgeAdmin;

class CreditsServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CreditsServiceError";
  }
}

function assertServerOnly() {
  if (typeof window !== "undefined") {
    throw new CreditsServiceError("Credits service is server-only");
  }
}

function requiredUuid(value: unknown, label: string) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!UUID_PATTERN.test(normalized)) {
    throw new CreditsServiceError(`${label} must be a UUID`);
  }
  return normalized;
}

function optionalUuid(value: unknown, label: string) {
  if (value === undefined || value === null || value === "") return null;
  return requiredUuid(value, label);
}

function requiredEmail(value: unknown) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!EMAIL_PATTERN.test(normalized)) throw new CreditsServiceError("Email must be valid");
  return normalized;
}

function note(value: unknown) {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") throw new CreditsServiceError("Credit note must be a string");
  const normalized = value.trim();
  if (normalized.length > 500) throw new CreditsServiceError("Credit note must be 500 characters or fewer");
  return normalized;
}

function nonNegativeInteger(value: unknown, label: string) {
  if (!Number.isInteger(value) || Number(value) < 0) {
    throw new CreditsServiceError(`Credits RPC returned an invalid ${label}`);
  }
  return Number(value);
}

function uuidOrNull(value: unknown, label: string) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) return null;
  return requiredUuid(normalized, label);
}

function operationKey(runId: string, operation: "settle" | "release", provided: unknown) {
  if (provided === undefined) return operationIdempotencyKey({ runId, operation });
  return validateIdempotencyKey(provided);
}

function firstRpcRow(value: unknown): Record<string, unknown> {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    throw new CreditsServiceError("Credits RPC returned no result");
  }
  return row as Record<string, unknown>;
}

function toSummary(value: unknown, expectedUserId?: string): CreditOperationSummary {
  const row = firstRpcRow(value);
  const userId = requiredUuid(row.account_user_id, "Credits RPC user id");
  if (expectedUserId && userId !== expectedUserId) {
    throw new CreditsServiceError("Credits RPC returned an unexpected account");
  }
  if (typeof row.status !== "string" || !row.status.trim()) {
    throw new CreditsServiceError("Credits RPC returned an invalid status");
  }
  if (typeof row.duplicate !== "boolean") {
    throw new CreditsServiceError("Credits RPC returned an invalid duplicate flag");
  }
  return {
    userId,
    available: nonNegativeInteger(row.available_credits, "available balance"),
    reserved: nonNegativeInteger(row.reserved_credits, "reserved balance"),
    reservationId: uuidOrNull(row.reservation_id, "Credits RPC reservation id"),
    ledgerEntryId: uuidOrNull(row.ledger_entry_id, "Credits RPC ledger entry id"),
    status: row.status.trim(),
    duplicate: row.duplicate,
  };
}

function toBalance(value: CreditBalanceRow | null, userId: string): CreditBalance {
  if (!value) return { userId, available: 0, reserved: 0 };
  return {
    userId,
    available: nonNegativeInteger(value.available_credits, "available balance"),
    reserved: nonNegativeInteger(value.reserved_credits, "reserved balance"),
  };
}

function toOpsIdentityLabel(value: unknown, expectedUserId: string): OpsCreditIdentityLabel {
  const row = firstRpcRow(value);
  const userId = requiredUuid(row.user_id, "Credits identity user id");
  if (userId !== expectedUserId) throw new CreditsServiceError("Credits identity RPC returned an unexpected account");
  if (row.label_source !== "ops_recorded" || typeof row.duplicate !== "boolean") {
    throw new CreditsServiceError("Credits identity RPC returned an invalid result");
  }
  return { userId, email: requiredEmail(row.email), source: "ops_recorded", duplicate: row.duplicate };
}

async function invoke(deps: CreditsServiceDependencies, functionName: string, args: Record<string, unknown>) {
  try {
    return await deps.rpc(functionName, args);
  } catch {
    throw new CreditsServiceError("Credits RPC request failed");
  }
}

export function createCreditsService(deps: CreditsServiceDependencies): CreditsService {
  return {
    async readBalance({ userId }) {
      assertServerOnly();
      const normalizedUserId = requiredUuid(userId, "User id");
      try {
        return toBalance(await deps.readBalance(normalizedUserId), normalizedUserId);
      } catch (error) {
        if (error instanceof CreditsServiceError) throw error;
        throw new CreditsServiceError("Credits balance lookup failed");
      }
    },

    async grant({ userId, amount, idempotencyKey, actorUserId, note: inputNote }) {
      assertServerOnly();
      const normalizedUserId = requiredUuid(userId, "User id");
      const normalizedAmount = validateCreditAmount(amount);
      const normalizedKey = validateIdempotencyKey(idempotencyKey);
      const normalizedActorUserId = optionalUuid(actorUserId, "Actor user id");
      const result = await invoke(deps, "grant_credits", {
        p_user_id: normalizedUserId,
        p_amount: normalizedAmount,
        p_idempotency_key: normalizedKey,
        p_actor_user_id: normalizedActorUserId,
        p_note: note(inputNote),
      });
      return toSummary(result, normalizedUserId);
    },

    async reserve({ userId, runId, amount, idempotencyKey }) {
      assertServerOnly();
      const normalizedUserId = requiredUuid(userId, "User id");
      const normalizedRunId = requiredUuid(runId, "Run id");
      const normalizedAmount = validateCreditAmount(amount);
      const result = await invoke(deps, "reserve_credits", {
        p_user_id: normalizedUserId,
        p_run_id: normalizedRunId,
        p_amount: normalizedAmount,
        p_idempotency_key: validateIdempotencyKey(idempotencyKey),
      });
      return toSummary(result, normalizedUserId);
    },

    async settle({ runId, amount, idempotencyKey }) {
      assertServerOnly();
      const normalizedRunId = requiredUuid(runId, "Run id");
      const result = await invoke(deps, "settle_credits", {
        p_run_id: normalizedRunId,
        p_amount: validateCreditAmount(amount),
        p_idempotency_key: operationKey(normalizedRunId, "settle", idempotencyKey),
      });
      return toSummary(result);
    },

    async release({ runId, idempotencyKey }) {
      assertServerOnly();
      const normalizedRunId = requiredUuid(runId, "Run id");
      const result = await invoke(deps, "release_credits", {
        p_run_id: normalizedRunId,
        p_idempotency_key: operationKey(normalizedRunId, "release", idempotencyKey),
      });
      return toSummary(result);
    },

    async recordOpsIdentityLabel({ userId, email }) {
      assertServerOnly();
      const normalizedUserId = requiredUuid(userId, "User id");
      const normalizedEmail = requiredEmail(email);
      const result = await invoke(deps, "record_ops_credit_identity_label", {
        p_user_id: normalizedUserId,
        p_email: normalizedEmail,
      });
      return toOpsIdentityLabel(result, normalizedUserId);
    },
  };
}

function configuredCreditsDependencies(): CreditsServiceDependencies {
  return {
    async rpc(functionName, args) {
      assertServerOnly();
      if (!client) throw new CreditsServiceError("Credits admin RPC is not configured");
      const { data, error } = await client.database.rpc(functionName, args);
      if (error) throw new CreditsServiceError("Credits admin RPC rejected the request");
      return data;
    },
    async readBalance(userId) {
      assertServerOnly();
      if (!client) throw new CreditsServiceError("Credits admin RPC is not configured");
      const { data, error } = await client.database
        .from("credit_accounts")
        .select("available_credits,reserved_credits")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw new CreditsServiceError("Credits balance lookup failed");
      return data as CreditBalanceRow | null;
    },
  };
}

export const credits = createCreditsService(configuredCreditsDependencies());

export const readBalance = credits.readBalance;
export const grant = credits.grant;
export const reserve = credits.reserve;
export const settle = credits.settle;
export const release = credits.release;
export const recordOpsIdentityLabel = credits.recordOpsIdentityLabel;
