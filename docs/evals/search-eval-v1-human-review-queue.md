# Search Eval v1 人工金标审核队列

状态：`partially_approved_human_review`
创建日期：2026-08-03

本文件记录研究依据与人工确认状态，不是完整黄金集，也不是招聘结论。10 条 L1 case 与 3 条 L2 case 已确认并可作为局部金标；其余 17 条 case 仍需逐项审核。

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

## L1：第二批已确认金标

下列候选已由产品负责人确认，并已写入评测 JSON 的 `known_relevant` 与 `approved_human_review` judgment。

| Case | 候选人草案 | 个人稳定身份 | 支持证据 | 研究判断 |
| --- | --- | --- | --- | --- |
| `l1-kubernetes-platform-engineer` | Tim Hockin | [个人主页](https://hockin.org/~thockin/)；[GitHub](https://github.com/thockin) | [个人履历：Kubernetes 技术负责人、共同创始人及 Steering Committee 成员](https://hockin.org/~thockin/resume/) | **已确认 relevant**：公开项目维护与平台工程职责均有本人一手归属。 |
| `l1-computer-vision-paper-author` | Kaiming He | [MIT 个人主页](https://people.csail.mit.edu/kaiming/) | [CVF 公开论文页：Mask R-CNN（ICCV 2017）](https://openaccess.thecvf.com/content_iccv_2017/html/He_Mask_R-CNN_ICCV_2017_paper.html) | **已确认 relevant**：个人主页和 CVF 作者元数据可稳定交叉核验，且论文直接属于计算机视觉。 |
| `l1-security-incident-responder` | Tavis Ormandy | [GitHub](https://github.com/taviso) | [Project Zero 署名漏洞复盘](https://projectzero.google/2021/12/this-shouldnt-have-happened.html) | **已确认 relevant**：公开安全工程工作与漏洞披露/复盘由本人署名。 |
| `l1-product-analytics-builder` | Marius Andra | [GitHub](https://github.com/macobo) | [PostHog 事件管线重构提案](https://github.com/PostHog/posthog/issues/10192)；[PostHog 官方员工经历：初始 SDK](https://newsletter.posthog.com/p/what-we-learned-about-hiring-from) | **已确认 relevant**：公开身份可关联至 PostHog，且有具体事件处理与入库管线技术证据。 |
| `l1-typescript-design-systems` | shadcn | [个人主页](https://shadcn.com/)；[GitHub](https://github.com/shadcn) | [shadcn/ui 开源仓库](https://github.com/shadcn-ui/ui) | **已确认 relevant**：本人声明创建 shadcn/ui，仓库为 TypeScript 组件与代码分发平台。 |
| `l1-open-source-observability` | Daniel Dyla | [GitHub](https://github.com/dyladan) | [OpenTelemetry JS 维护者名单](https://github.com/open-telemetry/opentelemetry-js)；[官方成员目录中的 `dyladan` JavaScript 归属](https://opentelemetry.io/community/members/) | **已确认 relevant**：公开维护 OpenTelemetry JavaScript 及其 instrumentation 工作。 |

审核时请逐条确认候选与证据链接的对应关系；确认后再单独写入评测 JSON。

## L2：第一轮证据采集（未形成金标）

L2 必须同时满足多个硬条件。本表把可用线索和尚缺的个人级证据分开记录；任何 `待补证` 条目都不得进入 `known_relevant`。

| Case | 当前研究线索 | 已验证的公开证据 | 仍缺的关键证据 | 状态 |
| --- | --- | --- | --- | --- |
| `l2-agent-platform-founder-engineer` | Harrison Chase | [LangChain 官方介绍：共同创办 LangChain、为生产 Agent 提供运行时](https://www.langchain.com/about)；[LangGraph 生产部署说明](https://github.com/langchain-ai/langgraph) | 无 | **已确认 relevant** |
| `l2-ai-recruiting-workflow-builder` | 暂无可靠个人候选 | [Vekt 的隐私优先招聘编排说明](https://vekt.website/)；[Calyflow 的自托管招聘 AI 工作流说明](https://www.calyflow.ai/) | 同时拥有产品工程身份、AI 招聘工作流与隐私数据处理的个人级归属 | 待补证 |
| `l2-edge-ai-systems-engineer` | Daniel Situnayake | [个人主页：edge AI、embedded ML 与 TinyML/TFLite Micro 合著者](https://situnayake.com/)；[TFLite Micro per-op profiling 文档](https://android.googlesource.com/platform/external/tensorflow/%2Bshow/d7992c051ee/tensorflow/lite/micro/docs/profiling.md) | TFLite Micro profiling 工件是项目级证据，需人工确认其与候选人技术交付的关联是否足够直接 | **可人工确认，证据强度较低** |
| `l2-multilingual-nlp-engineer` | Matthew Honnibal | [个人主页：spaCy 作者与 Explosion 联合创办人](https://honnibal.dev/)；[spaCy 开源 Python 库](https://github.com/explosion/spaCy)；[其署名的 NLP 评测论文](https://aclanthology.org/W09-3306/) | 多语言能力来自其所创库的公开语言模型能力，保留该间接性说明以便日后复核 | **已确认 relevant** |
| `l2-privacy-data-platform-engineer` | 暂无可靠个人候选 | [PySyft 隐私数据处理机制](https://openmined.org/pysyft/)；[安全与透明度说明](https://openmined.org/pysyft/faqs/) | 个人级 SQL 系统工作与安全技术证据，不能只以隐私项目身份替代 | 待补证 |
| `l2-developer-tools-product-engineer` | Jan Oberhauser | [n8n 官方 Creator 身份与公开工作流](https://n8n.io/creators/jan/)；[n8n 开源工作流/API/integration 平台](https://github.com/n8n-io/n8n) | 无 | **已确认 relevant** |
| `l2-mlops-reliability-engineer` | Bozhao Yu | [BentoCTL 部署工具的公开署名](https://bentoml.com/blog/introduction-to-bentoctl)；[BentoML 可靠性与 monitoring 配置](https://docs.bentoml.org/en/latest/reference/bentoml/configurations.html) | 候选人的 on-call 或运行可靠性直接证据；现有材料不足以进入人工确认 | 待补证 |
| `l2-web-performance-engineer` | 暂无可靠个人候选 | 仅有项目级 React/a11y 线索，尚不足以支持个人判断 | 同一人同时具备 React 生产贡献、性能与可访问组件证据 | 待补证 |
| `l2-fintech-backend-engineer` | 暂无可靠个人候选 | 尚未找到可公开归属的支付接入与账本正确性实现组合 | 同一人的支付集成、账本正确性及 Go/Java 代码证据 | 待补证 |
| `l2-research-engineer-rag` | Malte Pietsch | [本人公开的 Haystack evaluation / retrieval 工程说明](https://www.linkedin.com/posts/maltepietsch_github-deepset-aihaystack-experimental-activity-7218628773187895296-7akg)；[Haystack RAG 实现仓库](https://github.com/deepset-ai/haystack)；[RAG 评测文档](https://docs.haystack.deepset.ai/docs/evaluation) | 无 | **可人工确认** |

下一轮按缺口最小的顺序补证：`developer-tools`、`agent-platform`、`multilingual-nlp`，再处理需要跨项目和跨来源关联的其余 7 条。
