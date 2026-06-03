# Hot Monitor 复盘到模板治理回流 Phase 6 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **本仓库额外约束：** 未经用户明确允许，不允许提交 commit。本计划中的所有实现、测试、文档更新都只保留在工作区，完成后汇报变更和验证结果。

**Goal:** 让 Hot Monitor 失败复盘可以关联已有提取模板，生成模板回流建议和草稿，并把确认后的草稿应用到模板治理主线。

**Architecture:** 不新增数据库、不新增 IPC、不接 AI。Hot Monitor 复用 `automation.listTemplates()` 加载模板，复用 `taskOperations.linkReviewTemplate/suggestTemplateBackflow/createTemplateBackflowDraft/applyTemplateBackflowDraft` 完成 Review -> Template 回流；模板治理 UI 拆成独立组件，避免继续拉大 `App.tsx`。

**Tech Stack:** React 18、TypeScript、Ant Design、Vitest、Testing Library、现有 `useIpc`、`taskOperations` API、`ReviewService`、`TemplateService`。

---

## 文件结构

| 文件 | 职责 |
| --- | --- |
| `src/renderer/entries/hot-monitor/templateGovernance.ts` | 新增模板治理纯函数：判断治理意图、补齐后续动作、合并已关联模板 |
| `tests/unit/renderer/hot-monitor/templateGovernance.test.ts` | 覆盖模板治理纯函数 |
| `src/renderer/entries/hot-monitor/components/ReviewTemplateGovernancePanel.tsx` | 新增单条复盘的模板治理面板 |
| `tests/unit/components/ReviewTemplateGovernancePanel.test.tsx` | 覆盖模板选择、关联、建议、草稿、应用 |
| `src/renderer/entries/hot-monitor/App.tsx` | 加载模板列表，把治理面板挂到失败复盘列表；新建复盘后更新可回流动作 |
| `tests/unit/components/HotMonitorApp.test.tsx` | 覆盖 Hot Monitor 与治理面板的集成 |
| `src/renderer/entries/hot-monitor/failureReview.ts` | 调整默认后续动作，给模板治理类失败补 `template-governance` |
| `tests/unit/renderer/hot-monitor/failureReview.test.ts` | 更新失败复盘默认动作断言 |
| `docs/overview/current-status.md` | Phase 6 完成后回写状态 |

---

## 现有上下文

| 现有项目 | 当前行为 |
| --- | --- |
| `HotMonitorApp` | 已在失败运行详情中展示复盘表单、复盘列表和同源重跑 |
| `TaskReviewRecord` | 已支持 `linkedTemplateIds?: string[]` |
| `useIpc().automation.listTemplates()` | 已通过 `TEMPLATE_LIST` 返回 `ExtractionTemplate[]` |
| `useIpc().taskOperations.linkReviewTemplate()` | 已通过 `TEMPLATE_LINK_REVIEW` 关联复盘和模板 |
| `useIpc().taskOperations.suggestTemplateBackflow()` | 已通过 `REVIEW_TEMPLATE_BACKFLOW_SUGGEST` 生成建议 |
| `useIpc().taskOperations.createTemplateBackflowDraft()` | 已通过 `REVIEW_TEMPLATE_BACKFLOW_DRAFT` 生成草稿 |
| `useIpc().taskOperations.applyTemplateBackflowDraft()` | 已通过 `TEMPLATE_BACKFLOW_APPLY` 应用草稿 |
| `ReviewPanel` | Automation 已有同类能力，可参考但不直接依赖 |

---

### Task 1: 新增模板治理纯函数

**Files:**
- Create: `src/renderer/entries/hot-monitor/templateGovernance.ts`
- Create: `tests/unit/renderer/hot-monitor/templateGovernance.test.ts`

- [ ] **Step 1: 写模板治理 RED 测试**

创建 `tests/unit/renderer/hot-monitor/templateGovernance.test.ts`：

