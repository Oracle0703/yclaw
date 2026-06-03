# Data Center 承接热点批次上下文 Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **本仓库额外约束：** 未经用户明确允许，不允许提交 commit。本计划中的所有 `git commit` 步骤一律省略；完成后只汇报变更和验证结果。

**Goal:** 让用户从 Hot Monitor 运行详情进入 Data Center 后，Data Center 能自动识别 `taskId/batchId/source` 上下文，并把结果列表、JSONL 导出和数据质量扫描默认限定在该热点批次。

**Architecture:** 不新增后端 IPC、数据库表或查询服务。复用现有 `react-router-dom` route state、Data Center IPC API、`DataCenterService.listResults(query)`、`DataExportService.createExport(query)` 和 `DataQualityService.scan({ query })`。前端新增一个小型 route context 解析函数，并把 context 作为 prop 传给结果资产表和质量面板。

**Tech Stack:** React 18、TypeScript、Ant Design、Ant Design Pro `ProCard`、Vitest、Testing Library、现有 `useIpc().dataCenter` API。

---

## 文件结构

| 文件 | 职责 |
| --- | --- |
| `tests/unit/renderer/data-center/App.test.tsx` | 先用 RED 测试锁定 Hot Monitor route state、结果查询、导出和质量扫描 payload |
| `src/renderer/entries/data-center/App.tsx` | 读取 `useLocation().state`，解析安全的 Data Center route context，并显示上下文条 |
| `src/renderer/entries/data-center/components/ResultAssetTable.tsx` | 接收 context，列表查询和 JSONL 导出默认带 `taskId/batchId` |
| `src/renderer/entries/data-center/components/QualityRulePanel.tsx` | 接收 context，质量扫描默认带 `taskId/batchId` |
| `docs/overview/current-status.md` | Phase 2 完成后更新热点黄金路径和 Data Center 联动现状 |

## 现有上下文

| 现有项目 | 当前行为 |
| --- | --- |
| Hot Monitor 运行详情 | 已通过 `navigate('/data-center', { state: { batchId, taskId, source: 'hot-monitor' } })` 交接上下文 |
| `DataCenterService.listResults()` | 已支持 `taskId`、`batchId` 查询参数 |
| `DataExportService.createExport()` | 已支持 `query.taskId`、`query.batchId` |
| `DataQualityService.scan()` | 已支持 `scan({ query: { taskId, batchId } })` |
| `DataCenterApp` | 当前未读取 route state，所有 Tab 都按全局数据工作 |
| `ResultAssetTable` | 当前固定调用 `listResults({ page: 1, pageSize: 20 })`，导出固定使用 `{ page: 1, pageSize: 500 }` |
| `QualityRulePanel` | 当前固定调用 `scanQuality({ limit: 200 })` |

---

### Task 1: 锁定 Data Center 接收 Hot Monitor 上下文的 RED 测试

**Files:**
- Modify: `tests/unit/renderer/data-center/App.test.tsx`

- [ ] **Step 1: 扩展测试 mock，加入 `useLocation`**

在现有 `vi.hoisted` 中增加 `locationStateMock`：

```tsx
const { dataCenterApiMock, locationStateMock } = vi.hoisted(() => ({
  locationStateMock: vi.fn(() => null),
  dataCenterApiMock: {
    // 保持现有 mock 不变
  },
}));
```

在 `@renderer/shared/hooks` mock 下方新增：

```tsx
vi.mock('react-router-dom', () => ({
  useLocation: () => ({
    state: locationStateMock(),
  }),
}));
```

在每个测试前清理 route state。当前文件没有 `beforeEach`，需要把 import 改为：

```tsx
import { beforeEach, describe, expect, it, vi } from 'vitest';
```

并在 `describe('DataCenter App', () => {` 内加入：

```tsx
beforeEach(() => {
  vi.clearAllMocks();
  locationStateMock.mockReturnValue(null);
});
```

- [ ] **Step 2: 新增 RED 测试，断言上下文条和结果查询**

在 `renders overview, result asset and export tabs` 后新增：

