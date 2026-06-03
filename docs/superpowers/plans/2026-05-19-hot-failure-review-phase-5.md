# Hot Monitor 失败复盘闭环 Phase 5 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **本仓库额外约束：** 未经用户明确允许，不允许提交 commit。本计划中的所有实现、测试、文档更新都只保留在工作区，完成后汇报变更和验证结果。

**Goal:** 让 Hot Monitor 失败运行可以在运行详情中完成失败诊断、复盘创建、复盘列表查看和同源重跑，复盘记录写入现有 `ReviewService` 主线。

**Architecture:** 不新增数据库、不新增 IPC、不接 AI。Hot Monitor 运行详情复用 `useIpc().taskOperations.listReviews/createReview` 读取和创建 `TaskReviewRecord`；失败诊断由前端纯函数从 `HotRunDetail` 推导；重跑继续复用现有 `startRun(sourceId)`。

**Tech Stack:** React 18、TypeScript、Ant Design、Vitest、Testing Library、现有 `useIpc`、`taskOperations` API、`ReviewService` / `ReviewRepository`。

---

## 文件结构

| 文件 | 职责 |
| --- | --- |
| `src/renderer/entries/hot-monitor/failureReview.ts` | 新增失败复盘推导函数：原因分类、结论草稿、建议后续动作、统计摘要 |
| `tests/unit/renderer/hot-monitor/failureReview.test.ts` | 覆盖失败诊断规则，不依赖 React |
| `src/renderer/entries/hot-monitor/App.tsx` | 运行详情中加载复盘、展示复盘表单、创建复盘、展示复盘列表、触发重跑 |
| `tests/unit/components/HotMonitorApp.test.tsx` | 覆盖失败复盘 UI、IPC 调用、成功运行不展示、缺上下文禁用 |
| `docs/overview/current-status.md` | Phase 5 完成后回写当前状态 |

---

## 现有上下文

| 现有项目 | 当前行为 |
| --- | --- |
| `HotRunDetail` | 已包含 `taskId / sourceId / sourceName / batchId / status / error / breakpoint / stepResults / linkedResultIds` |
| `HotRunDetailView` | 已展示失败定位、断点错误、错误摘要、步骤结果和关联结果 |
| `useIpc().taskOperations` | 已封装 `listReviews(taskId, batchId)` 和 `createReview(payload)` |
| `TaskReviewRecord` | 已支持 `taskId / batchId / reviewType / reasonCategory / conclusion / owner / followUpActions / createdAt` |
| `ReviewService` | 已能创建和查询复盘记录 |
| `HotMonitorApp.startRun` | 已能按 `sourceId` 启动热点采集，可作为复盘后重跑入口 |

---

### Task 1: 新增失败复盘推导函数

**Files:**
- Create: `src/renderer/entries/hot-monitor/failureReview.ts`
- Create: `tests/unit/renderer/hot-monitor/failureReview.test.ts`

- [ ] **Step 1: 写失败诊断 RED 测试**

创建 `tests/unit/renderer/hot-monitor/failureReview.test.ts`：

```ts
import { describe, expect, it } from 'vitest';
import type { HotRunDetail } from '@shared/types';
import {
  buildFailureReviewDraft,
  summarizeFailureEvidence,
} from '@renderer/entries/hot-monitor/failureReview';

function makeDetail(overrides: Partial<HotRunDetail> = {}): HotRunDetail {
  return {
    batchId: 'batch-failed',
    sourceId: 'source-failed',
    sourceName: '失败任务',
    taskId: 'task-failed',
    status: 'failed',
    startedAt: '2026-05-19T01:00:00.000Z',
    finishedAt: '2026-05-19T01:01:00.000Z',
    resultCount: 0,
    reportStatus: 'pending',
    error: '未找到热点列表 selector timeout',
    breakpoint: {
      stepIndex: 1,
      error: '未找到热点列表',
    },
    stepResults: [
      {
        stepId: 'open',
        success: true,
        duration: 100,
      },
      {
        stepId: 'extract',
        success: false,
        error: 'selector timeout',
        duration: 3000,
      },
    ],
    linkedResultIds: [],
    ...overrides,
  };
}

describe('failureReview', () => {
  it('summarizes failure evidence from hot run detail', () => {
    expect(summarizeFailureEvidence(makeDetail())).toEqual({
      failedStepCount: 1,
      totalStepCount: 2,
      linkedResultCount: 0,
      breakpointLabel: '第 2 步',
      primaryError: '未找到热点列表',
    });
  });

  it('builds selector failure review draft', () => {
    expect(buildFailureReviewDraft(makeDetail())).toEqual({
      reasonCategory: 'selector_changed',
      conclusion: '热点采集失败：未找到热点列表。建议检查页面结构或选择器后重新运行。',
      owner: '当前值班员',
      followUpActions: ['update-selector', 'retry-source'],
    });
  });

  it('detects login or permission failures', () => {
    expect(
      buildFailureReviewDraft(
        makeDetail({
          error: 'HTTP 403 login required',
          breakpoint: { stepIndex: 0, error: 'login required' },
        }),
      ).reasonCategory,
    ).toBe('login_required');
  });

  it('detects parser structure failures', () => {
    expect(
      buildFailureReviewDraft(
        makeDetail({
          error: 'JSON parse failed: field title missing',
          breakpoint: null,
        }),
      ),
    ).toMatchObject({
      reasonCategory: 'parser_changed',
      followUpActions: ['update-parser', 'add-quality-check'],
    });
  });
});
```

