import {
  MAX_RESUME_FILE_BYTES,
  MAX_RESUME_TEXT_CHARS,
  detectSupportedResumeFileType,
} from "./resume-upload-constraints.mjs";

export { MAX_RESUME_FILE_BYTES, MAX_RESUME_TEXT_CHARS };

export type ResumeFileType = "txt" | "pdf" | "docx";

export type ResumeExtractResult = {
  text: string;
  fileName: string;
  fileType: ResumeFileType;
  truncated: boolean;
};

export class ResumeExtractError extends Error {
  code: "missing_file" | "too_large" | "unsupported" | "empty" | "parse_failed";
  cause?: unknown;

  constructor(code: ResumeExtractError["code"], message = code, cause?: unknown) {
    super(message);
    this.name = "ResumeExtractError";
    this.code = code;
    this.cause = cause;
  }
}

function detectFileType(file: File): ResumeFileType {
  const fileType = detectSupportedResumeFileType(file.name, file.type);
  if (fileType) return fileType;
  throw new ResumeExtractError("unsupported");
}

function normalizeExtractedText(value: string): string {
  let normalized = String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
  for (let i = 0; i < 4; i += 1) {
    normalized = normalized.replace(/([\p{Script=Han}])\s+([\p{Script=Han}])/gu, "$1$2");
  }
  return normalized;
}

async function extractPdf(buffer: Buffer): Promise<string> {
  const { getDocument, VerbosityLevel } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = getDocument({
    data: new Uint8Array(buffer),
    verbosity: VerbosityLevel.ERRORS,
  });
  const pdf = await loadingTask.promise;
  try {
    const pages: string[] = [];
    for (let pageNo = 1; pageNo <= pdf.numPages; pageNo += 1) {
      const page = await pdf.getPage(pageNo);
      const content = await page.getTextContent();
      const parts: string[] = [];
      for (const item of content.items) {
        if (!("str" in item)) continue;
        const text = item.str.trim();
        if (!text) continue;
        parts.push(text);
        if (item.hasEOL) parts.push("\n");
      }
      pages.push(parts.join(" "));
      page.cleanup();
    }
    return pages.join("\n");
  } finally {
    await pdf.destroy();
  }
}

async function extractDocx(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

async function extractRawText(file: File, fileType: ResumeFileType): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  if (fileType === "txt") return new TextDecoder("utf-8", { fatal: false }).decode(buffer);
  if (fileType === "pdf") return extractPdf(buffer);
  return extractDocx(buffer);
}

export async function extractResumeText(file: File | null | undefined): Promise<ResumeExtractResult> {
  if (!file) throw new ResumeExtractError("missing_file");
  if (file.size > MAX_RESUME_FILE_BYTES) throw new ResumeExtractError("too_large");

  const fileType = detectFileType(file);
  let rawText = "";
  try {
    rawText = await extractRawText(file, fileType);
  } catch (error) {
    if (error instanceof ResumeExtractError) throw error;
    throw new ResumeExtractError("parse_failed", "parse_failed", error);
  }

  const normalized = normalizeExtractedText(rawText);
  if (!normalized) throw new ResumeExtractError("empty");

  const truncated = normalized.length > MAX_RESUME_TEXT_CHARS;
  return {
    text: truncated ? normalized.slice(0, MAX_RESUME_TEXT_CHARS).trimEnd() : normalized,
    fileName: file.name,
    fileType,
    truncated,
  };
}
