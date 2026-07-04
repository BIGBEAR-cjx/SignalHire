import { buildProjectCandidateGraphView, getProject, recordProjectRoleAgentEvent } from "./projects";
import { listOutreachQueue } from "./outreach-threads";
import { buildProjectInboxQueueView } from "./inbox";
import { listSearchTasks, createSearchTask, runSearchTaskNow } from "./search-tasks";
import { buildRoleAgentWorkspaceView } from "./role-agent-workspace.mjs";
import { runRoleAgentRunCore } from "./role-agent-runner.mjs";
import { createHttpLiveSignalProvider } from "./live-signal-refresh.mjs";
import { runBulkContactResolution } from "./contact-resolution-route.mjs";
import { updateOutreachThread } from "./outreach-threads";

export type RoleAgentRunAction = "run_sourcing" | "refresh_live_signals" | "prepare_outreach";

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

async function refreshLiveSignals(input: { userId?: string; project?: unknown; targets?: unknown[] }) {
  const provider = createHttpLiveSignalProvider({
    url: process.env.LIVE_SIGNAL_PROVIDER_URL,
    apiKey: process.env.LIVE_SIGNAL_PROVIDER_API_KEY,
  });
  if (!provider) {
    const targets = Array.isArray(input.targets) ? input.targets : [];
    return {
      refreshed: [],
      failed: targets.map((target) => ({
        ...(target && typeof target === "object" ? target as Record<string, unknown> : {}),
        error: "provider_not_configured",
      })),
      error: "provider_not_configured",
    };
  }
  return provider.refresh(input);
}

async function resolveContacts(input: { userId?: string; projectId?: string }) {
  const result = await runBulkContactResolution({
    body: { project_id: input.projectId },
    user: { id: input.userId },
    env: process.env,
    messages: {
      loginRequired: "login_required",
      missingId: "missing_project_id",
    },
  });
  return result.body;
}

async function approveOutreachDraft(input: { userId?: string; id?: string }) {
  return updateOutreachThread({
    userId: String(input.userId || ""),
    id: String(input.id || ""),
    status: "approved",
    send_error: "",
  });
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
      resolveContacts,
      approveOutreachDraft,
      recordProjectRoleAgentEvent,
    },
  });
}
