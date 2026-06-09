import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";
import {
  MAX_RESUME_FILE_BYTES,
  MAX_RESUME_TEXT_CHARS,
  extractResumeText,
} from "./web/lib/resume-extract.ts";

const require = createRequire(import.meta.url);
const JSZip = require("./web/node_modules/jszip");

function file({ name, type = "text/plain", text = "" }) {
  return new File([new TextEncoder().encode(text)], name, { type });
}

async function docxFile() {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);
  zip.folder("_rels").file(".rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);
  zip.folder("word").file("document.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>Jane Candidate</w:t></w:r></w:p>
    <w:p><w:r><w:t>Led AI product teams.</w:t></w:r></w:p>
  </w:body>
</w:document>`);
  return new File(
    [await zip.generateAsync({ type: "nodebuffer" })],
    "candidate.docx",
    { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
  );
}

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


test("extracts plain text resumes", async () => {
  const result = await extractResumeText(file({
    name: "candidate.txt",
    text: "  Jane Candidate\n\nBuilt AI products.\nLed a team.  ",
  }));

  assert.equal(result.text, "Jane Candidate\nBuilt AI products.\nLed a team.");
  assert.equal(result.fileName, "candidate.txt");
  assert.equal(result.fileType, "txt");
  assert.equal(result.truncated, false);
});

test("extracts PDF resumes", async () => {
  const result = await extractResumeText(pdfFile());

  assert.equal(result.text, "Jane Candidate");
  assert.equal(result.fileType, "pdf");
});

test("extracts DOCX resumes", async () => {
  const result = await extractResumeText(await docxFile());

  assert.equal(result.text, "Jane Candidate\nLed AI product teams.");
  assert.equal(result.fileType, "docx");
});

test("rejects unsupported resume file types", async () => {
  await assert.rejects(
    () => extractResumeText(file({ name: "candidate.doc", type: "application/msword", text: "legacy doc" })),
    /unsupported/i,
  );
});

test("rejects empty extracted resume text", async () => {
  await assert.rejects(
    () => extractResumeText(file({ name: "empty.txt", text: "   \n\t  " })),
    /empty/i,
  );
});

test("rejects oversized resume files", async () => {
  const oversized = new File([new Uint8Array(MAX_RESUME_FILE_BYTES + 1)], "large.txt", { type: "text/plain" });

  await assert.rejects(
    () => extractResumeText(oversized),
    /too_large/i,
  );
});

test("truncates very long resume text", async () => {
  const result = await extractResumeText(file({
    name: "long.txt",
    text: "A".repeat(MAX_RESUME_TEXT_CHARS + 100),
  }));

  assert.equal(result.text.length, MAX_RESUME_TEXT_CHARS);
  assert.equal(result.truncated, true);
});
