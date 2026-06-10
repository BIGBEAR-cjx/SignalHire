import assert from "node:assert/strict";
import { test } from "node:test";
import { extractPdfTextFromFile } from "./web/lib/client-resume-extract.ts";

function pdfFile() {
  const text = "Jane Candidate";
  const pdf = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj
4 0 obj << /Length 47 >> stream
BT /F1 24 Tf 72 720 Td (${text}) Tj ET
endstream endobj
5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
xref
0 6
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000241 00000 n
0000000338 00000 n
trailer << /Size 6 /Root 1 0 R >>
startxref
408
%%EOF`;
  return new File([Buffer.from(pdf)], "candidate.pdf", { type: "application/pdf" });
}

test("extracts PDF text in the browser-compatible extractor", async () => {
  const result = await extractPdfTextFromFile(pdfFile());

  assert.equal(result.truncated, false);
  assert.equal(result.text, "Jane Candidate");
});
