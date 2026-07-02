# P1 PRD: Sequence Step Edit And Approval History

日期：2026-07-01

## 1. Summary

`Sequence Step Edit And Approval History` turns outreach sequence from a static preview into a recruiter-controlled workflow. Users can edit each step independently, mark follow-up steps as reviewed, and see a compact audit trail for what changed.

## 2. Product Promise

> Review each outreach step separately, with evidence refs and approval history attached.

中文表达：

> 每一步外联都可以独立修改、审核，并保留证据和审批记录。

## 3. Users And Jobs

### Recruiter

Job：首封、跟进 1、跟进 2 的文案需要分别调，不希望改首封时覆盖后续。

成功体验：能展开 step，编辑 subject/body，保存后看到 review history。

### Agency

Job：对客户解释为什么某个候选人的跟进被改过或跳过。

成功体验：每个 step 的历史记录能显示 saved / reviewed / skipped / stopped。

## 4. Scope

### In Scope

- Per-step sequence patch helper:
  - patch subject/body
  - patch reviewed/approved state
  - patch skipped state
  - append audit event
- Role Workspace sequence UI:
  - each step has editable subject/body
  - save step
  - mark reviewed
  - skip follow-up
  - compact history list
- Preserve existing route:
  - PATCH `/api/outreach-threads/[id]` still updates `sequence_messages`.
- Guardrails:
  - Step 1 always `manual_approval_required`.
  - Step 1 reviewed does not mean sent.
  - Follow-up review draft eligibility remains contact-gated.

### Out Of Scope

- New sequence table.
- Automatic sending.
- New Gmail OAuth behavior.
- Rich text editor.

## 5. Sequence Step Contract

```ts
type OutreachSequenceMessage = {
  step: 1 | 2 | 3;
  subject: string;
  body: string;
  send_mode: "manual_approval_required" | "draft_for_review";
  evidence_refs: string[];
  delay_days?: 7;
  approved?: boolean;
  skipped?: boolean;
  reviewed_at?: string;
  audit_events?: Array<{
    action: "saved" | "reviewed" | "skipped";
    at: string;
    summary: string;
  }>;
};
```

## 6. Acceptance Criteria

- Editing step 2 does not alter step 1 or step 3.
- Marking step 1 reviewed does not make first email auto-sendable.
- Skipped follow-up step no longer appears as active review work.
- Each save/review/skip appends an audit event.
- Existing threads without sequence metadata still get fallback sequence safely.

## 7. Metrics

- Steps saved per role.
- Steps reviewed per role.
- Follow-up steps skipped.
- Drafts sent after review.
