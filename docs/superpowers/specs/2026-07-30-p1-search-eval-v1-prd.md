# P1 PRD：Search Eval v1

日期：2026-07-30

## 目标

为 SignalHire 搜索建立内部、可复现的质量与效率基线。在未证明提升前，不改变默认搜索体验或对用户承诺“更快”。

## 范围

1. 建立版本化黄金集：起步 30 个 case，L1 事实、L2 多硬条件、L3 隐藏人才各 10 个。
2. Case 包含 brief、难度、known-relevant 候选人、必需/排除条件和最小证据要求；L2/L3 标注需二次复核。
3. 每个候选人 judgment 记录 relevant/non-relevant/uncertain、硬条件命中、身份正确性、证据可验证性、标注人和版本。
4. 运行结果记录 `case_id`、evaluator/strategy version、route、route reason、research run、P@5/P@10、known-relevant recall@10、硬条件 recall、identity error、有效证据率、duration、search/fetch count、失败原因。
5. 引入仅内部可见的 fast/deep 受控实验：
   - Fast：明确、小范围查询，使用有界缓存提示和开放证据预检；
   - Deep：多硬条件、公开结构化证据不足或 L3；继续使用现有深研 worker。
6. 提供只读 eval runner，生成 JSON/Markdown 回归报告；不得把 benchmark 直接入生产队列。

## 不做

- 客户自定义 benchmark 或公开分数。
- API/MCP。
- 候选人认领。
- 把 demo cache 当黄金集，或把缓存命中当作质量上升。
- 基于未记录 token/供应商费用做“真实成本”结论；v1 仅报告成本代理指标。

## 回归门槛

相对锁定 baseline，任何一项触发即失败：P@10、硬条件 recall 或有效证据率下降超过 5 个百分点；p95 延迟上升超过 25%。无结论或数据缺失必须显示 inconclusive，不得吞错报通过。

## 验收标准

- 同一 case/strategy version 运行两次得到稳定的报告字段与排序。
- case 和总体层均输出规定指标，并保留 route 与 reason。
- 同名不同公司、重复候选人、缺证据、空结果都有测试。
- 回归超过门槛脚本非零退出；未执行或 inconclusive 不算 pass。
- Fast/Deep 只作为可追溯实验，不改变默认用户路径。
