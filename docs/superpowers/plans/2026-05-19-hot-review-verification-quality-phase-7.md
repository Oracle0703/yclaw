# Hot Monitor 回流验证与质量扫描 Phase 7 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **本仓库额外约束：** 未经用户明确允许，不允许提交 commit。本计划中的所有实现、测试、文档更新都只保留在工作区，完成后汇报变更和验证结果。

**Goal:** 让 Hot Monitor 失败复盘在模板回流后可以发起验证重跑，并对新批次自动执行 Data Center 质量扫描，形成“复盘 -> 回流 -> 验证”的最小闭环。

**Architecture:** 不新增数据库、不新增 IPC、不接 AI。Hot Monitor 复用现有 `HOT_RUN_START/HOT_RUN_LIST/HOT_REPORT_GENERATE` 启动并等待新批次，复用 `dataCenter.scanQuality()` 对新批次做质量扫描；验证状态留在渲染端组件状态中，批次、报告和质量洞察继续由既有服务持久化。

**Tech Stack:** React 18、TypeScript、Ant Design、Vitest、Testing Library、现有 `useIpc`、Hot Monitor IPC、Data Center IPC API、`DataQualityScanResult`。

---

## 文件结构

| 文件 | 职责 |
| --- | --- |
| `src/renderer/entries/hot-monitor/verification.ts` | 新增验证重跑纯函数：构造质量扫描 payload、格式化质量等级、提取质量摘要 |
| `tests/unit/renderer/hot-monitor/verification.test.ts` | 覆盖验证重跑纯函数 |
| `src/renderer/entries/hot-monitor/components/ReviewVerificationPanel.tsx` | 新增单条复盘的验证重跑面板 |
| `tests/unit/components/ReviewVerificationPanel.test.tsx` | 覆盖验证面板展示、按钮回调、结果中心跳转 |
| `src/renderer/entries/hot-monitor/App.tsx` | 接入 `dataCenter`，抽出可返回结果的运行 helper，执行验证重跑和质量扫描 |
| `tests/unit/components/HotMonitorApp.test.tsx` | 覆盖验证重跑成功扫描新批次、重跑失败不扫描、忽略旧失败批次 |
| `docs/overview/current-status.md` | Phase 7 完成后回写状态 |

---

## 现有上下文

| 现有项目 | 当前行为 |
| --- | --- |
| `startRun(sourceId)` | 会启动热点运行、等待完成、成功后生成报告，但不向调用方返回 `completedRun` |
| `waitForRunCompletion(sourceId)` | 当前取运行列表第一条终态运行，尚不能忽略当前失败批次 |
| `ReviewTemplateGovernancePanel` | 单条复盘可关联模板、生成回流建议、生成草稿、应用草稿 |
| `QualityRulePanel` | 已能用 `scanQuality({ query: { taskId, batchId }, limit: 200 })` 扫描当前批次 |
| `createDataCenterApi` | 已封装 `scanQuality`、`getBatchQualityScore`、`getBatchQualityInsight` |
| `DataQualityScanResult` | 已包含 `batchScore`、`batchInsight`、`rules`、`issues`、`issueCount` |

---

### Task 1: 新增验证质量纯函数

**Files:**
- Create: `src/renderer/entries/hot-monitor/verification.ts`
- Create: `tests/unit/renderer/hot-monitor/verification.test.ts`

- [ ] **Step 1: 写验证质量 RED 测试**

创建 `tests/unit/renderer/hot-monitor/verification.test.ts`：

