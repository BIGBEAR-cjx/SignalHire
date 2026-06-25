function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function searchLimit(value) {
  return Math.min(Math.max(Number(value) || 20, 1), 100);
}

/**
 * @param {{
 *   body?: Record<string, unknown>,
 *   user?: { id: string } | null,
 *   getProject: (userId: string, projectId: string) => Promise<any>,
 *   searchMiraPeople: (input: { text: string, size: number }) => Promise<unknown[]>,
 *   toShortlistCandidates: (rows: unknown[]) => Array<Record<string, unknown>>,
 *   addItem: (input: any) => Promise<string | null>,
 *   messages?: Record<string, string>,
 * }} input
 */
export async function runOpenJobsProviderSearch({
  body = {},
  user = null,
  getProject,
  searchMiraPeople,
  toShortlistCandidates,
  addItem,
  messages = {},
} = {}) {
  const input = isRecord(body) ? body : {};
  if (!user) return { status: 401, body: { error: messages.loginRequired || "login_required" } };

  const projectId = cleanString(input.project_id);
  if (!projectId) return { status: 400, body: { error: messages.missingId || "missing_id" } };

  const project = await getProject(user.id, projectId);
  if (!project) return { status: 404, body: { error: messages.projectNotFound || "project_not_found" } };

  const text = cleanString(input.brief) || project.brief || project.name;
  try {
    const rows = await searchMiraPeople({ text, size: searchLimit(input.limit) });
    const candidates = toShortlistCandidates(rows);
    let saved = 0;
    for (let index = 0; index < candidates.length; index += 1) {
      const candidate = candidates[index];
      const id = await addItem({
        userId: user.id,
        sourceRunId: null,
        candidateIndex: index,
        candidate,
        projectId,
        status: "needs_evidence",
        dedupKey: `${user.id}:project:${projectId}:openjobs:${candidate.provider_id || candidate.linkedin_url || index}`,
      });
      if (id) saved += 1;
    }
    return { status: 200, body: { ok: true, provider: "openjobs_mira", found: rows.length, saved } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "OpenJobs Mira search failed";
    return { status: 200, body: { ok: false, provider: "openjobs_mira", error: message, found: 0, saved: 0 } };
  }
}
