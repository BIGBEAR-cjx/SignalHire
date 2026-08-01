import test from "node:test";
import assert from "node:assert/strict";
import { createGitHubPublicLiveSignalProvider } from "./web/lib/live-signal-refresh.mjs";

test("turns GitHub public events into evidence-linked live signals", async () => {
  const provider = createGitHubPublicLiveSignalProvider({
    now: () => new Date("2026-08-01T12:00:00.000Z"),
    fetchImpl: async (url, init) => {
      assert.equal(url, "https://api.github.com/users/ada/events/public?per_page=10");
      assert.equal(init.headers.Authorization, "Bearer token-for-test");
      return {
        ok: true,
        json: async () => [{
          type: "PullRequestEvent",
          created_at: "2026-07-30T12:00:00.000Z",
          repo: { name: "ada/inference" },
        }],
      };
    },
    apiKey: "token-for-test",
  });

  const result = await provider.refresh({
    targets: [{ candidate_id: "candidate-1", candidate_name: "Ada", github_login: "ada" }],
  });

  assert.equal(result.failed.length, 0);
  assert.equal(result.refreshed[0].provider, "github_public_events");
  assert.equal(result.refreshed[0].live_signals[0].type, "pull_request");
  assert.equal(result.refreshed[0].live_signals[0].url, "https://github.com/ada/inference");
  assert.equal(result.refreshed[0].live_signals[0].expires_at, "2026-08-13T12:00:00.000Z");
});

test("does not fabricate signals when GitHub identity is absent or the API fails", async () => {
  const provider = createGitHubPublicLiveSignalProvider({
    fetchImpl: async () => ({ ok: false, status: 429 }),
  });

  const result = await provider.refresh({
    targets: [
      { candidate_id: "candidate-1", candidate_name: "No GitHub" },
      { candidate_id: "candidate-2", candidate_name: "Rate limited", github_login: "ada" },
    ],
  });

  assert.deepEqual(result.refreshed, []);
  assert.deepEqual(result.failed.map((item) => item.error), ["github_identity_not_found", "github_http_429"]);
});
