import test from "node:test";
import assert from "node:assert/strict";
import {
  assertTalentPayload,
  normalizeAuthCookie,
  resolveAuthCookie,
} from "./web/scripts/verify-live-research-job-utils.mjs";

test("assertTalentPayload requires search plan and evidence graph", () => {
  assert.throws(
    () => assertTalentPayload({
      result: {
        search_brief: {},
        talent_map: [],
        candidates: Array.from({ length: 10 }, (_, index) => ({
          name: `Candidate ${index}`,
          match_score: 80,
          evidence_audit: {},
          claims: [],
        })),
      },
    }),
    /missing search_plan/,
  );

  assert.doesNotThrow(() => assertTalentPayload({
    result: {
      search_brief: {},
      search_plan: { must_have: [], nice_to_have: [], exclusions: [], source_strategy: [], adjacent_pools: [] },
      talent_map: [],
      evidence_graph: { summary: "", source_mix: [], candidates: [] },
      candidates: Array.from({ length: 10 }, (_, index) => ({
        name: `Candidate ${index}`,
        match_score: 80,
        evidence_audit: {},
        claims: [],
      })),
    },
  }));
});

test("normalizeAuthCookie accepts raw token or cookie header", () => {
  assert.equal(normalizeAuthCookie("abc.def"), "sh_token=abc.def");
  assert.equal(normalizeAuthCookie("sh_token=abc.def"), "sh_token=abc.def");
  assert.equal(normalizeAuthCookie(" foo=bar; sh_token=abc.def "), "foo=bar; sh_token=abc.def");
  assert.equal(normalizeAuthCookie(""), "");
});

test("resolveAuthCookie signs in with injected auth client", async () => {
  const cookie = await resolveAuthCookie({
    email: "test@example.com",
    password: "pw",
    insforgeBaseUrl: "https://insforge.example",
    createAuthClient: async (baseUrl) => {
      assert.equal(baseUrl, "https://insforge.example");
      return {
        auth: {
          signInWithPassword: async ({ email, password }) => {
            assert.equal(email, "test@example.com");
            assert.equal(password, "pw");
            return { data: { accessToken: "signed-token" } };
          },
        },
      };
    },
  });

  assert.equal(cookie, "sh_token=signed-token");
});
