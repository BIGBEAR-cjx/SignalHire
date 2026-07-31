import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("renders visible ready and unavailable live signal provider states accessibly", () => {
  const page = readFileSync("web/app/app/projects/[id]/page.tsx", "utf8");

  assert.match(page, /roleAgentWorkspace\.signal_refresh\.provider_status === "ready"/);
  assert.match(page, /Live signal provider ready/);
  assert.match(page, /Live signal provider unavailable/);
  assert.match(page, /aria-live="polite"/);
});
