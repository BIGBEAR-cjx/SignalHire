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

function targetRows(targets = []) {
  return (Array.isArray(targets) ? targets : []).map((target) => {
    if (typeof target === "string") return { id: cleanString(target), name: "", error: "" };
    return {
      id: cleanString(target?.id),
      name: cleanString(target?.name),
      error: cleanString(target?.error),
    };
  }).filter((target) => target.id);
}

function idSet(values = []) {
  return new Set((Array.isArray(values) ? values : []).map((value) => cleanString(value)).filter(Boolean));
}

/**
 * @param {{ targets?: Array<string | { id?: unknown, name?: unknown }>, approved?: string[], failed?: Array<{ id?: unknown, name?: unknown, error?: unknown }> }} input
 * @returns {{ attempted: number, approved: number, failed: number, status: "none" | "all_approved" | "partial_failed" | "all_failed", failed_items: Array<{ id: string, name: string, error: string }> }}
 */
export function buildOutreachApprovalOutcome({ targets = [], approved = [], failed = [] } = {}) {
  const rows = targetRows(targets);
  const approvedIds = idSet(approved);
  const failedById = new Map(targetRows(failed).map((row) => [row.id, row]));
  const failedItems = rows
    .filter((row) => failedById.has(row.id) || (!approvedIds.has(row.id) && rows.length > 0))
    .map((row) => {
      const failedRow = failedById.get(row.id);
      return {
        id: row.id,
        name: failedRow?.name || row.name,
        error: failedRow?.error || "approval_failed",
      };
    });
  const attempted = rows.length;
  const failedCount = failedItems.length;
  const approvedCount = Math.max(0, attempted - failedCount);
  const status = attempted === 0
    ? "none"
    : failedCount === 0
      ? "all_approved"
      : approvedCount === 0
        ? "all_failed"
        : "partial_failed";
  return {
    attempted,
    approved: approvedCount,
    failed: failedCount,
    status,
    failed_items: failedItems,
  };
}
