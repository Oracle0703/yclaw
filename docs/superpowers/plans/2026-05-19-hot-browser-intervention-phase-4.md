# Hot Monitor 浏览器介入闭环 Phase 4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **本仓库额外约束：** 未经用户明确允许，不允许提交 commit。本计划中的所有 `git commit` 步骤一律省略；完成后只汇报变更和验证结果。

**Goal:** 让 Hot Monitor 的失败运行可以进入 Browser 介入台，展示失败上下文，并复用现有 `intervention:resume` 恢复自动执行。

**Architecture:** 不新增数据库、不新增 IPC、不重构 Browser。Hot Monitor 运行详情通过 `navigate('/browser', { state })` 传递 `taskId/batchId/sourceId/breakpoint`；Workbench 解析 route state 后把安全的 context 传给 Browser App；Browser App 把 context 转成现有 `InterventionState` 并复用 `InterventionPanel`。

**Tech Stack:** React 18、TypeScript、Ant Design、Vitest、Testing Library、现有 `useIpc().invoke`、`react-router-dom/useNavigate/useLocation`。

---

## 文件结构

| 文件 | 职责 |
| --- | --- |
| `src/renderer/entries/browser/routeContext.ts` | 新增 Browser 介入 route state 解析函数，防止直接信任 `location.state` |
| `tests/unit/renderer/browser/routeContext.test.ts` | 覆盖合法 Hot Monitor state、空 state、缺字段、非法 breakpoint |
| `src/renderer/entries/workbench/App.tsx` | 为 `/browser` 增加 route wrapper，把解析后的 context 传给 Browser App |
| `src/renderer/entries/browser/App.tsx` | 接收 `interventionContext`，挂回 `InterventionPanel`，并监听 `intervention:stepInfo` |
| `tests/unit/components/BrowserApp.test.tsx` | 锁定 Browser 介入台展示与恢复调用，并保护现有录制器回归 |
| `src/renderer/entries/hot-monitor/App.tsx` | 失败运行详情增加“进入介入浏览器”按钮和跳转函数 |
| `tests/unit/components/HotMonitorApp.test.tsx` | 锁定失败运行可进入 Browser，成功运行不展示介入按钮 |
| `docs/overview/current-status.md` | Phase 4 完成后更新 Hot Monitor / Browser 介入现状 |

---

## 现有上下文

| 现有项目 | 当前行为 |
| --- | --- |
| `HotRunDetail` | 包含 `taskId/sourceId/sourceName/batchId/status/error/breakpoint/stepResults/linkedResultIds` |
| `HotRunDetailView` | 已展示失败定位、断点错误、错误摘要 |
| `InterventionState` | 已有 `taskId/batchId/flowRunnerStatus/webContentsId/sessionPartition/breakpoint` |
| `InterventionPanel` | 已展示任务、批次、会话、错误，并调用 `INTERVENTION_RESUME` |
| `BrowserApp` | 当前是 API 调查录制器页面，包含标签页、地址栏、录制器，但没有挂载 `InterventionPanel` |
| `Workbench App` | 已把 `/data-center` 用 route wrapper 传递 context，`/browser` 当前直接渲染 `BrowserPage` |

---

### Task 1: 新增 Browser 介入 route context 解析

**Files:**
- Create: `src/renderer/entries/browser/routeContext.ts`
- Create: `tests/unit/renderer/browser/routeContext.test.ts`

- [ ] **Step 1: 写 route context RED 测试**

创建 `tests/unit/renderer/browser/routeContext.test.ts`：

