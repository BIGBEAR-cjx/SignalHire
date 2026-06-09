export const MAX_RESUME_FILE_BYTES = 4 * 1024 * 1024;
export const MAX_RESUME_TEXT_CHARS = 20_000;

export function resumeExtensionOf(name) {
  const clean = name.toLowerCase().split("?")[0]?.split("#")[0] ?? "";
  const dot = clean.lastIndexOf(".");
  return dot >= 0 ? clean.slice(dot + 1) : "";
}

export function detectSupportedResumeFileType(name, type = "") {
  const ext = resumeExtensionOf(name);
  if (ext === "txt") return "txt";
  if (ext === "pdf") return "pdf";
  if (ext === "docx") return "docx";

  const mime = type.toLowerCase();
  if (mime === "text/plain") return "txt";
  if (mime === "application/pdf") return "pdf";
  if (mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return "docx";

  return null;
}
