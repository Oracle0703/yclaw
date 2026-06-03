# 热点报告工作台增强 Phase 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **本仓库额外约束：** 未经用户明确允许，不允许提交 commit。本计划中的所有 `git commit` 步骤一律省略；完成后只汇报变更和验证结果。

**Goal:** 增强 Hot Monitor 报告工作台，让报告列表和报告预览能清楚展示 Source / Task / Batch / Report 上下文，并能从报告继续进入运行详情或 Data Center。

**Architecture:** 不新增数据库字段、不新增 IPC 通道。复用现有 `HotReportSummary.sourceId/batchId/id`、已加载的 `runs` 与 `sources` 推导 `taskId` 和 source 名称；复用现有 `HOT_RUN_DETAIL`、`HOT_REPORT_DETAIL`、`HOT_REPORT_REVEAL`、`HOT_REPORT_DELETE` 和 `/data-center` route state 协议。

**Tech Stack:** React 18、TypeScript、Ant Design、Vitest、Testing Library、现有 `useIpc().invoke` 和 `react-router-dom/useNavigate`。

---

## 文件结构

| 文件 | 职责 |
| --- | --- |
| `tests/unit/components/HotMonitorApp.test.tsx` | 先用 RED 测试锁定报告列表元数据、空态、预览摘要、结果中心跳转和运行详情回看 |
| `src/renderer/entries/browser/components/HotReportPanel.tsx` | 增强报告列表卡片，显示 Source / Batch / Report 和更明确空态 |
| `src/renderer/entries/hot-monitor/App.tsx` | 预览抽屉增加上下文摘要和操作；实现报告到运行详情 / Data Center 的跳转 |
| `src/renderer/entries/hot-monitor/styles.css` | 给报告预览摘要区补少量样式 |
| `docs/overview/current-status.md` | Phase 3 完成后更新 Hot Monitor 报告工作台现状 |

## 现有上下文

| 现有项目 | 当前行为 |
| --- | --- |
| `HotReportSummary` | 有 `id/sourceId/batchId/title/format/filePath/content?/createdAt`，没有 `taskId` |
| `runs` | `HotRunSummary[]` 有 `sourceId/batchId/resultCount/reportStatus`，没有 `taskId` |
| `sources` | `HotSource[]` 有 `id/taskId/name`，可通过 `sourceId` 推导 `taskId` |
| 报告预览 | `previewReportDetail(report)` 调用 `HOT_REPORT_DETAIL` 后把详情放入 `previewReport` |
| 运行详情 | `viewRunDetail(run)` 调用 `HOT_RUN_DETAIL({ sourceId, batchId })` 并打开现有运行详情 Modal |
| Data Center 交接 | 运行详情 Modal 已能 `navigate('/data-center', { state: { batchId, taskId, source: 'hot-monitor' } })` |

---

### Task 1: 锁定报告列表元数据与空态 RED 测试

**Files:**
- Modify: `tests/unit/components/HotMonitorApp.test.tsx`

- [ ] **Step 1: 扩展现有报告列表测试断言**

找到测试：

```tsx
it('shows reports as compact rows without file paths and can reveal storage location', async () => {
```

在 `expect(screen.queryByText('E:/allsite/yclaw/output/html/2026-05-06/16-15.html')).toBeNull();` 后追加：

```tsx
expect(screen.getAllByText('Source：source-1').length).toBeGreaterThan(0);
expect(screen.getAllByText('Batch：batch-1').length).toBeGreaterThan(0);
expect(screen.getAllByText('Report：report-1').length).toBeGreaterThan(0);
```

- [ ] **Step 2: 新增无报告空态 RED 测试**

在报告相关测试附近新增：

```tsx
it('shows an actionable empty state when no hot reports exist', async () => {
  invokeMock.mockImplementation(async (channel: string) => {
    if (channel === IPC_CHANNELS.HOT_SOURCE_LIST) return [];
    if (channel === IPC_CHANNELS.HOT_RUN_LIST) return [];
    if (channel === IPC_CHANNELS.HOT_REPORT_LIST) return [];
    if (channel === IPC_CHANNELS.HOT_TIMELINE_PRESETS) return [];
    return null;
  });

  render(<HotMonitorApp />);

  expect(await screen.findByText('暂无报告，成功运行后可生成 HTML 报告。')).toBeDefined();
});
```

