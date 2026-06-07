---
target: web/app/r/[id]/page.tsx
total_score: 29
p0_count: 0
p1_count: 1
timestamp: 2026-06-04T15-13-43Z
slug: web-app-r-id-page-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|---|---:|---|
| 1 | Visibility of System Status | 3 | 报告页状态清楚；DB 卡顿已加超时保护。 |
| 2 | Match System / Real World | 3 | 证据、候选人、来源等术语贴近 HR 工作流。 |
| 3 | User Control and Freedom | 3 | 公开报告新增中英切换，空状态有返回入口。 |
| 4 | Consistency and Standards | 3 | 共享结果组件统一接收 locale，仍有少量上层项目页中文壳未完全覆盖。 |
| 5 | Error Prevention | 3 | 报告读取超时后快速降级为空状态，避免用户等待。 |
| 6 | Recognition Rather Than Recall | 3 | 主要区块标题、状态、徽章已双语化。 |
| 7 | Flexibility and Efficiency | 3 | 分享链接可携带 `?lang=zh|en`，适合跨语言转发。 |
| 8 | Aesthetic and Minimalist Design | 3 | 保持 Apple-like Evidence Desk 风格；无新增装饰。 |
| 9 | Error Recovery | 3 | 缺失报告页提供明确说明和返回动作。 |
| 10 | Help and Documentation | 2 | 局限性说明已双语化，但真实报告的来源内容仍依赖生成时语言。 |
| **Total** |  | **29/40** | **Solid, with remaining language-model dependency** |

## Anti-Patterns Verdict

**LLM assessment**: 页面没有明显 AI slop 式装饰问题，主要风险来自产品级一致性：此前公开报告和结果组件大量中文硬编码，英文用户即使切换平台语言也会看到中文报告框架。

**Deterministic scan**: `detect.mjs --json web/app/r/[id]/page.tsx web/components/result.tsx` 返回 `[]`，未发现内置规则命中的视觉反模式。

**Visual/browser evidence**: 本地 `/r/11e6f828-aaa7-43cd-aaad-88200b532e80?lang=en` 在 DB 无本地 seed 时能快速返回英文空状态，包含 `Report not found · SignalHire`、`AI talent report`、`Verify a candidate with SignalHire`，内容容器带 `lang="en"`。

## Overall Impression

当前最大质量提升是把结果组件从中文固定壳改成可按平台语言展示的报告壳，并给公开报告页加了语言参数和 DB 超时保护。它更接近“可交付给不同语言客户的证据报告”，不是只在中文后台可读的内部页面。

## What's Working

- 结果组件继续保持证据优先结构：搜索计划、来源执行、覆盖缺口、人才地图、候选人对比和证据审计的顺序符合 HR 审阅逻辑。
- 新增 `locale` 是可选参数，默认中文，不会破坏现有调用。
- 公开报告页支持 `?lang=zh|en`，适合分享链接直接指定语言。

## Priority Issues

**[P1] 真实报告正文仍依赖生成时语言**

Why it matters: 如果历史 report 的 AI 输出内容本身是英文，中文用户仍会读到英文证据摘要；如果输出内容是中文，英文用户会看到英文框架加中文正文。

Fix: 后续需要在持久化结果里记录 `platform_language`，并对已有报告提供再生成/翻译摘要路径。

Suggested command: `$impeccable harden web/components/result.tsx`

**[P2] 全站 `<html lang>` 仍由客户端 localStorage 控制**

Why it matters: 公开报告页已在内容容器上标注 `lang`，但根 html 仍默认 `zh-CN`，对部分辅助技术和 SEO 不如服务端 locale 路由完整。

Fix: 后续如果要做严肃国际化，应升级为 route/cookie/header 级语言策略。

Suggested command: `$impeccable shape bilingual routing`

**[P3] 项目详情页上层文案仍未完整双语化**

Why it matters: 候选人画像组件已接入 locale，但项目详情页自己的按钮、筛选、空态仍是中文，英文用户在项目页会遇到混合语言。

Fix: 用现有 `useI18n` 字典补齐项目详情页文案。

Suggested command: `$impeccable harden web/app/app/projects/[id]/page.tsx`

## Persona Red Flags

**Jordan (First-time recruiter)**: 之前英文用户打开分享报告时会看到中文状态和标题，容易误判报告不可交付；现在报告壳已能按链接语言展示。

**Alex (Power user)**: 需要把报告转发给客户时，可以直接使用 `?lang=en`，减少手动说明成本；但历史正文语言仍可能不一致。

**Priya (Accessibility user)**: 内容容器已有 `lang`，但根 html 语言仍非服务端同步，辅助技术体验还有提升空间。

## Minor Observations

- 报告读取增加 4.5 秒超时，避免本地或 DB 异常时请求长时间挂起。
- `border-left` 报告引用样式已改成完整边框，避开 side-stripe 反模式。
- 信源数量和信任启发式文案已支持中英。

## Questions to Consider

- 报告正文语言是否应该成为 `research_runs` 的一等字段？
- 分享链接的默认语言应该跟随生成语言、浏览器语言，还是创建者当前平台语言？
- 是否需要给历史报告提供“一键转译报告摘要”的轻量功能？