- [ ] **Step 2: 运行测试确认 RED**

Run:

```bash
cmd.exe /c npm test -- tests/unit/renderer/hot-monitor/failureReview.test.ts
```

Expected: FAIL，原因是 `failureReview.ts` 尚不存在。

- [ ] **Step 3: 实现失败复盘推导函数**

创建 `src/renderer/entries/hot-monitor/failureReview.ts`：

```ts
import type { HotRunDetail } from '@shared/types';

export type HotFailureReasonCategory =
  | 'selector_changed'
  | 'login_required'
  | 'network_or_rate_limit'
  | 'parser_changed'
  | 'quality_issue'
  | 'unknown';

export interface HotFailureEvidenceSummary {
  failedStepCount: number;
  totalStepCount: number;
  linkedResultCount: number;
  breakpointLabel: string;
  primaryError: string;
}

export interface HotFailureReviewDraft {
  reasonCategory: HotFailureReasonCategory;
  conclusion: string;
  owner: string;
  followUpActions: string[];
}

export function summarizeFailureEvidence(detail: HotRunDetail): HotFailureEvidenceSummary {
  const failedStepCount = detail.stepResults.filter((step) => !step.success).length;
  const primaryError = detail.breakpoint?.error ?? detail.error ?? '未知错误';

  return {
    failedStepCount,
    totalStepCount: detail.stepResults.length,
    linkedResultCount: detail.linkedResultIds.length,
    breakpointLabel: detail.breakpoint ? `第 ${detail.breakpoint.stepIndex + 1} 步` : '无',
    primaryError,
  };
}

export function buildFailureReviewDraft(detail: HotRunDetail): HotFailureReviewDraft {
  const evidence = summarizeFailureEvidence(detail);
  const reasonCategory = inferFailureReasonCategory(detail);
  return {
    reasonCategory,
    conclusion: buildConclusion(reasonCategory, evidence.primaryError),
    owner: '当前值班员',
    followUpActions: buildFollowUpActions(reasonCategory),
  };
}

export function inferFailureReasonCategory(detail: HotRunDetail): HotFailureReasonCategory {
  const text = [
    detail.error,
    detail.breakpoint?.error,
    ...detail.stepResults.map((step) => step.error),
  ].filter(Boolean).join(' ').toLowerCase();

  if (/login|登录|403|401|unauthorized/.test(text)) {
    return 'login_required';
  }

  if (/parse|json|field|字段|结构/.test(text)) {
    return 'parser_changed';
  }

  if (/rate|429|network|网络|timeout|超时/.test(text) && !/selector|选择器|未找到/.test(text)) {
    return 'network_or_rate_limit';
  }

  if (/selector|选择器|未找到|定位/.test(text)) {
    return 'selector_changed';
  }

  if (detail.resultCount === 0 || detail.linkedResultIds.length === 0) {
    return 'quality_issue';
  }

  return 'unknown';
}

function buildConclusion(
  reasonCategory: HotFailureReasonCategory,
  primaryError: string,
): string {
  const suffixByReason: Record<HotFailureReasonCategory, string> = {
    selector_changed: '建议检查页面结构或选择器后重新运行。',
    login_required: '建议刷新登录态或会话后重新运行。',
    network_or_rate_limit: '建议确认网络、频控或稍后重试。',
    parser_changed: '建议更新解析规则并补充质量校验。',
    quality_issue: '建议检查结果数量和质量规则。',
    unknown: '建议补充人工判断后再决定后续动作。',
  };

  return `热点采集失败：${primaryError}。${suffixByReason[reasonCategory]}`;
}

function buildFollowUpActions(reasonCategory: HotFailureReasonCategory): string[] {
  if (reasonCategory === 'selector_changed') {
    return ['update-selector', 'retry-source'];
  }

  if (reasonCategory === 'login_required') {
    return ['refresh-session', 'retry-source'];
  }

  if (reasonCategory === 'parser_changed') {
    return ['update-parser', 'add-quality-check'];
  }

  if (reasonCategory === 'quality_issue') {
    return ['add-quality-check', 'monitor-next-run'];
  }

  if (reasonCategory === 'network_or_rate_limit') {
    return ['retry-source', 'monitor-next-run'];
  }

  return ['monitor-next-run'];
}
```