```tsx
it('scopes result assets to the hot-monitor batch route context', async () => {
  locationStateMock.mockReturnValue({
    source: 'hot-monitor',
    taskId: 'task-hot-1',
    batchId: 'batch-hot-1',
  });

  await act(async () => {
    render(<DataCenterApp />);
  });

  expect(screen.getByText('来自热点监控')).toBeDefined();
  expect(screen.getByText('Task：task-hot-1')).toBeDefined();
  expect(screen.getByText('Batch：batch-hot-1')).toBeDefined();
  expect(screen.getByText('结果、导出和质量扫描将默认限定在该批次。')).toBeDefined();
  expect(dataCenterApiMock.listResults).toHaveBeenCalledWith({
    page: 1,
    pageSize: 20,
    taskId: 'task-hot-1',
    batchId: 'batch-hot-1',
  });
});
```

- [ ] **Step 3: 运行测试确认 RED**

Run:

```bash
cmd.exe /c npm test -- tests/unit/renderer/data-center/App.test.tsx
```

Expected: FAIL，原因是页面还没有渲染 `来自热点监控`，并且 `listResults` 没有收到 `taskId/batchId`。

---

### Task 2: 在 DataCenterApp 中解析 route context 并展示上下文条

**Files:**
- Modify: `src/renderer/entries/data-center/App.tsx`
- Test: `tests/unit/renderer/data-center/App.test.tsx`

- [ ] **Step 1: 引入 `useLocation` 和 `Alert`**

把 import 改为：

```tsx
import { Alert, Tabs } from 'antd';
import { useLocation } from 'react-router-dom';
```

- [ ] **Step 2: 在 `App.tsx` 中增加 context 类型和解析函数**

在 imports 后添加：

```tsx
export interface DataCenterRouteContext {
  taskId?: string;
  batchId?: string;
  source?: string;
}

function parseDataCenterRouteContext(state: unknown): DataCenterRouteContext | null {
  if (!state || typeof state !== 'object') {
    return null;
  }

  const value = state as Record<string, unknown>;
  const context: DataCenterRouteContext = {};
  if (typeof value.taskId === 'string' && value.taskId.length > 0) {
    context.taskId = value.taskId;
  }
  if (typeof value.batchId === 'string' && value.batchId.length > 0) {
    context.batchId = value.batchId;
  }
  if (typeof value.source === 'string' && value.source.length > 0) {
    context.source = value.source;
  }

  return context.taskId || context.batchId || context.source ? context : null;
}
```

- [ ] **Step 3: 在组件内读取 context**

把 `export default function App() {` 改为：

```tsx
export default function App() {
  const location = useLocation();
  const routeContext = parseDataCenterRouteContext(location.state);
```

- [ ] **Step 4: 在 `PageShell` 内 `Tabs` 前显示上下文条**

在 `<Tabs` 前插入：

```tsx
{routeContext ? (
  <Alert
    message={routeContext.source === 'hot-monitor' ? '来自热点监控' : '已限定数据上下文'}
    description={[
      routeContext.taskId ? `Task：${routeContext.taskId}` : null,
      routeContext.batchId ? `Batch：${routeContext.batchId}` : null,
      '结果、导出和质量扫描将默认限定在该批次。',
    ].filter(Boolean).join(' · ')}
    type="info"
    showIcon
  />
) : null}
```

- [ ] **Step 5: 暂时只运行 Data Center 测试**

Run:

```bash
cmd.exe /c npm test -- tests/unit/renderer/data-center/App.test.tsx
```

Expected: 仍 FAIL，因为上下文条可能出现，但 `ResultAssetTable` 还没把 context 带到 `listResults`。

---

### Task 3: 让 ResultAssetTable 使用当前批次上下文

**Files:**
- Modify: `src/renderer/entries/data-center/App.tsx`
- Modify: `src/renderer/entries/data-center/components/ResultAssetTable.tsx`
- Test: `tests/unit/renderer/data-center/App.test.tsx`

- [ ] **Step 1: 给 `ResultAssetTable` 增加 prop**

在 `ResultAssetTable.tsx` 中引入类型：

```tsx
import type { DataCenterRouteContext } from '../App';
```

