# 热点采集任务黄金路径 Phase 1 实施计划

> **给执行 agent 的要求：** 必须使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans` 按任务逐步执行本计划。步骤使用 checkbox（`- [ ]` / `- [x]`）格式跟踪。

**目标：** 打通多平台 NewsNow / TrendRadar 热点任务的最小真实闭环：创建任务、运行批次、查看结果数量、生成 HTML 报告，并能追踪 `Task / Batch / Result / Report` 关系。

**架构：** 不重做 Hot Monitor。复用现有 `createTrendRadarBatchDraft()`、`HotSourceService`、`HotRunProjectionService`、`HotReportService` 和 Hot Monitor 页面，只增加黄金路径优先入口、运行详情追踪字段和失败/空结果提示。第一版不新增数据库结构，不新增 IPC channel。

**技术栈：** Electron renderer、React 18、Ant Design、Ant Design Pro `ProTable`、Vitest、Testing Library、现有类型化 IPC 常量。

---

## 文件结构

| 文件 | 职责 |
| --- | --- |
| `tests/unit/components/HotMonitorApp.test.tsx` | 锁定 Hot Monitor 黄金路径：默认多平台创建、聚合运行、报告生成、运行详情追踪、失败提示 |
| `tests/unit/services/HotRunProjectionService.test.ts` | 锁定 Hot run 投影字段：`taskId`、`batchId`、结果 ID、报告状态、错误信息 |
| `src/renderer/entries/hot-monitor/App.tsx` | 调整 Hot Monitor 主操作，让多平台聚合成为最明确的首选路径 |
| `src/renderer/entries/browser/components/HotRunPanel.tsx` | 在运行详情中展示 `sourceId`、`batchId`、报告状态、空结果提示和失败摘要 |
| `src/renderer/entries/hot-monitor/newsnowPresets.ts` | 保持多平台默认草稿来源，必要时只补命名或导出常量 |
| `docs/overview/current-status.md` | 可选：Phase 1 实现后标记热点黄金路径状态 |

## 现有上下文

| 现有项目 | 当前行为 |
| --- | --- |
| `createTrendRadarBatchDraft()` | 返回 `name: '多平台热榜'`、`siteKey: 'trendradar'`、`parserKey: 'newsnow.batch'`、默认 11 个平台 |
| `startTrendRadarAggregateRun()` | 无选中聚合源时创建默认源，然后启动运行；成功后生成 HTML 报告 |
| `HotRunDetailView` | 已显示状态、任务、关联结果、断点、错误和步骤结果，但缺少 `sourceId`、`batchId`、报告状态和空结果提示 |
| `HotRunProjectionService.getRunDetail()` | 返回 `taskId`、`error`、`breakpoint`、`stepResults`、`linkedResultIds`，并继承 summary 的 `batchId`、`sourceId`、`reportStatus` |

---

### 任务 1：锁定 Phase 1 黄金路径组件测试

**文件：**
- 修改：`tests/unit/components/HotMonitorApp.test.tsx`

- [x] **步骤 1：新增测试，确认 Hot Monitor 主路径突出多平台创建**

把下面测试加到现有多平台相关测试附近：

```tsx
it('presents multi-platform aggregation as the phase 1 golden path', async () => {
  render(<HotMonitorApp />);

  expect(await screen.findByText('多平台聚合采集')).toBeDefined();
  expect(screen.getByRole('button', { name: '运行多平台热榜' })).toBeDefined();

  fireEvent.click(screen.getByRole('button', { name: '多平台热榜' }));

  expect(await screen.findByRole('dialog', { name: '新增采集任务' })).toBeDefined();
  expect(screen.getByDisplayValue('多平台热榜')).toBeDefined();
  expect(screen.getByDisplayValue('https://newsnow.busiyi.world/api/s')).toBeDefined();
  expect(screen.getByDisplayValue('newsnow.batch')).toBeDefined();
});
```

- [x] **步骤 2：运行组件测试，确认当前标签不匹配时进入 RED**

运行：

```bash
npm test -- tests/unit/components/HotMonitorApp.test.tsx
```

实现前预期：如果当前 UI 已经有完全一致标签，则可能直接 PASS；否则应 FAIL，原因是主路径标签尚未匹配 `多平台聚合采集` / `运行多平台热榜`。

- [x] **步骤 3：新增或扩展测试，确认聚合运行会创建/复用默认多平台源并生成 HTML 报告**

如果现有 `starts an aggregate crawl without requiring a selected source` 测试已经覆盖主体流程，就扩展该测试，不要重复新增同类测试：

```tsx
expect(invokeMock).toHaveBeenCalledWith(IPC_CHANNELS.HOT_SOURCE_CREATE, {
  name: '多平台热榜',
  sourceKind: 'api',
  siteKey: 'trendradar',
  entryUrl: 'https://newsnow.busiyi.world/api/s',
  parserKey: 'newsnow.batch',
  platformIds: [
    'toutiao',
    'baidu',
    'wallstreetcn-hot',
    'thepaper',
    'bilibili-hot-search',
    'cls-hot',
    'ifeng',
    'tieba',
    'weibo',
    'douyin',
    'zhihu',
  ],
  enabled: true,
  tags: ['多平台', '热榜'],
});

