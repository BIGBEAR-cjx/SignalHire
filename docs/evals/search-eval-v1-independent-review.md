# Search Eval v1 独立人工总复核清单

状态：`prepared_for_independent_human_review`

本清单供**未参与自动公开证据审核的人**逐条复核。复核人不得只复述 `automated-public-evidence-review` 的结论；每条都必须自行打开候选人身份页和证据链接。完整证据与 caveat 见 [审核队列](./search-eval-v1-human-review-queue.md)。

## 通过规则

对每条 case 分别确认：

1. `known_relevant` 指向的确为该候选人；
2. 公开技术工件可访问，且至少一条直接归属候选人；
3. 全部 `required_conditions` 成立，未命中 `excluded_conditions`；
4. 证据与结论之间不存在仅凭组织名称、课程、营销文案或同名推断的跳跃。

任一条无法确认即填 `revise` 或 `uncertain`。只有 30 条均为 `pass`、复核人签名并经产品负责人确认后，才可将 fixture 根 `review_status` 从 `draft_pending_human_review` 改为 `approved_human_review`。

## 复核记录

复核人：`待填写`

复核日期：`待填写`
证据快照版本：`v1-automated-public-evidence-review-1`

| Case | 候选人 | 独立结论（pass / revise / uncertain） | 复核备注 |
| --- | --- | --- | --- |
| `l1-open-source-ml-inference` | Woosuk Kwon | 待填写 | |
| `l1-github-rust-data-engineer` | Ritchie Vink | 待填写 | |
| `l1-llm-evaluation-researcher` | Wei-Lin Chiang | 待填写 | |
| `l1-kubernetes-platform-engineer` | Tim Hockin | 待填写 | |
| `l1-computer-vision-paper-author` | Kaiming He | 待填写 | |
| `l1-security-incident-responder` | Tavis Ormandy | 待填写 | |
| `l1-database-performance-engineer` | Andres Freund | 待填写 | |
| `l1-product-analytics-builder` | Marius Andra | 待填写 | |
| `l1-typescript-design-systems` | shadcn | 待填写 | |
| `l1-open-source-observability` | Daniel Dyla | 待填写 | |
| `l2-agent-platform-founder-engineer` | Harrison Chase | 待填写 | |
| `l2-ai-recruiting-workflow-builder` | Michal Juhas | 待填写 | |
| `l2-edge-ai-systems-engineer` | Daniel Situnayake | 待填写 | |
| `l2-multilingual-nlp-engineer` | Matthew Honnibal | 待填写 | |
| `l2-privacy-data-platform-engineer` | Andrew Trask | 待填写 | |
| `l2-developer-tools-product-engineer` | Jan Oberhauser | 待填写 | |
| `l2-mlops-reliability-engineer` | Chaoyu Yang | 待填写 | |
| `l2-web-performance-engineer` | Devon Govett | 待填写 | |
| `l2-fintech-backend-engineer` | Markus Geiss | 待填写 | |
| `l2-research-engineer-rag` | Malte Pietsch | 待填写 | |
| `l3-underground-agent-evals-builder` | Jeffrey Ip | 待填写 | |
| `l3-quiet-distributed-systems-operator` | Marek Siarkowicz | 待填写 | |
| `l3-open-source-ai-safety-builder` | JJ Allaire | 待填写 | |
| `l3-developer-education-to-platform-builder` | Quincy Larson | 待填写 | |
| `l3-climate-data-engineer` | Anderson Banihirwe | 待填写 | |
| `l3-healthcare-interoperability-builder` | James Agnew | 待填写 | |
| `l3-accessibility-infrastructure-engineer` | Wilco Fiers | 待填写 | |
| `l3-robotics-simulation-engineer` | Peter Barker | 待填写 | |
| `l3-compiler-toolchain-engineer` | Nikita Popov | 待填写 | |
| `l3-public-interest-security-engineer` | Priya Wadhwa | 待填写 | |

## 升级记录

产品负责人确认：`待填写`

确认日期：`待填写`
最终决定：`保持草稿 / 升级为正式黄金集`

在以上字段全部完成前，此 checklist 不构成审核通过，不得用于对外主张搜索质量、候选人真实性或招聘结果。