```ts
import { describe, expect, it } from 'vitest';
import { parseBrowserInterventionRouteContext } from '@renderer/entries/browser/routeContext';

describe('parseBrowserInterventionRouteContext', () => {
  it('extracts hot monitor intervention route context', () => {
    expect(
      parseBrowserInterventionRouteContext({
        source: 'hot-monitor',
        taskId: 'task-hot-1',
        batchId: 'batch-hot-1',
        sourceId: 'source-hot-1',
        sourceName: 'AI 热榜',
        breakpoint: {
          stepIndex: 1,
          error: '页面结构变化',
          screenshot: 'shot.png',
          domSnapshot: 'dom.html',
        },
        ignored: true,
      }),
    ).toEqual({
      source: 'hot-monitor',
      taskId: 'task-hot-1',
      batchId: 'batch-hot-1',
      sourceId: 'source-hot-1',
      sourceName: 'AI 热榜',
      breakpoint: {
        stepIndex: 1,
        error: '页面结构变化',
        screenshot: 'shot.png',
        domSnapshot: 'dom.html',
      },
    });
  });

  it('returns null for empty or unsupported route state', () => {
    expect(parseBrowserInterventionRouteContext(null)).toBeNull();
    expect(parseBrowserInterventionRouteContext({})).toBeNull();
    expect(parseBrowserInterventionRouteContext({ source: 'data-center' })).toBeNull();
    expect(parseBrowserInterventionRouteContext({
      source: 'hot-monitor',
      taskId: '',
      batchId: 'batch-hot-1',
      sourceId: 'source-hot-1',
    })).toBeNull();
  });

  it('drops invalid breakpoint while keeping valid route context', () => {
    expect(
      parseBrowserInterventionRouteContext({
        source: 'hot-monitor',
        taskId: 'task-hot-1',
        batchId: 'batch-hot-1',
        sourceId: 'source-hot-1',
        breakpoint: {
          stepIndex: '1',
          error: 403,
        },
      }),
    ).toEqual({
      source: 'hot-monitor',
      taskId: 'task-hot-1',
      batchId: 'batch-hot-1',
      sourceId: 'source-hot-1',
      breakpoint: null,
    });
  });
});
```

- [ ] **Step 2: 运行测试确认 RED**

Run:

```bash
cmd.exe /c npm test -- tests/unit/renderer/browser/routeContext.test.ts
```

Expected: FAIL，原因是 `src/renderer/entries/browser/routeContext.ts` 尚不存在。

- [ ] **Step 3: 实现 route context 解析**

创建 `src/renderer/entries/browser/routeContext.ts`：

```ts
export interface BrowserInterventionRouteContext {
  source: 'hot-monitor';
  taskId: string;
  batchId: string;
  sourceId: string;
  sourceName?: string;
  breakpoint: {
    stepIndex: number;
    error: string;
    screenshot?: string;
    domSnapshot?: string;
  } | null;
}

export function parseBrowserInterventionRouteContext(
  state: unknown,
): BrowserInterventionRouteContext | null {
  if (!state || typeof state !== 'object') {
    return null;
  }

  const value = state as Record<string, unknown>;
  if (value.source !== 'hot-monitor') {
    return null;
  }

  if (
    typeof value.taskId !== 'string' ||
    value.taskId.length === 0 ||
    typeof value.batchId !== 'string' ||
    value.batchId.length === 0 ||
    typeof value.sourceId !== 'string' ||
    value.sourceId.length === 0
  ) {
    return null;
  }

  const context: BrowserInterventionRouteContext = {
    source: 'hot-monitor',
    taskId: value.taskId,
    batchId: value.batchId,
    sourceId: value.sourceId,
    breakpoint: parseBreakpoint(value.breakpoint),
  };

  if (typeof value.sourceName === 'string' && value.sourceName.length > 0) {
    context.sourceName = value.sourceName;
  }

  return context;
}

function parseBreakpoint(
  value: unknown,
): BrowserInterventionRouteContext['breakpoint'] {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const breakpoint = value as Record<string, unknown>;
  if (
    typeof breakpoint.stepIndex !== 'number' ||
    !Number.isFinite(breakpoint.stepIndex) ||
    typeof breakpoint.error !== 'string' ||
    breakpoint.error.length === 0
  ) {
    return null;
  }

  return {
    stepIndex: breakpoint.stepIndex,
    error: breakpoint.error,
    screenshot: typeof breakpoint.screenshot === 'string' ? breakpoint.screenshot : undefined,
    domSnapshot: typeof breakpoint.domSnapshot === 'string' ? breakpoint.domSnapshot : undefined,
  };
}
```

