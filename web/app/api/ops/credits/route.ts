import { createClient } from "@insforge/sdk";
import { grant as grantCredits } from "../../../../lib/credits.ts";
import { authorizeOpsUser } from "../../../../lib/ops-auth.ts";

export const runtime = "nodejs";

type OpsAccount = {
  userId: string;
  email: string | null;
  available: number;
  reserved: number;
};

type SessionUser = { id: string; email: string };

type CreditOperationSummary = {
  userId: string;
  available: number;
  reserved: number;
  reservationId: string | null;
  ledgerEntryId: string | null;
  status: string;
  duplicate: boolean;
};

type OpsCreditsDependencies = {
  getUser: () => Promise<SessionUser | null>;
  configuredEmail?: string;
  findAccounts: (userId: string) => Promise<OpsAccount[]>;
  grant: (input: {
    userId: string;
    amount: number;
    idempotencyKey: string;
    actorUserId: string;
    note: string;
  }) => Promise<CreditOperationSummary>;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BASE = process.env.INSFORGE_API_BASE_URL;
const SERVICE_ROLE_KEY = process.env.INSFORGE_CREDITS_SERVICE_ROLE_KEY;
const client = BASE && SERVICE_ROLE_KEY
  ? createClient({ baseUrl: BASE, anonKey: SERVICE_ROLE_KEY, isServerMode: true })
  : null;

function requiredUuid(value: unknown) {
  const userId = typeof value === "string" ? value.trim() : "";
  return UUID_PATTERN.test(userId) ? userId : null;
}

function safeNumber(value: unknown) {
  return Number.isInteger(value) && Number(value) >= 0 ? Number(value) : 0;
}

function projectAccount(value: unknown): OpsAccount | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const userId = requiredUuid(row.user_id);
  if (!userId) return null;
  return {
    userId,
    email: typeof row.email === "string" ? row.email.trim().toLowerCase() || null : null,
    available: safeNumber(row.available_credits),
    reserved: safeNumber(row.reserved_credits),
  };
}

async function configuredFindAccounts(userId: string): Promise<OpsAccount[]> {
  if (!client) throw new Error("Credits service-role lookup is not configured");
  const { data, error } = await client.database
    .from("credit_accounts")
    .select("user_id,available_credits,reserved_credits")
    .eq("user_id", userId);
  if (error) throw new Error("Credits account lookup failed");
  return (Array.isArray(data) ? data : []).map(projectAccount).filter((account): account is OpsAccount => account !== null);
}

function authorize(user: SessionUser | null, configuredEmail: string | undefined) {
  return authorizeOpsUser(user, configuredEmail);
}

function failure(status: 400 | 401 | 403 | 500, error: string) {
  return Response.json({ error }, { status });
}

function parseGrant(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const value = body as Record<string, unknown>;
  const userId = requiredUuid(value.user_id);
  const amount = value.amount;
  const reason = typeof value.reason === "string" ? value.reason.trim() : "";
  const idempotencyKey = typeof value.idempotency_key === "string" ? value.idempotency_key : "";
  if (!userId || !Number.isInteger(amount) || Number(amount) <= 0 || !reason || reason.length > 500 || !idempotencyKey.trim()) {
    return null;
  }
  return { userId, amount: Number(amount), reason, idempotencyKey };
}

function projectGrant(summary: CreditOperationSummary) {
  return {
    user_id: summary.userId,
    available_credits: summary.available,
    reserved_credits: summary.reserved,
    ledger_entry_id: summary.ledgerEntryId,
    status: summary.status,
    duplicate: summary.duplicate,
  };
}

export function createOpsCreditsHandler(dependencies: OpsCreditsDependencies) {
  return {
    async GET(request: Request) {
      const authorization = authorize(await dependencies.getUser(), dependencies.configuredEmail);
      if (authorization.status !== 200) return failure(authorization.status, authorization.status === 401 ? "login_required" : "forbidden");
      const userId = requiredUuid(new URL(request.url).searchParams.get("user_id"));
      if (!userId) return failure(400, "user_id_required");
      try {
        const accounts = await dependencies.findAccounts(userId);
        return Response.json({ accounts: accounts.map((account) => ({
          user_id: account.userId,
          email: account.email,
          available_credits: account.available,
          reserved_credits: account.reserved,
        })) });
      } catch {
        return failure(500, "credits_lookup_failed");
      }
    },

    async POST(request: Request) {
      const authorization = authorize(await dependencies.getUser(), dependencies.configuredEmail);
      if (authorization.status !== 200) return failure(authorization.status, authorization.status === 401 ? "login_required" : "forbidden");
      let body: unknown;
      try { body = await request.json(); } catch { return failure(400, "invalid_json"); }
      const input = parseGrant(body);
      if (!input || !authorization.user) return failure(400, "invalid_grant");
      try {
        const grant = await dependencies.grant({
          userId: input.userId,
          amount: input.amount,
          idempotencyKey: input.idempotencyKey,
          actorUserId: authorization.user.id,
          note: input.reason,
        });
        return Response.json({ grant: projectGrant(grant) });
      } catch {
        return failure(500, "credits_grant_failed");
      }
    },
  };
}

const handler = createOpsCreditsHandler({
  async getUser() {
    const { getUser } = await import("../../../../lib/session.ts");
    return getUser();
  },
  configuredEmail: process.env.OPS_ADMIN_EMAIL,
  findAccounts: configuredFindAccounts,
  grant: grantCredits,
});

export const GET = handler.GET;
export const POST = handler.POST;
