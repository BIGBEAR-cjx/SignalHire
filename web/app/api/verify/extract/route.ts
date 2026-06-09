import { extractResumeText, ResumeExtractError } from "@/lib/resume-extract";
import { normalizeLocale, t } from "@/lib/i18n.mjs";
import { getUser } from "@/lib/session";

export const runtime = "nodejs";
export const maxDuration = 60;

function errorKey(error: unknown): string {
  if (!(error instanceof ResumeExtractError)) return "api.error.resumeParseFailed";
  if (error.code === "missing_file") return "api.error.resumeMissingFile";
  if (error.code === "unsupported") return "api.error.resumeUnsupportedType";
  if (error.code === "too_large") return "api.error.resumeTooLarge";
  if (error.code === "empty") return "api.error.resumeEmptyText";
  return "api.error.resumeParseFailed";
}

export async function POST(req: Request) {
  let locale = "zh";
  try {
    const form = await req.formData();
    locale = normalizeLocale(String(form.get("locale") ?? "zh"));
    const user = await getUser();
    if (!user) return Response.json({ error: t(locale, "api.error.loginRequired") }, { status: 401 });

    const file = form.get("file");
    if (!(file instanceof File)) {
      return Response.json({ error: t(locale, "api.error.resumeMissingFile") }, { status: 400 });
    }

    const result = await extractResumeText(file);
    return Response.json({
      text: result.text,
      fileName: result.fileName,
      fileType: result.fileType,
      truncated: result.truncated,
      warning: result.truncated ? t(locale, "research.resumeUploadTruncated") : "",
    });
  } catch (error) {
    return Response.json({ error: t(locale, errorKey(error)) }, { status: 400 });
  }
}
