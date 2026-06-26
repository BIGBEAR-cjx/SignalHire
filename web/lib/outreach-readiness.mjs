import { primarySendableEmail } from "./contact-profile.mjs";

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function bulkCanSendMap(contactResult = {}) {
  const source = isRecord(contactResult) ? contactResult : {};
  const rows = Array.isArray(source.items) ? source.items : [];
  const map = new Map();
  for (const row of rows) {
    const id = cleanString(row?.id);
    if (!id || map.has(id)) continue;
    const status = cleanString(row?.status);
    const reason = cleanString(row?.reason);
    const trustedReady = status === "resolved" || (status === "skipped" && reason === "already_sendable");
    map.set(id, trustedReady && Boolean(row?.can_send));
  }
  return map;
}

/**
 * @param {{ items?: unknown[], contactResult?: unknown }} input
 * @returns {string[]}
 */
export function selectOutreachReadinessTargets({ items = [], contactResult = {} } = {}) {
  const canSendById = bulkCanSendMap(contactResult);
  const targets = [];
  const seen = new Set();
  for (const item of Array.isArray(items) ? items : []) {
    const id = cleanString(item?.id);
    if (!id || seen.has(id) || item?.status !== "drafted") continue;
    if (primarySendableEmail(item?.contact_profile) || canSendById.get(id) === true) {
      seen.add(id);
      targets.push(id);
    }
  }
  return targets;
}
