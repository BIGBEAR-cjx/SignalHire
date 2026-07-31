import { createClient } from "@insforge/sdk";
import { authorizeOpsUser } from "../../../../../../lib/ops-auth";
import { createOpsLedgerHandler } from "../../../../../../lib/ops-credits-handlers.mjs";
import { getUser } from "../../../../../../lib/session";

export const runtime = "nodejs";

type LedgerSummary = {
  id: string;
  entryType: string;
  amount: number;
  available: number;
  reserved: number;
  createdAt: string;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BASE = process.env.INSFORGE_API_BASE_URL;
const SERVICE_ROLE_KEY = process.env.INSFORGE_CREDITS_SERVICE_ROLE_KEY;
const client = BASE && SERVICE_ROLE_KEY
  ? createClient({ baseUrl: BASE, anonKey: SERVICE_ROLE_KEY, isServerMode: true })
  : null;

function asUuid(value: unknown) {
  const id = typeof value === "string" ? value.trim() : "";
  return UUID_PATTERN.test(id) ? id : null;
}

function asNonNegativeInteger(value: unknown) {
  return Number.isInteger(value) && Number(value) >= 0 ? Number(value) : null;
}

function projectLedger(value: unknown): LedgerSummary | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const id = asUuid(row.id);
  const amount = asNonNegativeInteger(row.amount);
  const available = asNonNegativeInteger(row.available_after);
  const reserved = asNonNegativeInteger(row.reserved_after);
  const entryType = typeof row.entry_type === "string" ? row.entry_type.trim() : "";
  const createdAt = typeof row.created_at === "string" ? row.created_at : "";
  if (!id || amount === null || available === null || reserved === null || !entryType || !createdAt) return null;
  return { id, entryType, amount, available, reserved, createdAt };
}

async function listLedger(userId: string): Promise<LedgerSummary[]> {
  if (!client) throw new Error("Credits service-role lookup is not configured");
  const { data, error } = await client.database
    .from("credit_ledger_entries")
    .select("id,entry_type,amount,available_after,reserved_after,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error("Credits ledger lookup failed");
  return (Array.isArray(data) ? data : []).map(projectLedger).filter((entry): entry is LedgerSummary => entry !== null);
}

export const GET = createOpsLedgerHandler({
  getUser,
  configuredEmail: process.env.OPS_ADMIN_EMAIL,
  authorizeUser: authorizeOpsUser,
  listLedger,
});
