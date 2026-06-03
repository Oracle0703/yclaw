# 热点报告工作台增强 Phase 3 设计

## 1. 本阶段决策

Phase 3 选择增强 Hot Monitor 的报告工作台，而不是继续扩展 Data Center 或引入告警 / Review 流程。

本阶段目标：

> 让用户在 Hot Monitor 里能清楚理解一份热点报告来自哪个 Source / Task / Batch，能预览报告、追踪运行、进入结果中心，并完成报告的基础管理。

Phase 1 已经打通热点任务创建、运行、结果数量、HTML 报告和 `Task / Batch / Report` 追踪；Phase 2 已经让 Data Center 能承接 Hot Monitor 的 `taskId/batchId` 上下文。Phase 3 要补的是报告侧体验：报告现在能生成和预览，但报告列表与预览抽屉缺少足够的上下文，用户难以判断“这份报告对应哪一次运行”。

## 2. 当前已有基础

| 能力区域 | 当前已有能力 | 说明 |
| --- | --- | --- |
| 报告生成 | `HotReportService.generateReport()` 支持生成 HTML 报告 | 已能基于 `sourceId/batchId` 读取结果和执行日志 |
| 报告列表 | `HOT_REPORT_LIST` 返回 `HotReportSummary[]` | Hot Monitor 已展示最近报告和完整报告抽屉 |
| 报告预览 | `HOT_REPORT_DETAIL` 返回带 `content` 的报告详情 | 当前用 Drawer + iframe 预览 HTML |
| 报告管理 | 已支持打开存储位置、删除报告 | 现有按钮可保留 |
| 运行追踪 | `HotRunProjectionService` 已暴露 `taskId/batchId/resultCount/reportStatus` | 报告可以与运行详情和 Data Center 串起来 |
| Data Center 交接 | `/data-center` 已能接收 `{ taskId, batchId, source: 'hot-monitor' }` | 报告预览里可以复用同样跳转协议 |

## 3. 产品范围

| 做 | 不做 |
| --- | --- |
| 报告列表显示 Source / Task / Batch / Report / 创建时间 / 格式 | 不新增数据库字段 |
| 报告预览抽屉顶部显示报告上下文摘要 | 不新增 IPC 通道 |
| 报告预览里提供“查看结果中心”入口 | 不重做完整 Data Center 筛选器 |
| 报告行或预览里提供“查看运行详情”入口，复用现有运行详情视图 | 不实现报告编辑、人工批注或审核状态 |
| 无报告时给出明确空态 | 不做 docx 报告 |
| 补 Hot Monitor 组件测试 | 不重做 HTML 报告模板视觉体系 |

## 4. 用户路径

| 步骤 | 用户看到什么 | 系统做什么 | 验收标准 |
| --- | --- | --- | --- |
| 1. 进入报告区 | 最近报告列表里看到报告标题、格式、创建时间、Source / Batch 信息 | `HotReportPanel` 展示更多报告元数据 | 用户能区分报告对应哪一次运行 |
| 2. 预览报告 | 报告预览抽屉顶部显示报告摘要条 | `previewReport` 保存详情并渲染摘要 | 用户不用读 iframe 内容也能看到报告上下文 |
| 3. 追踪结果 | 点击“查看结果中心” | 跳转 `/data-center`，携带 `taskId/batchId/source` | Data Center 自动限定当前热点批次 |
| 4. 回看运行 | 点击“查看运行详情” | 读取对应 `sourceId/batchId` 的运行详情并打开现有运行详情 Modal | 用户能从报告回到运行状态、结果数量、失败信息 |
| 5. 管理报告 | 预览、打开存储位置、删除报告 | 继续复用现有 IPC | 旧能力不退化 |

## 5. 页面设计

### 5.1 报告列表

`HotReportPanel` 继续作为报告列表组件，但每条报告从“标题 + 格式时间 + 操作”增强为更清楚的报告卡片。

| 字段 | 展示方式 |
| --- | --- |
| 标题 | 主标题，保持现有 `report.title` |
| 格式 / 时间 | 副信息，继续显示 `format` 和格式化后的 `createdAt` |
| Source | 显示 `Source：source-xxx` |
| Batch | 显示 `Batch：batch-xxx` |
| Report | 显示 `Report：report-xxx` |
| 空态 | `暂无报告，成功运行后可生成 HTML 报告。` |

如果 `HotReportSummary` 当前没有 `taskId`，列表只显示已有的 `sourceId/batchId/reportId`。`taskId` 可以从预览详情或运行详情中补充，不为 Phase 3 新增后端字段。

