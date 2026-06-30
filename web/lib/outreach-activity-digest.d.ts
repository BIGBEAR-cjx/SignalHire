export type OutreachActivityDigestEmail = {
  source?: string;
  confidence?: string;
  deliverability_status?: string;
  deliverability?: string;
};

export type OutreachActivityDigestThread = {
  candidate_name?: string;
  candidateName?: string;
  name?: string;
  status?: string;
  last_activity?: string;
  lastActivity?: string;
  next_follow_up_at?: string;
  nextFollowUpAt?: string;
  evidence_angle?: string;
  evidenceAngle?: string;
  contact_angle?: string;
  contactAngle?: string;
  reply_summary?: string;
  replySummary?: string;
  contact_profile?: { emails?: OutreachActivityDigestEmail[] };
  contactProfile?: { emails?: OutreachActivityDigestEmail[] };
};

export function buildAgencyOutreachActivityDigest(input?: {
  roleName?: string;
  threads?: OutreachActivityDigestThread[];
  sequenceAnalytics?: unknown;
}): string;
