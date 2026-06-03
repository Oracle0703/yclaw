# Task Toolbench Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Hot Monitor the first standard-batch template in the task toolbench and make Result Library support `standard`、`signin`、`hot` multi-source results.

**Architecture:** Reuse existing Hot Source, Hot Run, Hot Report, Task Batch, Result, and Data Center IPC. Keep unification in renderer view models; do not add a new database table or backend aggregation service. Hot reports enter Result Library as `sourceType = hot`, while standard extraction results continue to use `ExtractionResult` and Data Center APIs.

**Tech Stack:** Electron IPC, React, TypeScript, Ant Design, Vitest, existing `IPC_CHANNELS`, existing task-toolbench view models.

---

## Scope

This plan implements the second-round audited scope from `docs/plans/task-toolbench-phase1-audit.md`.

Enter scope:

- `P1-02A` Result Library unified display model enhancement.
- `P1-02B` Hot Monitor template adapter.
- `P1-02C` Hot run monitor integration.
- `P1-02D` Hot reports in Result Library.
- `P1-02E` Standard result Data Center detail and export flow.

Stay out of scope:

- Comment Monitor runnable template.
- AI task assistant convergence.
- Capability Center full implementation.
- Data Center deep rewrite.
- Unified result table migration.
- Hot AI summary, notification sending, and `docx` report generation.

## File Structure

Create:

- `src/renderer/entries/workbench/task-toolbench/hotTemplateAdapter.ts`  
  Converts Hot template form values into `HotSourceDraft`, validates minimum runnable inputs, exposes supported report formats.

- `tests/unit/workbench/hotTemplateAdapter.test.ts`  
  Covers default draft conversion, required field validation, and unsupported report format filtering.

Modify:

- `src/renderer/entries/workbench/task-toolbench/templates.ts`  
  Upgrade `hot-monitor` from preview to ready, replace the preview-only `sourceId` field with real Hot template fields.

- `src/renderer/entries/workbench/task-toolbench/resultLibraryViewModel.ts`  
  Add `hot` detail refs and Hot report projection.

- `src/renderer/entries/workbench/task-toolbench/runMonitorViewModel.ts`  
  Add Hot run projection while keeping report status separate from batch status.

- `src/renderer/entries/workbench/pages/TaskEditor.tsx`  
  Support Hot template form save and save-and-run flow via `HOT_SOURCE_CREATE`, `HOT_SOURCE_UPDATE`, `HOT_RUN_START`.

- `src/renderer/entries/workbench/pages/RunMonitor.tsx`  
  Load Hot sources and runs, render Hot run records, generate Hot reports.

- `src/renderer/entries/workbench/pages/ResultLibrary.tsx`  
  Load Hot reports and sources, render Hot report details, keep standard/signin/hot detail and export actions separate.

- `tests/unit/workbench/templates.test.ts`  
  Verify Hot template is ready and has concrete fields.

- `tests/unit/workbench/resultLibraryViewModel.test.ts`  
  Verify `standard`、`signin`、`hot` ordering and detail refs.

- `tests/unit/workbench/runMonitorViewModel.test.ts`  
  Verify Hot run mapping and `reportStatus` handling.

- `tests/unit/components/TaskEditorPage.test.tsx`  
  Verify Hot template save and run behavior.

- `tests/unit/components/RunMonitorPage.test.tsx`  
  Verify Hot run list and report generation behavior.

- `tests/unit/components/ResultLibraryPage.test.tsx`  
  Verify Hot report list/detail and standard export routing.

- `docs/plans/task-toolbench-v1.md`  
  Keep the total plan aligned with this second-round scope.

## Task 1: Hot Template Adapter

**Files:**

- Create: `src/renderer/entries/workbench/task-toolbench/hotTemplateAdapter.ts`
- Modify: `src/renderer/entries/workbench/task-toolbench/templates.ts`
- Test: `tests/unit/workbench/hotTemplateAdapter.test.ts`
- Test: `tests/unit/workbench/templates.test.ts`

- [ ] **Step 1: Write failing adapter tests**

Add `tests/unit/workbench/hotTemplateAdapter.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  HOT_REPORT_FORMATS,
  buildHotSourceDraft,
  validateHotTemplateValues,
} from '../../../src/renderer/entries/workbench/task-toolbench/hotTemplateAdapter';

describe('hotTemplateAdapter', () => {
  it('builds a HotSourceDraft from minimum template values', () => {
    const draft = buildHotSourceDraft({
      name: '今日热点',
      sourceKind: 'api',
      siteKey: 'trendradar',
      entryUrl: 'https://newsnow.busiyi.world/',
      parserKey: 'newsnow.batch',
      platformIds: ['weibo', 'douyin'],
      enabled: true,
    });

    expect(draft).toMatchObject({
      name: '今日热点',
      sourceKind: 'api',
      siteKey: 'trendradar',
      entryUrl: 'https://newsnow.busiyi.world/',
      parserKey: 'newsnow.batch',
      platformIds: ['weibo', 'douyin'],
      schedule: { type: 'manual' },
      enabled: true,
    });
  });

  it('reports missing runnable fields', () => {
    expect(
      validateHotTemplateValues({
        name: '',
        sourceKind: 'api',
        siteKey: '',
        entryUrl: '',
        parserKey: '',
      }),
    ).toEqual(['任务名称不能为空', '站点标识不能为空', '入口 URL 不能为空', '解析器不能为空']);
  });

  it('only exposes report formats supported by HotReportService', () => {
    expect(HOT_REPORT_FORMATS).toEqual(['md', 'html']);
  });
});
```

