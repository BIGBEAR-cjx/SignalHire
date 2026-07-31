import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const projectPage = readFileSync("web/app/app/projects/[id]/page.tsx", "utf8");
const projectRoute = readFileSync("web/app/api/projects/[id]/route.ts", "utf8");
const clientWorkspacePage = readFileSync("web/app/client/page.tsx", "utf8");

function talentMonitorPanelSource() {
  const start = projectPage.indexOf("function TalentMonitorPanel(");
  const end = projectPage.indexOf("function primaryEmail(", start);
  return projectPage.slice(start, end);
}

test("monitor settings expose a valid timezone selector while retaining the fixed 09:00 local schedule boundary", () => {
  const source = talentMonitorPanelSource();
  assert.match(source, /value=\{editTimezone\}/);
  assert.match(source, /timezone: editTimezone/);
  assert.match(projectPage, /Scheduled runs use 09:00|所选时区的 09:00/);
  assert.doesNotMatch(source, /type=["']time["']/);
  assert.doesNotMatch(source, /schedule_time: edit/);
});

test("monitor UI makes no unimplemented completion notification promise and labels budget versus account Credits", () => {
  const source = talentMonitorPanelSource();
  assert.doesNotMatch(source, /Notify when a run completes|运行完成后通知我/);
  assert.doesNotMatch(source, /notification_enabled: editNotifications/);
  assert.match(projectPage, /Monthly budget remaining|本月预算剩余/);
  assert.match(projectPage, /Account Credits|账户 Credits/);
  assert.match(projectRoute, /readBalance\(\{ userId: user\.id \}\)/);
});

test("client workspace has an explicit load-more continuation and an accurate authorized-project total", () => {
  assert.match(clientWorkspacePage, /Show more projects|显示更多项目/);
  assert.match(clientWorkspacePage, /Showing \$\{view\.projects\.length\} of \$\{view\.pagination\.total\}/);
  assert.match(clientWorkspacePage, /offset=\$\{offset\}/);
});
