import type { SessionUser } from "./session";

export type OpsAuthorization = {
  status: 200 | 401 | 403;
  user: SessionUser | null;
};

function normalizedEmail(value: unknown) {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

export function normalizeOpsEmail(value: unknown) {
  return normalizedEmail(value);
}

export function isOpsAdmin(user: Pick<SessionUser, "email"> | null | undefined, configuredEmail: unknown) {
  const email = normalizedEmail(user?.email);
  const officialEmail = normalizedEmail(configuredEmail);
  return Boolean(email && officialEmail && email === officialEmail);
}

export function authorizeOpsUser(user: SessionUser | null, configuredEmail = process.env.OPS_ADMIN_EMAIL): OpsAuthorization {
  if (!user) return { status: 401, user: null };
  if (!isOpsAdmin(user, configuredEmail)) return { status: 403, user: null };
  return { status: 200, user: { id: user.id, email: user.email.trim().toLowerCase() } };
}
