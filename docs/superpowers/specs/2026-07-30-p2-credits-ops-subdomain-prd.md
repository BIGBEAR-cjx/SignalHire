# P2 PRD：Credits 账本与 Ops 子域名后台

日期：2026-07-30

## 目标

建立可解释、不可超扣的 Credits 体系，并让唯一官方运营账号在 `ops.<主域名>` 为用户人工加额。本期不接平台收款。

## 用户与权限

- User：查看自身可用/预占 Credits 与研究运行扣费状态；不自助购买、不退款、不管理价目。
- Ops：admin 仅由 server env `OPS_ADMIN_EMAIL` 精确 allowlist 决定；可搜索账户、查看最小化账本、为指定用户加额和查看失败 reservation。
- Ops 与主站复用 InsForge 用户库/数据库，但在 ops host 重新登录，使用 host-only `sh_token`；绝不使用 `.主域名` 跨子域 cookie。

## 数据模型

- `credit_accounts`：`user_id`、available、reserved、updated_at；余额不得为负。
- `credit_ledger_entries`：append-only，记录 amount、entry type、balance_after、run/task、idempotency key、actor、note、time。
- `credit_reservations`：每个计费 research run 唯一 reservation，记录 reserved/settled/released 状态。
- `ops_audit_events`：append-only，记录运营操作与 ledger entry；不保存 token、密码、候选人/邮件/报告 payload。

所有余额变化须由数据库事务/RPC 原子完成，不允许“先读余额再在应用层 UPDATE”。

## Credits 生命周期

1. Ops `grant`：运营人工加额，带 amount、reason、idempotency key、actor audit。
2. `reserve`：统一 research enqueue 点检查余额并预占；深度搜索首版使用固定价目，cache/demo 默认 0 Credits 且留下说明记录。
3. `settle`：worker 成功完成后扣除实际/固定消耗并释放多余预占。
4. `release`：失败、取消或终止重试后只释放一次。

搜索、Talent Monitor、Role Agent 和 cron 必须调用同一 server-side Credits service；没有可用 reservation 不得 enqueue 计费工作。

## Ops 信息架构

- `ops.<主域名>/ops/login`：独立登录入口；`next` 只接受相对 `/ops…` 路径。
- `/ops`：账户搜索（email/user id）、当前 balance、账本、人工加额表单、最近失败 reservation。
- `/api/ops/*`：每个 API 均做 server 端 auth guard；返回最小化账户/账本投影。

## 不做

- 支付、结账、发票、退款、订阅、优惠券。
- 多管理员、角色自助管理、用户间转账。
- 暴露 InsForge 服务 key、候选人、邮件、Gmail token 或完整报告给运营页面。
- Search API/MCP、候选人认领。

## 验收标准

- 未登录、非官方邮箱、env 缺失均无法访问任一 `/api/ops/*`；大小写 email 安全归一化。
- Ops 相同 idempotency key 重提不会重复加额，且生成 ledger/audit。
- 并发 reserve 不会让余额负数；同一 run 只会有一个 reservation。
- 成功只 settle 一次；失败/取消只 release 一次；cron 与手动入口不会绕过预占。
- 普通用户无法读取他人账户/账本，Ops 页面只返回定义的最小字段。
- 主站与 ops 子域可独立登录；主站 cookie 不自动授予 ops 权限。
- 构建、账本单测、ops auth/route 测试及用户视角流程通过。
