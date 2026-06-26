export type ContactProviderConfig = { provider: "hunter"; enabled: boolean; reason: string };
export type HunterEmailFinderRequest = { url: string; redacted_url: string; method: "GET" };
export type NormalizedContactProviderResult = {
  contact_profile: {
    emails: Array<{
      value: string;
      type: "work";
      source: "hunter";
      confidence: "high" | "medium" | "low";
      deliverability_status: "valid" | "risky";
      last_verified_at: string;
    }>;
    phones: [];
    linkedin_url: string;
  };
  cost_units: number;
  raw_reference: string;
};

export function buildContactProviderConfig(env?: Record<string, string | undefined>): ContactProviderConfig;
export function buildHunterEmailFinderRequest(input?: { apiKey?: string; candidate?: unknown }): HunterEmailFinderRequest;
export function normalizeHunterEmailFinderResult(value?: unknown): NormalizedContactProviderResult;
export function resolveHunterContact(input?: { apiKey?: string; candidate?: unknown; fetchImpl?: typeof fetch }): Promise<NormalizedContactProviderResult>;