```ts
import { describe, expect, it } from 'vitest';
import type { TaskReviewRecord } from '@shared/types';
import {
  ensureTemplateGovernanceAction,
  hasTemplateGovernanceIntent,
  mergeLinkedTemplateIds,
} from '@renderer/entries/hot-monitor/templateGovernance';

function makeReview(overrides: Partial<TaskReviewRecord> = {}): TaskReviewRecord {
  return {
    id: 'review-1',
    taskId: 'task-1',
    batchId: 'batch-1',
    reviewType: 'failure',
    reasonCategory: 'selector_changed',
    conclusion: '价格字段选择器需要改为 .price-current',
    owner: '当前值班员',
    followUpActions: ['update-selector'],
    linkedTemplateIds: [],
    createdAt: '2026-05-19T02:00:00.000Z',
    ...overrides,
  };
}

describe('templateGovernance', () => {
  it('detects review actions that should flow back to templates', () => {
    expect(hasTemplateGovernanceIntent(makeReview())).toBe(true);
    expect(
      hasTemplateGovernanceIntent(
        makeReview({
          reasonCategory: 'login_required',
          conclusion: '刷新登录态后观察下一次运行',
          followUpActions: ['refresh-session', 'monitor-next-run'],
        }),
      ),
    ).toBe(false);
  });

  it('adds template-governance action for template-related failures', () => {
    expect(ensureTemplateGovernanceAction(['update-selector'])).toEqual([
      'update-selector',
      'template-governance',
    ]);
  });

  it('does not duplicate template-governance action', () => {
    expect(ensureTemplateGovernanceAction(['update-parser', 'template-governance'])).toEqual([
      'update-parser',
      'template-governance',
    ]);
  });

  it('merges linked template ids without mutating the source review', () => {
    const review = makeReview({ linkedTemplateIds: ['template-1'] });
    const merged = mergeLinkedTemplateIds(review, 'template-2');
    const duplicated = mergeLinkedTemplateIds(merged, 'template-2');

    expect(merged).toEqual({
      ...review,
      linkedTemplateIds: ['template-1', 'template-2'],
    });
    expect(duplicated.linkedTemplateIds).toEqual(['template-1', 'template-2']);
    expect(review.linkedTemplateIds).toEqual(['template-1']);
  });
});
```

- [ ] **Step 2: 运行测试确认 RED**

Run:

```bash
cmd.exe /c npm test -- tests/unit/renderer/hot-monitor/templateGovernance.test.ts
```

Expected: FAIL，原因是 `templateGovernance.ts` 尚不存在。

- [ ] **Step 3: 实现模板治理纯函数**

创建 `src/renderer/entries/hot-monitor/templateGovernance.ts`：

```ts
import type { TaskReviewRecord } from '@shared/types';

const TEMPLATE_GOVERNANCE_ACTIONS = new Set([
  'update-template',
  'link-template',
  'template-governance',
  'update-selector',
  'update-parser',
  'add-quality-check',
]);

const ACTIONS_THAT_SHOULD_ADD_TEMPLATE_GOVERNANCE = new Set([
  'update-selector',
  'update-parser',
  'add-quality-check',
]);

export function hasTemplateGovernanceIntent(review: Pick<
  TaskReviewRecord,
  'reasonCategory' | 'conclusion' | 'followUpActions'
>): boolean {
  if (review.followUpActions.some((action) => TEMPLATE_GOVERNANCE_ACTIONS.has(action))) {
    return true;
  }

  const text = [
    review.reasonCategory,
    review.conclusion,
  ].filter(Boolean).join(' ');

  return /selector|选择器|parser|解析|quality|质量|校验|template|模板/i.test(text);
}

export function ensureTemplateGovernanceAction(actions: string[]): string[] {
  const shouldAppend = actions.some((action) =>
    ACTIONS_THAT_SHOULD_ADD_TEMPLATE_GOVERNANCE.has(action),
  );
  if (!shouldAppend || actions.includes('template-governance')) {
    return actions;
  }

  return [...actions, 'template-governance'];
}

export function mergeLinkedTemplateIds(
  review: TaskReviewRecord,
  templateId: string,
): TaskReviewRecord {
  return {
    ...review,
    linkedTemplateIds: Array.from(new Set([...(review.linkedTemplateIds ?? []), templateId])),
  };
}
```

- [ ] **Step 4: 运行模板治理纯函数测试**

Run:

```bash
cmd.exe /c npm test -- tests/unit/renderer/hot-monitor/templateGovernance.test.ts
```

Expected: PASS。

---

### Task 2: 新增 ReviewTemplateGovernancePanel 组件

**Files:**
- Create: `src/renderer/entries/hot-monitor/components/ReviewTemplateGovernancePanel.tsx`
- Create: `tests/unit/components/ReviewTemplateGovernancePanel.test.tsx`

- [ ] **Step 1: 写组件 RED 测试**

创建 `tests/unit/components/ReviewTemplateGovernancePanel.test.tsx`：

