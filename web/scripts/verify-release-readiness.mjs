import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  if (index === -1 || index + 1 >= process.argv.length) return fallback;
  return cleanString(process.argv[index + 1]) || fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function baseUrl() {
  return cleanString(argValue("--base-url", process.env.SIGNALHIRE_QA_BASE_URL || "http://127.0.0.1:3000")).replace(/\/+$/, "");
}

async function fetchText(url) {
  const response = await fetch(url, { redirect: "manual" });
  const text = await response.text();
  return { status: response.status, text };
}

function isVercelSecurityCheckpoint(text) {
  return /Vercel Security Checkpoint|Failed to verify your browser|We're verifying your browser/i.test(text);
}

function runtimeEnvChecks({ requireLiveProvider = false } = {}) {
  const rows = [];
  const required = [
    "INSFORGE_API_BASE_URL",
    "INSFORGE_API_KEY",
    "NEXT_PUBLIC_INSFORGE_API_BASE_URL",
    "CRON_SECRET",
  ];
  for (const key of required) {
    rows.push({
      name: `env:${key}`,
      status: cleanString(process.env[key]) ? "pass" : "warn",
      detail: cleanString(process.env[key]) ? "configured" : "missing in current shell",
    });
  }
  const liveReady = Boolean(cleanString(process.env.LIVE_SIGNAL_PROVIDER_URL));
  rows.push({
    name: "env:LIVE_SIGNAL_PROVIDER_URL",
    status: liveReady ? "pass" : requireLiveProvider ? "fail" : "warn",
    detail: liveReady ? "configured" : "missing; refresh_live_signals will record provider_not_configured guardrail",
  });
  rows.push({
    name: "env:SIGNALHIRE_QA_EMAIL",
    status: cleanString(process.env.SIGNALHIRE_QA_EMAIL) && cleanString(process.env.SIGNALHIRE_QA_PASSWORD) ? "pass" : "warn",
    detail: cleanString(process.env.SIGNALHIRE_QA_EMAIL) && cleanString(process.env.SIGNALHIRE_QA_PASSWORD)
      ? "login QA credentials present"
      : "login-state QA will be skipped without SIGNALHIRE_QA_EMAIL and SIGNALHIRE_QA_PASSWORD",
  });
  return rows;
}

async function routeSmokeChecks(origin) {
  const rows = [];
  const client = await fetchText(`${origin}/client`);
  const clientHasCopy = /客户交付工作台|Client delivery|客户工作台/i.test(client.text);
  rows.push({
    name: "route:/client",
    status: client.status === 200 && clientHasCopy ? "pass" : isVercelSecurityCheckpoint(client.text) ? "blocked" : "fail",
    detail: `status=${client.status}${clientHasCopy ? ", client workspace copy present" : ""}`,
  });

  const workspace = await fetchText(`${origin}/api/client-portal/workspace`);
  rows.push({
    name: "route:/api/client-portal/workspace anonymous",
    status: workspace.status === 401 ? "pass" : isVercelSecurityCheckpoint(workspace.text) ? "blocked" : "fail",
    detail: `status=${workspace.status}`,
  });
  return rows;
}

function loadPlaywright() {
  const modulePath = cleanString(process.env.PLAYWRIGHT_MODULE_PATH);
  if (modulePath) return require(modulePath);
  try {
    return require("playwright");
  } catch {
    return null;
  }
}

function nestedText(a, b) {
  return a.text !== b.text && (a.text.includes(b.text) || b.text.includes(a.text));
}

function visibleOverlap(rects) {
  for (let i = 0; i < rects.length; i += 1) {
    for (let j = i + 1; j < rects.length; j += 1) {
      const a = rects[i];
      const b = rects[j];
      if ((a.tag === "LABEL" && b.tag === "INPUT") || (a.tag === "INPUT" && b.tag === "LABEL")) continue;
      if (nestedText(a, b)) continue;
      if (a.width * a.height > 160000 || b.width * b.height > 160000) continue;
      if (a.text === b.text) continue;
      const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
      const y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
      const area = x * y;
      const minArea = Math.min(Math.max(1, a.width * a.height), Math.max(1, b.width * b.height));
      if (area / minArea > 0.65) return { a: a.text, b: b.text };
    }
  }
  return null;
}

