import { buildProjectCandidateGraphView, getProject, recordProjectRoleAgentEvent } from "./projects";
import { listOutreachQueue } from "./outreach-threads";
import { buildProjectInboxQueueView } from "./inbox";
import { listSearchTasks, createSearchTask, runSearchTaskNow } from "./search-tasks";
import { buildRoleAgentWorkspaceView } from "./role-agent-workspace.mjs";
import { runRoleAgentRunCore } from "./role-agent-runner.mjs";

export type RoleAgentRunAction = "run_sourcing" | "refresh_live_signals";

export async function buildRoleAgentRunWorkspace(input: { userId: string; projectId: string }) {
  const [project, candidateGraph, outreachQueue, inboxQueue, searchTasks] = await Promise.all([
    getProject(input.userId, input.projectId),
    buildProjectCandidateGraphView(input.userId, input.projectId),
    listOutreachQueue({ userId: input.userId, projectId: input.projectId }),
    buildProjectInboxQueueView(input.userId, input.projectId),
    listSearchTasks({ userId: input.userId, projectId: input.projectId }),
  ]);
  if (!project) return null;
  const workspace = buildRoleAgentWorkspaceView({
    role: { id: project.id, status: project.status },
    settings: project.outreach_settings,
    candidateGraph,
    outreachQueue,
    inboxQueue,
    searchTasks,
    roleAgentMetrics: project.inbox_sync_summary,
    locale: "en",
  });
  return { project, workspace };
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

export async function runRoleAgentProjectAction(input: {
  userId: string;
  projectId: string;
  actionType: RoleAgentRunAction;
}) {
  const built = await buildRoleAgentRunWorkspace(input);
  if (!built) return null;
  return runRoleAgentRunCore({
    userId: input.userId,
    project: built.project,
    actionType: input.actionType,
    workspace: built.workspace,
    deps: {
      createSearchTask,
      runSearchTaskNow,
      refreshLiveSignals,
      recordProjectRoleAgentEvent,
    },
  });
}
