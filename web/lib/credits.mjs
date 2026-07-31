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
