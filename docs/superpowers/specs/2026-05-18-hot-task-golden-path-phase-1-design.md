# 热点采集任务黄金路径 Phase 1 设计

## 1. 本阶段决策

Phase 1 只做一条最小但真实可跑通的热点任务主线：

> 创建一个多平台 NewsNow / TrendRadar 热点采集任务，运行一次批次，产出结果和 HTML 报告，并让操作人能看清 `Task / Batch / Result / Report` 之间的关系。

这一阶段不重做整个 Hot Monitor 页面，也不扩展新业务入口。重点是把现有热点服务和现有页面能力串成一条明确路径。

## 2. 当前已有基础

| 能力区域 | 当前已有能力 | 说明 |
| --- | --- | --- |
| 热点源 | `HotSourceService.createSource()` 会创建 `HotSource` 和底层 Task | 热点配置已经能映射到统一任务模型 |
| 任务编译 | `HotTaskCompiler` 会把 `HotSourceDraft` 编译成任务步骤 | `newsnow.batch` 已支持多平台 API 聚合模式 |
| 运行投影 | `HotRunProjectionService` 能把 Task 批次映射回 Hot Run | 已能暴露 `sourceId`、`taskId`、`batchId`、状态、结果数量、报告状态 |
| 报告 | `HotReportService` 能生成 HTML 报告 | 现有 Hot UI 已能预览报告内容 |
| IPC 通道 | `hot:source:*`、`hot:run:*`、`hot:report:*`、`hot:timeline:*`、`hot:ai:*`、`hot:notification:*` 已存在 | 第一版不应新增后端通道 |
| 测试 | 已有 Hot source、compiler、run projection、report、组件测试 | Phase 1 应延续现有测试风格，不另起一套 |

## 3. 产品范围

| 做 | 不做 |
| --- | --- |
| 默认把黄金路径指向多平台 NewsNow / TrendRadar 聚合 | 不重构完整 Hot Monitor 信息架构 |
| 让主操作清楚：创建、运行、查看报告 | 不做 Runner 稳定化、lease 回收、orphan 修复 |
| 在运行详情里展示 Task / Batch / Result / Report 关键标识 | 不做完整 Browser 介入流程 |
| 成功运行后能打开报告，并能进入 Data Center | 不做 Data Center 双向深度联动 |
| 失败时展示批次错误或断点信息 | 不做完整 Alert 处理和 Review 编辑器 |
| 补关键路径测试 | 不新增数据库结构，除非实现中发现硬性阻塞 |

## 4. 黄金路径

| 步骤 | 用户看到什么 | 系统做什么 | 验收标准 |
| --- | --- | --- | --- |
| 1. 进入 | 用户从 Workbench 或 Hot Monitor 点击“创建热点采集任务” | 打开 `/hot-monitor`，并让多平台热点任务路径可见 | 用户不用在旧模块里摸索入口 |
| 2. 配置 | 用户看到默认的多平台 TrendRadar 任务草稿 | 草稿使用 `siteKey: trendradar`、`parserKey: newsnow.batch`、NewsNow API URL 和默认平台列表 | 默认草稿无需手工补平台即可保存 |
| 3. 保存 | 用户保存任务 | `HotSourceService.createSource()` 创建 `HotSource` 和底层 Task | 页面提示创建成功，并能看到 source/task 关系 |
| 4. 运行 | 用户在同一条路径点击运行 | `HotRunProjectionService.startRun()` 启动底层 Task，并读取批次投影 | 运行列表出现一个 Batch 状态 |
| 5. 结果 | 运行完成 | 通过 `ResultService.listResults({ batchId })` 获取结果 | 运行详情显示结果数量和结果 ID |
| 6. 报告 | 用户生成或打开 HTML 报告 | `HotReportService` 生成关联 source 和 batch 的报告 | 报告能在当前路径预览 |
| 7. 追踪 | 用户查看运行详情 | UI 显示 `sourceId`、`taskId`、`batchId`、报告状态、结果数量 | 操作人能说明这次任务跑到哪里、产出了什么 |
| 8. 失败 | 运行失败 | 显示 Batch 的 `error` 或 `breakpoint` 摘要 | 用户不用打开开发者工具也能知道失败原因 |

## 5. 页面设计

### 5.1 Workbench 入口

Workbench 首页已有“创建热点采集任务”按钮，继续进入 `/hot-monitor`。如果 Hot Monitor 不能稳定默认到黄金路径，再考虑增加 route state 或 query 参数。

