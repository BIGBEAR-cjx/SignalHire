import { createRequire } from "node:module";
import { createHmac } from "node:crypto";

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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function baseUrl() {
  return cleanString(argValue("--base-url", process.env.SIGNALHIRE_QA_BASE_URL || "http://127.0.0.1:3000")).replace(/\/+$/, "");
}

function automationBypassHeaders() {
  const secret = cleanString(process.env.VERCEL_AUTOMATION_BYPASS_SECRET);
  return secret ? { "x-vercel-protection-bypass": secret } : {};
}

function requestOptions(options = {}) {
  return {
    ...options,
    headers: {
      ...automationBypassHeaders(),
      ...(options.headers || {}),
    },
  };
}

async function fetchText(url, options = {}) {
  const response = await fetch(url, requestOptions({ redirect: "manual", ...options }));
  const text = await response.text();
  return { status: response.status, text };
}

async function fetchTextWithRetry(url, options = {}, retryStatuses = new Set([0, 401, 502, 503, 504])) {
  let latest = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      latest = await fetchText(url, options);
    } catch (error) {
      latest = { status: 0, text: error instanceof Error ? error.message : String(error) };
    }
    if (!retryStatuses.has(latest.status)) return latest;
    await sleep(700 * (attempt + 1));
  }
  return latest;
}

async function fetchTextUntil(url, options = {}, predicate = () => true) {
  let latest = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    latest = await fetchTextWithRetry(url, options);
    if (predicate(latest)) return latest;
    await sleep(700 * (attempt + 1));
  }
  return latest;
}

async function fetchJsonWithRetry(url, options = {}, retryStatuses = new Set([0, 502, 503, 504])) {
  let latest = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      latest = await fetchJson(url, options);
    } catch (error) {
      latest = {
        status: 0,
        json: { error: error instanceof Error ? error.message : String(error) },
        text: error instanceof Error ? error.message : String(error),
      };
    }
    if (!retryStatuses.has(latest.status)) return latest;
    await sleep(700 * (attempt + 1));
  }
  return latest;
}

async function gotoWithRetry(page, url, options = {}) {
  let latestError = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await page.goto(url, options);
    } catch (error) {
      latestError = error;
      await sleep(700 * (attempt + 1));
    }
  }
  throw latestError;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, requestOptions({ redirect: "manual", ...options }));
  const text = await response.text();
  let json = {};
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { status: response.status, json, text };
}

function isVercelSecurityCheckpoint(text) {
  return /Vercel Security Checkpoint|Failed to verify your browser|We're verifying your browser/i.test(text);
}

function base64Url(value) {
  return Buffer.from(value).toString("base64url");
}

function signQaJwt(payload, secret) {
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = base64Url(JSON.stringify(header));
  const encodedPayload = base64Url(JSON.stringify(payload));
  const signature = createHmac("sha256", secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest("base64url");
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

async function resolveQaSession() {
  const explicitToken = cleanString(process.env.SIGNALHIRE_QA_SESSION_TOKEN || process.env.SIGNALHIRE_QA_ACCESS_TOKEN);
  const projectId = cleanString(process.env.SIGNALHIRE_QA_PROJECT_ID);
  if (explicitToken) {
    return {
      cookie: `sh_token=${encodeURIComponent(explicitToken)}`,
      projectId,
      detail: "using SIGNALHIRE_QA_SESSION_TOKEN",
    };
  }

  const userId = cleanString(process.env.SIGNALHIRE_QA_USER_ID);
  const email = cleanString(process.env.SIGNALHIRE_QA_EMAIL);
  if (!userId || !email) return null;

  let secret = cleanString(process.env.SIGNALHIRE_QA_JWT_SECRET);
  if (!secret) {
    const insforgeBase = cleanString(process.env.INSFORGE_API_BASE_URL).replace(/\/+$/, "");
    const apiKey = cleanString(process.env.INSFORGE_API_KEY);
    if (!insforgeBase || !apiKey) {
      return { error: "INSFORGE_API_BASE_URL or INSFORGE_API_KEY missing for QA token generation" };
    }
    const response = await fetchJsonWithRetry(`${insforgeBase}/api/secrets/JWT_SECRET`, {
      headers: { "x-api-key": apiKey },
    });
    secret = cleanString(response.json?.value);
    if (response.status !== 200 || !secret) {
      return { error: `JWT_SECRET lookup failed with status=${response.status}` };
    }
  }

  const now = Math.floor(Date.now() / 1000);
  const token = signQaJwt({
    sub: userId,
    email,
    role: "authenticated",
    iat: now,
    exp: now + 15 * 60,
  }, secret);
  return {
    cookie: `sh_token=${encodeURIComponent(token)}`,
    projectId,
    detail: "generated short-lived QA sh_token",
  };
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
    status: liveReady || !requireLiveProvider ? "pass" : "fail",
    detail: liveReady ? "configured" : "using internal live signal provider fallback",
  });
  rows.push({
    name: "env:SIGNALHIRE_QA_EMAIL",
    status: cleanString(process.env.SIGNALHIRE_QA_EMAIL) ? "pass" : "warn",
    detail: cleanString(process.env.SIGNALHIRE_QA_EMAIL)
      ? "QA account email present"
      : "login-state QA will be skipped without SIGNALHIRE_QA_EMAIL",
  });
  rows.push({
    name: "env:SIGNALHIRE_QA_SESSION",
    status: (cleanString(process.env.SIGNALHIRE_QA_SESSION_TOKEN || process.env.SIGNALHIRE_QA_ACCESS_TOKEN)
      || (cleanString(process.env.SIGNALHIRE_QA_USER_ID) && cleanString(process.env.SIGNALHIRE_QA_EMAIL))) ? "pass" : "warn",
    detail: cleanString(process.env.SIGNALHIRE_QA_SESSION_TOKEN || process.env.SIGNALHIRE_QA_ACCESS_TOKEN)
      ? "explicit QA session token present"
      : cleanString(process.env.SIGNALHIRE_QA_USER_ID) && cleanString(process.env.SIGNALHIRE_QA_EMAIL)
        ? "QA user id and email present for token-based client portal QA"
        : "set SIGNALHIRE_QA_USER_ID and SIGNALHIRE_QA_EMAIL for token-based client portal QA",
  });
  return rows;
}