- [ ] **Step 4: 运行 route context 测试**

Run:

```bash
cmd.exe /c npm test -- tests/unit/renderer/browser/routeContext.test.ts
```

Expected: PASS。

---

### Task 2: Workbench 把 `/browser` route state 传给 Browser App

**Files:**
- Modify: `src/renderer/entries/workbench/App.tsx`

- [ ] **Step 1: 修改 Workbench 路由桥接**

在 `src/renderer/entries/workbench/App.tsx` 中新增 import：

```ts
import { parseBrowserInterventionRouteContext } from '../browser/routeContext';
```

在 `DataCenterRoutePage` 后新增：

```tsx
function BrowserRoutePage() {
  const location = useLocation();
  const interventionContext = parseBrowserInterventionRouteContext(location.state);

  return <BrowserPage interventionContext={interventionContext} />;
}
```

把路由：

```tsx
<Route path="/browser" element={<BrowserPage />} />
```

改为：

```tsx
<Route path="/browser" element={<BrowserRoutePage />} />
```

- [ ] **Step 2: 暂不运行完整测试**

本任务会先引入 `BrowserPage interventionContext` prop，当前 `BrowserApp` 尚未声明 prop，后续 Task 3 一起修正。不要为了通过编译临时扩大类型。

---

### Task 3: Browser App 挂回介入台并消费 route context

**Files:**
- Modify: `src/renderer/entries/browser/App.tsx`
- Modify: `tests/unit/components/BrowserApp.test.tsx`

- [ ] **Step 1: 在 Browser App 测试 mock 中加入介入面板真实渲染依赖**

`BrowserApp.test.tsx` 当前没有 mock `InterventionPanel`。本任务推荐不 mock 它，直接用组件真实行为。测试文件已有 `antd` mock 但缺少 `Descriptions`，需要在现有 `vi.mock('antd', () => ({ ... }))` 中增加：

```tsx
Descriptions: Object.assign(
  ({ children }: { children?: React.ReactNode }) => <dl>{children}</dl>,
  {
    Item: ({
      children,
      label,
    }: {
      children?: React.ReactNode;
      label?: React.ReactNode;
    }) => (
      <div>
        <dt>{label}</dt>
        <dd>{children}</dd>
      </div>
    ),
  },
),
```

- [ ] **Step 2: 写 Browser route context RED 测试**

在 `BrowserApp.test.tsx` 末尾新增：

```tsx
it('shows hot monitor intervention context and resumes automation', async () => {
  render(
    <BrowserApp
      interventionContext={{
        source: 'hot-monitor',
        taskId: 'task-failed',
        batchId: 'batch-failed',
        sourceId: 'source-failed',
        sourceName: '失败任务',
        breakpoint: {
          stepIndex: 1,
          error: '页面结构变化',
        },
      }}
    />,
  );

  expect(await screen.findByText('当前操作窗口：首页')).toBeDefined();
  expect(screen.getByText('介入台')).toBeDefined();
  expect(screen.getByText('task-failed')).toBeDefined();
  expect(screen.getByText('batch-failed')).toBeDefined();
  expect(screen.getByText('页面结构变化')).toBeDefined();

  fireEvent.click(screen.getByRole('button', { name: '恢复自动执行' }));

  expect(invokeMock).toHaveBeenCalledWith(IPC_CHANNELS.INTERVENTION_RESUME, {
    taskId: 'task-failed',
    batchId: 'batch-failed',
  });
});
```

- [ ] **Step 3: 运行 Browser 测试确认 RED**

Run:

```bash
cmd.exe /c npm test -- tests/unit/components/BrowserApp.test.tsx
```