| 入口 | 行为 |
| --- | --- |
| Workbench “创建热点采集任务” | 打开 Hot Monitor，并优先展示多平台热点任务创建路径 |
| Hot Monitor 主按钮 | 进入同样的默认创建路径 |
| 旧的采集源列表 | 保留，但在视觉优先级上低于黄金路径 |

### 5.2 Hot Monitor 主界面

当前 Hot Monitor 页面已经很大，混合了采集源管理、TrendRadar 配置、RSS、报告、通知和多个抽屉。Phase 1 不做大重构，只加一条清晰的“黄金路径主面板”或“主操作条”。

| 面板 | 内容 |
| --- | --- |
| 创建 | 默认“多平台热点采集”草稿和保存动作 |
| 运行 | 最新运行状态、`batchId`、结果数量、失败原因 |
| 报告 | 生成 / 预览 HTML 报告 |
| 追踪 | 有数据时显示 `sourceId`、`taskId`、`batchId`、`reportId` |

### 5.3 Data Center 交接

Phase 1 只做实用交接，不做复杂筛选协议。

| 来源 | 目标 |
| --- | --- |
| Hot 运行详情里的 `batchId` | 跳到 `/data-center`，并尽量携带 batch 上下文 |
| 报告预览 | 仍然使用现有 Hot 报告预览作为主体验 |

如果 Data Center 现在还不能接收 `batchId` 过滤参数，Phase 1 可以先显示 `batchId` 并跳到 `/data-center`。真正的深度筛选留到 Phase 1.5。

## 6. 数据流

```text
热点任务入口
  -> HotSourceDraft(newsnow.batch)
  -> HotSourceService.createSource()
  -> HotTaskCompiler.compile()
  -> TaskService.createTask()
  -> HotSourceRepository.saveSource()
  -> HotRunProjectionService.startRun()
  -> Task / Batch 执行
  -> ResultService.listResults({ batchId })
  -> HotReportService.generateReport()
  -> Hot 运行详情 / 报告预览 / Data Center 交接
```

## 7. 错误处理

| 场景 | 处理方式 |
| --- | --- |
| 创建热点源失败 | 展示错误信息，并保留当前草稿 |
| 启动运行失败 | 展示失败信息，并保持当前采集源选中 |
| UI 轮询超时 | 停止轮询，提示批次可能仍在后台运行 |
| 批次失败 | 展示 `batch.error`，如果有断点则展示断点摘要 |
| 报告生成失败 | 保留运行详情，并展示报告生成错误 |
| 结果数量为 0 | 视为运行完成，但提示“未抽取到记录” |

## 8. 测试策略

| 层级 | 测试内容 |
| --- | --- |
| 组件测试 | `HotMonitorApp.test.tsx` 覆盖默认多平台创建路径、启动运行、报告动作、失败展示 |
| 服务测试 | `HotTaskCompiler.test.ts` 锁定 `newsnow.batch` 的任务步骤和 `hot:batch` 标签 |
| 服务测试 | `HotRunProjectionService.test.ts` 验证 task/batch/result/report 投影字段 |
| 服务测试 | `HotSourceService.test.ts` 验证创建热点源仍会创建底层 Task |
| 回归测试 | Workbench 首页测试继续验证“创建热点采集任务”进入 `/hot-monitor` |

## 9. 实施拆分

| 顺序 | 目标 | 可能涉及文件 |
| --- | --- | --- |
| 1 | 先锁定黄金路径测试 | `tests/unit/components/HotMonitorApp.test.tsx`、相关服务测试 |
| 2 | 默认进入多平台创建上下文 | `src/renderer/entries/hot-monitor/App.tsx`、`newsnowPresets.ts` |
| 3 | 运行详情展示追踪字段 | 复用 browser Hot 组件里的运行详情视图 |
| 4 | 报告生成和预览交接 | `HotMonitorApp.tsx`、报告面板交互 |
| 5 | 失败和空结果提示 | `HotMonitorApp.tsx`、运行详情视图 |

## 10. 成功标准

Phase 1 完成后，用户应该能说清楚：

> 我创建了一个多平台热点任务，运行了一次，找到了对应批次，看到了结果数量，打开了 HTML 报告，也知道失败时应该看哪里。

这不是完整任务运营平台的终点，而是第一条真实主线。Runner 稳定化、Browser 介入、Data Center 深度联动、Alert 负责人和 Review 编辑都应该在这条路径跑通之后继续推进。
