import { createClient } from "@insforge/sdk";
import { grant, recordOpsIdentityLabel } from "../../../../lib/credits";
import { authorizeOpsUser } from "../../../../lib/ops-auth";
import { createOpsCreditsHandler, projectOpsAccount } from "../../../../lib/ops-credits-handlers.mjs";
import { getUser } from "../../../../lib/session";

export const runtime = "nodejs";

type OpsAccount = {
  userId: string;
  email: string | null;
  labelSource: "ops_recorded" | null;
  available: number;
  reserved: number;
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

async function configuredFindAccounts(query: { userId: string | null; email: string | null }): Promise<OpsAccount[]> {
  if (!client) throw new Error("Credits service-role lookup is not configured");
  const directoryQuery = client.database.from("ops_credit_identity_labels").select("user_id,email,label_source");
  const { data: directoryRows, error: directoryError } = query.email
    ? await directoryQuery.eq("email", query.email)
    : query.userId
      ? await directoryQuery.eq("user_id", query.userId)
      : { data: [], error: null };
  if (directoryError) throw new Error("Credits identity lookup failed");
  const directory = Array.isArray(directoryRows) ? directoryRows[0] : null;
  const userId = asUuid(directory?.user_id) ?? query.userId;
  if (!userId) return [];
  const { data: accountRows, error: accountError } = await client.database
    .from("credit_accounts")
    .select("available_credits,reserved_credits")
    .eq("user_id", userId)
    .limit(1);
  if (accountError) throw new Error("Credits account lookup failed");
  const account = Array.isArray(accountRows) ? accountRows[0] : null;
  if (!account && !directory) return [];
  return [projectOpsAccount({
    userId,
    email: typeof directory?.email === "string" ? directory.email : null,
    labelSource: directory?.label_source === "ops_recorded" ? "ops_recorded" : null,
    account,
  }) as OpsAccount];
}

const handler = createOpsCreditsHandler({
  getUser,
  configuredEmail: process.env.OPS_ADMIN_EMAIL,
  authorizeUser: authorizeOpsUser,
  findAccounts: configuredFindAccounts,
  grant,
  recordIdentity: recordOpsIdentityLabel,
});

export const GET = handler.GET;
export const POST = handler.POST;