### 5.2 报告预览抽屉

预览抽屉保留 iframe 渲染 HTML 报告，但顶部从单一标题增强为上下文摘要区。

| 区域 | 内容 |
| --- | --- |
| 标题 | 报告标题 |
| 摘要 | `Source / Batch / Report / 格式 / 创建时间` |
| 操作 | `查看运行详情`、`查看结果中心`、`打开存储位置`、`关闭预览` |
| 内容 | iframe 继续展示 `previewReport.content` |

`查看结果中心` 需要 `taskId`。如果当前 `previewReport` 没有 `taskId`，页面应尝试通过已加载的运行列表按 `sourceId + batchId` 找到对应 run 的 `taskId`。如果找不到，则禁用或不展示该按钮，避免跳转到不完整上下文。

### 5.3 查看运行详情

报告已包含 `sourceId` 和 `batchId`，可以复用现有的 `showRunDetail(sourceId, batchId)` 能力。

| 场景 | 行为 |
| --- | --- |
| 报告有 `sourceId/batchId` | 点击“查看运行详情”后打开现有运行详情 Modal |
| 运行详情加载成功 | 展示 `HotRunDetailView`，保留“查看结果中心”按钮 |
| 运行详情加载失败 | 复用现有错误提示 |

## 6. 数据流

```text
Hot Monitor 页面加载
  -> HOT_REPORT_LIST
  -> HotReportPanel 展示报告元数据

用户点击“预览报告”
  -> HOT_REPORT_DETAIL({ reportId })
  -> previewReport(content + metadata)
  -> 报告预览 Drawer

用户点击“查看运行详情”
  -> HOT_RUN_DETAIL({ sourceId, batchId })
  -> runDetail Modal

用户点击“查看结果中心”
  -> 从 previewReport 或 runs 中解析 taskId/batchId
  -> navigate('/data-center', {
       state: { taskId, batchId, source: 'hot-monitor' }
     })
```

## 7. 错误处理

| 场景 | 处理方式 |
| --- | --- |
| 报告列表为空 | 显示明确空态，不展示空白列表 |
| 报告详情加载失败 | 复用 `reportError(error, '加载热点报告预览失败')` |
| 报告缺少 `sourceId/batchId` | 不展示“查看运行详情”和“查看结果中心” |
| 找不到对应 `taskId` | 不展示或禁用“查看结果中心”，避免跳转泛 Data Center |
| 打开存储位置失败 | 复用现有错误提示 |
| 删除报告后当前预览仍打开 | 关闭预览并刷新报告列表，保持现有行为 |

## 8. 测试策略

| 层级 | 测试内容 |
| --- | --- |
| 组件测试 | `HotReportPanel` 或 `HotMonitorApp.test.tsx` 覆盖报告行显示 Source / Batch / Report |
| 组件测试 | 覆盖无报告空态文案 |
| 组件测试 | 点击“预览报告”后，报告预览抽屉显示上下文摘要 |
| 组件测试 | 预览抽屉点击“查看结果中心”会调用 `navigate('/data-center', { state })` |
| 组件测试 | 预览抽屉点击“查看运行详情”会调用现有运行详情加载并展示运行详情 |
| 回归测试 | 预览报告、打开存储位置、删除报告的既有测试保持通过 |

## 9. 实施拆分

| 顺序 | 目标 | 可能涉及文件 |
| --- | --- | --- |
| 1 | 锁定报告列表元数据和空态测试 | `tests/unit/components/HotMonitorApp.test.tsx` |
| 2 | 增强 `HotReportPanel` 报告行展示 | `src/renderer/entries/browser/components/HotReportPanel.tsx` |
| 3 | 增强 Hot Monitor 报告预览抽屉摘要和操作 | `src/renderer/entries/hot-monitor/App.tsx` |
| 4 | 实现报告预览到运行详情 / Data Center 的跳转 | `src/renderer/entries/hot-monitor/App.tsx` |
| 5 | 更新现状文档 | `docs/overview/current-status.md` |

## 10. 成功标准

Phase 3 完成后，用户应该能说清楚：

> 我在热点报告列表里能看出每份报告属于哪个批次；打开报告后能直接看到报告上下文，也能回到运行详情或进入结果中心继续复盘。

这一步完成后，Hot Monitor 的黄金路径会从“任务能跑、报告能生成”提升到“报告能管理、能追踪、能继续分析”。后续再做报告模板增强、AI 摘要缓存、通知分发治理或 Review 流程时，报告已经有稳定的操作入口和上下文承接。
