import { createClient } from "@insforge/sdk";
import { buildDueFollowUpDraftPatch, buildFollowUpDraftRunSummary } from "./outreach-followups.mjs";
import { buildRoleOutreachSettings } from "./outreach-settings.mjs";
import { updateOutreachThread, type OutreachThread } from "./outreach-threads";
import { recordProjectOutreachFollowUpSummary } from "./projects";

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

type DueProjectRow = {
  id: string;
  user_id: string;
  outreach_settings: unknown;
};

async function listAutoFollowUpProjects(limit: number): Promise<DueProjectRow[]> {
  const rows = await runSQL<DueProjectRow>(
    `SELECT id, user_id, outreach_settings
     FROM projects
     WHERE COALESCE(outreach_settings->>'auto_follow_up_only', 'false') = 'true'
       AND status = 'open'
     ORDER BY updated_at DESC
     LIMIT $1`,
    [limit],
  );
  return rows ?? [];
}

async function listDueThreadsForProject(input: {
  userId: string;
  projectId: string;
  nowIso: string;
  limit: number;
}): Promise<OutreachThread[]> {
  if (!client) return [];
  try {
    const { data, error } = await client.database
      .from("outreach_threads")
      .select("*")
      .eq("user_id", input.userId)
      .eq("project_id", input.projectId)
      .in("status", ["sent", "contacted", "follow_up_scheduled", "follow_up_due"])
      .lte("next_follow_up_at", input.nowIso)
      .order("next_follow_up_at", { ascending: true })
      .limit(input.limit);
    if (error || !data) return [];
    return data as OutreachThread[];
  } catch {
    return [];
  }
}

export async function processDueFollowUpDrafts({
  now = new Date(),
  maxProjects = 20,
  maxThreadsPerProject = 20,
} = {}) {
  const projects = await listAutoFollowUpProjects(maxProjects);
  const outcomes: Array<{ status: string; reason?: string }> = [];

  for (const project of projects) {
    const settings = buildRoleOutreachSettings(project.outreach_settings);
    const projectOutcomes: Array<{ status: string; reason?: string }> = [];
    const threads = await listDueThreadsForProject({
      userId: project.user_id,
      projectId: project.id,
      nowIso: now.toISOString(),
      limit: maxThreadsPerProject,
    });

    for (const thread of threads) {
      const result = buildDueFollowUpDraftPatch({ thread, settings, now });
      if (!result.ok) {
        const outcome = { status: "skipped", reason: result.reason };
        projectOutcomes.push(outcome);
        outcomes.push(outcome);
        continue;
      }
      try {
        const updated = await updateOutreachThread({
          userId: project.user_id,
          id: thread.id,
          ...result.patch,
        });
        const outcome = updated ? { status: "drafted" } : { status: "failed", reason: "update_failed" };
        projectOutcomes.push(outcome);
        outcomes.push(outcome);
      } catch (error) {
        const outcome = { status: "failed", reason: error instanceof Error ? error.message : "update_failed" };
        projectOutcomes.push(outcome);
        outcomes.push(outcome);
      }
    }

    try {
      await recordProjectOutreachFollowUpSummary({
        userId: project.user_id,
        id: project.id,
        summary: buildFollowUpDraftRunSummary(projectOutcomes, { now }),
      });
    } catch {}
  }

  return {
    ok: true,
    project_count: projects.length,
    summary: buildFollowUpDraftRunSummary(outcomes, { now }),
  };
}
