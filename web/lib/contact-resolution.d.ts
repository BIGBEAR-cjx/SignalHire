import type { ContactProfile, ContactEmail } from "./contact-profile.mjs";

export type ContactResolutionStatus = "resolved" | "disabled" | "not_found" | "error";
export type ContactResolutionResult = {
  ok: boolean;
  candidate_id: string;
  provider: string;
  status: ContactResolutionStatus;
  reason: string;
  contact_profile: ContactProfile;
  send_eligibility: {
    can_send: boolean;
    reason: string;
    primary_email: ContactEmail | null;
    warnings: string[];
  };
  audit: {
    searched_at: string;
    cost_units: number;
    input_fields: string[];
    raw_reference: string;
  };
};

export function buildContactResolutionResult(input?: {
  candidateId?: string;
  candidate?: unknown;
  provider?: string;
  enabled?: boolean;
  reason?: string;
  providerResult?: unknown;
  error?: unknown;
  now?: Date;
}): ContactResolutionResult;