- [ ] **Step 4: 运行失败复盘推导测试**

Run:

```bash
cmd.exe /c npm test -- tests/unit/renderer/hot-monitor/failureReview.test.ts
```

Expected: PASS。

---

### Task 2: Hot Monitor 运行详情加载当前批次复盘

**Files:**
- Modify: `src/renderer/entries/hot-monitor/App.tsx`
- Modify: `tests/unit/components/HotMonitorApp.test.tsx`

- [ ] **Step 1: 扩展 HotMonitorApp 测试 mock**

在 `tests/unit/components/HotMonitorApp.test.tsx` 的 hoisted mock 中加入：

```ts
const { invokeMock, messageErrorMock, messageSuccessMock, navigateMock, listReviewsMock, createReviewMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  messageErrorMock: vi.fn(),
  messageSuccessMock: vi.fn(),
  navigateMock: vi.fn(),
  listReviewsMock: vi.fn(),
  createReviewMock: vi.fn(),
}));
```

把 `useIpc` mock 改为同时返回 `taskOperations`：

```ts
vi.mock('@renderer/shared/hooks', () => ({
  useIpc: () => ({
    invoke: invokeMock,
    taskOperations: {
      listReviews: listReviewsMock,
      createReview: createReviewMock,
    },
  }),
}));
```

在 `beforeEach` 中设置默认复盘返回：

```ts
listReviewsMock.mockResolvedValue([]);
createReviewMock.mockResolvedValue({
  id: 'review-created',
  taskId: 'task-failed',
  batchId: 'batch-failed',
  reviewType: 'failure',
  reasonCategory: 'selector_changed',
  conclusion: '已更新选择器并重新运行',
  owner: '当前值班员',
  followUpActions: ['update-selector', 'retry-source'],
  createdAt: '2026-05-19T02:00:00.000Z',
});
```

- [ ] **Step 2: 写加载复盘列表 RED 测试**

新增测试：

```tsx
it('loads existing reviews for failed hot run detail', async () => {
  listReviewsMock.mockResolvedValue([
    {
      id: 'review-1',
      taskId: 'task-failed',
      batchId: 'batch-failed',
      reviewType: 'failure',
      reasonCategory: 'selector_changed',
      conclusion: '已确认页面结构变化',
      owner: '当前值班员',
      followUpActions: ['update-selector'],
      createdAt: '2026-05-19T01:30:00.000Z',
    },
  ]);

  render(<HotMonitorApp />);

  fireEvent.click(await screen.findByRole('button', { name: '查看详情' }));

  expect(await screen.findByRole('dialog', { name: '运行详情' })).toBeDefined();
  expect(await screen.findByText('失败复盘')).toBeDefined();
  expect(await screen.findByText('已确认页面结构变化')).toBeDefined();
  expect(listReviewsMock).toHaveBeenCalledWith('task-failed', 'batch-failed');
});
```

如果测试数据默认 `HOT_RUN_LIST` 是成功运行，需要在本测试中用 `invokeMock.mockImplementation` 覆盖为失败运行，并确保 `HOT_RUN_DETAIL` 返回 `task-failed/batch-failed/source-failed`。

- [ ] **Step 3: 运行 Hot Monitor 测试确认 RED**

Run:

```bash
cmd.exe /c npm test -- tests/unit/components/HotMonitorApp.test.tsx
```

Expected: FAIL，原因是运行详情还没有加载复盘列表。