```tsx
import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ExtractionTemplate, TaskReviewRecord } from '@shared/types';
import { ReviewTemplateGovernancePanel } from '@renderer/entries/hot-monitor/components/ReviewTemplateGovernancePanel';

const taskOperations = {
  linkReviewTemplate: vi.fn(),
  suggestTemplateBackflow: vi.fn(),
  createTemplateBackflowDraft: vi.fn(),
  applyTemplateBackflowDraft: vi.fn(),
};

function makeReview(overrides: Partial<TaskReviewRecord> = {}): TaskReviewRecord {
  return {
    id: 'review-1',
    taskId: 'task-1',
    batchId: 'batch-1',
    reviewType: 'failure',
    reasonCategory: 'selector_changed',
    conclusion: '价格字段选择器需要改为 .price-current',
    owner: '当前值班员',
    followUpActions: ['update-selector', 'template-governance'],
    linkedTemplateIds: [],
    createdAt: '2026-05-19T02:00:00.000Z',
    ...overrides,
  };
}

const templates: ExtractionTemplate[] = [
  {
    id: 'template-1',
    name: '价格采集模板',
    fields: [{ name: 'price', selector: '.price-old', attribute: 'textContent' }],
    version: 'v1',
    description: '电商价格采集',
    deprecated: false,
    pluginDependencies: [],
    createdAt: '2026-05-18T00:00:00.000Z',
    updatedAt: '2026-05-19T00:00:00.000Z',
  },
];

describe('ReviewTemplateGovernancePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    taskOperations.linkReviewTemplate.mockResolvedValue({ reviewId: 'review-1', templateId: 'template-1' });
    taskOperations.suggestTemplateBackflow.mockResolvedValue({
      reviewId: 'review-1',
      templateId: 'template-1',
      recommended: true,
      reason: '复盘后续动作包含 template-governance，建议将结论回流到模板。',
      followUpActions: ['update-selector', 'template-governance'],
    });
    taskOperations.createTemplateBackflowDraft.mockResolvedValue({
      reviewId: 'review-1',
      templateId: 'template-1',
      title: '回流复盘结论到模板',
      status: 'draft',
      riskLevel: 'medium',
      proposedChanges: [
        { type: 'selector-update', description: '价格字段选择器需要改为 .price-current' },
      ],
      executionSteps: ['更新模板字段或选择器', '关联复盘记录并记录变更原因'],
      acceptanceCriteria: ['模板更新后通过一次任务试运行'],
      sourceConclusion: '价格字段选择器需要改为 .price-current',
      owner: '当前值班员',
    });
    taskOperations.applyTemplateBackflowDraft.mockResolvedValue({
      reviewId: 'review-1',
      templateId: 'template-1',
      appliedBy: '当前值班员',
      appliedAt: '2026-05-19T03:00:00.000Z',
      appliedChanges: ['价格字段选择器需要改为 .price-current'],
    });
  });

  it('links a review to the selected template', async () => {
    const onReviewUpdated = vi.fn();
    render(
      <ReviewTemplateGovernancePanel
        review={makeReview()}
        templates={templates}
        taskOperations={taskOperations}
        onReviewUpdated={onReviewUpdated}
      />,
    );

    fireEvent.mouseDown(screen.getByLabelText('选择回流模板'));
    fireEvent.click(await screen.findByText('价格采集模板'));
    fireEvent.click(screen.getByRole('button', { name: '关联模板' }));

    await waitFor(() => {
      expect(taskOperations.linkReviewTemplate).toHaveBeenCalledWith({
        reviewId: 'review-1',
        templateId: 'template-1',
      });
    });
    expect(onReviewUpdated).toHaveBeenCalledWith(
      expect.objectContaining({ linkedTemplateIds: ['template-1'] }),
    );
  });

  it('shows template backflow suggestion', async () => {
    render(
      <ReviewTemplateGovernancePanel
        review={makeReview()}
        templates={templates}
        taskOperations={taskOperations}
        onReviewUpdated={vi.fn()}
      />,
    );

    fireEvent.mouseDown(screen.getByLabelText('选择回流模板'));
    fireEvent.click(await screen.findByText('价格采集模板'));
    fireEvent.click(screen.getByRole('button', { name: '生成回流建议' }));

    expect(await screen.findByText('建议将结论回流到模板。', { exact: false })).toBeDefined();
    expect(taskOperations.suggestTemplateBackflow).toHaveBeenCalledWith({
      reviewId: 'review-1',
      templateId: 'template-1',
    });
  });

  it('creates and applies template backflow draft', async () => {
    const onReviewUpdated = vi.fn();
    render(
      <ReviewTemplateGovernancePanel
        review={makeReview()}
        templates={templates}
        taskOperations={taskOperations}
        onReviewUpdated={onReviewUpdated}
      />,
    );

    fireEvent.mouseDown(screen.getByLabelText('选择回流模板'));
    fireEvent.click(await screen.findByText('价格采集模板'));
    fireEvent.click(screen.getByRole('button', { name: '生成回流草稿' }));

    expect(await screen.findByText('风险等级：medium')).toBeDefined();
    expect(await screen.findByText('价格字段选择器需要改为 .price-current')).toBeDefined();
    expect(await screen.findByText('更新模板字段或选择器')).toBeDefined();
    expect(await screen.findByText('模板更新后通过一次任务试运行')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: '应用回流草稿' }));

    await waitFor(() => {
      expect(taskOperations.applyTemplateBackflowDraft).toHaveBeenCalledWith({
        draft: expect.objectContaining({
          reviewId: 'review-1',
          templateId: 'template-1',
        }),
        appliedBy: '当前值班员',
      });
    });
    expect(await screen.findByText('回流草稿已应用到模板')).toBeDefined();
    expect(onReviewUpdated).toHaveBeenCalledWith(
      expect.objectContaining({ linkedTemplateIds: ['template-1'] }),
    );
  });

  it('disables governance actions when no template exists', () => {
    render(
      <ReviewTemplateGovernancePanel
        review={makeReview()}
        templates={[]}
        taskOperations={taskOperations}
        onReviewUpdated={vi.fn()}
      />,
    );

    expect(screen.getByText('暂无模板，请先在 Automation 中创建提取模板')).toBeDefined();
    expect(screen.getByRole('button', { name: '关联模板' })).toBeDisabled();
  });
});
```

