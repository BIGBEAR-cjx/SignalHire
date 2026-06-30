# P2 PRD: Source Mix UX Upgrade

日期：2026-06-30

## 1. Summary

`Source Mix UX Upgrade` 把 SignalHire 的多平台来源能力从后台数据变成用户可理解的判断界面。

当前系统已经有 CandidateGraph、source mix、source nodes、readiness 和 contact coverage。P2 不重建这些底层能力，而是把它们变成 Role Workspace 和候选人卡片上的清晰解释：候选人来自哪里、来源是否足够、哪些是强证据、哪些只是 lead。

## 2. Product Promise

> Every candidate comes with a visible source mix, evidence coverage, and readiness reason, so recruiters can trust why SignalHire thinks this person is ready or still needs verification.

中文表达：

> 每个候选人都带来源构成、证据覆盖和推进理由，让招聘者清楚知道为什么此人可外联，或者还需要补证据。

## 3. Why This Matters

Lessie 用多平台覆盖建立“找得到人”的信任。SignalHire 要用多平台来源和证据链建立“这个人值得判断”的信任。

P2 的目标不是炫耀数据源数量，而是把 source mix 变成判断工具：

- 单来源候选人不能被误认为高可信。
- people API / LinkedIn seed 只能代表线索，不等于强证据。
- GitHub、论文、公司页、个人站等公开证据要能支撑 claim。
- 联系方式来源要和候选人证据分开，避免“有邮箱 = 值得推荐”的误判。

## 4. Users And Jobs

### Recruiter

Job：快速判断 shortlist 中哪些人值得继续推进，哪些人只是线索。

成功体验：不用打开每个来源链接，也能知道候选人的来源覆盖和证据缺口。

### Founder / Hiring Manager

Job：看候选人时希望知道“为什么是这个人”，而不是只看分数。

成功体验：候选人卡片用几行解释 readiness，而不是只给 match score。

### Agency / Headhunter

Job：给客户交付候选人时，需要说清楚候选人来自哪里、证据强度如何。

成功体验：source mix 可以直接转化为交付解释。

## 5. Scope

### In Scope

- Role Workspace source mix panel 升级。
- 候选人行 / 卡片展示 source chips。
- 每个 source chip 增加 tooltip，解释 source category、强弱和是否只是 lead。
- 每个候选人展示 readiness reason。
- 区分 `lead source`、`evidence source`、`contact source`。
- 在 shortlist report 中复用 source mix。
- 在 P2 内细分 GitHub / paper / company page，不继续全部塞进 `public_web`。
- 展示 source count、source type、evidence quality、contactability score。
- 移动端布局优化，source chips 不横向溢出。

### Out Of Scope

- 不新增数据源。
- 不新增 provider adapter。
- 不改 CandidateGraph dedupe 规则，除非必须支持 readiness reason。
- 不新增数据库表。
- 不做 SEO/free tools。

## 6. Source Taxonomy

P2 UI 使用以下展示分类：

| Source type | UI label | Meaning | Strength |
|---|---|---|---|
| `people_api` | People API | provider 返回的人才资料或联系方式线索 | lead / contact, not strong evidence |
| `linkedin_seed` | LinkedIn seed | 用户或 provider 提供的 LinkedIn URL | identity lead |
| `public_web` | Public web | 公开网页、公司页、博客、项目页 | evidence candidate |
| `github` | GitHub | GitHub profile、repo、commit、issue | strong technical evidence when tied to claims |
| `paper` | Paper | Semantic Scholar / OpenAlex / OpenReview | strong research evidence when tied to claims |
| `personal_site` | Personal site | 个人主页、portfolio | medium evidence |
| `company_page` | Company page | 公司/team/profile 页面 | employment evidence |
| `internal_resume` | Internal resume | 用户上传或内部候选人资料 | candidate-provided / internal evidence |
| `manual_upload` | Manual upload | 用户手动输入 | user-provided lead |

当前 `candidate-graph.mjs` 只保证基础 source types。P2 必须补最小 source classifier，把 `public_web` 细分成 GitHub、paper、company page、personal site 等展示类型；不重写 dedupe 和 CandidateGraph 主结构。

### Source Classification Rules

P2 第一版使用 URL / source metadata 做轻量分类：

- GitHub：host 包含 `github.com`，或 source metadata 包含 `github`。
- Paper：host 包含 `semanticscholar.org`、`openreview.net`、`arxiv.org`、`doi.org`，或 provider/source family 为 OpenAlex / Semantic Scholar / OpenReview。
- Company page：URL path 或 metadata 表明 team、about、people、company、jobs、profile，且不是个人站。
- Personal site：非平台域名，metadata 指向 portfolio / personal homepage / website。
- Public web fallback：无法细分时保留 `public_web`。

## 7. Readiness Model

### Existing Buckets

- `ready_for_outreach`
- `sourced`
- `needs_verification`

### Required Readiness Reasons

每个候选人需要展示一句短 reason：

- `ready_for_outreach`：
  - “High evidence quality with 2+ source types and no unresolved risks.”
  - 中文：“证据质量高，覆盖 2 个以上来源，暂无未解决风险。”

