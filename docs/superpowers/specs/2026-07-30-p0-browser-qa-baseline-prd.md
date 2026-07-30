# P0 PRD：浏览器 QA 基线

日期：2026-07-30

## 目标

让招聘团队与客户的关键路径在真实登录态、桌面和移动视口下可重复验证。它是发布门槛，不是新增业务功能。

## 用户与任务

- Recruiter：登录后在项目页确认 Role Agent 的可用、失败和禁用状态。
- Customer：从受邀登录进入 `/client`，查看项目并提交反馈。

## 范围

- 将既有 `verify:release --browser` 扩展为明确的 QA 结果：通过、失败、外部阻塞；缺 Playwright 或 QA 凭据只能是“未完成验收”。
- 使用 owner 和 customer 两种认证 session，覆盖：
  - `/login?next=/client` 登录跳转；
  - `/client` 和 `/client/projects/[id]`；
  - 客户项目页五个 tab、反馈成功/失败/busy 状态；
  - owner 的客户访问开关、邀请、撤销；
  - Role Agent 至少一个成功、一个失败、一个 disabled/busy 状态。
- 桌面 `1440×900` 与移动 `390×844` 截图、控制台错误和关键请求错误断言。
- 对匿名、未授权、撤销授权直接请求 API 进行负向验证。

## 不做

- 不重写客户门户页面。
- 不把截图像素 diff 作为唯一正确性标准。
- 不将 QA 凭据、session token、Vercel bypass secret 写入仓库或截图。
- 不增加 API/MCP、支付或候选人认领。

## 约束

- 生产浏览器验收需要真实 QA fixture；没有 fixture 时允许脚本报告 blocked，但禁止发布报告称为“已验收”。
- 页面文本、网络响应和截图都不得包含 cookie、token、provider key 或内部 debug payload。

## 验收标准

- QA 输出对每一项关键路径记录 URL、角色、视口、结果和失败摘要。
- Customer 在桌面与移动端均可切换全部五个 tab，正文不裁切/重叠。
- Customer 可提交一次反馈，重复提交显示 busy，服务端失败显示可理解错误。
- 未登录、未授权、已撤销客户无法加载 workspace/project API。
- Owner 可执行客户开通、邀请、重发、撤销，并看到对应审计结果。
- Role Agent 的 success / error / disabled 状态均有浏览器级证据。
- 现有构建和受影响的单元、route、browser 测试通过。

## 指标

- `qa_browser_run_completed`
- `qa_browser_path_failed`
- `qa_browser_external_blocked`