- [ ] **Step 2: 运行组件测试确认 RED**

Run:

```bash
cmd.exe /c npm test -- tests/unit/components/ReviewTemplateGovernancePanel.test.tsx
```

Expected: FAIL，原因是组件尚不存在。

- [ ] **Step 3: 实现 ReviewTemplateGovernancePanel**

创建 `src/renderer/entries/hot-monitor/components/ReviewTemplateGovernancePanel.tsx`：

```tsx
import { useMemo, useState } from 'react';
import { Alert, Button, Select, Space, Tag, message } from 'antd';
import type {
  ExtractionTemplate,
  TaskReviewRecord,
  TemplateBackflowDraft,
} from '@shared/types';
import { hasTemplateGovernanceIntent, mergeLinkedTemplateIds } from '../templateGovernance';

interface TaskOperationsLike {
  linkReviewTemplate(payload: unknown): Promise<unknown>;
  suggestTemplateBackflow(payload: unknown): Promise<unknown>;
  createTemplateBackflowDraft(payload: unknown): Promise<unknown>;
  applyTemplateBackflowDraft(payload: unknown): Promise<unknown>;
}

interface TemplateBackflowSuggestionView {
  recommended?: boolean;
  reason?: string;
  followUpActions?: string[];
}

export function ReviewTemplateGovernancePanel({
  review,
  templates,
  taskOperations,
  onReviewUpdated,
}: {
  review: TaskReviewRecord;
  templates: ExtractionTemplate[];
  taskOperations: TaskOperationsLike;
  onReviewUpdated: (review: TaskReviewRecord) => void;
}) {
  const [selectedTemplateId, setSelectedTemplateId] = useState(
    review.linkedTemplateIds?.[0] ?? templates[0]?.id ?? '',
  );
  const [suggestion, setSuggestion] = useState<TemplateBackflowSuggestionView | null>(null);
  const [draft, setDraft] = useState<TemplateBackflowDraft | null>(null);
  const [applyMessage, setApplyMessage] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const hasTemplates = templates.length > 0;
  const canOperate = Boolean(review.id && selectedTemplateId && hasTemplates);

  const templateOptions = useMemo(
    () => templates.map((template) => ({
      label: template.name,
      value: template.id,
    })),
    [templates],
  );

  const handleError = (error: unknown, fallback: string) => {
    message.error(error instanceof Error ? error.message : fallback);
  };

  const updateLinkedReview = (templateId: string) => {
    onReviewUpdated(mergeLinkedTemplateIds(review, templateId));
  };

  const linkTemplate = async () => {
    if (!canOperate) {
      return;
    }

    setLoadingAction('link');
    try {
      await taskOperations.linkReviewTemplate({
        reviewId: review.id,
        templateId: selectedTemplateId,
      });
      updateLinkedReview(selectedTemplateId);
      message.success('复盘已关联模板');
    } catch (error) {
      handleError(error, '关联模板失败');
    } finally {
      setLoadingAction(null);
    }
  };

  const suggestBackflow = async () => {
    if (!canOperate) {
      return;
    }

    setLoadingAction('suggest');
    try {
      const result = await taskOperations.suggestTemplateBackflow({
        reviewId: review.id,
        templateId: selectedTemplateId,
      });
      setSuggestion(result as TemplateBackflowSuggestionView);
    } catch (error) {
      handleError(error, '生成回流建议失败');
    } finally {
      setLoadingAction(null);
    }
  };

  const createDraft = async () => {
    if (!canOperate) {
      return;
    }

    setLoadingAction('draft');
    try {
      const result = await taskOperations.createTemplateBackflowDraft({
        reviewId: review.id,
        templateId: selectedTemplateId,
      });
      setDraft(result as TemplateBackflowDraft);
      setApplyMessage(null);
    } catch (error) {
      handleError(error, '生成回流草稿失败');
    } finally {
      setLoadingAction(null);
    }
  };

  const applyDraft = async () => {
    if (!draft) {
      return;
    }

    setLoadingAction('apply');
    try {
      await taskOperations.applyTemplateBackflowDraft({
        draft,
        appliedBy: review.owner ?? '当前值班员',
      });
      updateLinkedReview(draft.templateId);
      setApplyMessage('回流草稿已应用到模板');
      message.success('回流草稿已应用到模板');
    } catch (error) {
      handleError(error, '应用回流草稿失败');
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="hot-monitor-template-governance">
      <div className="browser-workspace-section-title">模板治理</div>
      {hasTemplateGovernanceIntent(review) ? (
        <Tag color="processing">建议回流模板</Tag>
      ) : (
        <Tag>可人工评估</Tag>
      )}
      {review.linkedTemplateIds?.length ? (
        <div className="browser-workspace-action-description">
          已关联模板：{review.linkedTemplateIds.join('、')}
        </div>
      ) : null}
      {!hasTemplates ? (
        <Alert
          type="info"
          showIcon
          message="暂无模板，请先在 Automation 中创建提取模板"
        />
      ) : null}
      <Space wrap>
        <Select
          aria-label="选择回流模板"
          style={{ minWidth: 220 }}
          value={selectedTemplateId || undefined}
          options={templateOptions}
          disabled={!hasTemplates}
          placeholder="选择回流模板"
          onChange={setSelectedTemplateId}
        />
        <Button
          onClick={() => void linkTemplate()}
          disabled={!canOperate}
          loading={loadingAction === 'link'}
        >
          关联模板
        </Button>
        <Button
          onClick={() => void suggestBackflow()}
          disabled={!canOperate}
          loading={loadingAction === 'suggest'}
        >
          生成回流建议
        </Button>
        <Button
          onClick={() => void createDraft()}
          disabled={!canOperate}
          loading={loadingAction === 'draft'}
        >
          生成回流草稿
        </Button>
      </Space>
      {suggestion ? (
        <div className="browser-workspace-action-card">
          <div className="browser-workspace-action-title">
            {suggestion.recommended ? '建议回流' : '谨慎回流'}
          </div>
          <div className="browser-workspace-action-description">
            {suggestion.reason ?? '已生成模板回流建议'}
          </div>
          <div className="browser-workspace-action-description">
            后续动作：{suggestion.followUpActions?.join('、') || '无'}
          </div>
        </div>
      ) : null}
      {draft ? (
        <div className="browser-workspace-action-card">
          <div className="browser-workspace-action-title">{draft.title}</div>
          <div className="browser-workspace-action-description">风险等级：{draft.riskLevel}</div>
          {draft.proposedChanges.map((change) => (
            <div
              key={`${change.type}-${change.description}`}
              className="browser-workspace-action-description"
            >
              {change.description}
            </div>
          ))}
          {draft.executionSteps.map((step) => (
            <div key={step} className="browser-workspace-action-description">{step}</div>
          ))}
          {draft.acceptanceCriteria.map((item) => (
            <div key={item} className="browser-workspace-action-description">{item}</div>
          ))}
          <Button
            type="primary"
            onClick={() => void applyDraft()}
            loading={loadingAction === 'apply'}
          >
            应用回流草稿
          </Button>
        </div>
      ) : null}
      {applyMessage ? <div className="browser-workspace-action-description">{applyMessage}</div> : null}
    </div>
  );
}
```

