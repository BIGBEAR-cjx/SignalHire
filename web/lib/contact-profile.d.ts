export type ContactConfidence = "high" | "medium" | "low";
export type ContactEmail = {
  value: string;
  type: string;
  source: string;
  confidence: ContactConfidence;
  last_verified_at: string;
  deliverability_status: "valid" | "risky" | "unknown" | "bounced";
};
export type ContactPhone = {
  value: string;
  type: string;
  source: string;
  confidence: ContactConfidence;
};
export type ContactProfile = {
  emails: ContactEmail[];
  phones: ContactPhone[];
  linkedin_url: string;
  contactability_score: number;
};
export function buildContactProfile(candidate?: unknown): ContactProfile;
export function primarySendableEmail(profile?: unknown): ContactEmail | null;
