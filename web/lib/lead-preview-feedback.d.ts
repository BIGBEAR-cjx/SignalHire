import type { LeadPreviewConstraint, LeadPreviewItem } from "./lead-preview";

export function buildLeadPreviewConstraint(input?: {
  lead?: Partial<LeadPreviewItem>;
  reason?: string;
}): LeadPreviewConstraint;