```ts
import { describe, expect, it } from 'vitest';
import type { DataQualityScanResult } from '@shared/types';
import {
  buildVerificationQualityScanInput,
  formatQualityGrade,
  summarizeVerificationQuality,
} from '@renderer/entries/hot-monitor/verification';

describe('hot monitor verification helpers', () => {
  it('builds a quality scan input for the new hot batch', () => {
    expect(buildVerificationQualityScanInput('task-1', 'batch-new')).toEqual({
      query: {
        taskId: 'task-1',
        batchId: 'batch-new',
      },
      limit: 200,
    });
  });

  it('formats quality grades for Chinese UI', () => {
    expect(formatQualityGrade('excellent')).toBe('优秀');
    expect(formatQualityGrade('good')).toBe('良好');
    expect(formatQualityGrade('watch')).toBe('关注');
    expect(formatQualityGrade('poor')).toBe('较差');
    expect(formatQualityGrade(undefined)).toBe('-');
  });

  it('summarizes quality score and top rules from batch insight first', () => {
    const scan: DataQualityScanResult = {
      scannedAt: '2026-05-19T04:00:00.000Z',
      totalResults: 12,
      issueCount: 3,
      affectedResults: 2,
      rules: [
        {
          ruleId: 'failed-result',
          name: '失败结果',
          severity: 'error',
          hitCount: 1,
          sampleResultIds: ['result-1'],
        },
      ],
      issues: [],
      batchScore: {
        batchId: 'batch-new',
        score: 86,
        grade: 'good',
      },
      batchInsight: {
        id: 'insight-1',
        batchId: 'batch-new',
        taskId: 'task-1',
        score: 86,
        grade: 'good',
        totalResults: 12,
        issueCount: 3,
        affectedResults: 2,
        failedRate: 0.08,
        suspiciousRate: 0.16,
        duplicateRate: 0,
        topRules: [
          { ruleId: 'empty-data', count: 2 },
          { ruleId: 'failed-result', count: 1 },
        ],
        topFields: [{ fieldPath: 'payload.title', count: 2 }],
        severityBreakdown: { warning: 2, error: 1 },
        statusBreakdown: { succeeded: 11, failed: 1 },
        scoreTrendHint: 'flat',
        summary: '批次质量良好，但仍有空数据问题。',
        createdAt: '2026-05-19T04:00:00.000Z',
      },
    };

    expect(summarizeVerificationQuality(scan)).toEqual({
      scoreLabel: '86',
      gradeLabel: '良好',
      issueCount: 3,
      affectedResults: 2,
      totalResults: 12,
      topRules: [
        { ruleId: 'empty-data', count: 2 },
        { ruleId: 'failed-result', count: 1 },
      ],
      summary: '批次质量良好，但仍有空数据问题。',
    });
  });

  it('falls back to rule summaries when batch insight has no top rules', () => {
    const scan: DataQualityScanResult = {
      scannedAt: '2026-05-19T04:00:00.000Z',
      totalResults: 4,
      issueCount: 1,
      affectedResults: 1,
      rules: [
        {
          ruleId: 'duplicate-payload',
          name: '重复内容',
          severity: 'warning',
          hitCount: 1,
          sampleResultIds: ['result-2'],
        },
      ],
      issues: [],
    };

    expect(summarizeVerificationQuality(scan)).toEqual({
      scoreLabel: '-',
      gradeLabel: '-',
      issueCount: 1,
      affectedResults: 1,
      totalResults: 4,
      topRules: [{ ruleId: 'duplicate-payload', count: 1 }],
      summary: '暂无批次洞察摘要。',
    });
  });
});
```

- [ ] **Step 2: 运行测试确认 RED**

Run:

```bash
cmd.exe /c npm test -- tests/unit/renderer/hot-monitor/verification.test.ts
```

Expected: FAIL，原因是 `verification.ts` 尚不存在。

- [ ] **Step 3: 实现验证质量纯函数**

创建 `src/renderer/entries/hot-monitor/verification.ts`：

```ts
import type {
  DataQualityGrade,
  DataQualityRuleId,
  DataQualityScanInput,
  DataQualityScanResult,
} from '@shared/types';

export interface VerificationQualitySummary {
  scoreLabel: string;
  gradeLabel: string;
  issueCount: number;
  affectedResults: number;
  totalResults: number;
  topRules: Array<{
    ruleId: DataQualityRuleId;
    count: number;
  }>;
  summary: string;
}

export function buildVerificationQualityScanInput(
  taskId: string,
  batchId: string,
): DataQualityScanInput {
  return {
    query: {
      taskId,
      batchId,
    },
    limit: 200,
  };
}

export function formatQualityGrade(grade?: DataQualityGrade | null): string {
  if (grade === 'excellent') {
    return '优秀';
  }
  if (grade === 'good') {
    return '良好';
  }
  if (grade === 'watch') {
    return '关注';
  }
  if (grade === 'poor') {
    return '较差';
  }
  return '-';
}

export function summarizeVerificationQuality(
  scan: DataQualityScanResult,
): VerificationQualitySummary {
  const insightTopRules = scan.batchInsight?.topRules ?? [];
  const fallbackTopRules = scan.rules.map((rule) => ({
    ruleId: rule.ruleId,
    count: rule.hitCount,
  }));

  return {
    scoreLabel:
      typeof scan.batchScore?.score === 'number' ? String(scan.batchScore.score) : '-',
    gradeLabel: formatQualityGrade(scan.batchScore?.grade),
    issueCount: scan.issueCount,
    affectedResults: scan.affectedResults,
    totalResults: scan.totalResults,
    topRules: (insightTopRules.length > 0 ? insightTopRules : fallbackTopRules).slice(0, 3),
    summary: scan.batchInsight?.summary ?? '暂无批次洞察摘要。',
  };
}
```

- [ ] **Step 4: 运行验证质量纯函数测试**

Run:

```bash
cmd.exe /c npm test -- tests/unit/renderer/hot-monitor/verification.test.ts
```

Expected: PASS。

---

### Task 2: 新增复盘验证面板组件

**Files:**
- Create: `src/renderer/entries/hot-monitor/components/ReviewVerificationPanel.tsx`
- Create: `tests/unit/components/ReviewVerificationPanel.test.tsx`

- [ ] **Step 1: 写验证面板 RED 测试**

创建 `tests/unit/components/ReviewVerificationPanel.test.tsx`：