Run:

```bash
npx vitest run tests/unit/workbench/hotTemplateAdapter.test.ts
```

Expected: FAIL because `hotTemplateAdapter.ts` does not exist.

- [ ] **Step 2: Add Hot template adapter**

Create `src/renderer/entries/workbench/task-toolbench/hotTemplateAdapter.ts`:

```ts
import type { HotReportFormat, HotSourceDraft, HotSourceKind } from '@shared/types';

export const HOT_REPORT_FORMATS = ['md', 'html'] as const satisfies HotReportFormat[];

export interface HotTemplateFormValues {
  name: string;
  sourceKind: HotSourceKind;
  siteKey: string;
  entryUrl: string;
  parserKey: string;
  platformIds?: string[] | string;
  sessionId?: string | null;
  enabled?: boolean;
}

export function validateHotTemplateValues(values: Partial<HotTemplateFormValues>): string[] {
  const errors: string[] = [];
  if (!values.name?.trim()) errors.push('任务名称不能为空');
  if (!values.siteKey?.trim()) errors.push('站点标识不能为空');
  if (!values.entryUrl?.trim()) errors.push('入口 URL 不能为空');
  if (!values.parserKey?.trim()) errors.push('解析器不能为空');
  return errors;
}

export function buildHotSourceDraft(values: HotTemplateFormValues): HotSourceDraft {
  const errors = validateHotTemplateValues(values);
  if (errors.length > 0) {
    throw new Error(errors.join('；'));
  }

  return {
    name: values.name.trim(),
    sourceKind: values.sourceKind,
    siteKey: values.siteKey.trim(),
    entryUrl: values.entryUrl.trim(),
    parserKey: values.parserKey.trim(),
    platformIds: normalizePlatformIds(values.platformIds),
    sessionId: values.sessionId?.trim() || null,
    schedule: { type: 'manual' },
    filter: null,
    timeline: null,
    enabled: values.enabled ?? true,
    tags: ['hot-monitor'],
  };
}

function normalizePlatformIds(value: string[] | string | undefined): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => item.trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}
```

- [ ] **Step 3: Upgrade Hot template definition**

Modify the `hot-monitor` entry in `src/renderer/entries/workbench/task-toolbench/templates.ts`:

```ts
{
  id: 'hot-monitor',
  name: '热点监控任务',
  description: '复用已有热点源、标准批次、标准结果和报告能力，创建可运行的热点监控任务。',
  category: 'monitoring',
  adapter: 'hot',
  requiredCapabilities: ['hot-source'],
  status: 'ready',
  defaultEntryUrl: 'https://newsnow.busiyi.world/',
  defaultSchedule: { type: 'manual' },
  parameterFields: [
    {
      name: 'name',
      label: '任务名称',
      type: 'text',
      required: true,
      defaultValue: '热点监控',
    },
    {
      name: 'sourceKind',
      label: '来源类型',
      type: 'select',
      required: true,
      defaultValue: 'api',
      options: [
        { label: 'API', value: 'api' },
        { label: '浏览器', value: 'browser' },
        { label: 'RSS', value: 'rss' },
      ],
    },
    {
      name: 'siteKey',
      label: '站点标识',
      type: 'text',
      required: true,
      defaultValue: 'trendradar',
    },
    {
      name: 'entryUrl',
      label: '入口 URL',
      type: 'url',
      required: true,
      defaultValue: 'https://newsnow.busiyi.world/',
    },
    {
      name: 'parserKey',
      label: '解析器',
      type: 'text',
      required: true,
      defaultValue: 'newsnow.batch',
    },
    {
      name: 'platformIds',
      label: '平台 ID',
      type: 'text',
      placeholder: '多个平台用英文逗号分隔',
    },
  ],
}
```

- [ ] **Step 4: Extend template tests**

Add assertions to `tests/unit/workbench/templates.test.ts`:

```ts
it('exposes hot monitor as a ready template with concrete source fields', () => {
  const template = getTaskTemplateById('hot-monitor');

  expect(template?.status).toBe('ready');
  expect(template?.adapter).toBe('hot');
  expect(template?.runDisabledReason).toBeUndefined();
  expect(template?.parameterFields.map((field) => field.name)).toEqual([
    'name',
    'sourceKind',
    'siteKey',
    'entryUrl',
    'parserKey',
    'platformIds',
  ]);
});
```

Run:

```bash
npx vitest run tests/unit/workbench/hotTemplateAdapter.test.ts tests/unit/workbench/templates.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/entries/workbench/task-toolbench/hotTemplateAdapter.ts src/renderer/entries/workbench/task-toolbench/templates.ts tests/unit/workbench/hotTemplateAdapter.test.ts tests/unit/workbench/templates.test.ts
git commit -m "feat: add hot monitor template adapter"
```

