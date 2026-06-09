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

function diagnosticName(error: unknown): string {
  if (error instanceof Error) return error.name || "Error";
  return typeof error;
}

function logResumeExtractFailure(error: unknown, file?: File) {
  const code = error instanceof ResumeExtractError ? error.code : "unknown";
  const cause = error instanceof ResumeExtractError ? error.cause : error;
  console.warn("[resume-extract] failed", {
    code,
    fileName: file?.name,
    fileType: file?.type,
    fileSize: file?.size,
    errorName: diagnosticName(error),
    causeName: diagnosticName(cause),
  });
}

export async function POST(req: Request) {
  let locale = normalizeLocale(new URL(req.url).searchParams.get("locale") ?? "zh");
  let file: File | undefined;
  try {
    let form: FormData;
    try {
      form = await req.formData();
    } catch (error) {
      logResumeExtractFailure(error);
      return Response.json({ error: t(locale, "api.error.resumeUploadInterrupted") }, { status: 413 });
    }
    locale = normalizeLocale(String(form.get("locale") ?? locale));
    const user = await getUser();
    if (!user) return Response.json({ error: t(locale, "api.error.loginRequired") }, { status: 401 });

    const formFile = form.get("file");
    if (!(formFile instanceof File)) {
      return Response.json({ error: t(locale, "api.error.resumeMissingFile") }, { status: 400 });
    }
    file = formFile;

    const result = await extractResumeText(file);
    return Response.json({
      text: result.text,
      fileName: result.fileName,
      fileType: result.fileType,
      truncated: result.truncated,
      warning: result.truncated ? t(locale, "research.resumeUploadTruncated") : "",
    });
  } catch (error) {
    logResumeExtractFailure(error, file);
    return Response.json({ error: t(locale, errorKey(error)) }, { status: 400 });
  }
}
