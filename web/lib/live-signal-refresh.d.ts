export function selectLiveSignalRefreshProjects(projects?: unknown[], options?: { limit?: number }): unknown[];
export function buildLiveSignalRefreshEvent(input?: unknown): unknown;
export function buildLiveSignalRefreshBlockedEvent(input?: unknown): unknown;
export function buildLiveSignalRefreshSummary(results?: unknown[]): unknown;
export function refreshLiveSignalsWithProvider(input?: unknown): Promise<unknown>;
export function createInternalLiveSignalProvider(input?: {
  now?: string;
}): {
  refresh(input?: unknown): Promise<{ refreshed: unknown[]; failed: unknown[]; error?: string }>;
};
export function createHttpLiveSignalProvider(input?: {
  url?: string;
  apiKey?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): null | {
  refresh(input?: unknown): Promise<{ refreshed: unknown[]; failed: unknown[]; error?: string }>;
};
