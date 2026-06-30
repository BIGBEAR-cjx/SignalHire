export type DueFollowUpDraftPatch =
  | { ok: false; reason: string }
  | {
      ok: true;
      step: number;
      patch: {
        status: "follow_up_due";
        subject: string;
        body: string;
        notes: string;
        next_follow_up_at: null;
        send_error: "";
      };
    };

export function latestFollowUpDraftState(notes?: string): Record<string, unknown> | null;
export function buildDueFollowUpDraftPatch(input?: {
  thread?: unknown;
  settings?: unknown;
  now?: Date;
}): DueFollowUpDraftPatch;
export function buildFollowUpDraftRunSummary(items?: Array<{ status?: string; reason?: string }>, options?: { now?: Date | string }): {
  last_run_at?: string;
  scanned: number;
  drafted: number;
  skipped: number;
  failed: number;
  reasons: Record<string, number>;
};
