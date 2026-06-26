import {
  backgroundInboxSync as backgroundInboxSyncCore,
  listBackgroundInboxSyncProjects,
} from "./inbox-background-sync.mjs";
import { syncGmailInboxForProject } from "./inbox";

export async function backgroundInboxSync(input: {
  maxProjects?: number;
  maxThreadsPerProject?: number;
  now?: Date;
} = {}) {
  return backgroundInboxSyncCore(({
    ...input,
    listProjects: listBackgroundInboxSyncProjects,
    syncProject: ({ userId, projectId, maxThreads }: { userId: string; projectId: string; maxThreads: number }) => (
      syncGmailInboxForProject({ userId, projectId, maxThreads })
    ),
  }) as never);
}