- `sourced`：
  - “Sourced from multiple signals, but still needs stronger evidence before recommendation.”
  - 中文：“已从多个信号发现，但推荐前还需补强证据。”

- `needs_verification`：
  - “Single-source or low-evidence lead. Verify public evidence before outreach.”
  - 中文：“单一来源或低证据线索，外联前需先验证公开证据。”

### Hard Rules

- 单来源候选人不能显示为 `ready_for_outreach`。
- low evidence candidate 不能显示为 `ready_for_outreach`。
- 有联系方式但证据弱，不能显示为 `ready_for_outreach`。
- people API 或 LinkedIn seed 单独出现，只能作为 lead，不是推荐证据。

## 8. UI Requirements

### Role Workspace Source Mix Panel

展示：

- total candidates
- ready for outreach count
- needs verification count
- contact coverage
- source mix list with labels
- provider enabled / disabled status

Source mix item 需要展示：

- source label
- count
- source category：lead / evidence / contact / internal
- tooltip：
  - 解释该来源类别是什么。
  - 说明是否可作为强证据。
  - 说明是否只是 lead。

### Candidate Readiness List

每行展示：

- candidate name
- title / company
- readiness badge
- readiness reason
- source chips，最多展示 3 个，剩余用 `+N`
- evidence quality
- contactability score

### Candidate Card Source Chips

Chips 必须：

- 可换行。
- 不造成横向滚动。
- 移动端最多两行，超出折叠成 `+N sources`。
- hover / focus 时展示 tooltip。
- tooltip 内容必须可键盘访问。

### Shortlist Report Reuse

Public / shareable shortlist report 必须复用 P2 source mix：

- report 顶部展示整体 source mix。
- 候选人卡片展示 source chips 和 readiness reason。
- source tooltip 在 report 中也可用；如果公开报告不适合交互 tooltip，则展示简短 inline explanation。
- report 不展示内部-only 数据，如 provider raw reference、内部成本或 private notes。

### Copy Tone

用判断语言，不用营销语言：

- 用 “needs verification” 而不是 “weak candidate”。
- 用 “lead source” 而不是 “bad source”。
- 用 “public evidence” 而不是 “proof”。

## 9. Data Requirements

P2 优先复用：

- `CandidateGraphView.summary`
- `CandidateGraphView.source_mix`
- `CandidateGraphView.candidates[].source_types`
- `CandidateGraphView.candidates[].evidence_quality`
- `CandidateGraphView.candidates[].contactability_score`
- `CandidateGraphView.candidates[].readiness`

若需要新增字段，优先新增 view-model 字段：

```ts
type CandidateGraphCandidateView = {
  readiness_reason: string;
  source_labels: Array<{
    source_type: string;
    label: string;
    category: "lead" | "evidence" | "contact" | "internal";
    tooltip: string;
  }>;
};
```

不要求新增数据库列。

## 10. Empty And Edge States

- 无候选人：显示空态，不显示 0 分仪表盘。
- provider disabled：显示 disabled badge，不阻塞内部候选人和公开证据展示。
- source type unknown：显示 normalized fallback label，不崩溃。
- source tooltip 缺失：展示安全 fallback tooltip。
- contactability 0：显示 “No sourced contact yet”，不能显示为错误。
- mobile：source chips 换行，不能挤压候选人姓名。

## 11. Metrics

- `ready_source_coverage_avg`：ready candidates 平均 source type 数。
- `needs_verification_count`：需要补证据候选人数。
- `source_mix_panel_viewed`：source mix panel 展示次数。
- `candidate_readiness_expand_rate`：用户查看候选人 readiness details 的比例。
- `source_chip_tooltip_open_rate`：source chip tooltip 打开比例。
- `report_source_mix_viewed`：shareable shortlist report 中 source mix 被展示的次数。

## 12. Acceptance Criteria

- Role Workspace source mix 使用可读 label，不只显示 snake_case。
- 候选人行展示 source chips、evidence quality、readiness reason。
- 每个 source chip 有 tooltip 或公开报告中的 inline explanation。
- shortlist report 复用 source mix 和 source chips。
- GitHub / paper / company page 在 P2 中被细分展示。
- 单来源或 low evidence 候选人不会显示为 ready。
- Contact source 和 evidence source 不混为一谈。
- provider disabled 时 UI 仍可用。
- 移动端无横向溢出。

## 13. Test Plan

- Unit test：CandidateGraph readiness 规则不回退。
- Source guard：Role Workspace 页面包含 source label mapping。
- Source guard：页面包含 readiness reason。
- Source guard：candidate source chips 使用 flex wrap。
- Source guard：source chip tooltip 可 hover/focus 访问。
- Source guard：`web/app/r/[id]/page.tsx` 或 report components 复用 source mix。
- Unit test：GitHub / paper / company page source classification。
- Build：`npm --prefix web run build`。

## 14. Confirmed Decisions

- 每个 source chip 都需要 tooltip。
- shortlist report 必须复用 source mix。
- GitHub / paper / company page 在 P2 就细分。
