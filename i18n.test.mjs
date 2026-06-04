import assert from "node:assert/strict";
import { test } from "node:test";

import { isLocale, normalizeLocale, t } from "./web/lib/i18n.mjs";

test("normalizes supported locales and falls back to Chinese", () => {
  assert.equal(normalizeLocale("zh"), "zh");
  assert.equal(normalizeLocale("en"), "en");
  assert.equal(normalizeLocale("fr"), "zh");
  assert.equal(normalizeLocale(undefined), "zh");
});

test("identifies supported locales", () => {
  assert.equal(isLocale("zh"), true);
  assert.equal(isLocale("en"), true);
  assert.equal(isLocale("ja"), false);
});

test("translates known keys and falls back to Chinese or key", () => {
  assert.equal(t("zh", "nav.search"), "智能搜人");
  assert.equal(t("en", "nav.search"), "AI Search");
  assert.equal(t("fr", "nav.search"), "智能搜人");
  assert.equal(t("en", "missing.key"), "missing.key");
});