## Task 2: Result Library View Model Supports Hot Reports

**Files:**

- Modify: `src/renderer/entries/workbench/task-toolbench/resultLibraryViewModel.ts`
- Test: `tests/unit/workbench/resultLibraryViewModel.test.ts`

- [ ] **Step 1: Write failing Hot report projection test**

Add this test to `tests/unit/workbench/resultLibraryViewModel.test.ts`:

```ts
it('projects hot reports as hot result items without calling them standard results', () => {
  const model = buildResultLibraryViewModel({
    standardResults: [],
    signinRuns: [],
    hotReports: [
      {
        id: 'report-1',
        sourceId: 'source-1',
        batchId: 'batch-1',
        title: '今日热点报告',
        format: 'html',
        filePath: '/tmp/report.html',
        createdAt: '2026-06-03T10:00:00.000Z',
      },
    ],
    hotSources: [
      {
        id: 'source-1',
        taskId: 'task-hot',
        name: '热点监控',
        sourceKind: 'api',
        siteKey: 'trendradar',
        entryUrl: 'https://newsnow.busiyi.world/',
        parserKey: 'newsnow.batch',
        enabled: true,
        tags: [],
        createdAt: '2026-06-03T09:00:00.000Z',
        updatedAt: '2026-06-03T09:00:00.000Z',
      },
    ],
  });

  expect(model.items).toHaveLength(1);
  expect(model.items[0]).toMatchObject({
    id: 'hot-report:report-1',
    sourceType: 'hot',
    taskId: 'task-hot',
    batchId: 'batch-1',
    title: '今日热点报告',
    statusLabel: '已生成',
    detailRef: { sourceType: 'hot', reportId: 'report-1' },
    exportableFormats: [],
  });
});
```

Run:

```bash
npx vitest run tests/unit/workbench/resultLibraryViewModel.test.ts
```

Expected: FAIL because `buildResultLibraryViewModel` does not accept `hotReports` and `hotSources`.

- [ ] **Step 2: Extend result model types**

Modify imports and unions in `resultLibraryViewModel.ts`:

```ts
import type { ExtractionResult, HotReportSummary, HotSource, SigninRunSummary } from '@shared/types';
```

Change `ResultDetailRef`:

```ts
export type ResultDetailRef =
  | { sourceType: 'standard'; resultId: string }
  | { sourceType: 'signin'; taskId: string; runId: string }
  | { sourceType: 'hot'; reportId: string };
```

Change `UnifiedResultItem.raw`:

```ts
raw: ExtractionResult | SigninRunSummary | HotReportSummary;
```

Change `buildResultLibraryViewModel` input:

```ts
export function buildResultLibraryViewModel(input: {
  standardResults: ExtractionResult[];
  signinRuns: SigninRunSummary[];
  hotReports?: HotReportSummary[];
  hotSources?: HotSource[];
}): ResultLibraryViewModel {
  const signinDuplicateCounts = countSigninDuplicates(input.signinRuns);
  const standardItems = input.standardResults.map(toStandardResultItem);
  const signinItems = input.signinRuns.map((run, index) =>
    toSigninResultItem(run, index, signinDuplicateCounts.get(`${run.taskId}:${run.runAt}`) ?? 1),
  );
  const hotItems = (input.hotReports ?? []).map((report) =>
    toHotReportItem(report, input.hotSources ?? []),
  );
  const items = [...standardItems, ...signinItems, ...hotItems].sort(compareByCreatedAtDesc);

  return {
    items,
    emptyState:
      items.length === 0
        ? {
            title: '还没有任务结果',
            description: '任务运行后，标准结果、签到专项结果和热点报告会汇总到这里。',
          }
        : null,
  };
}
```

- [ ] **Step 3: Add Hot report projection helper**

Add to `resultLibraryViewModel.ts`:

```ts
function toHotReportItem(report: HotReportSummary, hotSources: HotSource[]): UnifiedResultItem {
  const source = hotSources.find((item) => item.id === report.sourceId);
  return {
    id: `hot-report:${report.id}`,
    sourceType: 'hot',
    taskId: source?.taskId ?? '',
    batchId: report.batchId,
    title: report.title,
    status: 'normal',
    statusLabel: '已生成',
    createdAt: report.createdAt,
    summary: `${report.format.toUpperCase()} · ${report.filePath}`,
    detailRef: { sourceType: 'hot', reportId: report.id },
    exportableFormats: [],
    raw: report,
  };
}
```

- [ ] **Step 4: Run view model tests**

```bash
npx vitest run tests/unit/workbench/resultLibraryViewModel.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/entries/workbench/task-toolbench/resultLibraryViewModel.ts tests/unit/workbench/resultLibraryViewModel.test.ts
git commit -m "feat: project hot reports in result library"
```

## Task 3: Run Monitor View Model Supports Hot Runs

**Files:**

- Modify: `src/renderer/entries/workbench/task-toolbench/runMonitorViewModel.ts`
- Test: `tests/unit/workbench/runMonitorViewModel.test.ts`

- [ ] **Step 1: Write failing Hot run projection test**

Add to `tests/unit/workbench/runMonitorViewModel.test.ts`:

