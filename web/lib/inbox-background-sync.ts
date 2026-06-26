import {
  backgroundInboxSync as backgroundInboxSyncCore,
  listBackgroundInboxSyncProjects,
} from "./inbox-background-sync.mjs";
import { syncGmailInboxForProject } from "./inbox";
import { updateProjectInboxSyncSummary } from "./projects";

export async function backgroundInboxSync(input: {
  maxProjects?: number;
  maxThreadsPerProject?: number;
  now?: Date;
} = {}) {
  return backgroundInboxSyncCore(({
    ...input,
    listProjects: listBackgroundInboxSyncProjects,
    recordProjectSyncSummary: ({ userId, projectId, summary }: { userId: string; projectId: string; summary: unknown }) => (
      updateProjectInboxSyncSummary({ userId, id: projectId, summary })
    ),
    syncProject: ({ userId, projectId, maxThreads }: { userId: string; projectId: string; maxThreads: number }) => (
      syncGmailInboxForProject({ userId, projectId, maxThreads })
    ),
  }) as never);
}