```tsx
import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import type { HotRunSummary, TaskReviewRecord } from '@shared/types';
import {
  ReviewVerificationPanel,
  type ReviewVerificationState,
} from '@renderer/entries/hot-monitor/components/ReviewVerificationPanel';

vi.mock('antd', () => ({
  Alert: ({ message }: { message?: React.ReactNode }) => <div role="alert">{message}</div>,
  Button: ({
    children,
    disabled,
    loading,
    onClick,
    type,
  }: {
    children?: React.ReactNode;
    disabled?: boolean;
    loading?: boolean;
    onClick?: () => void;
    type?: string;
  }) => (
    <button
      type="button"
      data-loading={loading ? 'true' : undefined}
      data-type={type}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  ),
  Space: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Statistic: ({ title, value }: { title?: React.ReactNode; value?: React.ReactNode }) => (
    <div>
      <span>{title}</span>
      <strong>{value}</strong>
    </div>
  ),
  Tag: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}));

function makeReview(overrides: Partial<TaskReviewRecord> = {}): TaskReviewRecord {
  return {
    id: 'review-1',
    taskId: 'task-1',
    batchId: 'batch-old',
    reviewType: 'failure',
    reasonCategory: 'selector_changed',
    conclusion: '已更新选择器',
    owner: '当前值班员',
    followUpActions: ['update-selector', 'template-governance'],
    createdAt: '2026-05-19T02:00:00.000Z',
    ...overrides,
  };
}

const completedRun: HotRunSummary = {
  batchId: 'batch-new',
  sourceId: 'source-1',
  sourceName: 'AI 热榜',
  status: 'success',
  resultCount: 12,
  reportStatus: 'generated',
  startedAt: '2026-05-19T04:00:00.000Z',
  finishedAt: '2026-05-19T04:01:00.000Z',
};

describe('ReviewVerificationPanel', () => {
  it('starts verification for a review', () => {
    const onVerify = vi.fn();
    render(
      <ReviewVerificationPanel
        review={makeReview()}
        state={{ status: 'idle' }}
        canVerify
        onVerify={onVerify}
        onOpenBatchResults={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '验证重跑并扫描新批次' }));

    expect(onVerify).toHaveBeenCalledWith(makeReview());
  });

  it('disables the action while verification is running', () => {
    render(
      <ReviewVerificationPanel
        review={makeReview()}
        state={{ status: 'running', message: '等待新批次完成' }}
        canVerify
        onVerify={vi.fn()}
        onOpenBatchResults={vi.fn()}
      />,
    );

    const button = screen.getByRole('button', { name: '验证重跑并扫描新批次' });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('等待新批次完成')).toBeDefined();
  });

  it('renders a successful verification summary and opens Data Center', () => {
    const onOpenBatchResults = vi.fn();
    const state: ReviewVerificationState = {
      status: 'succeeded',
      run: completedRun,
      quality: {
        scoreLabel: '86',
        gradeLabel: '良好',
        issueCount: 3,
        affectedResults: 2,
        totalResults: 12,
        topRules: [
          { ruleId: 'empty-data', count: 2 },
          { ruleId: 'failed-result', count: 1 },
        ],
        summary: '批次质量良好，但仍有空数据问题。',
      },
    };

    render(
      <ReviewVerificationPanel
        review={makeReview()}
        state={state}
        canVerify
        onVerify={vi.fn()}
        onOpenBatchResults={onOpenBatchResults}
      />,
    );

    expect(screen.getByText('新批次：batch-new')).toBeDefined();
    expect(screen.getByText('质量问题')).toBeDefined();
    expect(screen.getByText('empty-data：2')).toBeDefined();
    expect(screen.getByText('批次质量良好，但仍有空数据问题。')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: '查看新批次结果中心' }));

    expect(onOpenBatchResults).toHaveBeenCalledWith('batch-new');
  });

  it('renders a failed verification message', () => {
    render(
      <ReviewVerificationPanel
        review={makeReview()}
        state={{ status: 'failed', message: '新批次运行失败，未执行质量扫描' }}
        canVerify
        onVerify={vi.fn()}
        onOpenBatchResults={vi.fn()}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('新批次运行失败，未执行质量扫描');
  });
});
```

- [ ] **Step 2: 运行组件测试确认 RED**

Run:

```bash
cmd.exe /c npm test -- tests/unit/components/ReviewVerificationPanel.test.tsx
```

Expected: FAIL，原因是 `ReviewVerificationPanel.tsx` 尚不存在。

- [ ] **Step 3: 实现验证面板组件**

创建 `src/renderer/entries/hot-monitor/components/ReviewVerificationPanel.tsx`：