- [ ] **Step 3: 运行测试确认 RED**

Run:

```bash
cmd.exe /c npm test -- tests/unit/components/HotMonitorApp.test.tsx
```

Expected: FAIL，原因是报告行还没有显示 `Source：source-1`、`Batch：batch-1`、`Report：report-1`，空态仍是旧文案 `暂无报告`。

---

### Task 2: 增强 `HotReportPanel` 报告列表展示

**Files:**
- Modify: `src/renderer/entries/browser/components/HotReportPanel.tsx`
- Test: `tests/unit/components/HotMonitorApp.test.tsx`

- [ ] **Step 1: 增强空态文案**

把：

```tsx
<div className="browser-workspace-action-description">暂无报告</div>
```

改为：

```tsx
<div className="browser-workspace-action-description">
  暂无报告，成功运行后可生成 HTML 报告。
</div>
```

- [ ] **Step 2: 在报告行加入上下文元数据**

在报告标题和格式时间下方新增一段元数据：

```tsx
<div className="browser-workspace-action-meta">
  Source：{report.sourceId} · Batch：{report.batchId} · Report：{report.id}
</div>
```

插入后的报告主体应保持这个结构：

```tsx
<div className="hot-report-row-main">
  <div className="browser-workspace-action-title">{report.title}</div>
  <div className="browser-workspace-action-meta">
    {report.format} · {props.formatTime?.(report.createdAt) ?? report.createdAt}
  </div>
  <div className="browser-workspace-action-meta">
    Source：{report.sourceId} · Batch：{report.batchId} · Report：{report.id}
  </div>
</div>
```

- [ ] **Step 3: 运行 Hot Monitor 测试**

Run:

```bash
cmd.exe /c npm test -- tests/unit/components/HotMonitorApp.test.tsx
```

Expected: PASS 或只剩后续还未新增的预览增强测试。当前 Task 1 新增的列表与空态断言应通过。

---

### Task 3: 锁定报告预览摘要与结果中心跳转 RED 测试

**Files:**
- Modify: `tests/unit/components/HotMonitorApp.test.tsx`

- [ ] **Step 1: 扩展预览抽屉断言**

在 `shows reports as compact rows without file paths and can reveal storage location` 测试中，找到：

```tsx
const previewDrawer = await screen.findByRole('dialog', { name: '报告预览' });
expect(within(previewDrawer).getByTitle('AI 热榜 报告')).toBeDefined();
expect(within(previewDrawer).getByRole('button', { name: '关闭预览' })).toBeDefined();
```

在其后追加：

```tsx
expect(within(previewDrawer).getByText('Source：source-1')).toBeDefined();
expect(within(previewDrawer).getByText('Task：task-1')).toBeDefined();
expect(within(previewDrawer).getByText('Batch：batch-1')).toBeDefined();
expect(within(previewDrawer).getByText('Report：report-1')).toBeDefined();
expect(within(previewDrawer).getByText('格式：html')).toBeDefined();
expect(within(previewDrawer).getByRole('button', { name: '查看结果中心' })).toBeDefined();
```

- [ ] **Step 2: 增加结果中心跳转 RED 断言**

仍在同一个测试中，在关闭预览前增加：

```tsx
fireEvent.click(within(previewDrawer).getByRole('button', { name: '查看结果中心' }));
expect(navigateMock).toHaveBeenCalledWith('/data-center', {
  state: {
    batchId: 'batch-1',
    taskId: 'task-1',
    source: 'hot-monitor',
  },
});
```

- [ ] **Step 3: 运行测试确认 RED**

Run:

```bash
cmd.exe /c npm test -- tests/unit/components/HotMonitorApp.test.tsx
```

Expected: FAIL，原因是报告预览抽屉还没有上下文摘要和“查看结果中心”按钮。

---

### Task 4: 实现报告预览摘要和结果中心跳转

**Files:**
- Modify: `src/renderer/entries/hot-monitor/App.tsx`
- Modify: `src/renderer/entries/hot-monitor/styles.css`
- Test: `tests/unit/components/HotMonitorApp.test.tsx`

