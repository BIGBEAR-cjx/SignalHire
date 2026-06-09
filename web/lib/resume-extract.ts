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
  return String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

async function extractPdf(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });
  try {
    const data = await parser.getText({ pageJoiner: "\n" });
    return data.text;
  } finally {
    await parser.destroy();
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