Expected: FAIL，原因是 `BrowserApp` 尚不接受 `interventionContext` prop，也没有渲染 `InterventionPanel`。

- [ ] **Step 4: 修改 Browser App 接收 context**

在 `src/renderer/entries/browser/App.tsx` 中增加 import：

```ts
import type { InterventionState, Tab } from '@shared/types/browser';
import type { BrowserInterventionRouteContext } from './routeContext';
import { InterventionPanel } from './components/InterventionPanel';
```

把原有：

```ts
import type { Tab } from '@shared/types/browser';
```

替换掉，避免重复 import。

在组件上方新增：

```ts
interface BrowserAppProps {
  interventionContext?: BrowserInterventionRouteContext | null;
}

function buildRouteInterventionState(
  context?: BrowserInterventionRouteContext | null,
): InterventionState | null {
  if (!context) {
    return null;
  }

  return {
    taskId: context.taskId,
    batchId: context.batchId,
    flowRunnerStatus: 'intervention',
    webContentsId: 0,
    sessionPartition: 'default',
    breakpoint: context.breakpoint,
  };
}
```

把函数签名：

```ts
export default function App() {
```

改为：

```ts
export default function App({ interventionContext = null }: BrowserAppProps) {
```

在 state 区新增：

```ts
const [interventionState, setInterventionState] = useState<InterventionState | null>(
  () => buildRouteInterventionState(interventionContext),
);
```

增加同步 effect：

```ts
useEffect(() => {
  setInterventionState(buildRouteInterventionState(interventionContext));
}, [interventionContext]);
```

增加事件监听：

```ts
useIpcEvent(IPC_CHANNELS.INTERVENTION_STEP_INFO, (data: unknown) => {
  setInterventionState(data as InterventionState);
});
```

在 `<RecorderPanel ... />` 后追加：

```tsx
<InterventionPanel state={interventionState} />
```

- [ ] **Step 5: 运行 Browser 测试**

Run:

```bash
cmd.exe /c npm test -- tests/unit/components/BrowserApp.test.tsx
```

Expected: PASS，且现有录制器、标签页、地址栏回归不退化。

---

### Task 4: Hot Monitor 失败运行详情增加介入入口

**Files:**
- Modify: `src/renderer/entries/hot-monitor/App.tsx`
- Modify: `tests/unit/components/HotMonitorApp.test.tsx`

- [ ] **Step 1: 扩展失败运行详情测试 RED 断言**

在 `tests/unit/components/HotMonitorApp.test.tsx` 的失败运行详情测试中，找到已存在断言：

```tsx
expect(screen.getAllByText(/页面结构变化/).length).toBeGreaterThan(0);
```

在其后、点击“查看结果中心”前追加：

```tsx
expect(screen.getByRole('button', { name: '进入介入浏览器' })).toBeDefined();
fireEvent.click(screen.getByRole('button', { name: '进入介入浏览器' }));
expect(navigateMock).toHaveBeenCalledWith('/browser', {
  state: {
    source: 'hot-monitor',
    taskId: 'task-failed',
    batchId: 'batch-failed',
    sourceId: 'source-failed',
    sourceName: '失败任务',
    breakpoint: {
      stepIndex: 1,
      reason: 'selector-timeout',
      error: '未找到热点列表',
    },
  },
});
```

- [ ] **Step 2: 新增成功运行不展示介入入口测试**

在同一测试文件中新增：

```tsx
it('does not show browser intervention action for successful hot runs', async () => {
  render(<HotMonitorApp />);

  fireEvent.click(await screen.findByRole('button', { name: '查看运行' }));

  expect(await screen.findByRole('dialog', { name: '运行详情' })).toBeDefined();
  expect(screen.getByText('状态：success')).toBeDefined();
  expect(screen.queryByRole('button', { name: '进入介入浏览器' })).toBeNull();
});
```

如果页面中有多个“查看运行”按钮，则按现有测试模式用 `closest('tr')` 限定到成功任务行。