async function checkLiveSignalProviderHealth(origin, { requireLiveProvider = false } = {}) {
  const healthUrl = cleanString(process.env.LIVE_SIGNAL_PROVIDER_HEALTH_URL);
  if (!healthUrl) {
    const response = await fetchTextWithRetry(`${origin}/api/live-signals/health`, {}, new Set([0, 502, 503, 504]));
    return [{
      name: "live-signal-provider:health",
      status: response.status >= 200 && response.status < 300 ? "pass" : requireLiveProvider ? "fail" : "warn",
      detail: `internal provider health status=${response.status}`,
    }];
  }
  const apiKey = cleanString(process.env.LIVE_SIGNAL_PROVIDER_API_KEY);
  const headers = apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
  const response = await fetchTextWithRetry(healthUrl, { headers }, new Set([0, 502, 503, 504]));
  return [{
    name: "live-signal-provider:health",
    status: response.status >= 200 && response.status < 300 ? "pass" : requireLiveProvider ? "fail" : "warn",
    detail: `status=${response.status}`,
  }];
}

async function routeSmokeChecks(origin, qaSession = null) {
  const rows = [];
  const client = await fetchTextWithRetry(`${origin}/client`);
  const clientHasCopy = /客户交付工作台|Client delivery|客户工作台/i.test(client.text);
  rows.push({
    name: "route:/client",
    status: client.status === 200 && clientHasCopy ? "pass" : isVercelSecurityCheckpoint(client.text) ? "blocked" : "fail",
    detail: `status=${client.status}${clientHasCopy ? ", client workspace copy present" : ""}`,
  });

  const workspace = await fetchTextWithRetry(`${origin}/api/client-portal/workspace`);
  rows.push({
    name: "route:/api/client-portal/workspace anonymous",
    status: workspace.status === 401 ? "pass" : isVercelSecurityCheckpoint(workspace.text) ? "blocked" : "fail",
    detail: `status=${workspace.status}`,
  });

  if (qaSession) {
    const hasAuthorizedProjects = (text) => /"authorized_projects"\s*:\s*[1-9]/.test(text)
      || (/"projects"\s*:\s*\[/.test(text) && !/"projects"\s*:\s*\[\s*\]/.test(text));
    const authenticatedWorkspace = await fetchTextUntil(
      `${origin}/api/client-portal/workspace`,
      { headers: { Cookie: qaSession.cookie } },
      (result) => result.status !== 200 || hasAuthorizedProjects(result.text),
    );
    const hasProjects = hasAuthorizedProjects(authenticatedWorkspace.text);
    rows.push({
      name: "route:/api/client-portal/workspace authenticated",
      status: authenticatedWorkspace.status === 200 && hasProjects ? "pass" : isVercelSecurityCheckpoint(authenticatedWorkspace.text) ? "blocked" : "fail",
      detail: `status=${authenticatedWorkspace.status}${hasProjects ? ", authorized projects present" : ""}`,
    });

    if (qaSession.projectId) {
      const authenticatedProject = await fetchTextWithRetry(`${origin}/api/client-portal/projects/${encodeURIComponent(qaSession.projectId)}`, {
        headers: { Cookie: qaSession.cookie },
      });
      rows.push({
        name: "route:/api/client-portal/projects/[id] authenticated",
        status: authenticatedProject.status === 200 ? "pass" : isVercelSecurityCheckpoint(authenticatedProject.text) ? "blocked" : "fail",
        detail: `status=${authenticatedProject.status}`,
      });
    }
  }
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

async function browserChecks(origin, qaSession = null) {
  const playwright = loadPlaywright();
  if (!playwright?.chromium) {
    return [{
      name: "browser:playwright",
      status: "blocked",
      detail: "Install playwright or set PLAYWRIGHT_MODULE_PATH to run browser QA.",
    }];
  }
  const projectPath = qaSession?.projectId ? `/client/projects/${encodeURIComponent(qaSession.projectId)}` : "/client/projects/qa-missing-project";
  const cases = [
    { name: "browser:/client desktop", path: "/client", viewport: { width: 1440, height: 900 }, useQaSession: Boolean(qaSession) },
    { name: "browser:/client mobile", path: "/client", viewport: { width: 390, height: 844 }, isMobile: true, useQaSession: Boolean(qaSession) },
    { name: "browser:/client/projects/[id] desktop", path: projectPath, viewport: { width: 1440, height: 900 }, useQaSession: Boolean(qaSession) },
    { name: "browser:/client/projects/[id] mobile", path: projectPath, viewport: { width: 390, height: 844 }, isMobile: true, useQaSession: Boolean(qaSession) },
    { name: "browser:/login?next=/client desktop", path: "/login?next=/client", viewport: { width: 1440, height: 900 }, useQaSession: false },
  ];
  const browser = await playwright.chromium.launch({ headless: true });
  const rows = [];
  try {
    for (const item of cases) {
      const context = await browser.newContext({
        viewport: item.viewport,
        isMobile: Boolean(item.isMobile),
        extraHTTPHeaders: automationBypassHeaders(),
      });
      if (qaSession && item.useQaSession) {
        await context.addCookies([{
          name: "sh_token",
          value: decodeURIComponent(qaSession.cookie.replace(/^sh_token=/, "")),
          url: origin,
          httpOnly: true,
          sameSite: "Lax",
        }]);
      }
      const page = await context.newPage();
      try {
        const response = await gotoWithRetry(page, `${origin}${item.path}`, { waitUntil: "domcontentloaded", timeout: 12000 });
        await page.waitForLoadState("networkidle", { timeout: 2000 }).catch(() => {});
        await page.waitForFunction((useQaSession) => {
          const text = document.body?.innerText || "";
          if (useQaSession) {
            return /客户交付工作台|Client delivery|客户项目|Autonomous Recruiter QA Role|Interview-ready|Authorized projects|已授权项目/i.test(text)
              && !/正在加载工作台/.test(text);
          }
          return /登录|Sign in|邮箱|Email/i.test(text);
        }, Boolean(item.useQaSession), { timeout: 5000 }).catch(() => {});
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
        const hasLoginPrompt = /登录客户门户|登录 SignalHire|Log in to the client portal|Sign in to SignalHire|Sign up and verify email|注册并验证邮箱/i.test(bodyText);
        const hasClientPortalContent = /客户交付工作台|Client delivery|客户项目|Interview-ready|Authorized projects|已授权项目/i.test(bodyText);
        const hasLoadingOnly = /正在加载工作台/.test(bodyText) && !hasLoginPrompt;
        const checkpoint = isVercelSecurityCheckpoint(bodyText);
        const ok = item.useQaSession
          ? response?.status() === 200 && hasClientPortalContent && !hasLoginPrompt && !hasLoadingOnly && !overlap && !checkpoint
          : response?.status() === 200 && hasLoginPrompt && !hasLoadingOnly && !overlap && !checkpoint;
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
  const qaSessionResult = await resolveQaSession();
  const qaSession = qaSessionResult?.cookie ? qaSessionResult : null;
  const rows = [
    ...runtimeEnvChecks({ requireLiveProvider }),
    ...await checkLiveSignalProviderHealth(origin, { requireLiveProvider }),
    ...await routeSmokeChecks(origin, qaSession),
  ];
  if (qaSession) {
    rows.push({ name: "qa:token-session", status: "pass", detail: qaSession.detail });
  } else if (qaSessionResult?.error) {
    rows.push({ name: "qa:token-session", status: "fail", detail: qaSessionResult.error });
  }
  if (strictBrowser || hasFlag("--browser-if-available")) {
    rows.push(...await browserChecks(origin, qaSession));
  }
  printRows(rows);
  const failures = rows.filter((row) => row.status === "fail" || (strictBrowser && row.status === "blocked"));
  if (failures.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