- [ ] **Step 4: 在 HotMonitorApp 引入 taskOperations 和复盘状态**

在 `src/renderer/entries/hot-monitor/App.tsx` 中调整：

```ts
import type {
  HotReportSummary,
  HotRunDetail,
  HotRunSummary,
  HotSource,
  HotSourceDraft,
  HotTimelinePresetOption,
  TaskReviewRecord,
} from '@shared/types';
import { buildFailureReviewDraft, summarizeFailureEvidence } from './failureReview';
```

把：

```ts
const { invoke } = useIpc();
```

改为：

```ts
const { invoke, taskOperations } = useIpc();
```

新增状态：

```ts
const [runReviews, setRunReviews] = useState<TaskReviewRecord[]>([]);
const [reviewLoadError, setReviewLoadError] = useState<string | null>(null);
```

- [ ] **Step 5: 在 viewRunDetail 中加载复盘**

把 `viewRunDetail` 中 `setRunDetail(detail)` 后追加：

```ts
setRunReviews([]);
setReviewLoadError(null);
if (detail.taskId && detail.batchId) {
  try {
    const reviews = await taskOperations.listReviews(detail.taskId, detail.batchId);
    setRunReviews(Array.isArray(reviews) ? reviews as TaskReviewRecord[] : []);
  } catch (reviewError) {
    setReviewLoadError(reviewError instanceof Error ? reviewError.message : '加载复盘失败');
  }
}
```

保留外层 `try/catch` 对 `HOT_RUN_DETAIL` 的错误处理。复盘加载失败不应该阻断运行详情展示。

- [ ] **Step 6: 在 Modal 中展示复盘列表占位**

在 `HotRunDetailView` 后、操作按钮前加入：

```tsx
{shouldShowFailureReview(runDetail) ? (
  <section className="browser-review-queue-card">
    <div className="browser-workspace-section-title">失败复盘</div>
    {reviewLoadError ? (
      <div className="browser-workspace-action-description">{reviewLoadError}</div>
    ) : null}
    {runReviews.length === 0 ? (
      <div className="browser-workspace-action-description">当前批次暂无复盘记录</div>
    ) : null}
    {runReviews.map((review) => (
      <div key={review.id} className="browser-workspace-action-card">
        <div className="browser-workspace-action-title">{review.conclusion ?? '未填写结论'}</div>
        <div className="browser-workspace-action-description">
          原因：{review.reasonCategory ?? '未分类'}
        </div>
        <div className="browser-workspace-action-description">
          负责人：{review.owner ?? '未指定'}
        </div>
      </div>
    ))}
  </section>
) : null}
```

新增判断函数：

```ts
function shouldShowFailureReview(detail: HotRunDetail): boolean {
  return detail.status === 'failed' || Boolean(detail.error) || Boolean(detail.breakpoint);
}
```

- [ ] **Step 7: 运行 Hot Monitor 测试**

Run:

```bash
cmd.exe /c npm test -- tests/unit/components/HotMonitorApp.test.tsx
```

Expected: PASS，或只剩后续表单相关 RED 测试未写导致的失败。

---

### Task 3: 增加失败复盘表单和创建逻辑

**Files:**
- Modify: `src/renderer/entries/hot-monitor/App.tsx`
- Modify: `tests/unit/components/HotMonitorApp.test.tsx`

- [ ] **Step 1: 写创建复盘 RED 测试**

新增测试：

```tsx
it('creates a failure review for the selected failed hot run', async () => {
  render(<HotMonitorApp />);

  fireEvent.click(await screen.findByRole('button', { name: '查看详情' }));

  expect(await screen.findByText('失败复盘')).toBeDefined();
  fireEvent.change(screen.getByLabelText('处理结论'), {
    target: { value: '已更新选择器并准备重新运行' },
  });
  fireEvent.click(screen.getByRole('button', { name: '创建复盘' }));

  await waitFor(() => {
    expect(createReviewMock).toHaveBeenCalledWith({
      taskId: 'task-failed',
      batchId: 'batch-failed',
      reviewType: 'failure',
      reasonCategory: 'selector_changed',
      conclusion: '已更新选择器并准备重新运行',
      owner: '当前值班员',
      followUpActions: ['update-selector', 'retry-source'],
    });
  });
  expect(await screen.findByText('已更新选择器并重新运行')).toBeDefined();
  expect(messageSuccessMock).toHaveBeenCalledWith('复盘记录已创建');
});
```

