# Auth Session QA Hardening PRD

## 1. Summary

P2e 发布后，本地 Playwright smoke 仍暴露一个阻碍后续 Role Workspace 视觉验收的问题：`/app/projects` 可能长时间停留在“正在进入工作台”，而 `/login` 表单提交后 URL 变成 `/login?`、字段清空，像是浏览器在 React 水合或登录 Promise 完成前执行了原生表单 GET submit。

旧的 Auth Session Reliability 已经覆盖 cookie write / confirm 的单元行为；本 PRD 只补齐 QA 入口可靠性：

- 登录表单在客户端水合前不能原生提交导致 `/login?`。
- app shell 的 `currentUser()` 无论 resolve、reject 还是 cookie check timeout，都必须落到明确状态：已登录或未登录，不允许无限 loading。

## 2. Goals

- 登录表单只在客户端 ready 后允许提交。
- 登录表单声明 `method="post"`，避免无 JS 或未水合时回退成 GET query。
- app layout 调用 `currentUser()` 时捕获 reject，并落到 `user = null`。
- `currentUserFromCookie()` 的 `/api/whoami` fallback 有 timeout，避免网络挂起导致 app shell 无限 loading。
- 保持现有 cookie write 成功即可跳转的策略。

## 3. Non-Goals

本阶段不做：

- 替换 Insforge Auth。
- 改变 session cookie 名称或服务端鉴权语义。
- 新增 OAuth。
- 改动 P2 Inbox Agent、Gmail 或 outreach 业务逻辑。
- 存储 access token 到 localStorage。

## 4. Acceptance Criteria

- `/login` 表单源码满足：
  - `method="post"`。
  - submit button 在 hydrated 前 disabled。
  - `submit()` 对非 hydrated 状态直接阻断。
- `/app/*` layout 源码满足：
  - `currentUser(locale).then(...).catch(() => setUser(null))` 或等价行为。
  - effect cleanup 能避免卸载后 setState。
- `currentUserFromCookie()` 不会无限等待 `/api/whoami`。
- 现有 auth session tests 继续通过。
- `npm --prefix web run build` 通过。
- Playwright smoke 至少验证：
  - `/login` 页面加载后按钮可用。
  - 访问 `/app/projects` 不长期停留在 loading shell；如果未登录，应进入明确 login-required/auth modal 状态。

## 5. Test Plan

- `auth-navigation.test.mjs`
  - login form has `method="post"`.
  - login submit is hydration-gated.
  - app layout catches `currentUser` failures and sets `user(null)`.
- `auth-session-sync.test.mjs`
  - keep existing cookie write/confirm behavior.
- `api-route-copy.test.mjs`
  - existing auth route copy checks still pass.

Verification commands:

```bash
node --test auth-session-sync.test.mjs auth-navigation.test.mjs auth-copy.test.mjs api-route-copy.test.mjs
npm --prefix web run build
```

## 6. Rollout Plan

1. Create failing tests for hydration-gated login and layout catch.
2. Patch login page and app layout only.
3. Run auth tests and build.
4. Run browser smoke for `/login` and `/app/projects`.
5. Run two independent agents for product function and UX acceptance.
6. Write release PRD, merge to main, push, and confirm Vercel READY.
