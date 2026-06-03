# Hot Monitor 浏览器介入闭环 Phase 4 设计

## 1. 本阶段决策

Phase 4 选择补齐 Hot Monitor 失败运行后的浏览器介入闭环，而不是继续扩展报告、通知、AI 摘要或 Runner 底层稳定化。

本阶段目标：

> 当热点采集运行失败时，用户可以从 Hot Monitor 的运行详情直接进入 Browser 介入台，看到这次失败的 Task / Batch / Source / 断点错误，并在人工处理后点击“恢复自动执行”。

Phase 1 已经打通热点任务创建、运行、结果数量、HTML 报告和 `Task / Batch / Report` 追踪；Phase 2 已经让 Data Center 能承接热点批次上下文；Phase 3 已经让报告能追踪到运行详情和结果中心。Phase 4 要补的是失败后的操作路径：当前失败详情能显示错误和断点，但用户还不能从这条热点主线进入 Browser 现场处理。

## 2. 当前已有基础

| 能力区域 | 当前已有能力 | 说明 |
| --- | --- | --- |
| 运行详情 | `HotRunDetailView` 已展示 `Source / Task / Batch / 状态 / 报告 / 失败定位 / 断点错误 / 错误` | 失败原因已经能在 Hot Monitor 内看到 |
| 介入类型 | `InterventionState` 已定义 `taskId/batchId/flowRunnerStatus/webContentsId/sessionPartition/breakpoint` | 可作为 Browser 介入台的统一状态结构 |
| 介入面板 | `InterventionPanel` 已能展示任务、批次、会话、错误，并调用 `intervention:resume` | 现有组件可复用，不需要重做恢复按钮 |
| 介入 IPC | `intervention:status/takeover/resume/screenshot/stepInfo` 已存在 | Phase 4 不新增后端 IPC |
| Browser 路由 | Workbench 已有 `/browser` 路由 | 可以通过 `navigate('/browser', { state })` 从 Hot Monitor 进入 |
| Data Center 路由上下文模式 | Phase 2 已新增 `routeContext` 解析层 | Browser 可采用同样的小型 route context 解析模式 |

## 3. 产品范围

| 做 | 不做 |
| --- | --- |
| Hot Monitor 失败运行详情展示“进入介入浏览器”入口 | 不扩展到 Signin / Comment / 通用 Automation |
| 点击后跳转 `/browser` 并携带热点失败上下文 | 不新增数据库表或字段 |
| Browser 页面读取 route state 并展示介入上下文 | 不新增后端 IPC 通道 |
| Browser 页面把 `InterventionPanel` 挂回主界面 | 不实现完整 Runner lease / orphan / 远程会话恢复 |
| 恢复按钮复用 `intervention:resume({ taskId, batchId })` | 不做验证码破解、自动登录绕过或站点专用修复 |
| 补 Hot Monitor、Browser route context、Browser App 组件测试 | 不重构 Browser 录制器和标签页能力 |

## 4. 用户路径

| 步骤 | 用户看到什么 | 系统做什么 | 验收标准 |
| --- | --- | --- | --- |
| 1. 运行失败 | Hot Monitor 运行详情里显示失败定位、断点错误和错误摘要 | `HOT_RUN_DETAIL` 返回 `HotRunDetail` | 用户能知道失败发生在哪个批次 |
| 2. 进入介入 | 运行详情里出现“进入介入浏览器”按钮 | 仅在 `failed` 或存在 `breakpoint/error` 时展示 | 成功运行不出现介入入口 |
| 3. 打开 Browser | 页面切到 `/browser` | 路由 state 携带 `source/taskId/batchId/sourceId/sourceName/breakpoint` | Browser 不需要用户手动输入批次 |
| 4. 处理现场 | Browser 顶部或介入区域显示任务、批次、来源、断点步骤和错误 | Browser route context 转成 `InterventionState` | 用户能确认当前处理的是哪次热点失败 |
| 5. 恢复执行 | 点击“恢复自动执行” | 调用 `intervention:resume({ taskId, batchId })` | 调用参数与 Hot Monitor 失败批次一致 |

## 5. 页面设计

### 5.1 Hot Monitor 运行详情

运行详情 Modal 保留现有 `HotRunDetailView` 和“查看结果中心”按钮，并在失败场景增加“进入介入浏览器”按钮。

| 条件 | 展示 |
| --- | --- |
| `runDetail.status === 'failed'` | 展示“进入介入浏览器” |
| `runDetail.breakpoint` 存在 | 展示“进入介入浏览器” |
| `runDetail.error` 存在且状态不是 success | 展示“进入介入浏览器” |
| 成功运行 | 不展示“进入介入浏览器” |

按钮点击后跳转：

```ts
navigate('/browser', {
  state: {
    source: 'hot-monitor',
    taskId: runDetail.taskId,
    batchId: runDetail.batchId,
    sourceId: runDetail.sourceId,
    sourceName: runDetail.sourceName,
    breakpoint: runDetail.breakpoint,
  },
});
```

### 5.2 Browser route context

