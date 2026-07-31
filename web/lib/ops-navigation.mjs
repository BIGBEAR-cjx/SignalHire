export function hasUnsafeExternalNext(value) {
  if (typeof value !== "string") return true;
  const next = value.trim();
  return !next.startsWith("/ops") || next.startsWith("//") || /^\/ops[^/?#]/.test(next);
}

export function normalizeOpsNext(value) {
  return hasUnsafeExternalNext(value) ? "/ops" : value.trim();
}
