# Data Center 承接热点批次上下文 Phase 2 设计

## 1. 本阶段决策

Phase 2 只补一件事：

> 当用户从 Hot Monitor 的运行详情进入 Data Center 时，Data Center 必须识别这次热点运行的 `batchId` / `taskId`，并围绕这个批次展示结果、质量扫描和导出入口。

Phase 1 已经打通了热点任务的创建、运行、结果数量、HTML 报告和 `Task / Batch / Report` 追踪。当前断点在 Data Center：Hot Monitor 已经把上下文传到 `/data-center`，但 Data Center 页面还不会消费这个上下文。用户跳过去后看到的是泛结果中心，而不是“刚刚这个热点批次的结果”。

## 2. 当前已有基础

| 能力区域 | 当前已有能力 | 说明 |
| --- | --- | --- |
| Hot Monitor 跳转 | `查看结果中心` 已调用 `navigate('/data-center', { state })` | state 内包含 `batchId`、`taskId`、`source: 'hot-monitor'` |
| Data Center 查询 | `DataCenterService.listResults(query)` 支持 `taskId`、`batchId` | 后端不需要新增查询能力 |
| 数据导出 | `DataExportService.createExport()` 的 query 支持 `taskId`、`batchId` | JSONL 导出可以天然按批次收窄 |
| 质量扫描 | `DataQualityService.scan({ query })` 支持按 `batchId` 扫描 | 已有批次质量分和批次洞察 |
| IPC 封装 | `dataCenter.listResults`、`createExport`、`scanQuality` 已可传 payload | 不需要新增 IPC channel |
| 测试 | `tests/unit/renderer/data-center/App.test.tsx` 已 mock Data Center API | 可直接补 route state 和 query 断言 |

## 3. 产品范围

| 做 | 不做 |
| --- | --- |
| Data Center 读取 Hot Monitor 传来的 `batchId`、`taskId`、`source` | 不新增数据库表 |
| 在 Data Center 顶部展示“当前正在查看热点批次”的上下文提示 | 不实现复杂结果筛选器重构 |
| `结果资产` 默认按当前 `taskId/batchId` 拉取结果 | 不做 Data Center 双向回跳 Hot Monitor |
| `导出 JSONL` 默认使用当前批次 query | 不新增新的导出格式 |
| `数据质量` 的“立即扫描”默认按当前批次扫描 | 不新增质量规则编辑器 |
| 补 Data Center 组件测试 | 不改 Hot Monitor 已完成的跳转协议 |

## 4. 用户路径

| 步骤 | 用户看到什么 | 系统做什么 | 验收标准 |
| --- | --- | --- | --- |
| 1. 从 Hot Monitor 进入 | 运行详情里点击“查看结果中心” | 跳转 `/data-center` 并携带 `batchId/taskId/source` | 路由 state 里有批次上下文 |
| 2. Data Center 接住 | 页面顶部显示“来自热点监控：batch-failed / task-failed” | 解析 route state，生成 `DataCenterContext` | 用户知道当前看的是哪次运行 |
| 3. 查看结果 | `结果资产` 展示当前批次结果 | 调用 `listResults({ page, pageSize, taskId, batchId })` | 不再显示泛结果列表 |
| 4. 导出结果 | 点击“导出 JSONL” | 调用 `createExport({ query: { taskId, batchId, ... } })` | 导出任务只覆盖当前批次 |
| 5. 质量扫描 | 在数据质量页点击“立即扫描” | 调用 `scanQuality({ query: { taskId, batchId }, limit })` | 质量分和问题样例来自当前批次 |

## 5. 页面设计

### 5.1 Data Center 顶部上下文条

在 `DataCenterApp` 内读取 route state 后，如果存在 `batchId` 或 `taskId`，在 `PageShell` 内容区顶部显示一个轻量提示：

| 字段 | 展示 |
| --- | --- |
| 来源 | `来自热点监控`，当 `source === 'hot-monitor'` |
| Task | `Task：task-xxx` |
| Batch | `Batch：batch-xxx` |
| 说明 | `结果、导出和质量扫描将默认限定在该批次。` |