- [ ] **Step 1: 在 `App.tsx` 中增加报告上下文解析函数**

在 `const recentReports = sortedReports.slice(0, 3);` 下方加入：

```tsx
const getReportContext = (report: HotReportSummary | null) => {
  if (!report) {
    return null;
  }

  const source = sources.find((item) => item.id === report.sourceId) ?? null;
  const run = runs.find((item) => item.sourceId === report.sourceId && item.batchId === report.batchId) ?? null;

  return {
    sourceId: report.sourceId,
    sourceName: source?.name ?? run?.sourceName ?? report.sourceId,
    taskId: source?.taskId,
    batchId: report.batchId,
    reportId: report.id,
    format: report.format,
    createdAt: report.createdAt,
  };
};
```

- [ ] **Step 2: 在组件渲染前计算预览上下文**

在 `return (` 前加入：

```tsx
const previewReportContext = getReportContext(previewReport);
```

注意该常量必须放在 React 组件函数体内、`return` 前。

- [ ] **Step 3: 增加结果中心跳转函数**

在 `previewReportDetail` 函数后增加：

```tsx
const openReportResults = (report: HotReportSummary) => {
  const context = getReportContext(report);
  if (!context?.taskId) {
    message.error('当前报告缺少任务上下文，无法进入结果中心');
    return;
  }

  navigate('/data-center', {
    state: {
      batchId: context.batchId,
      taskId: context.taskId,
      source: 'hot-monitor',
    },
  });
};
```

- [ ] **Step 4: 增强报告预览抽屉头部**

把预览抽屉中的：

```tsx
<div className="hot-report-preview-head">
  <div className="browser-workspace-section-title">{previewReport.title}</div>
  <Button onClick={() => setPreviewReport(null)}>
    关闭预览
  </Button>
</div>
```

替换为：

```tsx
<div className="hot-report-preview-head">
  <div className="hot-report-preview-title-group">
    <div className="browser-workspace-section-title">{previewReport.title}</div>
    {previewReportContext ? (
      <div className="hot-report-preview-meta">
        <span>Source：{previewReportContext.sourceId}</span>
        {previewReportContext.taskId ? <span>Task：{previewReportContext.taskId}</span> : null}
        <span>Batch：{previewReportContext.batchId}</span>
        <span>Report：{previewReportContext.reportId}</span>
        <span>格式：{previewReportContext.format}</span>
      </div>
    ) : null}
  </div>
  <Space wrap>
    {previewReportContext?.taskId ? (
      <Button onClick={() => openReportResults(previewReport)}>
        查看结果中心
      </Button>
    ) : null}
    <Button onClick={() => void revealReport(previewReport)}>
      打开存储位置
    </Button>
    <Button onClick={() => setPreviewReport(null)}>
      关闭预览
    </Button>
  </Space>
</div>
```

- [ ] **Step 5: 给摘要区补样式**

在 `src/renderer/entries/hot-monitor/styles.css` 的 `.hot-report-preview-head` 后加入：

```css
.hot-report-preview-title-group {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 6px;
}

.hot-report-preview-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 12px;
  color: #64748b;
  font-size: 12px;
}
```

- [ ] **Step 6: 运行 Hot Monitor 测试**

Run:

```bash
cmd.exe /c npm test -- tests/unit/components/HotMonitorApp.test.tsx
```

Expected: PASS 或只剩后续运行详情回看测试未添加。

---

### Task 5: 锁定并实现报告预览回看运行详情

**Files:**
- Modify: `tests/unit/components/HotMonitorApp.test.tsx`
- Modify: `src/renderer/entries/hot-monitor/App.tsx`

- [ ] **Step 1: 增加运行详情 IPC mock**

在默认 `beforeEach` 的 `invokeMock.mockImplementation` 中，给 `IPC_CHANNELS.HOT_RUN_DETAIL` 增加返回：