- [ ] **Step 4: 运行组件测试**

Run:

```bash
cmd.exe /c npm test -- tests/unit/components/ReviewTemplateGovernancePanel.test.tsx
```

Expected: PASS。若 Ant Design `Select` 在测试环境触发方式不稳定，按本仓库现有组件测试方式改为用 `combobox` 查询或直接点击下拉 option。

---

### Task 3: Hot Monitor 运行详情接入模板列表与治理组件

**Files:**
- Modify: `src/renderer/entries/hot-monitor/App.tsx`
- Modify: `tests/unit/components/HotMonitorApp.test.tsx`

- [ ] **Step 1: 扩展 HotMonitorApp mock**

在 `tests/unit/components/HotMonitorApp.test.tsx` 的 hoisted mock 中增加：

```ts
listTemplatesMock: vi.fn(),
linkReviewTemplateMock: vi.fn(),
suggestTemplateBackflowMock: vi.fn(),
createTemplateBackflowDraftMock: vi.fn(),
applyTemplateBackflowDraftMock: vi.fn(),
```

把 `useIpc` mock 扩展为：

```ts
useIpc: () => ({
  invoke: invokeMock,
  automation: {
    listTemplates: listTemplatesMock,
  },
  taskOperations: {
    listReviews: listReviewsMock,
    createReview: createReviewMock,
    linkReviewTemplate: linkReviewTemplateMock,
    suggestTemplateBackflow: suggestTemplateBackflowMock,
    createTemplateBackflowDraft: createTemplateBackflowDraftMock,
    applyTemplateBackflowDraft: applyTemplateBackflowDraftMock,
  },
}),
```

