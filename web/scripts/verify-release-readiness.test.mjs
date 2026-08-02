import assert from "node:assert/strict";
import test from "node:test";

import { browserQaFixture, runReleaseBrowserCase } from "./verify-release-readiness.mjs";

test("browser release fixtures keep generated owner and customer sessions separate", () => {
  const fixture = browserQaFixture(
    { cookie: "sh_token=customer-session", projectId: "project-123" },
    { cookie: "sh_token=owner-session" },
  );

  assert.equal(fixture.owner, "sh_token=owner-session");
  assert.equal(fixture.customer, "sh_token=customer-session");
  assert.equal(fixture.projectId, "project-123");
});

test("release browser cases redact cookie setup and page creation failures", async () => {
  const rawSession = "sh_token=token%2Fdecoded";
  const strippedSession = "token%2Fdecoded";
  const decodedSession = "token/decoded";

  for (const phase of ["addCookies", "newPage"]) {
    let closed = false;
    const browser = {
      newContext: async () => ({
        addCookies: async () => {
          if (phase === "addCookies") throw new Error(`cookie setup failed for ${decodedSession}`);
        },
        newPage: async () => {
          if (phase === "newPage") throw new Error(`page creation failed for ${decodedSession}`);
        },
        close: async () => { closed = true; },
      }),
    };

    const row = await runReleaseBrowserCase({
      browser,
      item: { name: `browser:${phase}`, path: "/client", viewport: { width: 1440, height: 900 }, useQaSession: true },
      qaSession: { cookie: rawSession },
      origin: "http://127.0.0.1:3000",
      headers: {},
    });

    assert.equal(row.status, "fail");
    assert.equal(closed, true);
    assert.equal(row.detail.includes(rawSession), false);
    assert.equal(row.detail.includes(strippedSession), false);
    assert.equal(row.detail.includes(decodedSession), false);
    assert.match(row.detail, /\[REDACTED\]/);
  }
});
