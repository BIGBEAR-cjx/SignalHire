# P3 PRD: ATS-lite

日期：2026-06-30

## 1. Summary

ATS-lite 让 SignalHire 和 Greenhouse / Ashby / Lever 之一形成最小闭环：导入岗位、导出候选人、标记去重、导出 interested candidates。

第一版不追 Juicebox 的 50+ ATS/CRM 集成，只做一个 provider 的可验证路径。推荐优先 Greenhouse，因为招聘团队认知强、API 模型清晰。

## 2. Product Promise

> Import an ATS role, source and verify candidates in SignalHire, then export only reviewed candidates back with evidence context.

中文表达：

> 从 ATS 导入岗位，在 SignalHire 完成搜人和证据审阅，再把已审阅候选人和证据摘要导回 ATS。

## 3. Users And Jobs

### Recruiter

Job：不想在 ATS 和 SignalHire 之间重复录入 JD 和候选人。

成功体验：ATS 岗位可以生成 SignalHire project，候选人推进后可导出回 ATS。

### Hiring Manager

Job：希望 ATS 中看到候选人来源和推荐理由。

成功体验：ATS 记录包含 SignalHire evidence summary 和风险提示。

## 4. Scope

### In Scope

- 选择一个 ATS provider。
- ATS job import：
  - title
  - department
  - location
  - job description
  - hiring team if available
- Candidate export：
  - name
  - email if sourced and sendable
  - LinkedIn URL if present
  - evidence summary
  - source mix summary
  - SignalHire report link
- Dedupe 标记：
  - email hash
  - LinkedIn URL
  - ATS candidate id
- Interested candidate export。
- Provider disabled / missing key 状态。

### Out Of Scope

- 50+ ATS 集成。
- 双向实时同步。
- ATS workflow stage 自动推进。
- 简历附件上传。
- 自动创建 offer / interview plan。

## 5. Data Contract

```ts
type AtsLiteProvider = "greenhouse";

type AtsJobImportView = {
  provider: AtsLiteProvider;
  external_job_id: string;
  title: string;
  description: string;
  department: string;
  location: string;
  imported_project_id?: string;
};

type AtsCandidateExportPayload = {
  provider: AtsLiteProvider;
  project_id: string;
  candidate_id: string;
  name: string;
  email?: string;
  linkedin_url?: string;
  evidence_summary: string;
  source_mix_summary: string;
  report_url: string;
};
```

## 6. UX Requirements

- Settings 显示 ATS provider enabled / disabled。
- Project 创建页支持 “Import from ATS”。
- Project candidate row 支持 “Export to ATS”。
- Interested queue 支持 “Export interested to ATS”。
- Export 前展示 preview，不自动导出所有候选人。

## 7. Guardrails

- 只导出 reviewed / interested / approved candidates。
- 不导出未核验 preview lead。
- 不导出低置信度或无来源联系方式。
- 不把 internal notes 写入 ATS。
- Provider token 只在 server-side 使用。

## 8. Acceptance Criteria

- 没有 ATS key 时 UI 显示 disabled，不影响 SignalHire 主流程。
- 能从 mock provider 导入 job 生成 project draft。
- 能构建 candidate export payload。
- Dedupe key 能识别已导出候选人。