这个提示只解释当前上下文，不引入新的筛选面板。

### 5.2 ResultAssetTable

`ResultAssetTable` 接收一个可选 prop：

```ts
interface DataCenterRouteContext {
  taskId?: string;
  batchId?: string;
  source?: 'hot-monitor' | string;
}
```

行为：

| 场景 | 行为 |
| --- | --- |
| 无上下文 | 保持现状，调用 `listResults({ page: 1, pageSize: 20 })` |
| 有 `taskId/batchId` | 调用 `listResults({ page: 1, pageSize: 20, taskId, batchId })` |
| 导出 JSONL | `createExport.query` 同样带上 `taskId/batchId` |

### 5.3 QualityRulePanel

`QualityRulePanel` 接收同一个上下文 prop。

| 场景 | 行为 |
| --- | --- |
| 无上下文 | 保持现状，`scanQuality({ limit: 200 })` |
| 有上下文 | `scanQuality({ query: { taskId, batchId }, limit: 200 })` |
| 有 `batchId` | 扫描卡片文案显示“扫描当前批次” |

Phase 2 不自动扫描，避免用户进入页面就触发重计算；仍由用户点击“立即扫描”。

## 6. 数据流

```text
Hot Monitor 运行详情
  -> navigate('/data-center', { state: { taskId, batchId, source: 'hot-monitor' } })
  -> DataCenterApp 读取 location.state
  -> DataCenterRouteContext
  -> ResultAssetTable(context)
      -> dataCenter.listResults({ page, pageSize, taskId, batchId })
      -> dataCenter.createExport({ query: { page, pageSize, taskId, batchId } })
  -> QualityRulePanel(context)
      -> dataCenter.scanQuality({ query: { taskId, batchId }, limit: 200 })
```

## 7. 错误处理

| 场景 | 处理方式 |
| --- | --- |
| route state 为空 | Data Center 保持全局结果中心行为 |
| route state 类型不合法 | 忽略非法字段，只使用字符串类型的 `taskId/batchId/source` |
| 当前批次无结果 | `结果资产` 显示空表，同时上下文条仍展示批次 ID |
| 批次扫描无质量问题 | 显示 0 个问题和批次评分结果，或保持现有空态 |
| 导出创建失败 | 复用现有 `message.error` |

## 8. 测试策略

| 层级 | 测试内容 |
| --- | --- |
| Data Center 组件测试 | mock `useLocation` 返回 Hot Monitor state，断言上下文条显示 Task / Batch |
| Data Center 组件测试 | 断言 `listResults` 首次调用带 `taskId/batchId` |
| Data Center 组件测试 | 点击 `导出 JSONL` 后断言 `createExport.query` 带 `taskId/batchId` |
| Data Center 组件测试 | 点击 `立即扫描` 后断言 `scanQuality({ query: { taskId, batchId }, limit: 200 })` |
| 回归测试 | 无 route state 时，现有 Data Center 测试保持通过 |

## 9. 实施拆分

| 顺序 | 目标 | 可能涉及文件 |
| --- | --- | --- |
| 1 | 定义并解析 Data Center route context | `src/renderer/entries/data-center/App.tsx` |
| 2 | 把 context 传入结果资产表 | `ResultAssetTable.tsx` |
| 3 | 把 context 传入质量扫描面板 | `QualityRulePanel.tsx` |
| 4 | 补 Data Center 组件测试 | `tests/unit/renderer/data-center/App.test.tsx` |
| 5 | 更新当前状态文档 | `docs/overview/current-status.md` |

## 10. 成功标准

Phase 2 完成后，用户应该能说清楚：

> 我从热点运行详情进入数据中心后，看到的就是这次热点批次的结果；导出和质量扫描也默认只针对这次批次。

这一步完成后，热点黄金路径才真正从“运行报告”延伸到“结果资产使用”。后续再做 Runner 稳定化、Browser 介入和 AI 复盘时，才有稳定的 `Task / Batch / Result` 上下文可依赖。
