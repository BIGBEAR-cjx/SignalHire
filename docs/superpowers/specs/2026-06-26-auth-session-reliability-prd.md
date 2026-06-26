# Auth Session Reliability PRD

## 1. Summary

P2b 发布验证时发现一个独立阻塞点：测试账号可以调用 Insforge auth 并成功写入 `/api/auth/session`，但登录页停留在 `登录中...`，随后访问 `/app/projects` 仍显示未登录。P2b Role Workspace rendered QA 因此只能使用 mock authenticated API。

本 PRD 目标是修复 SignalHire 的登录态确认链路，让真实账号登录后能稳定进入 app workspace，并让服务端 API 能读取同一份 httpOnly session cookie。

## 2. Goals

- 登录成功写入 `sh_token` 后，不因同步确认请求卡住登录页。
- 登录后整页跳转到 `next` 路由，服务端 routes 能读取 cookie。
- `/api/whoami` 在 cookie 有效时返回当前用户。
- 如果 cookie 确认暂时失败，UI 给出明确错误，不无限停留在 loading。
- 不把 access token 写入 localStorage。

## 3. Non-Goals

本阶段不做：

- 替换 Insforge Auth。
- 新增 OAuth 登录。
- 修改注册/邮箱验证主流程。
- 改动业务 API 鉴权语义。
- 改动 P2b Inbox Agent 功能。

## 4. Current Risk

当前 `login()` 依赖 `writeAndConfirmSessionCookie()`：

1. Insforge `signInWithPassword` 返回 `accessToken`。
2. 前端 POST `/api/auth/session` 写 httpOnly cookie。
3. 前端立即 GET `/api/whoami` 确认 cookie。
4. 只有确认成功才返回 `ok: true`。

问题是第 3 步可能因为服务端 token 校验、外部 auth refresh、浏览器 cookie 同步时序或网络问题卡住/失败，导致登录页一直 loading，即使 cookie 写入请求已成功。

## 5. Product Behavior

登录策略调整为：

- 写 cookie 成功即可允许登录流程继续跳转。
- cookie 确认可作为 best-effort，不阻塞跳转。
- 如果写 cookie 本身失败，显示明确错误。
- app layout 和 API route 仍以 server-side cookie 校验为准。

用户体验：

- 登录成功后必须离开登录页。
- 登录失败时必须看到错误文本，而不是无限 `登录中...`。
- 如果跳转后 cookie 实际无效，app layout 显示已有登录要求页面。

## 6. Technical Scope

- 调整 `web/lib/auth-session-sync.mjs`：
  - 保留 `confirmSessionCookie()`。
  - `writeAndConfirmSessionCookie()` 不再因为 confirm 失败返回 false。
  - 增加短 timeout，避免 confirm 卡住。
  - 暴露 cookie write 成功和 confirm 结果，或保持兼容返回 boolean 但不阻塞。
- 调整 `web/lib/auth.ts` 的登录错误文案路径：
  - 写 cookie 成功后 `login()` 返回 ok。
  - 写 cookie POST 失败时返回 `loginNoToken` 或明确 session error。
- 保持注册和 verify 流程可用。

## 7. Acceptance Criteria

- 单元测试覆盖：
  - cookie write 成功、confirm 成功 -> ok。
  - cookie write 成功、confirm 失败 -> ok。
  - cookie write 成功、confirm timeout -> ok。
  - cookie write 失败 -> false。
- 本地浏览器 QA：
  - 使用测试账号登录后不再停留在登录页 loading。
  - 能进入 `/app/projects` 或看到服务端鉴权后的明确 app state。
- `npm --prefix web run build` 通过。

## 8. Verification Commands

```bash
node --test auth-session-sync.test.mjs api-route-copy.test.mjs
npm --prefix web run build
```

## 9. Rollout

修复后提交并推送 `main`。如果 Vercel production deployment ready，则用 share URL 或 authenticated browser 做登录页 smoke；若 Vercel Security Checkpoint 阻挡 API smoke，记录边界。
