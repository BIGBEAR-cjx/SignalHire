# Apple 风格 UI 重构 Phase 4 执行计划

## 目标

继续补齐 UI 重构的最后一批高频界面：登录注册弹窗、AI 外联弹窗和结果报告核心展示组件。目标是让弹窗、shortlist、核验报告、候选人详情、证据块与前几阶段的 Apple-inspired 工作台视觉一致。

## 范围

- `web/components/AuthModal.tsx`
- `web/components/OutreachModal.tsx`
- `web/components/result.tsx`

## 非目标

- 不改登录、注册、OTP、退出登录、外联生成、复制、mailto、搜索/核验结果数据结构。
- 不改 API 请求体。
- 不新增导出功能。
- 不重写所有结果子组件为全新架构；本阶段先统一核心材质、按钮、状态胶囊和明显 emoji/符号。

## 任务

- [x] 任务 1：重构登录注册弹窗
  - 使用统一 Logo、材质面板、分段登录/注册控件、图标关闭按钮。
  - 去掉 `✕`、`←` 文本符号。
  - 验证：登录/注册/验证码表单字段和 submit 函数不变。

- [x] 任务 2：重构 AI 外联弹窗
  - 改为更宽松的编辑工作台布局。
  - tone 切换使用统一 segmented control。
  - 操作按钮改为图标按钮，不使用 emoji。
  - 验证：生成、复制全文、复制依据、mailto、localStorage sender 逻辑不变。

- [x] 任务 3：重构结果核心组件
  - 统一 `ShortlistDeliveryReportView`、`SearchPlanView`、`ShortlistCard`、`CandidateProfileView`、`CandidateCard`、`TrustReportView` 的壳层样式。
  - 去掉明显符号 `✓`、`✕`、`⛓`、`↗`、`🚩`。
  - 保留原有派生数据 builder 和 props。

- [x] 任务 4：验证与推送
  - `eslint components/AuthModal.tsx components/OutreachModal.tsx components/result.tsx components/ui/signal-ui.tsx`
  - `tsc --noEmit`
  - `node --test auth-session-sync.test.mjs search-page-state.test.mjs research-progress.test.mjs`
  - `npm run build`
  - `git diff --check HEAD`
