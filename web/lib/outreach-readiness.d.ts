export function selectOutreachReadinessTargets(input?: { items?: unknown[]; contactResult?: unknown }): string[];
export function selectOutreachApprovalRetryTargets(input?: { failedItems?: unknown[]; items?: unknown[] }): string[];
export function buildOutreachApprovalOutcome(input?: {
  targets?: Array<string | { id?: unknown; name?: unknown }>;
  approved?: string[];
  failed?: Array<{ id?: unknown; name?: unknown; error?: unknown }>;
}): {
  attempted: number;
  approved: number;
  failed: number;
  status: "none" | "all_approved" | "partial_failed" | "all_failed";
  failed_items: Array<{ id: string; name: string; error: string }>;
};
