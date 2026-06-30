export type SequenceAnalyticsView = {
  role_id: string;
  summary: {
    drafted: number;
    approved: number;
    sent: number;
    opened: null;
    replied: number;
    interested: number;
    bounced: number;
    stopped: number;
    due_follow_up: number;
    open_tracking_available: false;
  };
  opened: null;
  open_tracking_available: false;
  open_tracking_label: string;
  step_performance: Array<{
    step: 1 | 2 | 3;
    drafted: number;
    sent: number;
    replied: number;
    interested: number;
    bounced: number;
  }>;
  next_actions: string[];
};

export function buildSequenceAnalyticsView(input?: {
  roleId?: string;
  threads?: unknown[];
  now?: Date | string;
  locale?: "zh" | "en" | string;
}): SequenceAnalyticsView;