在 `beforeEach` 中设置：

```ts
listTemplatesMock.mockResolvedValue([
  {
    id: 'template-1',
    name: '价格采集模板',
    fields: [{ name: 'price', selector: '.price-old', attribute: 'textContent' }],
    version: 'v1',
    description: '电商价格采集',
    deprecated: false,
    pluginDependencies: [],
    createdAt: '2026-05-18T00:00:00.000Z',
    updatedAt: '2026-05-19T00:00:00.000Z',
  },
]);
linkReviewTemplateMock.mockResolvedValue({ reviewId: 'review-1', templateId: 'template-1' });
suggestTemplateBackflowMock.mockResolvedValue({
  reviewId: 'review-1',
  templateId: 'template-1',
  recommended: true,
  reason: '复盘后续动作包含 template-governance，建议将结论回流到模板。',
  followUpActions: ['update-selector', 'template-governance'],
});
createTemplateBackflowDraftMock.mockResolvedValue({
  reviewId: 'review-1',
  templateId: 'template-1',
  title: '回流复盘结论到模板',
  status: 'draft',
  riskLevel: 'medium',
  proposedChanges: [
    { type: 'selector-update', description: '价格字段选择器需要改为 .price-current' },
  ],
  executionSteps: ['更新模板字段或选择器'],
  acceptanceCriteria: ['模板更新后通过一次任务试运行'],
  sourceConclusion: '价格字段选择器需要改为 .price-current',
  owner: '当前值班员',
});
applyTemplateBackflowDraftMock.mockResolvedValue({
  reviewId: 'review-1',
  templateId: 'template-1',
  appliedBy: '当前值班员',
  appliedAt: '2026-05-19T03:00:00.000Z',
  appliedChanges: ['价格字段选择器需要改为 .price-current'],
});
```

- [ ] **Step 2: 写 Hot Monitor 集成 RED 测试**

新增测试：

```tsx
it('shows template governance actions for failed run reviews', async () => {
  listReviewsMock.mockResolvedValue([
    {
      id: 'review-1',
      taskId: 'task-failed',
      batchId: 'batch-failed',
      reviewType: 'failure',
      reasonCategory: 'selector_changed',
      conclusion: '价格字段选择器需要改为 .price-current',
      owner: '当前值班员',
      followUpActions: ['update-selector', 'template-governance'],
      linkedTemplateIds: [],
      createdAt: '2026-05-19T02:00:00.000Z',
    },
  ]);

  render(<HotMonitorApp />);

  fireEvent.click(await screen.findByRole('button', { name: '查看详情' }));

  expect(await screen.findByText('模板治理')).toBeDefined();
  expect(await screen.findByText('价格采集模板')).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: '生成回流建议' }));

  expect(await screen.findByText('建议将结论回流到模板。', { exact: false })).toBeDefined();
  expect(suggestTemplateBackflowMock).toHaveBeenCalledWith({
    reviewId: 'review-1',
    templateId: 'template-1',
  });
});
```

如果 `Select` 默认只显示 value，需要在组件中默认选中第一项并展示 label，或测试中先打开下拉选择。

- [ ] **Step 3: 运行 Hot Monitor 测试确认 RED**

Run:

```bash
cmd.exe /c npm test -- tests/unit/components/HotMonitorApp.test.tsx
```

Expected: FAIL，原因是 Hot Monitor 还未加载模板列表或未渲染治理组件。

- [ ] **Step 4: 修改 App.tsx 引入类型和组件**

在 `src/renderer/entries/hot-monitor/App.tsx` 中新增类型 import：

```ts
ExtractionTemplate,
```