expect(invokeMock).toHaveBeenCalledWith(IPC_CHANNELS.HOT_RUN_START, {
  sourceId: 'source-trendradar',
});
expect(invokeMock).toHaveBeenCalledWith(IPC_CHANNELS.HOT_REPORT_GENERATE, {
  sourceId: 'source-trendradar',
  batchId: 'batch-trendradar-1',
  format: 'html',
});
```

- [x] **步骤 4：新增测试，确认运行详情展示追踪标识**

在现有 `only shows task actions for matching statuses and opens failed details in a modal` 测试里，扩展 `HOT_RUN_DETAIL` mock 返回：

```tsx
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
  error: '页面结构变化',
  breakpoint: {
    stepIndex: 1,
    reason: 'selector-timeout',
    error: '未找到热点列表',
  },
  stepResults: [],
  linkedResultIds: [],
};
```

打开运行详情弹窗后断言：

```tsx
expect(screen.getByText('Source：source-failed')).toBeDefined();
expect(screen.getByText('Task：task-failed')).toBeDefined();
expect(screen.getByText('Batch：batch-failed')).toBeDefined();
expect(screen.getByText('报告：pending')).toBeDefined();
expect(screen.getByText('未抽取到记录')).toBeDefined();
expect(screen.getByText(/页面结构变化/)).toBeDefined();
```

- [x] **步骤 5：运行聚焦组件测试**

运行：

```bash
npm test -- tests/unit/components/HotMonitorApp.test.tsx
```

实现前预期：如果 `HotRunDetailView` 还没有渲染这些追踪字段，应在新增断言处 FAIL。

---

### 任务 2：锁定运行投影服务的追踪字段

**文件：**
- 修改：`tests/unit/services/HotRunProjectionService.test.ts`

- [x] **步骤 1：新增或扩展运行详情投影字段测试**

如果现有文件里没有等价断言，新增下面测试：

```ts
it('projects task batch result and report trace fields into hot run detail', () => {
  const service = new HotRunProjectionService({
    sourceRepository: {
      listSources: () => [],
      getSource: () => ({
        id: 'source-trendradar',
        taskId: 'task-trendradar',
        name: '多平台热榜',
      }),
    },
    batchService: {
      listBatchesByTask: () => [],
      getBatch: () => ({
        id: 'batch-trendradar-1',
        taskId: 'task-trendradar',
        status: 'success',
        startedAt: '2026-05-18T01:00:00.000Z',
        finishedAt: '2026-05-18T01:02:00.000Z',
        stepResults: [],
      }),
    },
    resultService: {
      listResults: () => [
        { id: 'result-1' },
        { id: 'result-2' },
      ],
    },
    reportRepository: {
      getReportByBatchId: () => ({
        id: 'report-1',
      }),
    },
  } as unknown as ConstructorParameters<typeof HotRunProjectionService>[0]);

  const detail = service.getRunDetail('source-trendradar', 'batch-trendradar-1');

  expect(detail).toMatchObject({
    sourceId: 'source-trendradar',
    sourceName: '多平台热榜',
    taskId: 'task-trendradar',
    batchId: 'batch-trendradar-1',
    status: 'success',
    resultCount: 2,
    reportStatus: 'generated',
    linkedResultIds: ['result-1', 'result-2'],
  });
});
```

如果现有测试夹具要求完整 result/report 对象，优先复用 `HotRunProjectionService.test.ts` 里已有 helper，不要照搬上面的简化对象。

- [x] **步骤 2：运行服务测试**

运行：

```bash
npm test -- tests/unit/services/HotRunProjectionService.test.ts
```

预期：如果服务已经投影这些字段，应 PASS；否则 FAIL，并在任务 4 中做最小实现修正。

---

### 任务 3：让多平台聚合成为可见的主路径

**文件：**
- 修改：`src/renderer/entries/hot-monitor/App.tsx`
- 测试：`tests/unit/components/HotMonitorApp.test.tsx`

- [x] **步骤 1：定位 Hot Monitor 主操作区域**

在 `src/renderer/entries/hot-monitor/App.tsx` 中找到以下区域：

```tsx
<Button type="primary" onClick={startTrendRadarAggregateRun}>
```

以及打开多平台草稿的按钮：

```tsx
openTaskModal(createTrendRadarBatchDraft());
```

- [x] **步骤 2：更新标签，让黄金路径更明确**

使用这些文案：

```tsx
<Tag color="geekblue">Phase 1 黄金路径</Tag>
<Button type="primary" onClick={startTrendRadarAggregateRun}>
  运行多平台热榜
