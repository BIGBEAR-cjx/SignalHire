export function runInboxAction(input?: {
  body?: Record<string, unknown>;
  user?: { id: string } | null;
  getOutreachThread: (input: { userId: string; id: string }) => Promise<Record<string, unknown> | null>;
  updateOutreachThread: (input: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
  now?: Date;
}): Promise<{ status: number; body: Record<string, unknown> }>;
