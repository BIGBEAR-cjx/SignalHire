# Autonomous Recruiter P2c PRD: Live Contact Provider Resolution

## 1. Summary

P2c 的目标是把 P2 已有的 contact resolution gateway 从“单条候选人可解析”推进到“可控、可审计、可批量运行的真实联系方式补全闭环”。本阶段优先使用现有 Hunter adapter 作为第一个 live contact provider，解决 OpenJobs/Mira 和公开证据候选人缺少 email/phone 后无法进入 Gmail send 的问题。

P2c 不恢复 Apollo，不新增假 provider，不猜邮箱，不自动发送 follow-up，也不接 Calendar。所有联系方式必须带来源、置信度和可发送判断。

## 2. Goals

- Role Workspace 能对多个 outreach draft 批量解析联系方式。
- 系统默认只解析真正需要联系方式的候选人，避免浪费 provider credits。
- 已经有 sendable email 的候选人不会重复调用 provider，除非用户显式刷新。
- 用户能看到 provider 是否连接、预计本次最多解析多少人、哪些候选人被跳过、哪些失败。
- Hunter 返回的 email 继续通过 source/confidence/deliverability gate，低置信或无来源邮箱不可发送。
- provider error、quota/rate limit、not found 都在当前 role 页面展示为可理解状态。

## 3. Non-Goals

本阶段不做：

- Apollo runtime 或 Apollo UI。
- Prospeo / Findymail / PDL live adapter。
- 按全库自动扫联系方式。
- 自动发送首封邮件。
- 自动发送 follow-up。
- Google Calendar invite。
- Gmail reply classification 的进一步升级。
- 联系方式付费计费系统。

## 4. Primary User Stories

### Recruiter

作为 recruiter，我希望对一个 role 中所有还缺联系方式的候选人批量补 email，这样不用逐条点击，也能知道每次消耗了多少 provider credits。

### Founder / Hiring Manager

作为 founder，我希望只看到真正可发信的候选人进入 approve/send，低置信或未找到联系方式的人继续停留在 review 状态，避免错误外联。

### Operator

作为 operator，我希望 provider 没配置、额度不足或 rate limited 时，页面给出明确原因，而不是让用户以为系统坏了。

## 5. Product Scope

### P2c.1 Contact Resolution Cache Gate

范围：

- 新增 contact resolution eligibility 判断。
- 默认跳过已经存在 sendable email 的 thread。
- 默认跳过最近解析过且没有强制刷新请求的 thread。
- 每次解析结果继续写回 outreach thread 的 `contact_profile` 和 `send_error`。
- 不新增数据库迁移；缓存状态优先写入 `contact_profile.resolution` metadata。

验收：

- 有 sendable email 的候选人不会触发 provider 调用。
- 用户传入 `force_refresh: true` 时允许重新解析。
- 最近解析过但未找到联系方式的候选人默认跳过，避免重复扣 credits。
- 跳过结果返回明确 reason。

### P2c.2 Bulk Contact Resolution API

范围：

- 新增或扩展 contact resolution route 支持批量解析 role 下的 outreach threads。
- 第一版最多一次解析 10 条，作为 cost guard。
- 只解析当前用户有权限访问的 outreach thread。
- 输出 summary：
  - `resolved`
  - `skipped`
  - `failed`
  - `cost_units`
  - `provider`
  - `items`

验收：

- 未登录返回 401。
- 没有 provider key 时返回 disabled summary，不调用 provider。
- 超过上限时只处理前 10 条候选人。
- 每条 item 都有 `status`、`reason`、`can_send` 和 `cost_units`。

### P2c.3 Role Workspace Bulk UX

范围：

- Gmail Outreach Sequence 区增加 `Resolve missing contacts`。
- 展示本次批量解析结果摘要。
- provider 未连接时显示连接/配置缺口，按钮禁用。
- 单条解析按钮保留。
- send disabled reason 继续和 contact resolution 结果一致。

验收：

- 用户能在 role 页面一键补齐缺联系方式候选人。
- 批量结果不会撑破移动端布局。
- 成功、跳过、失败都显示为招聘方可理解语言。

### P2c.4 Provider Error Normalization

范围：

- Hunter 401/403 -> `provider_auth_error`。
- Hunter 429 -> `provider_rate_limited`。
- Hunter 402 或 quota 相关错误 -> `provider_quota_exceeded`。
- 404 / no data -> `no_contact_found`。
- 其他错误 -> `provider_error`。

验收：

- 错误不会清空已有联系方式。
- 错误状态不会让候选人进入 sendable。
- UI 不展示 API key 或原始 provider URL。

## 6. Data Notes

推荐 `contact_profile.resolution` metadata：

```ts
type ContactResolutionMetadata = {
  provider: string;
  status: "resolved" | "not_found" | "skipped" | "error" | "disabled";
  reason: string;
  searched_at: string;
  cost_units: number;
  raw_reference?: string;
};
```

## 7. Test Plan

Unit tests:

- `contact-resolution.test.mjs`
  - sendable existing email is eligible skip unless force refresh.
  - recent not-found resolution is skipped without force refresh.
  - provider result writes resolution metadata.

- `contact-resolution-route.test.mjs`
  - single resolution skips provider when existing email is sendable.
  - force refresh calls provider even with existing email.
  - provider errors are normalized.

- `contact-resolution-bulk.test.mjs`
  - unauthenticated bulk request rejected.
  - disabled provider returns disabled summary.
  - bulk processing respects max 10 cost guard.
  - bulk summary counts resolved/skipped/failed and cost units.

Source/API tests:

- `api-route-copy.test.mjs`
  - bulk route exists and uses server-only provider config.
  - Role Workspace renders bulk resolve CTA and result summary.

Verification:

- `node --test contact-resolution.test.mjs contact-resolution-route.test.mjs contact-resolution-bulk.test.mjs contact-providers.test.mjs api-route-copy.test.mjs`
- `npm --prefix web run build`
- Desktop and mobile Role Workspace browser check if local auth/dev server is available.

## 8. Rollout Plan

1. Add cache eligibility pure functions and failing tests.
2. Add route-core support for single skip/force refresh.
3. Add bulk contact resolution route core and tests.
4. Wire API route.
5. Add Role Workspace bulk CTA and summary.
6. Run focused tests and build.
7. Run product and UX acceptance agents after implementation.
