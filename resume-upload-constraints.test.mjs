import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MAX_RESUME_FILE_BYTES,
  detectSupportedResumeFileType,
} from "./web/lib/resume-upload-constraints.mjs";

test("resume upload limit stays below common serverless multipart limits", () => {
  assert.equal(MAX_RESUME_FILE_BYTES, 4 * 1024 * 1024);
});

test("detects supported resume files from extension or MIME type", () => {
  assert.equal(detectSupportedResumeFileType("resume.pdf", ""), "pdf");
  assert.equal(detectSupportedResumeFileType("resume", "application/pdf"), "pdf");
  assert.equal(detectSupportedResumeFileType("resume.docx", ""), "docx");
  assert.equal(detectSupportedResumeFileType("resume.txt", ""), "txt");
  assert.equal(detectSupportedResumeFileType("resume.doc", "application/msword"), null);
  assert.equal(detectSupportedResumeFileType("resume.png", "image/png"), null);
});
