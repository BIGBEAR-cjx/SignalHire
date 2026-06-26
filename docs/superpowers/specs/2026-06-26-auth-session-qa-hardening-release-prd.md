# Auth Session QA Hardening Release PRD

## 1. Release Summary

本发布修复 P2e 后续验收中发现的本地 QA 阻塞：`/app/projects` 在未登录状态可能停留在“正在进入工作台”，`/login` 在 React 水合或登录流程未完成前存在原生表单提交回退风险。

发布目标是让后续 Role Workspace / Inbox Agent 真实浏览器验收有稳定入口：未登录时快速落到明确登录要求，登录页水合后按钮可用，auth fallback 不会无限等待。

## 2. Release Scope

- `/login` 表单增加 `method="post"`。
- `/login` submit 在 React hydrated 前禁用并直接阻断。
- `/app/*` layout 捕获 `currentUser()` reject，落到 `user = null`。
- `/app/*` layout 增加 effect cleanup，避免卸载后 setState。
- `currentUserFromCookie()` 对 `/api/whoami` fallback 增加 timeout。

## 3. Safety Checks

- 不改 `/api/auth/session` cookie 语义。
- 不把 token 写入 localStorage/sessionStorage。
- 不改 Insforge auth provider。
- 不改 P2 Inbox Agent、Gmail、outreach 业务逻辑。
- 未登录 `/api/whoami` 401 仍保持为服务端鉴权真相。

## 4. Verification

Required:

- `node --test auth-session-sync.test.mjs auth-navigation.test.mjs auth-copy.test.mjs api-route-copy.test.mjs`
- `npm --prefix web run build`
- Product function acceptance agent: PASS.
- UX acceptance agent: PASS.

Browser smoke:

- `/login` 水合后按钮可用。
- `/app/projects` 未登录时从 loading 落到 login-required + AuthModal。
- Dev console 中 401/refresh failure 在未登录状态可接受，前提是 UI 不崩溃。

## 5. Known Residual Risks

- 极慢 JS 或禁 JS 环境会看到 disabled 登录按钮；这是为了避免 native GET fallback。
- 中文 UI 下部分 Insforge 原始 auth error 仍可能显示英文，例如 `Invalid credentials`；后续可单独做 auth error normalization。

## 6. Rollout Plan

1. Commit feature branch.
2. Merge into `main`.
3. Re-run required verification on `main`.
4. Push `main`.
5. Confirm Vercel production deployment is READY and points to the merge commit.