把组件签名改为：

```tsx
export function ResultAssetTable({
  context,
}: {
  context?: DataCenterRouteContext | null;
}) {
```

- [ ] **Step 2: 增加 query 构造函数**

在组件内部、state 下方加入：

```tsx
const buildResultQuery = (pageSize: number) => ({
  page: 1,
  pageSize,
  ...(context?.taskId ? { taskId: context.taskId } : {}),
  ...(context?.batchId ? { batchId: context.batchId } : {}),
});
```

- [ ] **Step 3: 用 context 查询结果**

把现有 effect 改为：

```tsx
useEffect(() => {
  void dataCenter.listResults(buildResultQuery(20)).then((value) => {
    setResults(((value as DataPage<ExtractionResult>)?.items ?? []) as ExtractionResult[]);
  });
}, [dataCenter, context?.taskId, context?.batchId]);
```

- [ ] **Step 4: 用 context 创建 JSONL 导出**

把 `createExport` 中的 query 改为：

```tsx
query: buildResultQuery(500),
```

- [ ] **Step 5: 在 `DataCenterApp` 传入 context**

把 `ResultAssetTable` tab 改为：

```tsx
{ key: 'results', label: '结果资产', children: <ResultAssetTable context={routeContext} /> },
```

- [ ] **Step 6: 运行 Data Center 测试**

Run:

```bash
cmd.exe /c npm test -- tests/unit/renderer/data-center/App.test.tsx
```

Expected: 新增 context/listResults 测试 PASS；后续导出和扫描测试还未添加。

---

### Task 4: 锁定并实现按上下文导出 JSONL

**Files:**
- Modify: `tests/unit/renderer/data-center/App.test.tsx`
- Modify: `src/renderer/entries/data-center/components/ResultAssetTable.tsx`

- [ ] **Step 1: 增加导出 RED 断言**

在 `scopes result assets to the hot-monitor batch route context` 测试末尾追加：

```tsx
await act(async () => {
  screen.getByText('导出 JSONL').click();
});

expect(dataCenterApiMock.createExport).toHaveBeenCalledWith(
  expect.objectContaining({
    query: {
      page: 1,
      pageSize: 500,
      taskId: 'task-hot-1',
      batchId: 'batch-hot-1',
    },
    format: 'jsonl',
  }),
);
```

- [ ] **Step 2: 如果 Task 3 已经改了导出 query，运行测试应直接 PASS**

Run:

```bash
cmd.exe /c npm test -- tests/unit/renderer/data-center/App.test.tsx
```

Expected: PASS。如果 FAIL，修正 `ResultAssetTable.exportJsonl()`，确保 `query: buildResultQuery(500)`。

---

### Task 5: 让 QualityRulePanel 使用当前批次上下文扫描

**Files:**
- Modify: `tests/unit/renderer/data-center/App.test.tsx`
- Modify: `src/renderer/entries/data-center/App.tsx`
- Modify: `src/renderer/entries/data-center/components/QualityRulePanel.tsx`

- [ ] **Step 1: 新增质量扫描 RED 测试**

在 Data Center 测试中新增：

```tsx
it('scopes quality scan to the hot-monitor batch route context', async () => {
  locationStateMock.mockReturnValue({
    source: 'hot-monitor',
    taskId: 'task-hot-1',
    batchId: 'batch-hot-1',
  });

  await act(async () => {
    render(<DataCenterApp />);
  });

  expect(screen.getByText('扫描当前批次')).toBeDefined();

  await act(async () => {
    screen.getByText('扫描当前批次').click();
  });

  expect(dataCenterApiMock.scanQuality).toHaveBeenCalledWith({
    query: {
      taskId: 'task-hot-1',
      batchId: 'batch-hot-1',
    },
    limit: 200,
  });
});
```

- [ ] **Step 2: 运行测试确认 RED**

Run:

```bash
cmd.exe /c npm test -- tests/unit/renderer/data-center/App.test.tsx
```

Expected: FAIL，原因是按钮仍叫 `立即扫描`，且 `scanQuality` payload 不带 query。

- [ ] **Step 3: 给 `QualityRulePanel` 增加 prop**