新增组件 import：

```ts
import { ReviewTemplateGovernancePanel } from './components/ReviewTemplateGovernancePanel';
```

新增纯函数 import：

```ts
import { mergeLinkedTemplateIds } from './templateGovernance';
```

- [ ] **Step 5: 读取 automation 并增加模板状态**

把：

```ts
const { invoke, taskOperations } = useIpc();
```

改为：

```ts
const { invoke, automation, taskOperations } = useIpc();
```

新增状态：

```ts
const [templates, setTemplates] = useState<ExtractionTemplate[]>([]);
const [templateLoadError, setTemplateLoadError] = useState<string | null>(null);
```

- [ ] **Step 6: 增加模板加载函数并在初始化时调用**

在 `HotMonitorApp` 内新增：

```ts
const loadTemplates = useCallback(async () => {
  setTemplateLoadError(null);
  try {
    const data = await automation.listTemplates();
    setTemplates(Array.isArray(data) ? data as ExtractionTemplate[] : []);
  } catch (error) {
    setTemplateLoadError(error instanceof Error ? error.message : '加载模板失败');
  }
}, [automation]);
```

在已有初始化 `useEffect` 中增加：

```ts
void loadTemplates();
```

如果已有 `refreshWorkspace()` 初始化集中加载，也可以在该流程旁单独调用，避免模板加载失败影响热点源、运行和报告加载。

- [ ] **Step 7: 增加更新单条复盘函数**

新增：

```ts
const updateRunReview = (nextReview: TaskReviewRecord) => {
  setRunReviews((current) =>
    current.map((review) => (review.id === nextReview.id ? nextReview : review)),
  );
};
```

或在回调中只合并模板 ID：

```ts
const markReviewTemplateLinked = (reviewId: string, templateId: string) => {
  setRunReviews((current) =>
    current.map((review) => (
      review.id === reviewId ? mergeLinkedTemplateIds(review, templateId) : review
    )),
  );
};
```

如果使用 `updateRunReview`，保留 `mergeLinkedTemplateIds` 在组件中使用即可。

- [ ] **Step 8: 在复盘列表中渲染模板治理组件**

在 `runReviews.map((review) => (...))` 的复盘卡片内追加：

```tsx
{templateLoadError ? (
  <div className="browser-workspace-action-description">{templateLoadError}</div>
) : null}
<ReviewTemplateGovernancePanel
  review={review}
  templates={templates}
  taskOperations={taskOperations}
  onReviewUpdated={updateRunReview}
/>
```

如果 TypeScript 对 `taskOperations` 的结构推断不够精确，可以先定义组件 props 为只要求四个方法的结构，现有对象会结构兼容。

- [ ] **Step 9: 运行 Hot Monitor 组件测试**

Run:

```bash
cmd.exe /c npm test -- tests/unit/components/HotMonitorApp.test.tsx
```

Expected: PASS。

---

### Task 4: 调整新建复盘默认动作以进入模板回流推荐路径

**Files:**
- Modify: `src/renderer/entries/hot-monitor/failureReview.ts`
- Modify: `tests/unit/renderer/hot-monitor/failureReview.test.ts`

- [ ] **Step 1: 更新失败复盘动作 RED 断言**

在 `tests/unit/renderer/hot-monitor/failureReview.test.ts` 中，把选择器失败断言改为：

```ts
expect(buildFailureReviewDraft(makeDetail())).toEqual({
  reasonCategory: 'selector_changed',
  conclusion: '热点采集失败：未找到热点列表。建议检查页面结构或选择器后重新运行。',
  owner: '当前值班员',
  followUpActions: ['update-selector', 'retry-source', 'template-governance'],
});
```

把 parser 失败断言改为：

```ts
expect(
  buildFailureReviewDraft(
    makeDetail({
      error: 'JSON parse failed: field title missing',
      breakpoint: null,
    }),
  ),
).toMatchObject({
  reasonCategory: 'parser_changed',
  followUpActions: ['update-parser', 'add-quality-check', 'template-governance'],
});
```

新增质量问题断言：

```ts
it('adds template governance action for quality failures', () => {
  expect(
    buildFailureReviewDraft(
      makeDetail({
        error: null,
        breakpoint: null,
        resultCount: 0,
        linkedResultIds: [],
        stepResults: [],
      }),
    ).followUpActions,
  ).toEqual(['add-quality-check', 'monitor-next-run', 'template-governance']);
});
```

- [ ] **Step 2: 运行测试确认 RED**

Run:

```bash
cmd.exe /c npm test -- tests/unit/renderer/hot-monitor/failureReview.test.ts
```

