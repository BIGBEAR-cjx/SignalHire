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

export function requireOpsBalance(value, label) {
  if (!Number.isInteger(value) || Number(value) < 0) throw new Error(`invalid ${label}`);
  return Number(value);
}

export function projectOpsAccount({ userId, email, labelSource, account }) {
  return {
    userId,
    email: typeof email === "string" ? email : null,
    labelSource: labelSource === "ops_recorded" ? "ops_recorded" : null,
    available: requireOpsBalance(account?.available_credits, "available balance"),
    reserved: requireOpsBalance(account?.reserved_credits, "reserved balance"),
  };
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

function projectIdentityLabel(label) {
  if (!label) return null;
  return { email: label.email, source: "ops_recorded" };
}

const FAILURE_REASONS = new Set(["monitor_run_failed", "monitor_run_cancelled"]);

export function terminalMonitorFailureReason(status) {
  if (status === "failed") return "monitor_run_failed";
  if (status === "cancelled") return "monitor_run_cancelled";
  return null;
}

function requiredTimestamp(value) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) return null;
  return value;
}

function projectFailedReservation(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const reservation = value;
  const reservationId = requiredUuid(reservation.id);
  const userId = requiredUuid(reservation.userId);
  const runId = requiredUuid(reservation.runId);
  const taskId = requiredUuid(reservation.taskId);
  const email = reservation.email === null || reservation.email === undefined ? null : normalizedEmail(reservation.email);
  const amount = reservation.amount;
  const updatedAt = requiredTimestamp(reservation.updatedAt);
  const reason = typeof reservation.failureReason === "string" ? reservation.failureReason : "";
  if (!reservationId || !userId || !runId || !taskId || (reservation.email != null && !email)
    || reservation.status !== "released" || !Number.isInteger(amount) || Number(amount) <= 0 || !updatedAt || !FAILURE_REASONS.has(reason)) return null;
  return {
    reservation_id: reservationId,
    user_id: userId,
    email,
    run_id: runId,
    task_id: taskId,
    status: "released",
    amount: Number(amount),
    updated_at: updatedAt,
    failure_reason: reason,
  };
}

function parseGrant(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const value = body;
  const userId = requiredUuid(value.user_id);
  const amount = value.amount;
  const reason = typeof value.reason === "string" ? value.reason.trim() : "";
  const idempotencyKey = typeof value.idempotency_key === "string" ? value.idempotency_key : "";
  const email = value.email === undefined ? null : normalizedEmail(value.email);
  const normalizedIdempotencyKey = idempotencyKey.trim();
  if (!userId || !Number.isInteger(amount) || Number(amount) <= 0 || !reason || reason.length > 500 || !normalizedIdempotencyKey || normalizedIdempotencyKey.length > 200) return null;
  if (value.email !== undefined && !email) return null;
  return { userId, amount: Number(amount), reason, idempotencyKey: normalizedIdempotencyKey, email };
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
      try {
        const accounts = await dependencies.findAccounts(query);
        return Response.json({ accounts: accounts.map((account) => ({
          user_id: account.userId,
          email: account.email,
          identity_label_source: account.labelSource ?? null,
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
      let identityLabel = null;
      if (input.email) {
        try {
          identityLabel = await dependencies.recordIdentity({ userId: input.userId, email: input.email });
        } catch {
          return failure(500, "identity_label_failed");
        }
      }
      try {
        const grant = await dependencies.grant({
          userId: input.userId,
          amount: input.amount,
          idempotencyKey: input.idempotencyKey,
          actorUserId: authorization.user.id,
          note: input.reason,
        });
        return Response.json(identityLabel
          ? { grant: projectGrant(grant), identity_label: projectIdentityLabel(identityLabel) }
          : { grant: projectGrant(grant) });
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

export function createOpsFailedReservationsHandler(dependencies) {
  return async function GET() {
    const authorization = authorize(await dependencies.getUser(), dependencies.configuredEmail, dependencies.authorizeUser);
    if (authorization.status !== 200) return failure(authorization.status, authorization.status === 401 ? "login_required" : "forbidden");
    try {
      const reservations = await dependencies.listFailedReservations();
      const projected = Array.isArray(reservations) ? reservations.map(projectFailedReservation) : [];
      if (projected.some((reservation) => reservation === null)) return failure(500, "failed_reservations_lookup_failed");
      return Response.json({ reservations: projected });
    } catch {
      return failure(500, "failed_reservations_lookup_failed");
    }
  };
}
