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

export type SourceMixInput = {
  source_type?: unknown;
  count?: unknown;
};

export type SourceMixUxView = {
  evidence_source_count: number;
  lead_source_count: number;
  total_source_count: number;
  evidence_types: string[];
  lead_types: string[];
  status_label: string;
  next_step: string;
};

export function classifySourceType(source?: SourceClassifierInput | unknown): SourceType;
export function buildSourceMixUxView(sourceMix?: SourceMixInput[] | unknown, options?: { locale?: SourceClassifierLocale | string }): SourceMixUxView;
export function sourceTypeLabel(sourceType?: string, locale?: SourceClassifierLocale): string;
export function sourceTypeTooltip(sourceType?: string, locale?: SourceClassifierLocale): string;
