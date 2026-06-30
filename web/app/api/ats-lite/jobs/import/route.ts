import { buildAtsJobImportView, buildAtsLiteProviderStatus, buildAtsProjectDraft, mockGreenhouseJob } from "@/lib/ats-lite.mjs";
import { createProject } from "@/lib/projects";
import { normalizeLocale, t } from "@/lib/i18n.mjs";
import { getUser } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: { external_job_id?: unknown; locale?: unknown } = {};
  try { body = await req.json(); } catch {}
  const locale = normalizeLocale(body.locale);
  const user = await getUser();
  if (!user) return Response.json({ error: t(locale, "api.error.loginRequired") }, { status: 401 });

  const externalJobId = typeof body.external_job_id === "string" && body.external_job_id.trim()
    ? body.external_job_id.trim()
    : "greenhouse-demo-role";
  const job = buildAtsJobImportView(mockGreenhouseJob(externalJobId));
  const draft = buildAtsProjectDraft(job);
  const project = await createProject({ userId: user.id, name: draft.name, brief: draft.brief });
  if (!project) return Response.json({ error: t(locale, "api.error.projectCreateFailed") }, { status: 500 });

  return Response.json({
    provider: buildAtsLiteProviderStatus(),
    job: { ...job, imported_project_id: project.id },
    project,
  });
}
