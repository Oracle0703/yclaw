# SPEC · Browser HOT Workspace V1

> 关联文档：`docs/specs/automation-browser-ops-v1.md`、`docs/overview/current-status.md`、`docs/overview/implementation-audit.md`  
> 关联代码：`src/renderer/entries/browser/`、`src/main/services/hot/`、`src/main/ipc/hot-handlers.ts`

---

## 1. 文档目标

| 项目 | 说明 |
| --- | --- |
| 目标 | 为浏览器模块中的 `HOT` 采集工作台与抖音分析台提供稳定文档承接 |
| 当前入口形态 | 不新增独立 renderer entry，继续挂在 `browser` 模块内 |
| 当前工作模式 | `browser-session` 与 `hot-workspace` 双模式 |
| 文档定位 | 回答“现在已经实现了什么、链路怎么走、还有什么没做” |

---

## 2. 当前实现结论

| 能力 | 状态 | 说明 |
| --- | --- | --- |
| 浏览器会话控制台 | `✅ 已做` | 标签页、地址栏、跳转、刷新、关闭、WebContentsView 容器已存在 |
| 抖音分析台 | `✅ 已做基础版` | 搜索样本、目标详情、评论分析、授权下载、回流草稿已存在 |
| `HOT` 采集工作台 | `✅ 已做基础版` | 热榜源 CRUD、运行列表、运行详情、报告生成均已存在 |
| 新增独立菜单 | `⬜ 未做` | 当前仍承载在 `browser` 模块内部，而不是单独入口 |
| 真实站点搜索 / 下载后端 | `⬜ 未做` | 当前抖音分析台仍偏 renderer-first 工作台，不是完整站点采集后端 |
| `docx` 报告导出 | `⬜ 未做` | `HotReportService` 当前只支持 `md` |

---

## 3. 模块边界

| 层级 | 代表文件 | 职责 |
| --- | --- | --- |
| Renderer 主视图 | `src/renderer/entries/browser/App.tsx` | 持有双工作模式状态，编排抖音分析台与 `HOT` 工作台 |
| Renderer - 抖音分析台 | `DouyinSearchPanel.tsx` `DouyinTargetPanel.tsx` `DouyinInsightPanel.tsx` | 搜索样本、当前视频、评论洞察、下载授权、回流草稿 |
| Renderer - HOT 面板 | `HotSourcePanel.tsx` `HotRunPanel.tsx` `HotReportPanel.tsx` | 采集源管理、运行列表/详情、报告列表 |
| Shared 类型 | `src/shared/types/hot.ts` | `HotSource`、`HotRunSummary`、`HotReportSummary`、工作模式类型 |
| IPC 边界 | `src/main/ipc/hot-handlers.ts` | `HOT_SOURCE_*`、`HOT_RUN_*`、`HOT_REPORT_*` 通道注册 |
| 主进程服务 | `src/main/services/hot/` | 采集源存储、任务编译、运行投影、报告生成 |
| 持久化 | `hot_sources` `hot_reports` | 源配置与报告元数据存储；运行数据复用既有 task/batch/result/log 表 |

---

## 4. 工作模式

| 模式 | 用途 | 当前实现 |
| --- | --- | --- |
| `browser-session` | 浏览器会话控制、站点打开、人工干预、录制、抖音分析台 | 默认模式 |
| `hot-workspace` | 管理热榜采集源、查看历史运行、生成报告 | 点击切换后加载 `HOT` 数据 |

当前设计结论：

| 决策点 | 结论 |
| --- | --- |
| 是否独立成新菜单 | 当前不独立，继续挂在 `browser` 下 |
| 为什么不独立 | 现阶段依赖浏览器会话、站点上下文和人工介入，分出去会让链路割裂 |
| 何时考虑独立 | 当 `HOT` 采集形成完全独立的任务配置、调度、结果运营入口时，再评估升级为独立模块 |

---

## 5. HOT 数据模型

### 5.1 采集源

