export type Locale = "zh" | "en";

export const SUPPORTED_LOCALES: Locale[];
export const DEFAULT_LOCALE: Locale;
export const messages: Record<Locale, Record<string, string>>;

export function isLocale(value: unknown): value is Locale;
export function normalizeLocale(value: unknown): Locale;
export function t(locale: unknown, key: string, params?: Record<string, string | number>): string;