```ts
it('projects hot runs and keeps report status separate from batch status', () => {
  const model = buildRunMonitorViewModel({
    batches: [],
    signinRuns: [],
    hotRuns: [
      {
        batchId: 'batch-hot',
        sourceId: 'source-hot',
        sourceName: '热点监控',
        status: 'success',
        startedAt: '2026-06-03T10:00:00.000Z',
        finishedAt: '2026-06-03T10:01:00.000Z',
        resultCount: 12,
        reportStatus: 'generated',
      },
    ],
    hotSources: [
      {
        id: 'source-hot',
        taskId: 'task-hot',
        name: '热点监控',
        sourceKind: 'api',
        siteKey: 'trendradar',
        entryUrl: 'https://newsnow.busiyi.world/',
        parserKey: 'newsnow.batch',
        enabled: true,
        tags: [],
        createdAt: '2026-06-03T09:00:00.000Z',
        updatedAt: '2026-06-03T09:00:00.000Z',
      },
    ],
  });

  expect(model.runs[0]).toMatchObject({
    runId: 'hot:source-hot:batch-hot',
    sourceType: 'hot',
    taskId: 'task-hot',
    rawStatus: 'success',
    statusLabel: '成功',
    reportStatus: 'generated',
    resultCount: 12,
  });
});
```

Run:

```bash
npx vitest run tests/unit/workbench/runMonitorViewModel.test.ts
```

Expected: FAIL because Hot run inputs are not supported.

- [ ] **Step 2: Extend run model types**

Modify imports:

```ts
import type { HotRunSummary, HotSource, SigninRunSummary, TaskBatch } from '@shared/types';
```

Change types:

```ts
export type RunSourceType = 'batch' | 'signin' | 'hot';

export type RunAction =
  | 'retry-batch'
  | 'intervention'
  | 'intervention-retry'
  | 'rerun-signin'
  | 'view-result'
  | 'generate-hot-report'
  | 'view-hot-report';
```

Extend `UnifiedRunRecord`:

```ts
batchId?: string | null;
resultCount?: number;
reportStatus?: HotRunSummary['reportStatus'];
raw: TaskBatch | SigninRunSummary | HotRunSummary;
```

Change function input:

```ts
export function buildRunMonitorViewModel(input: {
  batches: TaskBatch[];
  signinRuns: SigninRunSummary[];
  hotRuns?: HotRunSummary[];
  hotSources?: HotSource[];
}): RunMonitorViewModel {
  const signinDuplicateCounts = countSigninDuplicates(input.signinRuns);
  const batchRuns = input.batches.map(toBatchRunRecord);
  const signinRuns = input.signinRuns.map((run, index) =>
    toSigninRunRecord(run, index, signinDuplicateCounts.get(`${run.taskId}:${run.runAt}`) ?? 1),
  );
  const hotRuns = (input.hotRuns ?? []).map((run) => toHotRunRecord(run, input.hotSources ?? []));
  const runs = [...batchRuns, ...signinRuns, ...hotRuns].sort(compareRunsDesc);

  return {
    runs,
    emptyState:
      runs.length === 0
        ? {
            title: '还没有运行记录',
            description: '普通批次、京东签到运行历史和热点运行会在这里展示。',
          }
        : null,
  };
}
```

- [ ] **Step 3: Add Hot run projection helper**

Add:

```ts
function toHotRunRecord(run: HotRunSummary, hotSources: HotSource[]): UnifiedRunRecord {
  const source = hotSources.find((item) => item.id === run.sourceId);
  return {
    runId: `hot:${run.sourceId}:${run.batchId}`,
    sourceType: 'hot',
    taskId: source?.taskId ?? '',
    batchId: run.batchId,
    rawStatus: run.status,
    statusLabel: getBatchStatusLabel(run.status as TaskBatch['status']),
    startedAt: run.startedAt ?? run.finishedAt ?? '',
    finishedAt: run.finishedAt ?? null,
    error: null,
    debug: {
      sourceId: run.sourceId,
      sourceName: run.sourceName,
      resultCount: run.resultCount,
      reportStatus: run.reportStatus,
    },
    resultCount: run.resultCount,
    reportStatus: run.reportStatus,
    actions: run.reportStatus === 'generated'
      ? ['view-result', 'view-hot-report']
      : ['view-result', 'generate-hot-report'],
    raw: run,
  };
}
```

- [ ] **Step 4: Run view model tests**

```bash
npx vitest run tests/unit/workbench/runMonitorViewModel.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/entries/workbench/task-toolbench/runMonitorViewModel.ts tests/unit/workbench/runMonitorViewModel.test.ts
git commit -m "feat: project hot runs in run monitor"
```

## Task 4: Task Editor Supports Hot Template Save and Run

**Files:**

- Modify: `src/renderer/entries/workbench/pages/TaskEditor.tsx`
- Test: `tests/unit/components/TaskEditorPage.test.tsx`

- [ ] **Step 1: Write failing page test for Hot save**

Add to `tests/unit/components/TaskEditorPage.test.tsx`:

