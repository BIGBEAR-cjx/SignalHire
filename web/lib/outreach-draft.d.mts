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

export function buildOutreachEvidenceBrief(candidate?: unknown): OutreachEvidenceBrief;
export function buildEvidenceDrivenOutreachDraft(input?: {
  candidate?: unknown;
  tone?: string;
  senderName?: string;
  roleBrief?: string;
}): EvidenceDrivenOutreachDraft;
