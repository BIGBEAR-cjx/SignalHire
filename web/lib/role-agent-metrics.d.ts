export type RoleAgentMetricEvent = {
  event_type?: string;
  action_type?: string;
  action_status?: string;
  run_id?: string;
  workflow_step?: string;
  guardrail?: string;
  detail?: string;
  actor?: string;
  sentiment?: string;
  note?: string;
  report_href?: string;
  targets?: Array<{ id?: string; candidate_name?: string; name?: string }>;
  result?: Record<string, string | number | boolean>;
  failed_items?: Array<{ id?: string; candidate_name?: string; name?: string; error?: string; reason?: string }>;
  retryable?: boolean;
  at?: string;
};

export type RoleAgentMetricsSummary = {
  panel_views: number;
  settings_updates: number;
  client_report_views: number;
  manager_feedback_count: number;
  next_action_clicks: Record<string, number>;
  next_action_runs: Record<string, Record<string, number>>;
  last_event_at: string;
  recent_events: Array<{
    event_type: string;
    action_type: string;
    action_status: string;
    detail: string;
    at: string;
  }>;
  execution_log: Array<{
    action_type: string;
    status: string;
    detail: string;
    targets: Array<{ id: string; candidate_name: string }>;
    result: Record<string, string | number | boolean>;
    failed_items: Array<{ id: string; candidate_name: string; error: string }>;
    retryable: boolean;
    at: string;
  }>;
  role_agent_runs: Array<{
    run_id: string;
    action_type: string;
    workflow_step: string;
    status: string;
    detail: string;
    targets: Array<{ id: string; candidate_name: string }>;
    result: Record<string, string | number | boolean>;
    failed_items: Array<{ id: string; candidate_name: string; error: string }>;
    retryable: boolean;
    guardrail: string;
    started_at: string;
    finished_at: string;
    updated_at: string;
  }>;
};

export function buildRoleAgentMetricsSummary(current?: unknown, event?: RoleAgentMetricEvent): RoleAgentMetricsSummary;