```ts
it('creates a hot source from the hot monitor template', async () => {
  const invoke = vi.fn(async (channel: string) => {
    if (channel === IPC_CHANNELS.HOT_SOURCE_CREATE) {
      return {
        id: 'source-hot',
        taskId: 'task-hot',
        name: '热点监控',
        sourceKind: 'api',
        siteKey: 'trendradar',
        entryUrl: 'https://newsnow.busiyi.world/',
        parserKey: 'newsnow.batch',
        enabled: true,
        tags: [],
        createdAt: '2026-06-03T09:00:00.000Z',
        updatedAt: '2026-06-03T09:00:00.000Z',
      };
    }
    return null;
  });
  mockElectronInvoke(invoke);

  renderWithRouter(<TaskEditor />, { route: '/tasks/editor?templateId=hot-monitor' });

  await userEvent.click(await screen.findByRole('button', { name: /保存草稿/ }));

  expect(invoke).toHaveBeenCalledWith(
    IPC_CHANNELS.HOT_SOURCE_CREATE,
    expect.objectContaining({
      name: '热点监控',
      sourceKind: 'api',
      siteKey: 'trendradar',
      parserKey: 'newsnow.batch',
    }),
  );
});
```

Run:

```bash
npx vitest run tests/unit/components/TaskEditorPage.test.tsx
```

Expected: FAIL because `TaskEditor` only saves signin templates.

- [ ] **Step 2: Add Hot form values and adapter import**

Modify `TaskEditor.tsx` imports:

```ts
import type { HotSource } from '@shared/types';
import {
  buildHotSourceDraft,
  type HotTemplateFormValues,
} from '../task-toolbench/hotTemplateAdapter';
```

Add union form type:

```ts
type TaskEditorFormValues = JdSigninFormValues & HotTemplateFormValues;
```

Change `useForm`:

```ts
const [form] = Form.useForm<TaskEditorFormValues>();
```

- [ ] **Step 3: Add Hot save flow**

Add function in `TaskEditor.tsx`:

```ts
const saveHotTask = async (runAfterSave: boolean) => {
  const values = await form.validateFields();
  const draft = buildHotSourceDraft({
    name: values.name,
    sourceKind: values.sourceKind ?? 'api',
    siteKey: values.siteKey ?? 'trendradar',
    entryUrl: values.entryUrl,
    parserKey: values.parserKey ?? 'newsnow.batch',
    platformIds: values.platformIds,
    sessionId: values.sessionId,
    enabled: values.enabled,
  });

  setSaving(true);
  try {
    const source = await invoke<HotSource>(IPC_CHANNELS.HOT_SOURCE_CREATE, draft);
    message.success(runAfterSave ? '热点任务已保存，开始运行' : '热点任务已保存');

    if (runAfterSave) {
      const started = await invoke<{ sourceId: string; taskId: string; started: boolean }>(
        IPC_CHANNELS.HOT_RUN_START,
        { sourceId: source.id },
      );
      if (!started.started) {
        message.warning('热点任务已保存，但运行启动器未就绪');
      }
      navigate(`/runs?taskId=${encodeURIComponent(source.taskId)}`);
    }

    return source;
  } catch (err) {
    message.error(`保存失败：${normalizeIpcError(err)}`);
    return null;
  } finally {
    setSaving(false);
  }
};
```

Change save button handlers:

```ts
const saveTask = (runAfterSave: boolean) => {
  if (selectedTemplate.adapter === 'hot') return saveHotTask(runAfterSave);
  return saveSigninTask(runAfterSave);
};
```

Use `saveTask(false)` and `saveTask(true)` in buttons.

- [ ] **Step 4: Render Hot fields**

Add Hot-specific form items when `selectedTemplate.adapter === 'hot'`:

```tsx
{selectedTemplate.adapter === 'hot' ? (
  <>
    <Form.Item name="sourceKind" label="来源类型" initialValue="api" rules={[{ required: true }]}>
      <Select
        options={[
          { label: 'API', value: 'api' },
          { label: '浏览器', value: 'browser' },
          { label: 'RSS', value: 'rss' },
        ]}
      />
    </Form.Item>
    <Form.Item name="siteKey" label="站点标识" initialValue="trendradar" rules={[{ required: true, message: '请输入站点标识' }]}>
      <Input placeholder="trendradar" />
    </Form.Item>
    <Form.Item name="parserKey" label="解析器" initialValue="newsnow.batch" rules={[{ required: true, message: '请输入解析器' }]}>
      <Input placeholder="newsnow.batch" />
    </Form.Item>
    <Form.Item name="platformIds" label="平台 ID">
      <Input placeholder="多个平台用英文逗号分隔" />
    </Form.Item>
  </>
) : null}
```

- [ ] **Step 5: Run TaskEditor test**

```bash
npx vitest run tests/unit/components/TaskEditorPage.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/entries/workbench/pages/TaskEditor.tsx tests/unit/components/TaskEditorPage.test.tsx
git commit -m "feat: create hot tasks from task editor"
```

## Task 5: Run Monitor Loads Hot Runs and Generates Reports

**Files:**

- Modify: `src/renderer/entries/workbench/pages/RunMonitor.tsx`
- Test: `tests/unit/components/RunMonitorPage.test.tsx`

