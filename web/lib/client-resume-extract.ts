import {
  MAX_RESUME_TEXT_CHARS,
} from "./resume-upload-constraints.mjs";

export type ClientResumeExtractResult = {
  text: string;
  truncated: boolean;
};

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

export async function extractPdfTextFromFile(file: File): Promise<ClientResumeExtractResult> {
  const { getDocument, GlobalWorkerOptions, VerbosityLevel, version } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  if (typeof window !== "undefined" && !GlobalWorkerOptions.workerSrc) {
    GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${version}/legacy/build/pdf.worker.min.mjs`;
  }

  const loadingTask = getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
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
    const text = normalizeExtractedText(pages.join("\n"));
    const truncated = text.length > MAX_RESUME_TEXT_CHARS;
    return {
      text: truncated ? text.slice(0, MAX_RESUME_TEXT_CHARS).trimEnd() : text,
      truncated,
    };
  } finally {
    await pdf.destroy();
  }
}
