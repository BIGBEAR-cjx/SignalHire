export type PeopleProviderName = "pdl";
export type PeopleProviderStatus = { provider: PeopleProviderName; enabled: boolean; reason: string };
export type ProviderContactRow = {
  value: string;
  type: "work";
  source: PeopleProviderName;
  confidence: "medium";
};
export type ProviderCandidateRow = {
  provider: PeopleProviderName;
  provider_id: string;
  name: string;
  current_role: string;
  current_company: string;
  location: string;
  linkedin_url: string;
  contact_profile: {
    emails: ProviderContactRow[];
    phones: ProviderContactRow[];
    linkedin_url: string;
    contactability_score: number;
  };
};

export function buildPeopleProviderConfig(env?: Record<string, string | undefined>): { providers: PeopleProviderStatus[] };
export function normalizePdlPerson(value?: unknown): ProviderCandidateRow;
export function providerRowsToSourceLeads(rows?: ProviderCandidateRow[]): Array<{
  source_type: "people_api";
  provider: string;
  source_url: string;
  captured_at: string;
  confidence: "medium";
  extracted_fields: Record<string, unknown>;
}>;