```tsx
import { Alert, Button, Space, Statistic, Tag } from 'antd';
import type { HotRunSummary, TaskReviewRecord } from '@shared/types';
import type { VerificationQualitySummary } from '../verification';

export type ReviewVerificationStatus =
  | 'idle'
  | 'running'
  | 'scanning'
  | 'succeeded'
  | 'failed';

export interface ReviewVerificationState {
  status: ReviewVerificationStatus;
  message?: string;
  run?: HotRunSummary | null;
  quality?: VerificationQualitySummary | null;
}

export function ReviewVerificationPanel({
  review,
  state,
  canVerify,
  onVerify,
  onOpenBatchResults,
}: {
  review: TaskReviewRecord;
  state: ReviewVerificationState;
  canVerify: boolean;
  onVerify: (review: TaskReviewRecord) => void;
  onOpenBatchResults: (batchId: string) => void;
}) {
  const busy = state.status === 'running' || state.status === 'scanning';
  const run = state.run ?? null;
  const quality = state.quality ?? null;

  return (
    <div className="hot-monitor-review-verification">
      <div className="browser-workspace-section-title">回流验证</div>
      <Space wrap>
        <Tag>{statusLabelOf(state.status)}</Tag>
        <Button
          type="primary"
          disabled={!canVerify || busy}
          loading={busy}
          onClick={() => onVerify(review)}
        >
          验证重跑并扫描新批次
        </Button>
      </Space>
      {state.message ? (
        <div className="browser-workspace-action-description">{state.message}</div>
      ) : null}
      {state.status === 'failed' && state.message ? (
        <Alert type="error" showIcon message={state.message} />
      ) : null}
      {run ? (
        <div className="browser-workspace-action-card">
          <div className="browser-workspace-action-title">新批次：{run.batchId}</div>
          <Space size="large" wrap>
            <Statistic title="运行状态" value={run.status} />
            <Statistic title="结果数量" value={run.resultCount} />
            <Statistic title="报告状态" value={run.reportStatus} />
          </Space>
          <Button onClick={() => onOpenBatchResults(run.batchId)}>
            查看新批次结果中心
          </Button>
        </div>
      ) : null}
      {quality ? (
        <div className="browser-workspace-action-card">
          <div className="browser-workspace-action-title">质量扫描摘要</div>
          <Space size="large" wrap>
            <Statistic title="质量分" value={quality.scoreLabel} />
            <Statistic title="等级" value={quality.gradeLabel} />
            <Statistic title="质量问题" value={quality.issueCount} />
            <Statistic title="影响结果" value={quality.affectedResults} />
          </Space>
          <div className="browser-workspace-action-description">{quality.summary}</div>
          {quality.topRules.map((rule) => (
            <Tag key={rule.ruleId}>
              {rule.ruleId}：{rule.count}
            </Tag>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function statusLabelOf(status: ReviewVerificationStatus): string {
  if (status === 'running') {
    return '等待新批次完成';
  }
  if (status === 'scanning') {
    return '扫描新批次质量';
  }
  if (status === 'succeeded') {
    return '验证完成';
  }
  if (status === 'failed') {
    return '验证失败';
  }
  return '尚未验证';
}
```

- [ ] **Step 4: 运行组件测试确认 PASS**

Run:

```bash
cmd.exe /c npm test -- tests/unit/components/ReviewVerificationPanel.test.tsx
```

Expected: PASS。

---

### Task 3: 抽出可返回运行结果的 Hot Monitor helper

**Files:**
- Modify: `src/renderer/entries/hot-monitor/App.tsx`
- Modify: `tests/unit/components/HotMonitorApp.test.tsx`

- [ ] **Step 1: 写忽略旧失败批次的 RED 测试**

在 `tests/unit/components/HotMonitorApp.test.tsx` 的 hoisted mock 中新增 `scanQualityMock`：

```ts
const {
  invokeMock,
  listTemplatesMock,
  listReviewsMock,
  createReviewMock,
  linkReviewTemplateMock,
  suggestTemplateBackflowMock,
  createTemplateBackflowDraftMock,
  applyTemplateBackflowDraftMock,
  scanQualityMock,
  messageErrorMock,
  messageSuccessMock,
  navigateMock,
} = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  listTemplatesMock: vi.fn(),
  listReviewsMock: vi.fn(),
  createReviewMock: vi.fn(),
  linkReviewTemplateMock: vi.fn(),
  suggestTemplateBackflowMock: vi.fn(),
  createTemplateBackflowDraftMock: vi.fn(),
  applyTemplateBackflowDraftMock: vi.fn(),
  scanQualityMock: vi.fn(),
  messageErrorMock: vi.fn(),
  messageSuccessMock: vi.fn(),
  navigateMock: vi.fn(),
}));
```

在 `useIpc` mock 中加入：

```ts
dataCenter: {
  scanQuality: scanQualityMock,
},
```

在 `beforeEach` 中加入默认质量扫描结果：

```ts
scanQualityMock.mockResolvedValue({
  scannedAt: '2026-05-19T04:00:00.000Z',
  totalResults: 12,
  issueCount: 1,
  affectedResults: 1,
  rules: [
    {
      ruleId: 'empty-data',
      name: '空数据',
      severity: 'warning',
      hitCount: 1,
      sampleResultIds: ['result-new-1'],
    },
  ],
  issues: [],
  batchScore: {
    batchId: 'batch-verify',
    score: 92,
    grade: 'excellent',
  },
  batchInsight: {
    id: 'insight-verify',
    batchId: 'batch-verify',
    taskId: 'task-failed',
    score: 92,
    grade: 'excellent',
    totalResults: 12,
    issueCount: 1,
    affectedResults: 1,
    failedRate: 0,
    suspiciousRate: 0.08,
    duplicateRate: 0,
    topRules: [{ ruleId: 'empty-data', count: 1 }],
    topFields: [],
    severityBreakdown: { warning: 1, error: 0 },
    statusBreakdown: { succeeded: 12 },
    scoreTrendHint: 'up',
    summary: '验证批次质量优秀。',
    createdAt: '2026-05-19T04:00:00.000Z',
  },
});
```

新增测试：

