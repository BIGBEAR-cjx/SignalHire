const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function requiredUuid(value) {
  const userId = typeof value === "string" ? value.trim() : "";
  return UUID_PATTERN.test(userId) ? userId : null;
}

function normalizedEmail(value) {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  return EMAIL_PATTERN.test(email) ? email : null;
}

function failure(status, error) {
  return Response.json({ error }, { status });
}

function authorize(user, configuredEmail, authorizeUser) {
  return authorizeUser(user, configuredEmail);
}

function projectGrant(summary) {
  return {
    user_id: summary.userId,
    available_credits: summary.available,
    reserved_credits: summary.reserved,
    ledger_entry_id: summary.ledgerEntryId,
    status: summary.status,
    duplicate: summary.duplicate,
  };
}

function parseGrant(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const value = body;
  const userId = requiredUuid(value.user_id);
  const amount = value.amount;
  const reason = typeof value.reason === "string" ? value.reason.trim() : "";
  const idempotencyKey = typeof value.idempotency_key === "string" ? value.idempotency_key : "";
  if (!userId || !Number.isInteger(amount) || Number(amount) <= 0 || !reason || reason.length > 500 || !idempotencyKey.trim()) return null;
  return { userId, amount: Number(amount), reason, idempotencyKey };
}

function accountQuery(request) {
  const url = new URL(request.url);
  const userId = url.searchParams.get("user_id");
  const email = url.searchParams.get("email");
  if (Boolean(userId) === Boolean(email)) return null;
  return userId ? { userId: requiredUuid(userId), email: null } : { userId: null, email: normalizedEmail(email) };
}

export function createOpsCreditsHandler(dependencies) {
  return {
    async GET(request) {
      const authorization = authorize(await dependencies.getUser(), dependencies.configuredEmail, dependencies.authorizeUser);
      if (authorization.status !== 200) return failure(authorization.status, authorization.status === 401 ? "login_required" : "forbidden");
      const query = accountQuery(request);
      if (!query || (!query.userId && !query.email)) return failure(400, "user_id_or_email_required");
      if (query.email) return failure(400, "email_lookup_unavailable");
      try {
        const accounts = await dependencies.findAccounts(query);
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

    async POST(request) {
      const authorization = authorize(await dependencies.getUser(), dependencies.configuredEmail, dependencies.authorizeUser);
      if (authorization.status !== 200) return failure(authorization.status, authorization.status === 401 ? "login_required" : "forbidden");
      let body;
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

export function createOpsLedgerHandler(dependencies) {
  return async function GET(_request, context) {
    const authorization = authorize(await dependencies.getUser(), dependencies.configuredEmail, dependencies.authorizeUser);
    if (authorization.status !== 200) return failure(authorization.status, authorization.status === 401 ? "login_required" : "forbidden");
    const userId = requiredUuid((await context.params).userId);
    if (!userId) return failure(400, "user_id_required");
    try {
      const ledger = await dependencies.listLedger(userId);
      return Response.json({ ledger: ledger.map((entry) => ({
        id: entry.id,
        entry_type: entry.entryType,
        amount: entry.amount,
        available_credits: entry.available,
        reserved_credits: entry.reserved,
        created_at: entry.createdAt,
      })) });
    } catch {
      return failure(500, "credits_ledger_lookup_failed");
    }
  };
}