| 字段 | 来源 | 说明 |
| --- | --- | --- |
| `id` | `hot_sources.id` | 采集源主键 |
| `taskId` | `hot_sources.task_id` | 与自动化任务一一绑定 |
| `name` | 用户输入 | 源名称 |
| `sourceKind` | 用户输入 | `api` 或 `browser` |
| `siteKey` | 用户输入 | 站点标识，例如 `douyin`、`weibo` |
| `entryUrl` | 用户输入 | 入口地址 |
| `parserKey` | 用户输入 | 解析器标识，例如 `douyin.hot` |
| `sessionId` | 可选 | 绑定浏览器会话 |
| `schedule` | 可选 | 复用任务调度配置 |
| `enabled` | 可选 | 是否启用 |
| `tags` | 可选 | 标签列表 |

### 5.2 运行摘要

| 字段 | 来源 | 说明 |
| --- | --- | --- |
| `batchId` | `task_batches.id` | 运行批次 |
| `sourceId` | 由 `HotSource.taskId -> Batch.taskId` 映射 | 对应采集源 |
| `status` | `task_batches.status` | 当前状态 |
| `resultCount` | `ResultService.listResults({ batchId })` | 结果数 |
| `reportStatus` | `hot_reports` 查询 | `pending` / `generated` |

### 5.3 报告摘要

| 字段 | 来源 | 说明 |
| --- | --- | --- |
| `id` | `hot_reports.id` | 报告主键 |
| `sourceId` | `hot_reports.source_id` | 对应采集源 |
| `batchId` | `hot_reports.batch_id` | 对应运行批次 |
| `title` | 由服务生成 | 当前为 `<source.name> 报告` |
| `format` | 当前固定 `md` | `docx` 尚未支持 |
| `filePath` | 输出路径 | 默认位于用户数据目录下的 `hot-reports/` |

---

## 6. HOT 主链路

### 6.1 新建采集源

| 步骤 | 当前实现 |
| --- | --- |
| 1 | Renderer 在 `HotSourcePanel` 录入名称、站点、入口地址、解析器标识、类型、标签 |
| 2 | 调用 `HOT_SOURCE_CREATE` |
| 3 | `HotSourceService.createSource()` 先用 `HotTaskCompiler` 编译为任务草案 |
| 4 | 调用 `TaskService.createTask()` 创建真实自动化任务 |
| 5 | 将 `HotSource` 元数据写入 `hot_sources` |

### 6.2 更新 / 删除采集源

| 动作 | 当前实现 |
| --- | --- |
| 更新 | `HotSourceService.updateSource()` 会同步更新底层任务流 |
| 删除 | `HotSourceService.deleteSource()` 会先删底层任务，再删 `hot_sources` |

### 6.3 启动采集

| 步骤 | 当前实现 |
| --- | --- |
| 1 | Renderer 调用 `HOT_RUN_START` |
| 2 | `HotRunProjectionService.startRun()` 找到对应 `taskId` |
| 3 | 通过已有 `TaskService` 启动任务 |
| 4 | 运行态、批次、结果、执行日志继续复用自动化主线能力 |

### 6.4 查看运行详情

| 内容 | 来源 |
| --- | --- |
| 状态、开始/结束时间 | `task_batches` |
| `stepResults`、`breakpoint`、`error` | `BatchService.getBatch()` |
| 结果关联 | `ResultService.listResults({ batchId })` |
| 报告状态 | `HotReportRepository.getReportByBatchId()` |

### 6.5 生成报告

| 步骤 | 当前实现 |
| --- | --- |
| 1 | Renderer 调用 `HOT_REPORT_GENERATE` |
| 2 | `HotReportService.generateReport()` 校验 source / batch 对应关系 |
| 3 | 查询结果与执行日志 |
| 4 | 生成 Markdown 内容并写入文件 |
| 5 | 报告元数据写入 `hot_reports` |

---

## 7. Task 编译规则

### 7.1 `browser` 类型源

