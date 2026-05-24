# SignalHire 设计系统 (v1)

方向：**现代浅色 SaaS**（参考 Deflexai/Linear/Vercel 气质）。干净、留白多、可信、融资 demo 级。

## 调性
- 浅色为主，白底 + 极浅灰分区。大留白、圆角、柔和阴影。
- 差异化叙事靠"验证/证据"：环绕的数据来源 logo = 我们交叉核实的公开来源。

## 颜色
- 背景：白 `#FFFFFF`，分区浅灰 `#FAFAFA`
- 文字：近黑 `text-gray-900`，次要 `text-gray-600`，弱 `text-gray-400`
- 主按钮：黑底白字 `bg-gray-900 / hover:bg-gray-800`
- 次按钮：白底 + `border-gray-300`
- 裁决语义色（验证徽章）：
  - 已验证 verified → emerald（`bg-emerald-100 text-emerald-700`）
  - 查无实据 unverified → amber（`bg-amber-100 text-amber-800`）
  - 矛盾 contradicted → red（`bg-red-100 text-red-700`）

## 字体
- Geist Sans（标题/正文）+ Geist Mono（实时流/代码感），见 `app/layout.tsx`。
- H1：`text-5xl/6xl font-extrabold tracking-tight leading-[1.1]`。

## 形状/阴影
- 卡片/容器圆角：`rounded-2xl`；徽章/芯片：`rounded-full`。
- 浮起阴影：`shadow-[0_8px_30px_rgba(0,0,0,0.06~0.10)]`，配 `ring-1 ring-gray-100`。
- 浮动导航：`sticky top-3` 圆角胶囊 + `backdrop-blur`。

## 关键组件
- `app/Landing.tsx`：浮动导航 + Hero（状态徽章 / 大标题 / 双 CTA / 验证示例卡 / 同心环 + 数据来源 logo 气泡）+ 数据来源信任条。
  - 数据来源 logo 用 `react-icons`（`si` + `fa6` 的 `FaLinkedin`），离线无外链。环绕用品牌色，底部条用灰度。
  - 同心环与气泡 `lg:` 以上才显示，移动端隐藏只留中央内容。
- 工具区（`app/page.tsx` 的 `#tool`）：搜人/验证双模式 + 结果卡 + 搜索历史。**待办：把工具区与结果卡也对齐这套浅色系统**（当前还是早期朴素样式）。

## 后续 (Phase 2)
- 信任分大徽章可视化、证据带来源 favicon、可分享的只读验证报告页 `/r/[id]`。