- [ ] **Step 2: 运行测试确认 RED**

Run:

```bash
cmd.exe /c npm test -- tests/unit/components/HotMonitorApp.test.tsx
```

Expected: FAIL，原因是没有表单和创建逻辑。

- [ ] **Step 3: 增加复盘表单状态**

在 `HotMonitorApp` 中新增状态：

```ts
const [reviewDraft, setReviewDraft] = useState({
  reasonCategory: 'unknown',
  conclusion: '',
  owner: '当前值班员',
  followUpActions: [] as string[],
});
```

在 `viewRunDetail` 获取 detail 后初始化草稿：

```ts
const nextDraft = buildFailureReviewDraft(detail);
setReviewDraft(nextDraft);
```

- [ ] **Step 4: 实现创建复盘函数**

新增函数：

```ts
const createFailureReview = async () => {
  if (!runDetail?.taskId || !runDetail.batchId) {
    message.error('缺少 Task 或 Batch 上下文，无法创建复盘');
    return;
  }

  const conclusion = reviewDraft.conclusion.trim();
  if (!conclusion) {
    message.error('请填写处理结论');
    return;
  }

  try {
    const created = await taskOperations.createReview({
      taskId: runDetail.taskId,
      batchId: runDetail.batchId,
      reviewType: 'failure',
      reasonCategory: reviewDraft.reasonCategory,
      conclusion,
      owner: reviewDraft.owner.trim() || '当前值班员',
      followUpActions: reviewDraft.followUpActions,
    });
    setRunReviews((current) => [created as TaskReviewRecord, ...current]);
    message.success('复盘记录已创建');
  } catch (error) {
    reportError(error, '创建复盘失败');
  }
};
```

- [ ] **Step 5: 渲染最小复盘表单**

在“失败复盘”区域中、复盘列表前加入：

```tsx
<div className="hot-monitor-review-form">
  <div className="browser-workspace-action-description">
    诊断：{summarizeFailureEvidence(runDetail).primaryError}
  </div>
  <label className="hot-monitor-config-field">
    <span>原因分类</span>
    <Input
      aria-label="原因分类"
      className="browser-workspace-input"
      value={reviewDraft.reasonCategory}
      onChange={(event) =>
        setReviewDraft((current) => ({ ...current, reasonCategory: event.target.value }))
      }
    />
  </label>
  <label className="hot-monitor-config-field">
    <span>处理结论</span>
    <Input.TextArea
      aria-label="处理结论"
      className="browser-workspace-input"
      value={reviewDraft.conclusion}
      onChange={(event) =>
        setReviewDraft((current) => ({ ...current, conclusion: event.target.value }))
      }
    />
  </label>
  <label className="hot-monitor-config-field">
    <span>负责人</span>
    <Input
      aria-label="负责人"
      className="browser-workspace-input"
      value={reviewDraft.owner}
      onChange={(event) =>
        setReviewDraft((current) => ({ ...current, owner: event.target.value }))
      }
    />
  </label>
  <div className="browser-workspace-action-description">
    后续动作：{reviewDraft.followUpActions.join('、') || '无'}
  </div>
  <Button onClick={createFailureReview} disabled={!reviewDraft.conclusion.trim()}>
    创建复盘
  </Button>
</div>
```

本阶段先用现有 Ant Design `Input` / `TextArea` 控制范围。若后续要做更完整表单，可再换成 `ProForm`。

- [ ] **Step 6: 运行 Hot Monitor 测试**

Run:

```bash
cmd.exe /c npm test -- tests/unit/components/HotMonitorApp.test.tsx
```

Expected: PASS。

---

### Task 4: 增加复盘后重跑入口和成功运行保护

**Files:**
- Modify: `src/renderer/entries/hot-monitor/App.tsx`
- Modify: `tests/unit/components/HotMonitorApp.test.tsx`

- [ ] **Step 1: 写复盘区域重跑 RED 测试**

新增测试：

```tsx
it('reruns the current source from the failure review section', async () => {
  render(<HotMonitorApp />);

  fireEvent.click(await screen.findByRole('button', { name: '查看详情' }));
  expect(await screen.findByText('失败复盘')).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: '重新运行当前采集源' }));

  await waitFor(() => {
    expect(invokeMock).toHaveBeenCalledWith(IPC_CHANNELS.HOT_RUN_START, {
      sourceId: 'source-failed',
    });
  });
});
```