```tsx
it('reruns verification from a review and scans the new batch quality', async () => {
  let pollCount = 0;
  listReviewsMock.mockResolvedValue([
    {
      id: 'review-1',
      taskId: 'task-failed',
      batchId: 'batch-failed',
      reviewType: 'failure',
      reasonCategory: 'selector_changed',
      conclusion: '已回流模板，需要验证',
      owner: '当前值班员',
      followUpActions: ['update-selector', 'template-governance'],
      linkedTemplateIds: ['template-1'],
      createdAt: '2026-05-19T02:00:00.000Z',
    },
  ]);
  invokeMock.mockImplementation(async (channel: string, payload?: { sourceId?: string }) => {
    if (channel === IPC_CHANNELS.HOT_SOURCE_LIST) return [];
    if (channel === IPC_CHANNELS.HOT_REPORT_LIST) return [];
    if (channel === IPC_CHANNELS.HOT_TIMELINE_PRESETS) return [];
    if (channel === IPC_CHANNELS.HOT_RUN_DETAIL) {
      return {
        batchId: 'batch-failed',
        sourceId: 'source-failed',
        sourceName: '失败任务',
        taskId: 'task-failed',
        status: 'failed',
        startedAt: '2026-05-18T01:00:00.000Z',
        finishedAt: '2026-05-18T01:01:00.000Z',
        resultCount: 0,
        reportStatus: 'pending',
        error: '未找到热点列表',
        breakpoint: { stepIndex: 1, error: '未找到热点列表' },
        stepResults: [],
        linkedResultIds: [],
      };
    }
    if (channel === IPC_CHANNELS.HOT_RUN_LIST && payload?.sourceId === 'source-failed') {
      pollCount += 1;
      if (pollCount === 1) {
        return [
          {
            batchId: 'batch-failed',
            sourceId: 'source-failed',
            sourceName: '失败任务',
            status: 'failed',
            resultCount: 0,
            reportStatus: 'pending',
          },
        ];
      }
      return [
        {
          batchId: 'batch-verify',
          sourceId: 'source-failed',
          sourceName: '失败任务',
          status: 'success',
          resultCount: 12,
          reportStatus: 'pending',
        },
        {
          batchId: 'batch-failed',
          sourceId: 'source-failed',
          sourceName: '失败任务',
          status: 'failed',
          resultCount: 0,
          reportStatus: 'pending',
        },
      ];
    }
    if (channel === IPC_CHANNELS.HOT_RUN_LIST) return [];
    if (channel === IPC_CHANNELS.HOT_RUN_START) {
      return { sourceId: 'source-failed', taskId: 'task-failed', started: true };
    }
    if (channel === IPC_CHANNELS.HOT_REPORT_GENERATE) {
      return {
        id: 'report-verify',
        sourceId: 'source-failed',
        batchId: 'batch-verify',
        format: 'html',
        filePath: 'E:/allsite/yclaw/output/html/verify.html',
      };
    }
    return null;
  });

  render(<HotMonitorApp />);

  fireEvent.click(await screen.findByRole('button', { name: '查看详情' }));
  fireEvent.click(await screen.findByRole('button', { name: '验证重跑并扫描新批次' }));

  await waitFor(() => {
    expect(scanQualityMock).toHaveBeenCalledWith({
      query: {
        taskId: 'task-failed',
        batchId: 'batch-verify',
      },
      limit: 200,
    });
  });
  expect(await screen.findByText('新批次：batch-verify')).toBeDefined();
  expect(await screen.findByText('验证批次质量优秀。')).toBeDefined();
});
```

- [ ] **Step 2: 运行测试确认 RED**

Run:

```bash
cmd.exe /c npm test -- tests/unit/components/HotMonitorApp.test.tsx
```

Expected: FAIL，原因是 `useIpc` mock 尚未提供 `dataCenter`，且 Hot Monitor 尚未渲染验证面板。

- [ ] **Step 3: 在 App 中引入验证能力**

修改 `src/renderer/entries/hot-monitor/App.tsx` import：

```ts
import type { DataQualityScanResult } from '@shared/types';
import { ReviewVerificationPanel, type ReviewVerificationState } from './components/ReviewVerificationPanel';
import {
  buildVerificationQualityScanInput,
  summarizeVerificationQuality,
} from './verification';
```

把 `useIpc` 解构改为：

```ts
const { invoke, automation, taskOperations, dataCenter } = useIpc();
```

新增状态：

```ts
const [reviewVerificationById, setReviewVerificationById] = useState<
  Record<string, ReviewVerificationState>
>({});
```

- [ ] **Step 4: 抽出运行 helper 并支持忽略旧批次**

把原 `startRun` 改为调用新的 `runHotSource`：

```ts
const startRun = async (sourceId: string) => {
  try {
    const completedRun = await runHotSource(sourceId);
    if (completedRun?.status === 'success') {
      message.success('热点采集完成，报告已生成');
    } else if (completedRun?.status === 'failed') {
      message.error('热点采集失败，请查看运行详情');
    }
  } catch (error) {
    reportError(error, '启动热点采集失败');
  }
};
```

新增 `runHotSource`：

```ts
const runHotSource = async (
  sourceId: string,
  options: { ignoreBatchId?: string } = {},
): Promise<HotRunSummary | null> => {
  await invoke(IPC_CHANNELS.HOT_RUN_START, { sourceId });
  message.success('热点采集已启动');
  await loadRuns();
  const completedRun = await waitForRunCompletion(sourceId, options);
  await loadRuns();
  if (sourceRunsDrawer?.sourceId === sourceId) {
    await loadSourceRuns(sourceId);
  }
  if (completedRun?.status === 'success') {
    await generateReportForRun(completedRun);
  }
  return completedRun;
};
```

