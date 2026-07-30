# P0 PRD：Real Live Signal Provider v1

日期：2026-07-30

## 目标

让 Role Agent 的 `why now` 基于真实、可点击且会过期的外部证据，而不是当前 internal/aggregate fallback 的合成“刷新成功”。

## 用户承诺

Recruiter 能看见“这位候选人现在值得优先处理”的来源、发生时间、相关性和不确定性；点击只会前往原始证据。

## 范围

1. 首版只接一个许可明确的公开 provider/source adapter。候选人必须能从现有已验证 evidence 映射到稳定 identity/URL。
2. 新增持久化 `candidate_live_signals`，最小字段：`user_id`、`project_id`、稳定 candidate merge key、provider、type、source_url、summary、confidence、observed_at、expires_at、content_hash、timestamps。
3. 对 `provider + candidate identity + source_url + content_hash` 幂等 upsert；旧信号过期后不再参与优先级。
4. provider 回包先校验再写入，随后才记录 refresh event；event 仅保存 signal id/count/hash 等摘要，不保存完整外部 payload。
5. Candidate graph/Role Agent workspace 从持久信号读取，重新计算 freshness、`why_now` 和 next action。
6. UI 展示 provider 状态、最近运行、成功/跳过/失败，以及候选人信号卡（来源、时间、到期、why now）。
7. 无 provider 或不合格回包时显示 blocked；不得用 fallback 伪装为真实 refresh 成功。

## 数据与合规规则

- 只存最小事实和 canonical URL，不镜像原页面、登录态数据或敏感个人数据。
- 每条可用信号必须有 candidate identity、canonical source URL、observed time 和简短事实摘要。
- 禁止 LinkedIn scraping、绕过反爬、无 URL 的模型推断和将低置信度合成信号用于自动外联。
- 首封邮件仍需人工审批。

## 不做

- 多供应商 marketplace。
- 实时 websocket、每小时全量爬取或外部账号接管。
- 自动发送或自动跟进。

## 验收标准

- provider happy path 持久化后重新加载仍可见，且 `why_now` 排序真实改变。
- 无 source URL、无稳定 candidate key、过期或重复内容分别被拒绝/降权/幂等处理。
- 部分 provider 失败不覆盖已有有效信号；超时/鉴权错误已脱敏且可恢复。
- 暂停/关闭项目不刷新；cron 与手动刷新不会让同一 candidate/provider 并发写入。
- 每个信号都可点击原始 URL；没有 provider 时 UI 明确 blocked 且不制造 fresh 信号。
- 有 DB ingestion、graph projection、cron idempotency 和 UI/route 测试。
