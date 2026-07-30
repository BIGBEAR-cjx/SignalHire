# P1 PRD：Talent Monitor v2

日期：2026-07-30

## 目标

把当前 “manual/daily/weekly 搜索任务”升级为可配置、可解释、可审计的持续搜人产品；每轮交付新候选人或证据变化，而不是自动外联。

## 用户工作流

Recruiter 从项目/已澄清的 search brief 创建 Monitor，选择频率、时区、单轮目标数、月度 Credits 上限和通知。每次运行后查看新发现、证据更新、已见过、跳过、Credits 和暂停原因；可编辑、暂停、恢复或手动运行。

## 范围

1. 扩展 `search_tasks`：`candidate_batch_size`（5/10/20）、`timezone`、`schedule_time`、`monthly_credit_limit`、月度 used/reserved、notification、paused_reason、last_run_status。
2. 新建 `search_task_runs`：task/research run、状态、开始/完成、requested/returned/new/updated/seen/skip、credit reserved/consumed/released、stop reason、错误摘要和不可变 config snapshot。
3. 频率首版仍为 daily/weekly，按 timezone/schedule time 防重；不做小时级或月度复杂调度。
4. 编辑只影响下一轮；名称编辑不得让 next run 漂移，运行中的任务保留 snapshot。
5. 单轮目标数必须传入 worker 并在归档处硬限制，不能仅前端 slice。
6. UI 提供 Monitor detail/drawer、运行历史、暂停原因和逐轮 research run 链接。
7. 通知只面向新候选人或证据更新，并做去重。
8. 接入公共 Credits 服务端接口：运行前 reserve，成功 settle，失败/取消 release；余额/预算不足时不 enqueue，显示原因并暂停。Credits PRD 的数据层是上线前置依赖。

## 不做

- 自动生成或发送 outreach。
- 小时级监控、短信/IM 通知、外部 ATS 同步。
- 自己修改用户余额或绕过 Credits 原子预占。

## 验收标准

- 创建、编辑、暂停、恢复都正确；运行中 snapshot 不变，下轮使用新配置。
- Daily/weekly 在时区内仅运行一次；手动与 cron 并发只生成一次 reservation/run。
- batch size 在 worker 生效；history 准确显示 new/updated/seen/skip/error。
- 余额不足或月度封顶不 enqueue、不扣 Credits，显示可解释 pause reason。
- 成功结算实际 Credits；失败/取消只释放一次；通知只发 new/evidence update 且去重。
- 暂停项目/任务不跑、不扣、不发通知；全程不自动外联。