| 步骤 | Action |
| --- | --- |
| 打开目标页面 | `click`，并在 `params` 中携带 `entryUrl`、`parserKey` |
| 提取热点数据 | `extract`，携带 `parserKey` |
| 记录页面截图 | `screenshot` |

### 7.2 `api` 类型源

| 步骤 | Action |
| --- | --- |
| 请求 API 数据 | `extract`，`selector=entryUrl`，并携带 `mode=api` |
| 记录返回快照 | `screenshot`，并携带 `mode=api` |

---

## 8. 抖音分析台

| 能力 | 状态 | 说明 |
| --- | --- | --- |
| 搜索样本列表 | `✅ 已做` | renderer 内构造种子样本与当前分析对象 |
| 当前视频详情 | `✅ 已做` | 展示作者、互动数据、评论样本、备注 |
| 评论洞察 | `✅ 已做` | 基于当前目标生成结构化洞察与复盘草稿 |
| 下载授权确认 | `✅ 已做` | 下载前需显式授权 |
| 回流任务草稿 | `✅ 已做` | 可拼出任务说明 / review queue note |
| 真实后端搜索 | `⬜ 未做` | 当前不是完整在线搜索后端 |
| 下载持久化链路 | `⬜ 未做` | 当前仍是工作台级记录，不是完整下载中心 |

设计约束：

| 项目 | 当前结论 |
| --- | --- |
| 状态归属 | 仍由 `browser/App.tsx` 统一持有 |
| 是否已升级独立模块 | 否 |
| 与 HOT 的关系 | 同属浏览器采集工作台，但 `HOT` 偏“任务化采集源”，抖音分析台偏“人工分析与回流辅助” |

---

## 9. IPC 清单

| 通道 | 说明 |
| --- | --- |
| `hot:source:list` | 查询采集源列表 |
| `hot:source:detail` | 查询单个采集源 |
| `hot:source:create` | 创建采集源 |
| `hot:source:update` | 更新采集源 |
| `hot:source:delete` | 删除采集源 |
| `hot:run:list` | 查询运行列表 |
| `hot:run:start` | 启动采集 |
| `hot:run:detail` | 查询运行详情 |
| `hot:report:list` | 查询报告列表 |
| `hot:report:detail` | 查询单份报告 |
| `hot:report:generate` | 生成报告 |

---

## 10. 当前未完成项

| 项目 | 状态 | 说明 |
| --- | --- | --- |
| 独立菜单 / 独立模块入口 | `未做` | 当前仍在 `browser` 内 |
| `docx` 报告 | `未做` | 服务层明确只支持 `md` |
| 热榜专用结果面板 | `未做` | 当前运行与结果仍通过通用 batch/result 主线承载 |
| 多解析器注册中心 | `未做` | 当前仅保留 `parserKey` 占位，未形成插件化 parser registry |
| 真实在线搜索 / 下载后端 | `未做` | 抖音分析台目前仍偏本地工作台 |

---

## 11. 验收口径

| 验收项 | 当前口径 |
| --- | --- |
| 新建源 | 创建后可同时看到 `hot_sources` 记录与底层任务 |
| 更新源 | 更新后底层任务流同步更新 |
| 删除源 | 删除后底层任务与 `hot_sources` 记录一起移除 |
| 启动采集 | 能创建新 batch，并在运行列表出现 |
| 查看运行 | 能看到批次状态、步骤结果、断点、关联结果 |
| 生成报告 | 能在 `hot_reports` 中落元数据，并生成 `.md` 文件 |

---

## 12. 建议阅读顺序

| 目标 | 建议顺序 |
| --- | --- |
| 了解浏览器采集主线 | `docs/specs/automation-browser-ops-v1.md` → 本文档 |
| 了解当前实现状态 | `docs/overview/current-status.md` → 本文档 |
| 快速看代码 | `src/renderer/entries/browser/App.tsx` → `src/main/services/hot/` → `src/main/ipc/hot-handlers.ts` |
