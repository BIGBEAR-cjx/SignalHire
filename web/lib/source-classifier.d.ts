export type SourceType =
  | "github"
  | "paper"
  | "company_page"
  | "personal_site"
  | "people_api"
  | "linkedin_seed"
  | "public_web"
  | "internal_resume"
  | "manual_upload";

export type SourceClassifierLocale = "en" | "zh";

export type SourceClassifierInput = {
  source_type?: unknown;
  provider?: unknown;
  source?: unknown;
  source_family?: unknown;
  family?: unknown;
  source_url?: unknown;
  url?: unknown;
  href?: unknown;
  link?: unknown;
  title?: unknown;
  snippet?: unknown;
  description?: unknown;
  metadata_provider?: unknown;
  metadata?: unknown;
};

export function classifySourceType(source?: SourceClassifierInput | unknown): SourceType;
export function sourceTypeLabel(sourceType?: string, locale?: SourceClassifierLocale): string;
export function sourceTypeTooltip(sourceType?: string, locale?: SourceClassifierLocale): string;
