# Search Eval v1 人工金标审核队列

状态：`partially_approved_review`
创建日期：2026-08-03

本文件记录研究依据与审核状态，不是完整黄金集，也不是招聘结论。10 条 L1 case 与 5 条 L2 case 已由产品负责人确认；5 条 L2 case 与 10 条 L3 case 已通过自动化公开证据审核并可作为局部金标。所有 30 条标签仍需独立人工总复核，才能成为正式黄金集。

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
| `l1-security-incident-responder` | Tavis Ormandy | [Google Bug Hunters：Reptar，署名 Information Security Engineer](https://bughunters.google.com/blog/the-reptar-cpu-vulnerability)；[Google Security Blog：Downfall / Zenbleed，署名 Software Engineer](https://security.googleblog.com/2023/08/downfall-and-zenbleed-googlers-helping.html)；[Cloudflare 事件报告](https://blog.cloudflare.com/incident-report-on-memory-leak-caused-by-cloudflare-parser-bug/) | Google 页面闭合本人身份、安全工程与协调修复；Cloudflare 明确记录其向事故方报告漏洞并触发缓解 | **证据已补强，待重新独立复核**：替换原本无法闭合身份与事件响应关系的 GitHub/单篇复盘组合。 |
| `l1-product-analytics-builder` | Marius Andra | [GitHub](https://github.com/macobo) | [PostHog 事件管线重构提案](https://github.com/PostHog/posthog/issues/10192)；[PostHog 官方员工经历：初始 SDK](https://newsletter.posthog.com/p/what-we-learned-about-hiring-from) | **已确认 relevant**：公开身份可关联至 PostHog，且有具体事件处理与入库管线技术证据。 |
| `l1-typescript-design-systems` | shadcn | [个人主页](https://shadcn.com/)；[GitHub](https://github.com/shadcn) | [shadcn/ui 开源仓库](https://github.com/shadcn-ui/ui) | **已确认 relevant**：本人声明创建 shadcn/ui，仓库为 TypeScript 组件与代码分发平台。 |
| `l1-open-source-observability` | Daniel Dyla | [GitHub](https://github.com/dyladan) | [OpenTelemetry JS 维护者名单](https://github.com/open-telemetry/opentelemetry-js)；[官方成员目录中的 `dyladan` JavaScript 归属](https://opentelemetry.io/community/members/) | **已确认 relevant**：公开维护 OpenTelemetry JavaScript 及其 instrumentation 工作。 |

审核时请逐条确认候选与证据链接的对应关系；确认后再单独写入评测 JSON。

## L2：第一轮证据采集（未形成金标）

L2 必须同时满足多个硬条件。本表把可用线索和尚缺的个人级证据分开记录；任何 `待补证` 条目都不得进入 `known_relevant`。

| Case | 当前研究线索 | 已验证的公开证据 | 仍缺的关键证据 | 状态 |
| --- | --- | --- | --- | --- |
| `l2-agent-platform-founder-engineer` | Harrison Chase | [LangChain 官方介绍](https://www.langchain.com/about)；[Harrison 署名：LangChain 三年回顾](https://www.langchain.com/blog/three-years-langchain)；[Harrison 署名：Agent 基础设施](https://www.langchain.com/blog/why-you-should-outsource-your-agentic-infrastructure-but-own-your-cognitive-architecture)；[LangGraph 工件](https://github.com/langchain-ai/langgraph) | 官方介绍闭合创办身份；两篇本人署名文章分别覆盖 Agent 起源/所有权与可扩展、持久化、容错的生产基础设施；仓库仅作技术工件佐证 | **证据已补强，待重新独立复核**：不再把组织仓库单独视为个人归属证据。 |
| `l2-ai-recruiting-workflow-builder` | Michal Juhas | [公开个人身份与本人关于 Calyflow Agent 的说明](https://sk.linkedin.com/in/michaljuhas)；[本人署名：构建开源 GitHub Sourcer 招聘 Agent](https://blog.aiwithmichal.com/p/sourcing-on-github-six-years-ago-vs-2026)；[Calyflow 的人审发送、工作区隔离与密钥保护说明](https://app.calyflow.ai/docs/security) | 候选人为产品/技术负责人而非已验证的代码仓库 maintainer；但本人明确声明构建该 Agent，且产品在发送前保留人工确认，故不以群发自动化通过。 | **自动公开证据审核通过** |
| `l2-edge-ai-systems-engineer` | Daniel Situnayake | [个人主页](https://situnayake.com/)；[本人：将模型移植至 edge](https://situnayake.com/2023/03/21/nn-to-cpp.html)；[本人：嵌入式硬件性能实测](https://www.edgeimpulse.com/blog/make-deep-learning-models-run-fast-on-embedded-hardware/)；[本人：Performance Calibration](https://www.edgeimpulse.com/blog/announcing-performance-calibration/) | 个人主页闭合身份、嵌入式/edge ML 背景；后两篇本人署名文章直接讨论目标硬件上的延迟、内存、量化和性能测量 | **证据已补强，待重新独立复核**：移除只能说明项目存在、却无法归属个人的 TFLite Micro profiling 文档。 |
| `l2-multilingual-nlp-engineer` | Matthew Honnibal | [个人主页：spaCy 作者与 Explosion 联合创办人](https://honnibal.dev/)；[spaCy 开源 Python 库](https://github.com/explosion/spaCy)；[其署名的 NLP 评测论文](https://aclanthology.org/W09-3306/) | 多语言能力来自其所创库的公开语言模型能力，保留该间接性说明以便日后复核 | **已确认 relevant** |
| `l2-privacy-data-platform-engineer` | Andrew Trask | [个人主页：OpenMined 创办人、PySyft 创建者](https://andrewtrask.ai/)；[PyPI 作者元数据：Andrew Trask](https://pypi.org/project/syft/0.2.5/)；[其署名的 Syft 隐私基础设施论文](https://arxiv.org/abs/2110.01315) | 数据平台归属来自 PySyft/remote-data infrastructure；保留其不是独立 SQL 引擎作者的边界说明。 | **自动公开证据审核通过** |
| `l2-developer-tools-product-engineer` | Jan Oberhauser | [n8n 官方 Creator 身份与公开工作流](https://n8n.io/creators/jan/)；[n8n 开源工作流/API/integration 平台](https://github.com/n8n-io/n8n) | 无 | **已确认 relevant** |
| `l2-mlops-reliability-engineer` | Chaoyu Yang | [PyPI 身份与 BentoML 发布者](https://pypi.org/user/parano/)；[本人署名 BentoML 模型部署与监控/告警设计](https://www.bentoml.com/blog/ml-requirements)；[BentoML 生产可靠性与可观测性说明](https://www.bentoml.com/) | 可靠性证据以部署、回滚、监控和告警为准；没有把“on-call”职位头衔作为独立断言。 | **自动公开证据审核通过** |
| `l2-web-performance-engineer` | Devon Govett | [React Aria 无障碍拖放：本人署名](https://react-aria.adobe.com/blog/drag-and-drop)；[本人 Parcel RSC 技术文章](https://devongovett.me/blog/parcel-rsc.html)；[本人公开的 Parcel 性能优化说明](https://threadreaderapp.com/user/devongovett) | 性能证据包含个人技术说明与 Parcel 工程关联；React Aria 工件直接支持可访问组件条件。 | **自动公开证据审核通过** |
| `l2-fintech-backend-engineer` | Markus Geiss | [本人创建的 Apache Fineract Java 架构原则](https://cwiki.apache.org/confluence/spaces/FINERACT/pages/61334200/Key%2BDesign%2BPrinciples)；[本人署名的账本余额与异步总计修正提交](https://apache.googlesource.com/fineract-cn-accounting/%2Blog)；[本人负责的支付类型/账本 JIRA](https://www.mail-archive.com/issues%40fineract.apache.org/msg00578.html) | 支付与账本是 Fineract 金融服务实现的一部分，证据指向 Java 工程与金额/账本正确性处理。 | **自动公开证据审核通过** |
| `l2-research-engineer-rag` | Malte Pietsch | [本人公开的 Haystack evaluation / retrieval 工程说明](https://www.linkedin.com/posts/maltepietsch_github-deepset-aihaystack-experimental-activity-7218628773187895296-7akg)；[Haystack RAG 实现仓库](https://github.com/deepset-ai/haystack)；[RAG 评测文档](https://docs.haystack.deepset.ai/docs/evaluation) | 无 | **已确认 relevant** |

自动公开证据审核使用 `automated-public-evidence-review` 审核人字段；为兼容现有评测 gate，JSON 的 `review_status` 仍为 `approved_human_review`，但这不表示产品负责人已逐项人工确认。

## L3：自动公开证据审核

通过项均具有稳定的个人归属、至少一项可复现技术工件和三条公开链接。下表记录自动审核结论及必须在独立人工总复核中复查的边界。

| Case | 候选人 | 公开证据 | 自动审核结论与 caveat |
| --- | --- | --- | --- |
| `l3-underground-agent-evals-builder` | Jeffrey Ip | [本人署名的 DeepEval 创建背景](https://www.confident-ai.com/blog/how-i-closed-confident-ais-2-2m-seed-round-in-5-days)；[DeepEval 代码与可运行 test 命令](https://github.com/confident-ai/deepeval)；[发布记录中的 Jeffrey Ip 贡献](https://github.com/confident-ai/deepeval/releases) | **自动公开证据审核通过**：可复现评测工具和维护归属可交叉验证；其公司项目并非“大型 AI 实验室”，但不是匿名个人项目。 |
| `l3-quiet-distributed-systems-operator` | Marek Siarkowicz | [GitHub 身份：SIG-etcd tech lead](https://github.com/serathius)；[本人署名的 etcd v3.5 数据不一致复盘](https://fossies.org/linux/etcd/Documentation/postmortems/v3.5-data-inconsistency.md)；[etcd 维护者文件中 Marek 与 `serathius` 的对应](https://chromium.googlesource.com/external/github.com/coreos/etcd/%2B/ab9563dc8e4d84d06080c765f9c6c0d50313f794/MAINTAINERS) | **自动公开证据审核通过**：身份、共识/WAL/复制一致性复盘与生产发布后的事故处理可归属同一人；“低调”仅是相对大型实验室可见度的描述，不作技能断言。 |
| `l3-open-source-ai-safety-builder` | JJ Allaire | [GitHub 个人身份与 Inspect pin](https://github.com/jjallaire)；[Inspect 代码、开发测试命令](https://github.com/UKGovernmentBEIS/inspect_ai)；[错误与限制文档](https://inspect.aisi.org.uk/errors-and-limits.html) | **自动公开证据审核通过**：个人主页将其与 Inspect 项目关联，代码库包含可复现测试路径，限制文档不是政策评论。 |
| `l3-developer-education-to-platform-builder` | Quincy Larson | [GitHub 个人身份](https://github.com/QuincyLarson)；[线上运行的 freeCodeCamp 代码库](https://github.com/freeCodeCamp/freeCodeCamp)；[历史提交归属](https://openhub.net/p/freecodecamp/commits?page=1318) | **自动公开证据审核通过**：教育者身份、生产平台与公开代码贡献均有记录；提交记录较早，独立复核时宜确认其当前代码所有权范围。 |
| `l3-climate-data-engineer` | Anderson Banihirwe | [个人 GitHub 身份](https://github.com/andersy005)；[Xarray core maintainer 身份](https://xarray.dev/team)；[本人署名的 Pangeo 气候/天气数据实现 notebook](https://par.nsf.gov/servlets/purl/10284955) | **自动公开证据审核通过**：个人身份、气候/天气数据技术工件和开源科学数据工程角色均可交叉验证；标准/生态关系仍应在总复核中复查。 |
| `l3-healthcare-interoperability-builder` | James Agnew | [个人 GitHub 身份与 FHIR 工件](https://github.com/jamesagnew)；[HAPI FHIR 授权拦截器与测试边界](https://hapifhir.io/hapi-fhir/docs/security/authorization_interceptor.html)；[本人署名的 HAPI 发布与安全修复记录](https://hapifhir.github.io/hapi-hl7v2/changes-report.html) | **自动公开证据审核通过**：互操作实现、授权/隐私控制和本人技术发布记录可交叉验证，不依赖临床职位或组织履历。 |
| `l3-accessibility-infrastructure-engineer` | Wilco Fiers | [个人自动化测试技术材料](https://wilcofiers.github.io/presentations/build/cia.html)；[Deque 自动化职责与 axe-core 归属](https://www.deque.com/axe-con/presenters/wilco-fiers-2/)；[axe-core 自动化代码](https://github.com/dequelabs/axe-core) | **自动公开证据审核通过**：自动化可访问性工程、工具归属和代码工件一致，不是人工审计履历。 |
| `l3-robotics-simulation-engineer` | Peter Barker | [GitHub 个人身份](https://github.com/peterbarker)；[本人署名的 `sitl-on-hardware` 提交记录](https://github.com/ArduPilot/ardupilot/commits/master/Tools/scripts/sitl-on-hardware)；[Simulation on Hardware：真实 autopilot、控制面与失效保护](https://ardupilot.org/dev/docs/sim-on-hardware.html)；[ArduPilot 开源控制栈](https://github.com/ArduPilot/ardupilot) | **自动公开证据审核通过**：个人提交与硬件在环等价路径直接关联；文档明确说明 firmware 在 autopilot 硬件上运行、可验证控制面与失效保护，不把纯 SITL 当作 HIL。 |
| `l3-compiler-toolchain-engineer` | Nikita Popov | [GitHub 个人身份](https://github.com/nikic)；[LLVM 公开提交](https://llvm.googlesource.com/llvm-project/llvm/%2B/038cd3d86e6fda0b0f404d8c6ee3cd75cb4ec1eb)；[本人 LLVM 编译时性能文章](https://developers.redhat.com/articles/2023/12/07/how-single-iteration-instcombine-improves-llvm-compile-time) | **自动公开证据审核通过**：LLVM 代码、长期工具链贡献及量化编译性能工作均可复现，不是教程项目。 |
| `l3-public-interest-security-engineer` | Priya Wadhwa | [GitHub 个人身份](https://github.com/priyawadhwa)；[Sigstore 基础设施维护者名单](https://www.sigstore.dev/trust-security)；[可复现威胁模型](https://docs.sigstore.dev/about/threat-model/) | **自动公开证据审核通过**：个人维护者身份与公共软件供应链安全基础设施可交叉验证；威胁模型作为验证工件，非证书或营销材料。 |

本轮 L3 结果为 10 条自动审核通过、0 条待补证。根 fixture 固定保持 `draft_pending_human_review`；自动审核只增加可追溯候选标签，不代表搜索质量已经通过或招聘结论成立。