在 `QualityRulePanel.tsx` 中引入：

```tsx
import type { DataCenterRouteContext } from '../App';
```

把组件签名改为：

```tsx
export function QualityRulePanel({
  context,
}: {
  context?: DataCenterRouteContext | null;
}) {
```

- [ ] **Step 4: 构造质量扫描 payload**

在组件内部 state 下方加入：

```tsx
const buildQualityScanInput = () => ({
  ...(context?.taskId || context?.batchId
    ? {
        query: {
          ...(context?.taskId ? { taskId: context.taskId } : {}),
          ...(context?.batchId ? { batchId: context.batchId } : {}),
        },
      }
    : {}),
  limit: 200,
});
```

把 `scanQuality` 内调用改为：

```tsx
const next = (await dataCenter.scanQuality(buildQualityScanInput())) as DataQualityScanResult;
```

- [ ] **Step 5: 按上下文调整按钮文案**

把按钮文案改为：

```tsx
{context?.batchId ? '扫描当前批次' : '立即扫描'}
```

- [ ] **Step 6: 在 `DataCenterApp` 传入 context**

把质量 tab 改为：

```tsx
{ key: 'quality', label: '数据质量', children: <QualityRulePanel context={routeContext} /> },
```

- [ ] **Step 7: 运行 Data Center 测试**

Run:

```bash
cmd.exe /c npm test -- tests/unit/renderer/data-center/App.test.tsx
```

Expected: PASS。

---

### Task 6: 保持无 route state 的回归行为

**Files:**
- Modify: `tests/unit/renderer/data-center/App.test.tsx`

- [ ] **Step 1: 在现有 `renders primary data-center actions` 测试中补无上下文断言**

在点击 `立即扫描` 后，把原有：

```tsx
expect(dataCenterApiMock.scanQuality).toHaveBeenCalled();
```

替换为：

```tsx
expect(dataCenterApiMock.scanQuality).toHaveBeenCalledWith({ limit: 200 });
```

在 `renders overview, result asset and export tabs` 测试中增加：

```tsx
expect(dataCenterApiMock.listResults).toHaveBeenCalledWith({ page: 1, pageSize: 20 });
expect(screen.queryByText('来自热点监控')).toBeNull();
```

- [ ] **Step 2: 运行 Data Center 测试**

Run:

```bash
cmd.exe /c npm test -- tests/unit/renderer/data-center/App.test.tsx
```

Expected: PASS，证明无上下文时仍是全局 Data Center。

---

### Task 7: 更新现状文档并跑聚焦验证

**Files:**
- Modify: `docs/overview/current-status.md`

- [ ] **Step 1: 更新当前状态文档**

在 `热点监控` 或 `Data Center` 相关说明中加入：

```markdown
Data Center 已能承接 Hot Monitor 传入的 `taskId/batchId` 上下文，结果资产、JSONL 导出和数据质量扫描可默认限定在热点运行批次。
```

- [ ] **Step 2: 运行聚焦测试**

Run:

```bash
cmd.exe /c npm test -- tests/unit/renderer/data-center/App.test.tsx tests/unit/components/HotMonitorApp.test.tsx tests/unit/services/HotRunProjectionService.test.ts
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

Expected: exit 0。仓库既有 warning 可以保留，但本次修改文件不应新增 error。

- [ ] **Step 5: 检查 git 状态**

Run:

```bash
git status --short --branch
```

Expected: 出现 Phase 1、Phase 2 设计/计划和本次实现相关文件；不要提交。

---

## 自查

| 检查项 | 结果 |
| --- | --- |
| 规格覆盖 | 覆盖 route context、结果查询、导出、质量扫描、无上下文回归 |
| 范围控制 | 不新增数据库、不新增 IPC、不重构完整 Data Center 筛选器 |
| TDD 顺序 | 每个行为先补测试，再做最小实现 |
| 类型一致性 | 使用现有 `DataCenterResultQuery`、`DataQualityScanInput` 形态；新增 `DataCenterRouteContext` 只在渲染端使用 |
| 提交策略 | 明确不 commit，等待用户明确授权 |
