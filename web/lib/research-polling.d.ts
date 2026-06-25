export const RESEARCH_POLL_INTERVAL_MS: number;
export const RESEARCH_POLL_SLOW_INTERVAL_MS: number;
export const RESEARCH_POLL_SLOW_AFTER_MS: number;
export function nextResearchPollDelayMs(elapsedMs: number): number;
export function buildResearchRunHref(input: { kind: "search" | "verify"; id: string; projectId?: string | null }): string;
