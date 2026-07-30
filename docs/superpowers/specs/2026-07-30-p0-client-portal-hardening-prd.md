# P0 PRD：客户门户强化

日期：2026-07-30

## 目标

把现有 `/client` 从“可展示”收紧为可安全交付、可协作、可审计的客户闭环。

## 已有基础

现有门户已有授权项目列表、项目详情五个 tab、邮箱/域名邀请和团队审计中心。本任务只补齐权限、反馈和可靠性，不另建 BI/CRM。

## 范围

1. **访问状态**：清晰处理受邀、已授权、未授权与已撤销客户；撤销后浏览器刷新和直接 API 均拒绝。
2. **反馈真实性**：反馈 actor 一律从服务端认证的 `getUser().email` 获取，前端不可以伪造 reviewer。
3. **报告版本**：反馈必须绑定当前项目中明确的 report version，而非隐式固定 latest report。
4. **门户一致性**：获授权账号通过门户打开报告时，也能对该报告版本提交反馈；不再要求额外 share token。
5. **安全投影**：门户 API 的契约测试保证不返回 `user_id`、邀请/域名策略、执行日志、Role Agent 内部信息或 debug 文本。
6. **可用性**：五个 tab 的真实数据、空态、加载失败重试和移动端布局均可用；项目较多时不得静默遗漏已授权项目。

## 数据契约

每条客户反馈至少保存：`project_id`、`report_id`、认证 `actor_email`、`sentiment`、`note`、`created_at`。团队审计与 CSV 使用同一不可伪造 actor。

## 不做

- 候选人认领或资料纠错。
- 客户之间的消息、任务管理或独立 CRM。
- 公共分享人才库。
- 对客户展示 provider 成本、内部执行 trace 或私有 notes。

## Guardrails

- 授权只按当前项目的 email/domain policy 判断；token-only 项目不进入客户门户。
- 报告访问权限不因门户入口而放宽。
- 所有反馈写入和读取均在服务端重做项目授权校验。

## 验收标准

- 客户仅能读取其 email/domain 被授权的项目；他人项目、token-only 项目均不泄露。
- 撤销后 GET workspace、GET project、POST feedback 和浏览器刷新都失权。
- 前端传入的伪造 reviewer 不会写入审计；记录 actor 等于认证 email。
- 每条反馈精确关联一个 report version，并可在团队审计/CSV 中查到。
- 账号授权访问的报告可直接反馈；未授权账号不能绕过。
- workspace/project 响应持续通过“无内部字段泄露”契约测试。
- 桌面和移动端的五个 tab 均有可读空态、错误态和无裁切布局。
