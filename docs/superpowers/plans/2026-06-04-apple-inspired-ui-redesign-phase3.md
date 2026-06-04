# Apple 风格 UI 重构 Phase 3 执行计划

## 目标

把还没有覆盖的新工作台页面继续统一到 Apple-inspired 视觉系统：项目列表、项目详情、候选池、历史和设置。保留现有 API、状态更新、自动保存、项目内搜人不自动启动搜索、候选人状态流和外联弹窗逻辑。

## 范围

- `web/app/app/projects/page.tsx`
- `web/app/app/projects/[id]/page.tsx`
- `web/app/app/shortlist/page.tsx`
- `web/app/app/history/page.tsx`
- `web/app/app/settings/page.tsx`
- 必要时小幅扩展 `web/components/ui/signal-ui.tsx`

## 非目标

- 不做导出功能。
- 不改数据库 schema。
- 不改搜索、核验、shortlist、项目 API 的请求体和返回结构。
- 不重写 `components/result.tsx` 的深层报告组件；结果组件重构留到下一阶段。
- 不新增复杂动画库。

## 设计要求

- 页面入口使用统一的 `PageIntro`。
- 主操作使用 `PrimaryAction` / `SecondaryAction`，避免 emoji 按钮。
- 卡片使用 `Surface` 或同等材质感样式。
- 筛选使用圆角 segmented control 风格。
- 空状态使用图标和简短动作，不使用 emoji。
- 项目详情保留“在本项目下搜人”只预填条件、不自动启动的行为。
- 候选池和项目详情的外联按钮改为线性图标按钮。
- 移动端不出现明显文本溢出或双栏强挤。

## 任务

- [ ] 任务 1：扩展共享 UI 小组件
  - 补充状态胶囊、分段筛选、轻量列表行等纯展示组件。
  - 验证：`eslint components/ui/signal-ui.tsx` 和 `tsc --noEmit`。

- [ ] 任务 2：重构项目列表
  - 使用 `PageIntro`、`PrimaryAction`、`EmptyState`。
  - 新建项目弹窗改成更轻的材质面板和图标关闭按钮。
  - 验证：项目列表仍能加载、筛选、新建后跳转。

- [ ] 任务 3：重构项目详情
  - 项目 hero、KPI、状态漏斗、候选人工作区、历史研究统一视觉。
  - 搜人/核验 CTA 去 emoji，保留 query/project 参数。
  - 验证：状态筛选、候选人详情、备注自动保存、移出项目和删除逻辑不改。

- [ ] 任务 4：重构候选池、历史、设置
  - 候选池改成更清晰的审阅工作区。
  - 历史改成研究记录列表，保留重新打开目标 URL。
  - 设置改成账户与偏好面板，移除项目内 emoji/bullet 装饰。
  - 验证：页面 fetch、筛选、状态更新、退出登录逻辑不改。

- [ ] 任务 5：整体验证和推送
  - `node --test auth-session-sync.test.mjs search-page-state.test.mjs research-progress.test.mjs`
  - `eslint` 覆盖本阶段所有 TSX 文件。
  - `tsc --noEmit`
  - `npm run build`
  - `git diff --check HEAD`
  - 如浏览器登录态可用，补做 `/app/projects`、`/app/shortlist`、`/app/history` 的视觉检查。