```tsx
if (channel === IPC_CHANNELS.HOT_RUN_DETAIL) {
  return {
    batchId: 'batch-1',
    sourceId: 'source-1',
    sourceName: 'AI 热榜',
    taskId: 'task-1',
    status: 'success',
    startedAt: '2026-05-06T00:00:00.000Z',
    finishedAt: '2026-05-06T00:02:00.000Z',
    resultCount: 3,
    reportStatus: 'generated',
    stepResults: [],
    linkedResultIds: ['result-1', 'result-2', 'result-3'],
  };
}
```

- [ ] **Step 2: 扩展报告预览测试的 RED 断言**

在 `shows reports as compact rows without file paths and can reveal storage location` 测试中，预览抽屉断言后追加：

```tsx
fireEvent.click(within(previewDrawer).getByRole('button', { name: '查看运行详情' }));
expect(await screen.findByRole('dialog', { name: '运行详情' })).toBeDefined();
expect(screen.getByText('Task：task-1')).toBeDefined();
expect(screen.getByText('Batch：batch-1')).toBeDefined();
expect(invokeMock).toHaveBeenCalledWith(IPC_CHANNELS.HOT_RUN_DETAIL, {
  sourceId: 'source-1',
  batchId: 'batch-1',
});
```

- [ ] **Step 3: 运行测试确认 RED**

Run:

```bash
cmd.exe /c npm test -- tests/unit/components/HotMonitorApp.test.tsx
```

Expected: FAIL，原因是预览抽屉还没有“查看运行详情”按钮。

- [ ] **Step 4: 在预览抽屉增加“查看运行详情”按钮**

在 Task 4 的 `<Space wrap>` 中，在“查看结果中心”前插入：

```tsx
<Button onClick={() => void viewRunDetail({
  batchId: previewReport.batchId,
  sourceId: previewReport.sourceId,
  sourceName: previewReportContext?.sourceName ?? previewReport.sourceId,
  status: 'success',
  startedAt: null,
  finishedAt: null,
  resultCount: 0,
  reportStatus: 'generated',
})}>
  查看运行详情
</Button>
```

说明：`viewRunDetail` 只使用 `sourceId` 和 `batchId` 发起 IPC，请保持这个对象最小化，不新增后端依赖。

- [ ] **Step 5: 运行 Hot Monitor 测试**

Run:

```bash
cmd.exe /c npm test -- tests/unit/components/HotMonitorApp.test.tsx
```

Expected: PASS。

---

### Task 6: 更新当前状态文档并跑聚焦验证

**Files:**
- Modify: `docs/overview/current-status.md`

- [ ] **Step 1: 更新当前状态文档**

在 `热点监控` 或 `docs/specs/hot-monitor-v1.md` 行中加入：

```md
热点报告工作台已能在报告列表和预览抽屉展示 Source / Batch / Report 上下文，并可从报告继续进入运行详情或结果中心。
```

- [ ] **Step 2: 运行聚焦测试**

Run:

```bash
cmd.exe /c npm test -- tests/unit/components/HotMonitorApp.test.tsx tests/unit/renderer/data-center/App.test.tsx tests/unit/renderer/data-center/routeContext.test.ts tests/unit/services/HotRunProjectionService.test.ts
```

Expected: PASS。

- [ ] **Step 3: 运行类型检查**

Run:

```bash
cmd.exe /c npm run typecheck
```

Expected: PASS。

- [ ] **Step 4: 运行 lint**

Run:

```bash
cmd.exe /c npm run lint
```

Expected: exit 0。仓库既有 warning 可以保留，但本次修改文件不应新增 error 或 warning。

- [ ] **Step 5: 检查空白和工作区状态**

Run:

```bash
git diff --check
git status --short --branch
```

Expected: `git diff --check` 无输出；工作区显示 Phase 1、Phase 2、Phase 3 文档和实现文件的未提交改动。不要提交。

---

## 自查

| 检查项 | 结果 |
| --- | --- |
| 规格覆盖 | 覆盖报告列表元数据、空态、预览摘要、结果中心跳转、运行详情回看 |
| 范围控制 | 不新增数据库、不新增 IPC、不改报告生成后端 |
| TDD 顺序 | 每个行为先补测试，再做最小实现 |
| 类型一致性 | 只使用现有 `HotReportSummary`、`HotSource`、`HotRunSummary` 字段 |
| 提交策略 | 明确不 commit，等待用户明确授权 |
