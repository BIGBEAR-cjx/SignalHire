export const DEFAULT_MAX_ATTEMPTS: 3;
export const STALE_AFTER_MS: number;
export const RUN_STATUSES: {
  QUEUED: "queued";
  RUNNING: "running";
  RETRYING: "retrying";
  DONE: "done";
  ERROR: "error";
  CANCELED: "canceled";
};

export type JobStatus = "queued" | "running" | "retrying" | "done" | "error" | "canceled";
export type JobStatusView = {
  phase: JobStatus;
  label: string;
  detail: string;
  canRetry: boolean;
};

export function errorMessage(error: unknown, locale?: "zh" | "en" | string): string;
export function attemptCount(row: unknown): number;
export function maxAttempts(row: unknown): number;
export function isStaleRunningJob(row: unknown, now?: Date, staleAfterMs?: number): boolean;
export function buildRunStartUpdate(now?: Date): Record<string, unknown>;
export function buildRunFailureUpdate(input: {
  attemptCount: number;
  maxAttempts?: number;
  error: unknown;
  now?: Date;
  locale?: "zh" | "en" | string;
}): Record<string, unknown>;
export function buildRetryUpdate(now?: Date): Record<string, unknown>;
export function buildCancelUpdate(now?: Date, locale?: "zh" | "en" | string): Record<string, unknown>;
export function buildStaleRecoveryUpdate(row: unknown, now?: Date, locale?: "zh" | "en" | string): Record<string, unknown>;
export function buildQueueRetryUpdate(row: unknown, now?: Date): Record<string, unknown>;
export function describeJobStatus(row: unknown, locale?: "zh" | "en" | string): JobStatusView;