- [ ] **Step 1: Write failing page test for Hot runs**

Add to `tests/unit/components/RunMonitorPage.test.tsx`:

```ts
it('loads hot runs and can generate a hot report', async () => {
  const invoke = vi.fn(async (channel: string) => {
    if (channel === IPC_CHANNELS.TASK_LIST) return [];
    if (channel === IPC_CHANNELS.HOT_SOURCE_LIST) {
      return [{ id: 'source-hot', taskId: 'task-hot', name: '热点监控' }];
    }
    if (channel === IPC_CHANNELS.HOT_RUN_LIST) {
      return [
        {
          batchId: 'batch-hot',
          sourceId: 'source-hot',
          sourceName: '热点监控',
          status: 'success',
          resultCount: 3,
          reportStatus: 'pending',
          startedAt: '2026-06-03T10:00:00.000Z',
          finishedAt: '2026-06-03T10:01:00.000Z',
        },
      ];
    }
    if (channel === IPC_CHANNELS.HOT_REPORT_GENERATE) {
      return { id: 'report-hot', sourceId: 'source-hot', batchId: 'batch-hot', title: '热点报告', format: 'html', filePath: '/tmp/report.html', createdAt: '2026-06-03T10:02:00.000Z' };
    }
    return [];
  });
  mockElectronInvoke(invoke);

  renderWithRouter(<RunMonitor />, { route: '/runs' });

  expect(await screen.findByText('hot:source-hot:batch-hot')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /生成报告/ }));

  expect(invoke).toHaveBeenCalledWith(IPC_CHANNELS.HOT_REPORT_GENERATE, {
    sourceId: 'source-hot',
    batchId: 'batch-hot',
    format: 'html',
  });
});
```

Run:

```bash
npx vitest run tests/unit/components/RunMonitorPage.test.tsx
```

Expected: FAIL because `RunMonitor` does not load Hot runs.

- [ ] **Step 2: Load Hot sources and runs**

Modify `RunMonitor.tsx` imports:

```ts
import type { HotRunSummary, HotSource, SigninRunSummary, TaskBatch } from '@shared/types';
```

In `load`, add:

```ts
const [batches, signinRuns, hotSources, hotRuns] = await Promise.all([
  loadBatches(invoke, visibleTasks),
  loadSigninRuns(invoke, visibleTasks.filter(isJdSigninTask)),
  invoke<HotSource[]>(IPC_CHANNELS.HOT_SOURCE_LIST).catch(() => []),
  invoke<HotRunSummary[]>(IPC_CHANNELS.HOT_RUN_LIST, {}).catch(() => []),
]);
const visibleHotSources = selectedTaskId
  ? hotSources.filter((source) => source.taskId === selectedTaskId)
  : hotSources;
const visibleHotSourceIds = new Set(visibleHotSources.map((source) => source.id));
const visibleHotRuns = hotRuns.filter((run) => visibleHotSourceIds.has(run.sourceId));
setRuns(buildRunMonitorViewModel({ batches, signinRuns, hotRuns: visibleHotRuns, hotSources: visibleHotSources }).runs);
```

- [ ] **Step 3: Add report action**

Add function:

```ts
const generateHotReport = async (run: UnifiedRunRecord) => {
  if (run.sourceType !== 'hot' || !run.batchId) return;
  const sourceId = run.runId.split(':')[1];
  try {
    await invoke(IPC_CHANNELS.HOT_REPORT_GENERATE, {
      sourceId,
      batchId: run.batchId,
      format: 'html',
    });
    message.success('热点报告已生成');
    await load();
  } catch (err) {
    message.error(`生成报告失败：${normalizeIpcError(err)}`);
  }
};
```

In list actions, add:

```tsx
run.actions.includes('generate-hot-report') ? (
  <Button key="hot-report" type="link" onClick={() => void generateHotReport(run)}>
    生成报告
  </Button>
) : null
```

- [ ] **Step 4: Display Hot report fields in detail**

Add descriptions:

```tsx
{selectedRun.sourceType === 'hot' ? (
  <>
    <Descriptions.Item label="结果数量">{selectedRun.resultCount ?? 0}</Descriptions.Item>
    <Descriptions.Item label="报告状态">
      {selectedRun.reportStatus === 'generated' ? '已生成' : '未生成'}
    </Descriptions.Item>
  </>
) : null}
```

- [ ] **Step 5: Run page test**

```bash
npx vitest run tests/unit/components/RunMonitorPage.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/entries/workbench/pages/RunMonitor.tsx tests/unit/components/RunMonitorPage.test.tsx
git commit -m "feat: show hot runs in run monitor"
```

## Task 6: Result Library Loads Hot Reports and Standard Data Center Results

**Files:**

- Modify: `src/renderer/entries/workbench/pages/ResultLibrary.tsx`
- Test: `tests/unit/components/ResultLibraryPage.test.tsx`

- [ ] **Step 1: Write failing page test for Hot reports**

Add to `tests/unit/components/ResultLibraryPage.test.tsx`:

