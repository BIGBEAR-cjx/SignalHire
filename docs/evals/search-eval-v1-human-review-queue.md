# Search Eval v1 人工金标审核队列

状态：`partially_approved_human_review`
创建日期：2026-08-03

本文件记录研究依据与人工确认状态，不是完整黄金集，也不是招聘结论。已确认的 case 仅可作为局部金标；其余 case 仍需逐项审核。

## 审核规则

每个候选人必须同时满足：

1. 可稳定识别的公开个人主页或代码托管身份；
2. 至少一条第一方技术证据，直接支持 case 的必需条件；
3. 不以组织主页、项目主页、课程、营销材料或同名推断替代个人身份；
4. 对无法证实的条件保留 `uncertain`，不以“相关”凑足金标。

## L1：首批已确认金标

| Case | 候选人草案 | 个人稳定身份 | 支持证据 | 研究判断 |
| --- | --- | --- | --- | --- |
| `l1-open-source-ml-inference` | Woosuk Kwon | [GitHub](https://github.com/WoosukKwon) | [vLLM 项目](https://github.com/vllm-project/vllm)；[其公开 vLLM Core RFC](https://github.com/vllm-project/vllm/issues/23446) | **已确认 relevant**：公开维护 LLM serving / inference 核心路径。 |
| `l1-github-rust-data-engineer` | Ritchie Vink | [GitHub](https://github.com/ritchie46) | [Polars 项目](https://github.com/pola-rs/polars)；[发布记录中的贡献者](https://github.com/pola-rs/polars/releases) | **已确认 relevant**：Rust 数据处理/查询引擎的公开代码贡献证据。 |
| `l1-llm-evaluation-researcher` | Wei-Lin Chiang | [公开主页](https://infwinston.github.io/) | [Chatbot Arena 论文](https://arxiv.org/abs/2403.04132)；[FastChat / Chatbot Arena 代码](https://github.com/lm-sys/FastChat) | **已确认 relevant**：语言模型评测研究与公开评测平台均可交叉验证。 |
| `l1-database-performance-engineer` | Andres Freund | [GitHub](https://gist.github.com/anarazel) | [PostgreSQL 官方贡献者档案](https://www.postgresql.org/community/contributors/)；[性能相关官方邮件记录](https://www.postgresql.org/message-id/20240407044935.ox4d3limgt5g3re3%40awork3.anarazel.de) | **已确认 relevant**：PostgreSQL 性能与可扩展性贡献有官方一手归属。 |

## L1：仍需补齐个人级证据

以下 case 的现有脚手架仅证明“项目存在”，还不能证明某个人完整满足条件，因此不得批准：

- `l1-kubernetes-platform-engineer`
- `l1-computer-vision-paper-author`
- `l1-security-incident-responder`
- `l1-product-analytics-builder`
- `l1-typescript-design-systems`
- `l1-open-source-observability`

下一轮研究会为每个 case 补充公开个人身份与满足全部条件的直接证据；之后再提交第二批人工确认。