</Button>
<Button onClick={() => openTaskModal(createTrendRadarBatchDraft())}>
  多平台热榜
</Button>
```

保留现有 NewsNow preset 和 RSS 操作。

- [x] **步骤 3：确认 `openTaskModal(createTrendRadarBatchDraft())` 会重置编辑状态**

如果当前 `openTaskModal` 已经调用 `setEditingSourceId(null)`，保持现状即可。不要新增 modal 或 route。

- [x] **步骤 4：运行组件测试**

运行：

```bash
npm test -- tests/unit/components/HotMonitorApp.test.tsx
```

预期：黄金路径标签测试通过。

---

### 任务 4：在运行详情中展示追踪字段、失败信息和空结果提示

**文件：**
- 修改：`src/renderer/entries/browser/components/HotRunPanel.tsx`
- 测试：`tests/unit/components/HotMonitorApp.test.tsx`
- 测试：`tests/unit/services/HotRunProjectionService.test.ts`

- [x] **步骤 1：更新 `HotRunDetailView` 元信息区域**

在 `HotRunDetailView` 中，把当前摘要行替换成明确追踪字段：

```tsx
<div className="browser-workspace-summary">
  Source：{detail.sourceId}
</div>
<div className="browser-workspace-summary">
  Task：{detail.taskId}
</div>
<div className="browser-workspace-summary">
  Batch：{detail.batchId}
</div>
<div className="browser-workspace-summary">
  状态：{detail.status} · 报告：{detail.reportStatus}
</div>
<div className="browser-workspace-summary">
  关联结果 {detail.linkedResultIds.length} 条
