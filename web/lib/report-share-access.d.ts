export type ClientDeliveryAccessPolicy = {
  mode: "token_only" | "token_or_customer_account";
  allowed_emails: string[];
  allowed_domains: string[];
};

export type ClientDeliveryShareAccess = {
  allowed: boolean;
  reason: string;
};

export function requiresClientDeliveryShareToken(row?: unknown): boolean;
export function buildClientDeliveryShareToken(row?: unknown, options?: { secret?: string }): string;
export function buildClientDeliveryShareHref(row?: unknown, options?: { secret?: string; locale?: string }): string;
export function normalizeClientDeliveryAccessPolicy(value?: unknown): ClientDeliveryAccessPolicy;
export function verifyClientDeliveryCustomerAccountAccess(row?: unknown, viewer?: unknown, policy?: unknown): ClientDeliveryShareAccess;
export function verifyClientDeliveryShareAccess(row?: unknown, token?: string | null, options?: {
  secret?: string;
  viewer?: unknown;
  accessPolicy?: unknown;
}): ClientDeliveryShareAccess;