```ts
it('loads hot reports and opens hot report files without using standard result export', async () => {
  const invoke = vi.fn(async (channel: string) => {
    if (channel === IPC_CHANNELS.TASK_LIST) return [];
    if (channel === IPC_CHANNELS.RESULT_LIST) return [];
    if (channel === IPC_CHANNELS.HOT_SOURCE_LIST) {
      return [{ id: 'source-hot', taskId: 'task-hot', name: '热点监控' }];
    }
    if (channel === IPC_CHANNELS.HOT_REPORT_LIST) {
      return [{ id: 'report-hot', sourceId: 'source-hot', batchId: 'batch-hot', title: '热点报告', format: 'html', filePath: '/tmp/report.html', createdAt: '2026-06-03T10:00:00.000Z' }];
    }
    if (channel === IPC_CHANNELS.HOT_REPORT_REVEAL) return { revealed: true };
    return [];
  });
  mockElectronInvoke(invoke);

  renderWithRouter(<ResultLibrary />, { route: '/results' });

  expect(await screen.findByText('热点报告')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /打开报告/ }));

  expect(invoke).toHaveBeenCalledWith(IPC_CHANNELS.HOT_REPORT_REVEAL, { reportId: 'report-hot' });
  expect(invoke).not.toHaveBeenCalledWith(IPC_CHANNELS.RESULT_EXPORT, expect.anything());
});
```

Run:

```bash
npx vitest run tests/unit/components/ResultLibraryPage.test.tsx
```

Expected: FAIL because `ResultLibrary` does not load Hot reports.

- [ ] **Step 2: Load Hot reports and sources**

Modify imports:

```ts
import type { ExtractionResult, HotReportSummary, HotSource, SigninRunSummary } from '@shared/types';
```

In `load`, add Hot loads:

```ts
const [standardResults, signinRuns, hotSources, hotReports] = await Promise.all([
  invoke<ExtractionResult[]>(IPC_CHANNELS.RESULT_LIST, { taskId: selectedTaskId }).catch(() => []),
  loadSigninRuns(invoke, tasks.filter((task) => (!selectedTaskId || task.id === selectedTaskId) && isJdSigninTask(task))),
  invoke<HotSource[]>(IPC_CHANNELS.HOT_SOURCE_LIST).catch(() => []),
  invoke<HotReportSummary[]>(IPC_CHANNELS.HOT_REPORT_LIST, {}).catch(() => []),
]);
const visibleHotSources = selectedTaskId
  ? hotSources.filter((source) => source.taskId === selectedTaskId)
  : hotSources;
const visibleHotSourceIds = new Set(visibleHotSources.map((source) => source.id));
const visibleHotReports = hotReports.filter((report) => visibleHotSourceIds.has(report.sourceId));
const model = buildResultLibraryViewModel({
  standardResults,
  signinRuns,
  hotReports: visibleHotReports,
  hotSources: visibleHotSources,
});
```

- [ ] **Step 3: Split export and reveal actions by source type**

Change `exportItem`:

```ts
const exportItem = async (item: UnifiedResultItem) => {
  try {
    if (item.sourceType === 'hot' && item.detailRef.sourceType === 'hot') {
      await invoke(IPC_CHANNELS.HOT_REPORT_REVEAL, { reportId: item.detailRef.reportId });
      message.success('已打开报告位置');
      return;
    }

    if (item.sourceType === 'standard') {
      const path = await invoke<string>(IPC_CHANNELS.RESULT_EXPORT, {
        taskId: item.taskId,
        batchId: item.batchId ?? undefined,
        format: 'json',
      });
      message.success(`已导出：${path}`);
      return;
    }

    const blob = new Blob([JSON.stringify(item.raw, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${item.id.replace(/[:/]/g, '-')}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    message.success('已生成专项 JSON 导出');
  } catch (err) {
    message.error(`导出失败：${normalizeIpcError(err)}`);
  }
};
```

Change button label:

```tsx
{item.sourceType === 'hot' ? '打开报告' : 'JSON'}
```

- [ ] **Step 4: Display detail ref labels correctly**

Change detail entry text:

```tsx
{selected.detailRef.sourceType === 'standard'
  ? 'RESULT_DETAIL'
  : selected.detailRef.sourceType === 'signin'
    ? 'SIGNIN_TASK_HISTORY'
    : 'HOT_REPORT_DETAIL'}
```

- [ ] **Step 5: Run page test**

```bash
npx vitest run tests/unit/components/ResultLibraryPage.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/entries/workbench/pages/ResultLibrary.tsx tests/unit/components/ResultLibraryPage.test.tsx
git commit -m "feat: show hot reports in result library"
```

## Task 7: Standard Result Data Center Export Flow

**Files:**

- Modify: `src/renderer/entries/workbench/pages/ResultLibrary.tsx`
- Test: `tests/unit/components/ResultLibraryPage.test.tsx`

- [ ] **Step 1: Write failing Data Center export test**

Add to `tests/unit/components/ResultLibraryPage.test.tsx`:

```ts
it('uses Data Center export jobs for standard result export', async () => {
  const invoke = vi.fn(async (channel: string) => {
    if (channel === IPC_CHANNELS.TASK_LIST) return [];
    if (channel === IPC_CHANNELS.RESULT_LIST) {
      return [
        {
          id: 'result-1',
          taskId: 'task-1',
          batchId: 'batch-1',
          data: { title: '标准结果' },
          status: 'normal',
          createdAt: '2026-06-03T10:00:00.000Z',
        },
      ];
    }
    if (channel === IPC_CHANNELS.HOT_SOURCE_LIST || channel === IPC_CHANNELS.HOT_REPORT_LIST) return [];
    if (channel === IPC_CHANNELS.DATA_CENTER_EXPORTS_CREATE) {
      return { id: 'export-1', status: 'succeeded', outputPath: '/tmp/export.json' };
    }
    return [];
  });
  mockElectronInvoke(invoke);

  renderWithRouter(<ResultLibrary />, { route: '/results' });

  expect(await screen.findByText('标准结果')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /JSON/ }));

  expect(invoke).toHaveBeenCalledWith(
    IPC_CHANNELS.DATA_CENTER_EXPORTS_CREATE,
    expect.objectContaining({
      query: { taskId: 'task-1', batchId: 'batch-1' },
      format: 'json',
    }),
  );
});
```

Run:

```bash
npx vitest run tests/unit/components/ResultLibraryPage.test.tsx
```

Expected: FAIL because standard export still uses `RESULT_EXPORT`.

- [ ] **Step 2: Route standard export through Data Center**

Replace standard branch in `exportItem`:

```ts
if (item.sourceType === 'standard') {
  const job = await invoke<{ id: string; status: string; outputPath?: string; error?: string }>(
    IPC_CHANNELS.DATA_CENTER_EXPORTS_CREATE,
    {
      query: {
        taskId: item.taskId,
        batchId: item.batchId ?? undefined,
      },
      format: 'json',
      targetType: 'file',
      targetConfig: {},
    },
  );
  if (job.status === 'failed') {
    message.error(`导出失败：${job.error ?? '未知错误'}`);
  } else {
    message.success(job.outputPath ? `导出任务完成：${job.outputPath}` : `导出任务已创建：${job.id}`);
  }
  return;
}
```

- [ ] **Step 3: Run Result Library tests**

```bash
npx vitest run tests/unit/components/ResultLibraryPage.test.tsx
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/entries/workbench/pages/ResultLibrary.tsx tests/unit/components/ResultLibraryPage.test.tsx
git commit -m "feat: export standard results through data center"
```

## Task 8: Second-Round Verification

**Files:**

- Modify: `docs/plans/task-toolbench-v1.md`

- [ ] **Step 1: Run focused unit tests**

```bash
npx vitest run \
  tests/unit/workbench/hotTemplateAdapter.test.ts \
  tests/unit/workbench/templates.test.ts \
  tests/unit/workbench/resultLibraryViewModel.test.ts \
  tests/unit/workbench/runMonitorViewModel.test.ts \
  tests/unit/components/TaskEditorPage.test.tsx \
  tests/unit/components/RunMonitorPage.test.tsx \
  tests/unit/components/ResultLibraryPage.test.tsx
```

Expected: all listed test files pass.

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

Expected: command exits with code 0.

- [ ] **Step 3: Run lint**

```bash
npm run lint
```

Expected: no new lint errors. Existing warnings may remain if they predate this work.

- [ ] **Step 4: Run build**

```bash
npm run build
```

Expected: command exits with code 0.

- [ ] **Step 5: Update total V1 plan**

Modify `docs/plans/task-toolbench-v1.md` Phase 3 to state:

```md
### Phase 3：第二轮结果与热点闭环

包含任务包：

- P1-02A 结果库统一展示模型增强。
- P1-02B 热点监控模板适配。
- P1-02C 热点运行监控接入。
- P1-02D 热点报告进入结果库。
- P1-02E 标准结果导出与 Data Center 接入。

暂缓：

- P1-03 评论监控模板适配。
- P1-04 AI 任务助手收敛。
- P2-01 能力中心整理。

阶段验收：

- 热点模板能创建 HotSource 和关联 TaskFlow。
- 热点运行能在运行监控中展示标准批次状态。
- 热点报告能生成、查看并进入结果库。
- 结果库能同时展示 standard、signin、hot 来源。
- 标准结果导出走 Data Center 导出任务。
```

- [ ] **Step 6: Commit**

```bash
git add docs/plans/task-toolbench-v1.md
git commit -m "docs: align phase three with hot monitor scope"
```

## Final Acceptance

Second-round implementation is acceptable only when all conditions are true:

- `hot-monitor` template is `ready`.
- Hot template save calls `HOT_SOURCE_CREATE`.
- Hot save-and-run calls `HOT_RUN_START`.
- `started: false` is visible to the user and is not treated as running.
- Run Monitor displays Hot batch status, `resultCount`, and `reportStatus`.
- `reportStatus` does not change `TaskBatchStatus`.
- Hot reports generate only `md` or `html`.
- Hot reports enter Result Library as `sourceType = hot`.
- Standard results still enter Result Library as `sourceType = standard`.
- Signin results still enter Result Library as `sourceType = signin`.
- Standard result export uses Data Center export jobs.
- Hot report reveal uses `HOT_REPORT_REVEAL`.
- Comment, AI assistant, Capability Center, and unified result migration remain outside this implementation.