Expected: FAIL，原因是默认动作尚未追加 `template-governance`。

- [ ] **Step 3: 修改 failureReview.ts**

在 `src/renderer/entries/hot-monitor/failureReview.ts` 中引入：

```ts
import { ensureTemplateGovernanceAction } from './templateGovernance';
```

把 `buildFollowUpActions` 中对应分支改为：

```ts
if (reasonCategory === 'selector_changed') {
  return ensureTemplateGovernanceAction(['update-selector', 'retry-source']);
}

if (reasonCategory === 'parser_changed') {
  return ensureTemplateGovernanceAction(['update-parser', 'add-quality-check']);
}

if (reasonCategory === 'quality_issue') {
  return ensureTemplateGovernanceAction(['add-quality-check', 'monitor-next-run']);
}
```

登录态和网络频控分支保持不追加模板治理：

```ts
if (reasonCategory === 'login_required') {
  return ['refresh-session', 'retry-source'];
}

if (reasonCategory === 'network_or_rate_limit') {
  return ['retry-source', 'monitor-next-run'];
}
```

- [ ] **Step 4: 运行失败复盘和模板治理测试**

Run:

```bash
cmd.exe /c npm test -- tests/unit/renderer/hot-monitor/failureReview.test.ts tests/unit/renderer/hot-monitor/templateGovernance.test.ts
```

Expected: PASS。

---

### Task 5: 更新当前状态并跑 Phase 6 聚焦验证

**Files:**
- Modify: `docs/overview/current-status.md`

- [ ] **Step 1: 更新当前状态文档**

在 `docs/overview/current-status.md` 的热点监控当前状态中，把 Phase 5 说明后追加：

```md
Phase 6 已把失败复盘接入模板治理回流，复盘记录可关联已有提取模板，并可生成回流建议、回流草稿和应用到模板治理主线。
```

在运营闭环或相关段落追加：

```md
热点失败复盘已从“记录原因”推进到“回流模板”，为后续质量规则生成、AI 修复建议和自动验证重跑提供统一资产基础。
```

- [ ] **Step 2: 运行 Phase 6 聚焦测试**

Run:

```bash
cmd.exe /c npm test -- tests/unit/renderer/hot-monitor/templateGovernance.test.ts tests/unit/components/ReviewTemplateGovernancePanel.test.tsx
```

Expected: PASS。

- [ ] **Step 3: 运行 Hot Monitor 回归测试**

Run:

```bash
cmd.exe /c npm test -- tests/unit/renderer/hot-monitor/failureReview.test.ts tests/unit/components/HotMonitorApp.test.tsx
```

Expected: PASS。

- [ ] **Step 4: 运行 Review / Template 服务回归**

Run:

```bash
cmd.exe /c npm test -- tests/unit/services/ReviewService.test.ts tests/unit/services/TemplateService.test.ts tests/unit/components/ReviewPanel.test.tsx
```

Expected: PASS。

- [ ] **Step 5: 运行 Phase 4 / Phase 2 回归**

Run:

```bash
cmd.exe /c npm test -- tests/unit/renderer/browser/routeContext.test.ts tests/unit/components/BrowserApp.test.tsx tests/unit/components/InterventionPanel.test.tsx tests/unit/renderer/data-center/App.test.tsx tests/unit/renderer/data-center/routeContext.test.ts tests/unit/services/HotRunProjectionService.test.ts
```

Expected: PASS。

- [ ] **Step 6: 运行类型检查**

Run:

```bash
cmd.exe /c npm run typecheck
```

Expected: PASS。

- [ ] **Step 7: 运行 lint**

Run:

```bash
cmd.exe /c npm run lint
```

Expected: exit 0。仓库既有 warning 可以保留，本次修改不应新增 error。

- [ ] **Step 8: 检查空白和工作区状态**

Run:

```bash
git diff --check
git status --short --branch
```

Expected: `git diff --check` 无输出；工作区显示 Phase 1-6 的未提交改动。不要提交。

---

## 自查

| 检查项 | 结果 |
| --- | --- |
| 规格覆盖 | 覆盖模板选择、关联、建议、草稿、应用、错误处理和回归验证 |
| 范围控制 | 不新增数据库、不新增 IPC、不接 AI、不做质量规则生成 |
| TDD 顺序 | 纯函数、组件、App 集成、默认动作调整均先写测试 |
| 类型一致性 | 复用 `TaskReviewRecord`、`ExtractionTemplate`、`TemplateBackflowDraft` |
| 组件边界 | 模板治理面板独立，避免继续扩大 `HotMonitorApp` |
| 提交策略 | 明确不 commit，等待用户明确授权 |
