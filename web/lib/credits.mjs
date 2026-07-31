function positiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function nonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

function requiredString(value, label) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) throw new Error(`${label} is required`);
  return normalized;
}

export function validateCreditAmount(value) {
  if (!positiveInteger(value)) throw new Error("Credit amount must be a positive integer");
  return value;
}

export function validateIdempotencyKey(value) {
  const key = requiredString(value, "Idempotency key");
  if (key.length > 200) throw new Error("Idempotency key must be 200 characters or fewer");
  return key;
}

export function reservationKey({ runId } = {}) {
  const normalizedRunId = requiredString(runId, "Run id");
  return `research-run:${normalizedRunId}`;
}

export function operationIdempotencyKey({ runId, operation } = {}) {
  const normalizedRunId = requiredString(runId, "Run id");
  if (operation !== "settle" && operation !== "release") {
    throw new Error("Credit operation must be settle or release");
  }
  return `research-run:${normalizedRunId}:${operation}`;
}

export function settleTransitionSnapshots(balance = {}, { amount, reservationAmount } = {}) {
  const normalizedReservationAmount = validateCreditAmount(reservationAmount);
  const settle = applyCreditTransition(balance, { type: "settle", amount });
  if (amount > normalizedReservationAmount) {
    throw new Error("Settlement amount cannot exceed the reservation amount");
  }
  if (normalizedReservationAmount > balance.reserved) {
    throw new Error("Reservation amount cannot exceed the reserved Credits balance");
  }
  const releaseAmount = normalizedReservationAmount - amount;
  return {
    settle,
    release: releaseAmount ? applyCreditTransition(settle, { type: "release", amount: releaseAmount }) : settle,
  };
}

export function applyCreditTransition(balance = {}, transition = {}) {
  const available = balance.available;
  const reserved = balance.reserved;
  const type = requiredString(transition.type, "Transition type");
  const amount = validateCreditAmount(transition.amount);

  if (!nonNegativeInteger(available) || !nonNegativeInteger(reserved)) {
    throw new Error("Credit balance must contain non-negative integers");
  }

  if (type === "grant") return { available: available + amount, reserved };
  if (type === "reserve") {
    if (available < amount) throw new Error("Insufficient available Credits");
    return { available: available - amount, reserved: reserved + amount };
  }
  if (type === "settle") {
    if (reserved < amount) throw new Error("Insufficient reserved Credits");
    return { available, reserved: reserved - amount };
  }
  if (type === "release") {
    if (reserved < amount) throw new Error("Insufficient reserved Credits");
    return { available: available + amount, reserved: reserved - amount };
  }

  throw new Error(`Unsupported Credit transition: ${type}`);
}

// Next resolves an extensionless `./credits` import to this runtime module
// before the typed service module. Keep the pure contract above browser-safe,
// and load the service implementation only when a server route invokes it.
function creditsService() {
  return import("./credits.ts");
}

export async function grant(input) {
  return (await creditsService()).grant(input);
}

export async function recordOpsIdentityLabel(input) {
  return (await creditsService()).recordOpsIdentityLabel(input);
}
