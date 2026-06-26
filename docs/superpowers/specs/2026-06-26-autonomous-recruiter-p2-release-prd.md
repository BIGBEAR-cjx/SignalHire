# Autonomous Recruiter P2 Release PRD

## 1. Summary

本发布把本地已完成的 Autonomous Recruiter P2 变更收口上线：

- OpenJobs/Mira UX 文案加强。
- Gmail send 错误持久化和前端展示。
- Apollo runtime 删除。
- P2 Contact Resolution Gateway。
- Hunter contact provider adapter shell。
- Role Workspace contact review UX。
- Inbox Action Queue。
- Interested Candidate scheduling handoff packet。

发布目标不是新增业务功能，而是把已验证的本地实现提交、推送、部署到 Vercel production，并完成基础线上 smoke。

## 2. Scope

包含：

- 提交当前工作树中与 P2 和 Apollo 删除相关的所有代码、测试和 PRD 文档。
- 推送到 `origin/main`。
- 触发 Vercel production deployment。
- 确认 production deployment ready。
- 线上 smoke：
  - 首页或 `/app` shell 可访问。
  - 新 API route `/api/contact-resolution/status` 存在且未登录时返回 auth error，而不是 404。
  - Production build route list 包含 `/api/contact-resolution/resolve` 和 `/api/contact-resolution/status`。

不包含：

- 申请或配置真实 `HUNTER_API_KEY`。
- 真实 Gmail 发信 smoke。
- 真实 Mira/OpenJobs 拉取 smoke。
- 数据库迁移变更。
- 线上移动端视觉深测。

## 3. Acceptance Criteria

- Git 工作树提交后不再有本次相关未提交代码。
- `node --test` 相关套件通过。
- `npm --prefix web run build` 通过。
- `git push origin main` 成功。
- Vercel production deployment 显示 ready。
- 线上 `/api/contact-resolution/status` 至少返回非 404，且未登录状态不泄漏 provider key。

## 4. Rollback Plan

- 若 production deployment 失败，保留本地提交但不标记发布完成，先查看 Vercel build logs。
- 若 production ready 但 smoke 失败，优先用 Vercel 回滚到上一个 ready deployment。
- 若只是 env 缺失，例如 `HUNTER_API_KEY` 未配置，保持上线；这是预期 disabled state，不阻断发布。