把 `waitForRunCompletion` 签名改为：

```ts
const waitForRunCompletion = async (
  sourceId: string,
  options: { ignoreBatchId?: string } = {},
): Promise<HotRunSummary | null> => {
  const maxAttempts = 30;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const data = await invoke<HotRunSummary[]>(IPC_CHANNELS.HOT_RUN_LIST, { sourceId });
    const nextRuns = Array.isArray(data) ? data : [];
    setRuns(nextRuns);
    const latestRun = nextRuns.find((run) => {
      if (options.ignoreBatchId && run.batchId === options.ignoreBatchId) {
        return false;
      }
      return run.status === 'success' || run.status === 'failed';
    }) ?? null;
    if (latestRun) {
      return latestRun;
    }
    if (attempt < maxAttempts - 1) {
      await delay(1000);
    }
  }
  return null;
};
```

- [ ] **Step 5: 运行现有重跑测试**

Run:

```bash
cmd.exe /c npm test -- tests/unit/components/HotMonitorApp.test.tsx -t "reruns the current source from the failure review section"
```

Expected: PASS，确认普通“重新运行当前采集源”行为未回退。

---

### Task 4: 接入验证重跑和新批次质量扫描

**Files:**
- Modify: `src/renderer/entries/hot-monitor/App.tsx`
- Modify: `tests/unit/components/HotMonitorApp.test.tsx`

- [ ] **Step 1: 在 App 中实现验证重跑函数**

在 `src/renderer/entries/hot-monitor/App.tsx` 中新增：

```ts
const setReviewVerification = (reviewId: string, state: ReviewVerificationState) => {
  setReviewVerificationById((current) => ({
    ...current,
    [reviewId]: state,
  }));
};

const verifyReviewBackflow = async (review: TaskReviewRecord) => {
  if (!review.id || !runDetail?.sourceId || !runDetail.taskId || !runDetail.batchId) {
    message.error('缺少验证重跑上下文');
    return;
  }

  setReviewVerification(review.id, {
    status: 'running',
    message: '正在启动验证重跑并等待新批次完成',
  });

  try {
    const completedRun = await runHotSource(runDetail.sourceId, {
      ignoreBatchId: runDetail.batchId,
    });

    if (!completedRun) {
      setReviewVerification(review.id, {
        status: 'failed',
        message: '未等到新批次完成，请稍后查看运行列表',
      });
      return;
    }

    if (completedRun.status !== 'success') {
      setReviewVerification(review.id, {
        status: 'failed',
        run: completedRun,
        message: '新批次运行失败，未执行质量扫描',
      });
      return;
    }

    setReviewVerification(review.id, {
      status: 'scanning',
      run: completedRun,
      message: '新批次已完成，正在扫描质量',
    });

    const scan = (await dataCenter.scanQuality(
      buildVerificationQualityScanInput(runDetail.taskId, completedRun.batchId),
    )) as DataQualityScanResult;

    setReviewVerification(review.id, {
      status: 'succeeded',
      run: completedRun,
      quality: summarizeVerificationQuality(scan),
      message: '验证完成，新批次质量扫描已生成',
    });
    message.success('验证重跑完成，质量扫描已生成');
  } catch (error) {
    const messageText = error instanceof Error ? error.message : '验证重跑失败';
    setReviewVerification(review.id, {
      status: 'failed',
      message: messageText,
    });
    message.error(messageText);
  }
};
```

- [ ] **Step 2: 新增打开新批次结果中心函数**

在 `src/renderer/entries/hot-monitor/App.tsx` 中新增：

```ts
const openVerifiedBatchResults = (batchId: string) => {
  if (!runDetail?.taskId) {
    message.error('缺少 Task 上下文，无法打开结果中心');
    return;
  }

  navigate('/data-center', {
    state: {
      batchId,
      taskId: runDetail.taskId,
      source: 'hot-monitor',
    },
  });
};
```

- [ ] **Step 3: 在复盘列表中渲染验证面板**

在 `runReviews.map` 中，紧跟 `ReviewTemplateGovernancePanel` 后追加：

```tsx
<ReviewVerificationPanel
  review={review}
  state={reviewVerificationById[review.id] ?? { status: 'idle' }}
  canVerify={Boolean(runDetail.sourceId && runDetail.taskId)}
  onVerify={(targetReview) => void verifyReviewBackflow(targetReview)}
  onOpenBatchResults={openVerifiedBatchResults}
/>
```

- [ ] **Step 4: 增加新批次失败不扫描测试**

在 `tests/unit/components/HotMonitorApp.test.tsx` 新增：

