export type OutreachEvidenceBrief = {
  candidate_name: string;
  contact_angle: string;
  proof_points: string[];
  evidence_links: string[];
  risk_note: string;
  public_profiles: string[];
};

export type EvidenceDrivenOutreachDraft = {
  subject: string;
  body: string;
  evidence_brief: OutreachEvidenceBrief;
};

export type EvidenceDrivenOutreachSequenceMessage = {
  step: number;
  subject: string;
  body: string;
  send_mode: "manual_approval_required" | "draft_for_review";
  evidence_refs: string[];
  delay_days?: 7;
};

export function buildOutreachEvidenceBrief(candidate?: unknown): OutreachEvidenceBrief;
export function buildEvidenceDrivenOutreachDraft(input?: {
  candidate?: unknown;
  tone?: string;
  senderName?: string;
  roleBrief?: string;
}): EvidenceDrivenOutreachDraft;
export function buildEvidenceDrivenOutreachSequence(input?: {
  candidate?: unknown;
  tone?: string;
  senderName?: string;
  roleBrief?: string;
}): EvidenceDrivenOutreachSequenceMessage[];
