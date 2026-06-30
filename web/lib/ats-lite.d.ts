export type AtsLiteProvider = "greenhouse";

export type AtsLiteProviderStatus = {
  provider: AtsLiteProvider;
  enabled: boolean;
  reason: string;
};

export type AtsJobImportView = {
  provider: AtsLiteProvider;
  external_job_id: string;
  title: string;
  description: string;
  department: string;
  location: string;
  hiring_team?: string[];
  imported_project_id?: string;
};

export type AtsDedupeKeys = {
  ats_candidate_id: string;
  email_hash: string;
  linkedin_url: string;
};

export type AtsCandidateExportPayload = {
  provider: AtsLiteProvider;
  project_id: string;
  candidate_id: string;
  name: string;
  email?: string;
  linkedin_url?: string;
  evidence_summary: string;
  source_mix_summary: string;
  report_url: string;
};

export const ATS_LITE_PROVIDER: AtsLiteProvider;
export function buildAtsLiteProviderStatus(env?: Record<string, unknown>): AtsLiteProviderStatus;
export function mockGreenhouseJob(externalJobId?: string): unknown;
export function buildAtsJobImportView(raw?: unknown): AtsJobImportView;
export function buildAtsProjectDraft(job?: unknown): { name: string; brief: string };
export function buildAtsDedupeKeys(input?: { candidate?: unknown; atsCandidateId?: string }): AtsDedupeKeys;
export function buildAtsCandidateExportPayload(input?: {
  provider?: AtsLiteProvider;
  projectId?: string;
  candidateId?: string;
  status?: string;
  candidate?: unknown;
  reportBaseUrl?: string;
  atsCandidateId?: string;
}): { ok: false; reason: string } | { ok: true; payload: AtsCandidateExportPayload; dedupe_keys: AtsDedupeKeys };