```tsx
it('does not scan quality when the verification rerun fails', async () => {
  listReviewsMock.mockResolvedValue([
    {
      id: 'review-1',
      taskId: 'task-failed',
      batchId: 'batch-failed',
      reviewType: 'failure',
      reasonCategory: 'selector_changed',
      conclusion: '已回流模板，需要验证',
      owner: '当前值班员',
      followUpActions: ['update-selector', 'template-governance'],
      linkedTemplateIds: ['template-1'],
      createdAt: '2026-05-19T02:00:00.000Z',
    },
  ]);
  invokeMock.mockImplementation(async (channel: string, payload?: { sourceId?: string }) => {
    if (channel === IPC_CHANNELS.HOT_SOURCE_LIST) return [];
    if (channel === IPC_CHANNELS.HOT_REPORT_LIST) return [];
    if (channel === IPC_CHANNELS.HOT_TIMELINE_PRESETS) return [];
    if (channel === IPC_CHANNELS.HOT_RUN_DETAIL) {
      return {
        batchId: 'batch-failed',
        sourceId: 'source-failed',
        sourceName: '失败任务',
        taskId: 'task-failed',
        status: 'failed',
        startedAt: '2026-05-18T01:00:00.000Z',
        finishedAt: '2026-05-18T01:01:00.000Z',
        resultCount: 0,
        reportStatus: 'pending',
        error: '未找到热点列表',
        breakpoint: { stepIndex: 1, error: '未找到热点列表' },
        stepResults: [],
        linkedResultIds: [],
      };
    }
    if (channel === IPC_CHANNELS.HOT_RUN_LIST && payload?.sourceId === 'source-failed') {
      return [
        {
          batchId: 'batch-verify-failed',
          sourceId: 'source-failed',
          sourceName: '失败任务',
          status: 'failed',
          resultCount: 0,
          reportStatus: 'pending',
        },
      ];
    }
    if (channel === IPC_CHANNELS.HOT_RUN_LIST) return [];
    if (channel === IPC_CHANNELS.HOT_RUN_START) {
      return { sourceId: 'source-failed', taskId: 'task-failed', started: true };
    }
    return null;
  });

  render(<HotMonitorApp />);

  fireEvent.click(await screen.findByRole('button', { name: '查看详情' }));
  fireEvent.click(await screen.findByRole('button', { name: '验证重跑并扫描新批次' }));

  expect(await screen.findByText('新批次运行失败，未执行质量扫描')).toBeDefined();
  expect(scanQualityMock).not.toHaveBeenCalled();
});
```

- [ ] **Step 5: 增加新批次结果中心跳转测试**

在成功验证测试末尾追加：

```tsx
fireEvent.click(await screen.findByRole('button', { name: '查看新批次结果中心' }));

expect(navigateMock).toHaveBeenCalledWith('/data-center', {
  state: {
    batchId: 'batch-verify',
    taskId: 'task-failed',
    source: 'hot-monitor',
  },
});
```

- [ ] **Step 6: 运行 Phase 7 Hot Monitor 集成测试**

Run:

```bash
cmd.exe /c npm test -- tests/unit/components/HotMonitorApp.test.tsx
```

Expected: PASS。既有 React `act(...)` warning 如果仍出现，记录为既有测试噪声，不作为本阶段阻断。

---

### Task 5: 更新当前状态并跑 Phase 7 聚焦验证

**Files:**
- Modify: `docs/overview/current-status.md`

- [ ] **Step 1: 更新当前状态文档**

把 `docs/overview/current-status.md` 中 Hot Monitor 状态从 Phase 6 更新为 Phase 7。建议改为：

```md
| 热点监控     | 已实现基础版本 / Phase 7 回流验证与质量扫描已接入 | 独立 `hot-monitor` 入口，提供热点源配置、运行与报告生成；多平台 NewsNow / TrendRadar 热点采集黄金路径已实现创建、运行、结果数量、HTML 报告和 Task / Batch / Report 追踪的最小闭环；热点报告工作台已能在报告列表和预览抽屉展示 Source / Batch / Report 上下文，并可从报告继续进入运行详情或结果中心；失败运行详情已能进入 Browser 介入台，携带 Hot Monitor 的 Task / Batch / Source / breakpoint 上下文，并复用现有恢复自动执行入口；失败运行详情已接入复盘闭环，可读取当前 Task / Batch 的历史复盘，并创建真实 `TaskReviewRecord` 记录；复盘记录可关联已有提取模板，并生成回流建议、回流草稿和应用到模板治理主线；模板回流后可发起验证重跑，对新批次自动执行 Data Center 质量扫描并展示质量摘要 |
```

把 Hot Monitor 规格行同步改为 Phase 7，保留仍未完成项：

```md
| `docs/specs/hot-monitor-v1.md`                        | 基础版已落地 / Phase 7 回流验证与质量扫描已接入 | 独立 `hot-monitor` 入口、热点源、NewsNow/RSS、Timeline、报告、AI 摘要、通知出口和 MCP 查询已有稳定文档承接；多平台 NewsNow / TrendRadar 热点采集黄金路径已实现创建、运行、结果数量、HTML 报告和 Task / Batch / Report 追踪的最小闭环；热点报告工作台已能在报告列表和预览抽屉展示 Source / Batch / Report 上下文，并可从报告继续进入运行详情或结果中心；失败运行详情已能进入 Browser 介入台并复用恢复自动执行入口；失败运行详情已可读取当前 Task / Batch 的复盘列表、创建失败复盘记录，并在复盘后重新运行当前采集源；复盘记录可关联已有提取模板，并可生成回流建议、回流草稿和应用到模板治理主线；模板回流后可验证重跑并扫描新批次质量 | 可视化时间轴、通知目标精细选择、摘要缓存、docx 报告、真实现场会话恢复、AI 复盘初稿和质量规则自动生成仍属后续增强                     |
```