</div>
```

- [x] **步骤 2：增加空结果提示**

在关联结果数量下方渲染这个条件块：

```tsx
{detail.linkedResultIds.length === 0 ? (
  <div className="browser-workspace-summary">
    未抽取到记录
  </div>
) : null}
```

- [x] **步骤 3：保留现有断点和步骤结果输出**

不要删除：

```tsx
失败定位：{formatBreakpoint(detail.breakpoint)}
断点错误：{detail.breakpoint?.error ?? '无'}
错误：{detail.error ?? '无'}
```

- [x] **步骤 4：运行组件和服务测试**

运行：

```bash
npm test -- tests/unit/components/HotMonitorApp.test.tsx tests/unit/services/HotRunProjectionService.test.ts
```

预期：PASS。

---

### 任务 5：增加实用的 Data Center 交接入口

**文件：**
- 修改：`src/renderer/entries/hot-monitor/App.tsx`
- 测试：`tests/unit/components/HotMonitorApp.test.tsx`

- [x] **步骤 1：如果尚未引入导航能力，则引入 `useNavigate`**

在 `HotMonitorApp` 顶部添加：

```tsx
import { useNavigate } from 'react-router-dom';
```

在组件内部添加：

```tsx
const navigate = useNavigate();
```

如果现有测试没有 mock `react-router-dom`，添加：

```tsx
const { navigateMock } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}));
```

如果文件里已有 `vi.hoisted`，把 `navigateMock` 合并进去，不要新增第二个 hoisted block。

- [x] **步骤 2：在运行详情里增加 Data Center 操作**

在运行详情弹窗 footer 或详情区域中，只在 `runDetail` 存在时添加按钮：

```tsx
<Button
  onClick={() =>
    navigate('/data-center', {
      state: {
        batchId: runDetail.batchId,
        taskId: runDetail.taskId,
        source: 'hot-monitor',
      },
    })
  }
>
  查看结果中心
</Button>
```

本任务不实现 Data Center 过滤。

- [x] **步骤 3：增加组件测试断言**

在 `HotMonitorApp.test.tsx` 打开运行详情后点击：

```tsx
fireEvent.click(screen.getByRole('button', { name: '查看结果中心' }));

expect(navigateMock).toHaveBeenCalledWith('/data-center', {
  state: {
    batchId: 'batch-failed',
    taskId: 'task-failed',
    source: 'hot-monitor',
  },
});
```

- [x] **步骤 4：运行组件测试**

运行：

```bash
npm test -- tests/unit/components/HotMonitorApp.test.tsx
```

预期：PASS。

---

### 任务 6：验证与文档对齐

**文件：**
- 修改：`docs/overview/current-status.md`

- [x] **步骤 1：代码变绿后更新当前状态文档**

在 `docs/overview/current-status.md` 中更新 Hot Monitor 行或产品收敛行，加入：

```markdown
多平台 NewsNow / TrendRadar 热点采集黄金路径已进入 Phase 1，实现创建、运行、结果数量、HTML 报告和 Task / Batch / Report 追踪的最小闭环。
```

- [x] **步骤 2：运行聚焦测试**

运行：

```bash
npm test -- tests/unit/components/HotMonitorApp.test.tsx tests/unit/services/HotRunProjectionService.test.ts tests/unit/components/Home.test.tsx
```

预期：PASS。

- [x] **步骤 3：运行类型检查**

运行：

```bash
npm run typecheck
```

预期：PASS。

- [x] **步骤 4：运行 lint**

运行：

```bash
npm run lint
```

预期：exit 0。无关旧文件中的 warning 可以保留，但新增或修改文件不应引入新的 warning。

- [x] **步骤 5：检查 git 状态**

运行：

```bash
git status --short --branch
```

预期：只出现本 Phase 1 计划内文件变更。

---

## 自查

| 检查项 | 结果 |
| --- | --- |
| 规格覆盖 | 覆盖默认多平台路径、运行、结果数量、报告、追踪字段、失败展示、Data Center 交接 |
| 范围控制 | 排除 Runner 稳定化、Browser 介入、完整 Alert/Review、Data Center 深度过滤 |
| 占位扫描 | 无待定占位；每个任务都有明确文件、代码片段、命令和预期结果 |
| 类型一致性 | 使用现有 `HotRunDetail` 字段：`sourceId`、`taskId`、`batchId`、`reportStatus`、`linkedResultIds`、`error`、`breakpoint` |
| 提交策略 | 本计划刻意不包含 commit 步骤，因为项目 `AGENTS.md` 已要求未经用户明确允许不得提交 |