- [ ] **Step 3: 运行 Hot Monitor 测试确认 RED**

Run:

```bash
cmd.exe /c npm test -- tests/unit/components/HotMonitorApp.test.tsx
```

Expected: FAIL，原因是运行详情还没有“进入介入浏览器”按钮。

- [ ] **Step 4: 实现介入跳转函数**

在 `src/renderer/entries/hot-monitor/App.tsx` 中，靠近 `openReportResults` 或运行详情相关函数处新增：

```ts
const canOpenBrowserIntervention = (detail: HotRunDetail) =>
  detail.status === 'failed' || Boolean(detail.breakpoint) || Boolean(detail.error);

const openBrowserIntervention = (detail: HotRunDetail) => {
  navigate('/browser', {
    state: {
      source: 'hot-monitor',
      taskId: detail.taskId,
      batchId: detail.batchId,
      sourceId: detail.sourceId,
      sourceName: detail.sourceName,
      breakpoint: detail.breakpoint,
    },
  });
};
```

确认 `HotRunDetail` 已从 `@shared/types` import；如果当前只 import 了相关类型，复用现有 import。

- [ ] **Step 5: 在运行详情 Modal 按条件展示按钮**

在运行详情 Modal 的按钮区域中，把现有“查看结果中心”按钮保留，并在它前面加入：

```tsx
{canOpenBrowserIntervention(runDetail) ? (
  <Button onClick={() => openBrowserIntervention(runDetail)}>
    进入介入浏览器
  </Button>
) : null}
```

按钮应只依赖 `runDetail`，不发起新的 IPC。

- [ ] **Step 6: 运行 Hot Monitor 测试**

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

在 `热点监控` 相关说明中加入：

```md
失败运行详情已能进入 Browser 介入台，携带 Hot Monitor 的 Task / Batch / Source / breakpoint 上下文，并复用现有恢复自动执行入口。
```

在 `browser` 模块说明中加入：

```md
Browser 页面已重新挂载介入台，可承接 Hot Monitor 失败运行上下文并调用 `intervention:resume`。
```

- [ ] **Step 2: 运行 Phase 4 聚焦测试**

Run:

```bash
cmd.exe /c npm test -- tests/unit/renderer/browser/routeContext.test.ts tests/unit/components/BrowserApp.test.tsx tests/unit/components/HotMonitorApp.test.tsx tests/unit/components/InterventionPanel.test.tsx
```

Expected: PASS。

- [ ] **Step 3: 运行此前热点黄金路径回归测试**

Run:

```bash
cmd.exe /c npm test -- tests/unit/renderer/data-center/App.test.tsx tests/unit/renderer/data-center/routeContext.test.ts tests/unit/services/HotRunProjectionService.test.ts
```

Expected: PASS。

- [ ] **Step 4: 运行类型检查**

Run:

```bash
cmd.exe /c npm run typecheck
```

Expected: PASS。

- [ ] **Step 5: 运行 lint**

Run:

```bash
cmd.exe /c npm run lint
```

Expected: exit 0。仓库既有 warning 可以保留，但本次修改文件不应新增 error。

- [ ] **Step 6: 检查空白和工作区状态**

Run:

```bash
git diff --check
git status --short --branch
```

Expected: `git diff --check` 无输出；工作区显示 Phase 1-4 文档和实现文件的未提交改动。不要提交。

---

## 自查

| 检查项 | 结果 |
| --- | --- |
| 规格覆盖 | 覆盖 Hot Monitor 失败详情入口、Browser route context、介入台展示、恢复调用 |
| 范围控制 | 不扩 Signin / Comment / 通用 Automation，不新增数据库、不新增 IPC |
| TDD 顺序 | route context、Browser App、Hot Monitor 入口均先补测试再实现 |
| 类型一致性 | 复用现有 `HotRunDetail`、`InterventionState`，新增最小 `BrowserInterventionRouteContext` |
| 提交策略 | 明确不 commit，等待用户明确授权 |