新增一个独立解析函数，避免 Browser App 直接信任 `location.state`。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `source` | `'hot-monitor'` | 本阶段只接受 Hot Monitor |
| `taskId` | `string` | 必填 |
| `batchId` | `string` | 必填 |
| `sourceId` | `string` | 必填 |
| `sourceName` | `string \| undefined` | 可选，用于展示 |
| `breakpoint` | `{ stepIndex: number; error: string; screenshot?: string; domSnapshot?: string } \| null` | 可选 |

解析失败时返回 `null`，Browser 维持原来的录制器 / 标签页行为。

### 5.3 Browser 页面介入区

Browser 页面当前主要是“API 调查录制器”，Phase 4 不重构它，只在现有页面内增加一个介入区。

| 状态 | 展示 |
| --- | --- |
| 有 Hot Monitor route context | 展示 `InterventionPanel`，标题仍为“介入台” |
| 无 route context 且没有实时 `intervention:stepInfo` | 显示“当前没有需要人工介入的任务。” |
| 收到实时 `intervention:stepInfo` | 用实时状态更新介入面板 |

route context 转换成最小 `InterventionState`：

```ts
{
  taskId: context.taskId,
  batchId: context.batchId,
  flowRunnerStatus: 'intervention',
  webContentsId: 0,
  sessionPartition: 'default',
  breakpoint: context.breakpoint ?? null,
}
```

`webContentsId` 和 `sessionPartition` 在本阶段只用于展示兼容。真实现场 tab 复用和会话分区恢复留给后续 Runner / Browser 深化阶段。

## 6. 数据流

```text
用户打开 Hot Monitor 运行详情
  -> HOT_RUN_DETAIL({ sourceId, batchId })
  -> runDetail 包含 taskId / batchId / sourceId / breakpoint / error

用户点击“进入介入浏览器”
  -> navigate('/browser', { state: HotBrowserInterventionRouteState })

Workbench BrowserRoutePage
  -> parseBrowserInterventionRouteContext(location.state)
  -> <BrowserApp interventionContext={context} />

BrowserApp
  -> context 转 InterventionState
  -> InterventionPanel 展示失败上下文

用户点击“恢复自动执行”
  -> INTERVENTION_RESUME({ taskId, batchId })
```

## 7. 错误处理

| 场景 | 处理方式 |
| --- | --- |
| route state 为空 | Browser 保持原行为，不展示热点介入上下文 |
| route state 缺少 `taskId/batchId/sourceId` | 解析为 `null`，不进入介入模式 |
| `breakpoint` 结构不合法 | 丢弃 breakpoint，但保留合法的 task/batch/source 上下文 |
| `intervention:resume` 失败 | 复用 `InterventionPanel` 现有错误提示 |
| Browser 加载标签失败 | 保持现有 `读取标签页失败` 提示 |
| 成功运行误触介入 | Hot Monitor 不展示入口，避免无意义跳转 |

## 8. 测试策略

| 层级 | 测试内容 |
| --- | --- |
| route context 单测 | 合法 Hot Monitor state 能解析成 Browser intervention context |
| route context 单测 | 空 state、错误类型、缺字段返回 `null` |
| Hot Monitor 组件测试 | 失败运行详情显示“进入介入浏览器” |
| Hot Monitor 组件测试 | 点击按钮调用 `navigate('/browser', { state })` |
| Hot Monitor 组件测试 | 成功运行详情不显示“进入介入浏览器” |
| Browser App 组件测试 | route context 存在时展示介入台中的 Task / Batch / 错误 |
| Browser App 组件测试 | 点击“恢复自动执行”调用 `intervention:resume` |
| Browser App 回归测试 | 无 route context 时现有录制器、标签页和地址栏测试保持通过 |

## 9. 实施拆分

| 顺序 | 目标 | 可能涉及文件 |
| --- | --- | --- |
| 1 | 定义 Browser intervention route context 解析函数和单测 | `src/renderer/entries/browser/routeContext.ts`、`tests/unit/renderer/browser/routeContext.test.ts` |
| 2 | Workbench 把 `/browser` route state 传给 Browser App | `src/renderer/entries/workbench/App.tsx` |
| 3 | Browser App 挂回 `InterventionPanel` 并消费 route context | `src/renderer/entries/browser/App.tsx`、`tests/unit/components/BrowserApp.test.tsx` |
| 4 | Hot Monitor 失败运行详情增加“进入介入浏览器” | `src/renderer/entries/hot-monitor/App.tsx`、`tests/unit/components/HotMonitorApp.test.tsx` |
| 5 | 更新现状文档和聚焦验证 | `docs/overview/current-status.md` |

## 10. 成功标准

Phase 4 完成后，用户应该能说清楚：

> 我在 Hot Monitor 看到一次失败运行后，可以直接进入介入浏览器，看见这次失败的任务、批次和断点错误，并在人工处理后恢复自动执行。

这一步完成后，热点黄金路径会从“失败可查看”提升到“失败可处理”。后续再做通用 Automation 介入、真实会话恢复、Runner lease 稳定化和 AI 失败诊断时，都可以复用这条 `Task / Batch / Browser` 上下文协议。
