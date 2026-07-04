import { createClient } from "@insforge/sdk";
import { buildProjectCandidateGraphView, getProject, recordProjectRoleAgentEvent } from "./projects";
import { listOutreachQueue } from "./outreach-threads";
import { buildProjectInboxQueueView } from "./inbox";
import { listSearchTasks } from "./search-tasks";
import { buildRoleAgentWorkspaceView } from "./role-agent-workspace.mjs";
import { buildLiveSignalRefreshSummary, selectLiveSignalRefreshProjects } from "./live-signal-refresh.mjs";
import { runRoleAgentRunCore } from "./role-agent-runner.mjs";

const BASE = process.env.INSFORGE_API_BASE_URL;
const KEY = process.env.INSFORGE_API_KEY;
const client = BASE && KEY ? createClient({ baseUrl: BASE, anonKey: KEY, isServerMode: true }) : null;

async function runSQL<T = Record<string, unknown>>(query: string, params: unknown[] = []): Promise<T[] | null> {
  if (!BASE || !KEY) return null;
  try {
    const r = await fetch(`${BASE}/api/database/advance/rawsql`, {
      method: "POST",
      headers: { "x-api-key": KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ query, params }),
    });
    if (!r.ok) return null;
    const j = await r.json();
    return (j.rows ?? []) as T[];
  } catch {
    return null;
  }
}

async function listLiveSignalCandidateProjects(limit: number) {
  if (!client) return [];
  const rows = await runSQL<{
    id: string;
    user_id: string;
    name: string;
    brief: string | null;
    status: string;
  }>(
    `SELECT id, user_id, name, brief, status
     FROM projects
     WHERE status = 'open'
     ORDER BY updated_at DESC
     LIMIT $1`,
    [Math.max(1, Math.min(100, Math.floor(Number(limit))))],
  );
  return rows ?? [];
}

async function buildProjectWorkspace(row: { id: string; user_id: string; status: string }) {
  const [project, candidateGraph, outreachQueue, inboxQueue, searchTasks] = await Promise.all([
    getProject(row.user_id, row.id),
    buildProjectCandidateGraphView(row.user_id, row.id),
    listOutreachQueue({ userId: row.user_id, projectId: row.id }),
    buildProjectInboxQueueView(row.user_id, row.id),
    listSearchTasks({ userId: row.user_id, projectId: row.id }),
  ]);
  if (!project) return null;
  return {
    ...project,
    role_agent_workspace: buildRoleAgentWorkspaceView({
      role: { id: project.id, status: project.status },
      settings: project.outreach_settings,
      candidateGraph,
      outreachQueue,
      inboxQueue,
      searchTasks,
      roleAgentMetrics: project.inbox_sync_summary,
      locale: "en",
    }),
  };
}

async function refreshLiveSignals(input: { targets?: unknown[] }) {
  const targets = Array.isArray(input.targets) ? input.targets : [];
  return {
    refreshed: targets.map((target) => ({
      ...(target && typeof target === "object" ? target as Record<string, unknown> : {}),
      signal_count: 1,
      provider: "candidate_activity_snapshot",
    })),
    failed: [],
  };
}

export async function refreshDueLiveSignals(limit = 10) {
  const candidates = await listLiveSignalCandidateProjects(limit);
  const withWorkspaces = (await Promise.all(candidates.map(buildProjectWorkspace))).filter(Boolean);
  const due = selectLiveSignalRefreshProjects(withWorkspaces, { limit });
  const results = [];
  for (const project of due as Array<Record<string, unknown>>) {
    const result = await runRoleAgentRunCore({
      userId: String(project.user_id || ""),
      project,
      actionType: "refresh_live_signals",
      workspace: project.role_agent_workspace,
      deps: {
        refreshLiveSignals,
        recordProjectRoleAgentEvent,
      },
    }) as { status?: string; result?: { refreshed?: number; failed?: number }; error?: string };
    results.push({
      project_id: String(project.id || ""),
      status: result.status || "failed",
      refreshed: Number(result.result?.refreshed ?? 0),
      failed: Number(result.result?.failed ?? 0),
      error: result.error || "",
    });
  }
  return buildLiveSignalRefreshSummary(results);
}
