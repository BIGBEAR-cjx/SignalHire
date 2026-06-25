import { getProject } from "@/lib/projects";
import { addItem } from "@/lib/shortlist";
import { apolloRowsToShortlistCandidates, searchApolloPeople } from "@/lib/people-providers.mjs";
import { normalizeLocale, t } from "@/lib/i18n.mjs";
import { getUser } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: {
    project_id?: unknown;
    brief?: unknown;
    titles?: unknown;
    locations?: unknown;
    organization_domains?: unknown;
    limit?: unknown;
    locale?: unknown;
  } = {};
  try { body = await req.json(); } catch {}
  const locale = normalizeLocale(body.locale);
  const user = await getUser();
  if (!user) return Response.json({ error: t(locale, "api.error.loginRequired") }, { status: 401 });
  const projectId = typeof body.project_id === "string" ? body.project_id.trim() : "";
  if (!projectId) return Response.json({ error: t(locale, "api.error.missingId") }, { status: 400 });
  const project = await getProject(user.id, projectId);
  if (!project) return Response.json({ error: t(locale, "api.error.projectNotFound") }, { status: 404 });

  const titleFallback = project.name ? [project.name] : [];
  const rows = await searchApolloPeople({
    input: {
      titles: Array.isArray(body.titles) ? body.titles : titleFallback,
      locations: Array.isArray(body.locations) ? body.locations : [],
      organizationDomains: Array.isArray(body.organization_domains) ? body.organization_domains : [],
      keywords: typeof body.brief === "string" && body.brief.trim() ? body.brief : (project.brief || project.name),
      perPage: Math.min(Math.max(Number(body.limit) || 10, 1), 25),
    },
  });
  const candidates = apolloRowsToShortlistCandidates(rows);
  let saved = 0;
  for (let index = 0; index < candidates.length; index += 1) {
    const id = await addItem({
      userId: user.id,
      sourceRunId: null,
      candidateIndex: index,
      candidate: candidates[index],
      projectId,
      status: "needs_evidence",
      dedupKey: `${user.id}:project:${projectId}:apollo:${candidates[index].provider_id || candidates[index].linkedin_url || index}`,
    });
    if (id) saved += 1;
  }
  return Response.json({
    ok: true,
    provider: "apollo",
    found: rows.length,
    saved,
    plan_limited: rows.length === 0,
  });
}