把模块能力行同步补充：

```md
| `hot-monitor`   | 热点源配置、运行、报告、AI 摘要、通知出口与 MCP 查询；失败运行详情可进入 Browser 介入台，并可读取 / 创建当前 Task / Batch 的失败复盘记录；失败复盘可关联已有提取模板，生成回流建议、回流草稿并应用到模板治理主线；模板回流后可验证重跑当前采集源，并对新批次执行 Data Center 质量扫描                                                                                                                                 |
```

- [ ] **Step 2: 运行 Phase 7 聚焦测试**

Run:

```bash
cmd.exe /c npm test -- tests/unit/renderer/hot-monitor/verification.test.ts tests/unit/components/ReviewVerificationPanel.test.tsx tests/unit/components/HotMonitorApp.test.tsx
```

Expected: PASS。

- [ ] **Step 3: 运行 Phase 5-6 回归测试**

Run:

```bash
cmd.exe /c npm test -- tests/unit/renderer/hot-monitor/failureReview.test.ts tests/unit/renderer/hot-monitor/templateGovernance.test.ts tests/unit/components/ReviewTemplateGovernancePanel.test.tsx tests/unit/components/HotMonitorApp.test.tsx
```

Expected: PASS。

- [ ] **Step 4: 运行质量门禁**

Run:

```bash
cmd.exe /c npm run typecheck
```

Expected: PASS。

Run:

```bash
cmd.exe /c npm run lint
```

Expected: PASS，允许保留仓库既有 warning，但不能新增 error。

- [ ] **Step 5: 检查文档和空白问题**

Run:

```bash
rg -n "TB[D]|TO[D]O|待[定]|implement late[r]|fill i[n]" docs/superpowers/specs/2026-05-19-hot-review-verification-quality-phase-7-design.md docs/superpowers/plans/2026-05-19-hot-review-verification-quality-phase-7.md
```

Expected: 无输出。

Run:

```bash
git diff --check -- docs/superpowers/specs/2026-05-19-hot-review-verification-quality-phase-7-design.md docs/superpowers/plans/2026-05-19-hot-review-verification-quality-phase-7.md src/renderer/entries/hot-monitor/verification.ts src/renderer/entries/hot-monitor/components/ReviewVerificationPanel.tsx src/renderer/entries/hot-monitor/App.tsx tests/unit/renderer/hot-monitor/verification.test.ts tests/unit/components/ReviewVerificationPanel.test.tsx tests/unit/components/HotMonitorApp.test.tsx docs/overview/current-status.md
```

Expected: 无输出。

Run:

```bash
git status --short --branch
```

Expected: 显示 Phase 7 文件变更仍停留在工作区，没有 commit。

---

## 执行顺序

| 顺序 | 任务 | 目标 |
| --- | --- | --- |
| 1 | Task 1 | 先锁定质量扫描 payload 和展示摘要，避免 UI 中散落格式化逻辑 |
| 2 | Task 2 | 把复盘验证 UI 独立出来，避免继续扩大 `HotMonitorApp` |
| 3 | Task 3 | 抽出可返回运行结果的 helper，并修正旧失败批次误判风险 |
| 4 | Task 4 | 接入验证重跑、质量扫描和结果中心跳转 |
| 5 | Task 5 | 回写状态并完成聚焦验证 |

## 风险控制

| 风险 | 控制方式 |
| --- | --- |
| 验证重跑误用旧失败批次 | `waitForRunCompletion` 支持 `ignoreBatchId`，测试覆盖 |
| 重跑失败仍触发质量扫描 | 只有 `completedRun.status === 'success'` 才调用 `scanQuality` |
| 质量扫描范围过大 | payload 固定为 `{ query: { taskId, batchId: newBatchId }, limit: 200 }` |
| `HotMonitorApp` 继续膨胀 | UI 独立到 `ReviewVerificationPanel`，App 只保留 orchestration |
| Phase 6 模板治理回退 | 保留并运行 `ReviewTemplateGovernancePanel` 和 `templateGovernance` 测试 |
| 文档与实现不一致 | 完成实现后同步 `current-status.md`，并跑文档空占位扫描 |

## 完成口径

| 项目 | 标准 |
| --- | --- |
| 用户路径 | 失败复盘卡片下可以发起验证重跑 |
| 新批次等待 | 旧失败批次不会被当成验证结果 |
| 成功验证 | 新批次成功后生成报告并扫描质量 |
| 失败验证 | 新批次失败时展示失败状态且不扫描质量 |
| 质量摘要 | 展示质量分、等级、问题数、影响结果、Top 规则和摘要 |
| 结果中心 | 可跳转 Data Center，并携带新 `taskId/batchId` |
| 验证 | 聚焦测试、Phase 5-6 回归、typecheck、lint 通过 |

Plan complete and saved to `docs/superpowers/plans/2026-05-19-hot-review-verification-quality-phase-7.md`. 本仓库当前约束是不提交 commit；实现时按本计划逐项执行并保留在工作区。