- [ ] **Step 2: 写成功运行不展示复盘 RED 测试**

新增测试：

```tsx
it('does not show failure review section for successful hot runs', async () => {
  render(<HotMonitorApp />);

  fireEvent.click(await screen.findByRole('button', { name: '查看运行' }));

  expect(await screen.findByRole('dialog', { name: '运行详情' })).toBeDefined();
  expect(screen.getByText('状态：success')).toBeDefined();
  expect(screen.queryByText('失败复盘')).toBeNull();
  expect(listReviewsMock).not.toHaveBeenCalledWith('task-1', 'batch-1');
});
```

如果成功运行详情只能从报告预览进入，则按现有报告预览测试路径点击“查看运行详情”。

- [ ] **Step 3: 增加复盘区域重跑按钮**

在失败复盘区域的按钮组中加入：

```tsx
<Button onClick={() => void startRun(runDetail.sourceId)}>
  重新运行当前采集源
</Button>
```

该按钮只依赖 `runDetail.sourceId`，不新增 `BATCH_RETRY` 或其他 IPC。

- [ ] **Step 4: 确认成功运行保护**

确保以下逻辑成立：

```ts
if (shouldShowFailureReview(detail) && detail.taskId && detail.batchId) {
  const reviews = await taskOperations.listReviews(detail.taskId, detail.batchId);
  setRunReviews(Array.isArray(reviews) ? reviews as TaskReviewRecord[] : []);
}
```

成功运行不加载复盘列表、不展示复盘表单。

- [ ] **Step 5: 运行 Hot Monitor 测试**

Run:

```bash
cmd.exe /c npm test -- tests/unit/components/HotMonitorApp.test.tsx
```

Expected: PASS。

---

### Task 5: 更新当前状态文档并跑聚焦验证

**Files:**
- Modify: `docs/overview/current-status.md`

- [ ] **Step 1: 更新当前状态文档**

在 Hot Monitor 当前状态说明中追加：

```md
失败运行详情已接入复盘闭环，可读取当前 Task / Batch 的历史复盘，并创建真实 `TaskReviewRecord` 记录，沉淀失败原因、处理结论和后续动作。
```

在自动化运营闭环说明中追加：

```md
热点失败复盘开始复用统一 Review 主线，为后续 AI 复盘初稿、模板回流和规则治理提供数据基础。
```

- [ ] **Step 2: 运行 Phase 5 聚焦测试**

Run:

```bash
cmd.exe /c npm test -- tests/unit/renderer/hot-monitor/failureReview.test.ts tests/unit/components/HotMonitorApp.test.tsx
```

Expected: PASS。

- [ ] **Step 3: 运行 Phase 4 回归测试**

Run:

```bash
cmd.exe /c npm test -- tests/unit/renderer/browser/routeContext.test.ts tests/unit/components/BrowserApp.test.tsx tests/unit/components/InterventionPanel.test.tsx
```

Expected: PASS。

- [ ] **Step 4: 运行 Data Center / Hot 上下文回归测试**

Run:

```bash
cmd.exe /c npm test -- tests/unit/renderer/data-center/App.test.tsx tests/unit/renderer/data-center/routeContext.test.ts tests/unit/services/HotRunProjectionService.test.ts
```

Expected: PASS。

- [ ] **Step 5: 运行类型检查**

Run:

```bash
cmd.exe /c npm run typecheck
```

Expected: PASS。

- [ ] **Step 6: 运行 lint**

Run:

```bash
cmd.exe /c npm run lint
```

Expected: exit 0。仓库既有 warning 可以保留，本次修改不应新增 error。

- [ ] **Step 7: 检查空白和工作区状态**

Run:

```bash
git diff --check
git status --short --branch
```

Expected: `git diff --check` 无输出；工作区显示 Phase 1-5 的未提交改动。不要提交。

---

## 自查

| 检查项 | 结果 |
| --- | --- |
| 规格覆盖 | 覆盖失败诊断、复盘列表、复盘创建、复盘后重跑、成功运行保护 |
| 范围控制 | 不新增数据库、不新增 IPC、不接 AI、不做模板回流 |
| TDD 顺序 | 纯函数、运行详情加载、创建复盘、重跑入口都先写测试 |
| 类型一致性 | 复用 `HotRunDetail`、`TaskReviewRecord`、`CreateTaskReviewInput` 的现有字段 |
| 提交策略 | 明确不 commit，等待用户明确授权 |