async function browserChecks(origin) {
  const playwright = loadPlaywright();
  if (!playwright?.chromium) {
    return [{
      name: "browser:playwright",
      status: "blocked",
      detail: "Install playwright or set PLAYWRIGHT_MODULE_PATH to run browser QA.",
    }];
  }
  const cases = [
    { name: "browser:/client desktop", path: "/client", viewport: { width: 1440, height: 900 } },
    { name: "browser:/client mobile", path: "/client", viewport: { width: 390, height: 844 }, isMobile: true },
    { name: "browser:/client/projects/[id] desktop", path: "/client/projects/qa-missing-project", viewport: { width: 1440, height: 900 } },
    { name: "browser:/client/projects/[id] mobile", path: "/client/projects/qa-missing-project", viewport: { width: 390, height: 844 }, isMobile: true },
    { name: "browser:/login?next=/client desktop", path: "/login?next=/client", viewport: { width: 1440, height: 900 } },
  ];
  const browser = await playwright.chromium.launch({ headless: true });
  const rows = [];
  try {
    for (const item of cases) {
      const context = await browser.newContext({ viewport: item.viewport, isMobile: Boolean(item.isMobile) });
      const page = await context.newPage();
      try {
        const response = await page.goto(`${origin}${item.path}`, { waitUntil: "domcontentloaded", timeout: 30000 });
        await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
        await page.waitForTimeout(800);
        const bodyText = (await page.locator("body").innerText({ timeout: 5000 })).replace(/\s+/g, " ");
        const rects = await page.locator("h1, h2, h3, p, a, button, input, label").evaluateAll((nodes) => nodes.map((node) => {
          const r = node.getBoundingClientRect();
          return {
            tag: node.tagName,
            text: (node.textContent || node.getAttribute("placeholder") || "").trim().slice(0, 80),
            left: r.left,
            top: r.top,
            right: r.right,
            bottom: r.bottom,
            width: r.width,
            height: r.height,
          };
        }).filter((rect) => rect.text && rect.width > 1 && rect.height > 1));
        const overlap = visibleOverlap(rects);
        const hasLoginEntry = /登录|Sign in|邮箱|Email/i.test(bodyText);
        const hasLoadingOnly = /正在加载工作台/.test(bodyText) && !hasLoginEntry;
        const checkpoint = isVercelSecurityCheckpoint(bodyText);
        const ok = response?.status() === 200 && hasLoginEntry && !hasLoadingOnly && !overlap && !checkpoint;
        rows.push({
          name: item.name,
          status: ok ? "pass" : checkpoint ? "blocked" : "fail",
          detail: `status=${response?.status() || "n/a"}${overlap ? `, overlap=${overlap.a}/${overlap.b}` : ""}${checkpoint ? ", Vercel Security Checkpoint" : ""}`,
        });
      } catch (error) {
        rows.push({ name: item.name, status: "fail", detail: error instanceof Error ? error.message : String(error) });
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
  return rows;
}

function printRows(rows) {
  for (const row of rows) {
    const prefix = row.status === "pass" ? "PASS" : row.status === "warn" ? "WARN" : row.status === "blocked" ? "BLOCKED" : "FAIL";
    console.log(`${prefix} ${row.name} - ${row.detail}`);
  }
}

async function main() {
  const origin = baseUrl();
  const requireLiveProvider = hasFlag("--require-live-provider") || process.env.SIGNALHIRE_QA_REQUIRE_LIVE_PROVIDER === "1";
  const strictBrowser = hasFlag("--browser");
  const rows = [
    ...runtimeEnvChecks({ requireLiveProvider }),
    ...await routeSmokeChecks(origin),
  ];
  if (strictBrowser || hasFlag("--browser-if-available")) {
    rows.push(...await browserChecks(origin));
  }
  printRows(rows);
  const failures = rows.filter((row) => row.status === "fail" || (strictBrowser && row.status === "blocked"));
  if (failures.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
