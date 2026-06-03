# YClaw 本地任务工具台第三轮任务审计

> 前置审计：`docs/plans/task-toolbench-phase1-audit.md`  
> 前置计划：`docs/plans/task-toolbench-phase1-plan.md`  
> 关联拆解：`docs/plans/task-toolbench-v1.md`  
> 审计目标：在“京东签到专项闭环”和“热点标准批次闭环”之后，审核第三轮是否可以进入评论监控、AI 回复、MediaCrawler、能力中心，并明确最小闭环、接口边界和验收标准。

## 1. 审计结论

第三轮可以进入评论监控，但必须收窄为“小红书评论标准批次闭环”。

推荐第三轮只进入这条主线：

```text
评论监控模板
  -> 创建小红书评论源
  -> 创建关联 TaskFlow
  -> 立即运行标准批次
  -> 运行监控查看评论批次
  -> 评论结果进入结果库
  -> 生成评论洞察报告
  -> 可选生成 AI 回复草稿
```

第三轮可以进入：

- P1-03A 评论模板适配器。
- P1-03B 小红书评论源创建与编辑。
- P1-03C 评论运行监控接入。
- P1-03D 评论结果和报告进入结果库。
- P1-03E AI 回复草稿最小接入。

第三轮不建议进入：

- MediaCrawler 多平台外部执行闭环。
- 抖音、快手、B 站、微博、贴吧、知乎等多平台评论模板。
- AI 自动发布或半自动发布。
- 能力中心完整实现。
- 统一结果落表迁移。

核心原因：

- `CommentSourceService` 当前只允许 `platform = xhs`，所以第三轮不能承诺多平台评论模板。
- 评论源已经能创建 `TaskFlow`，评论运行已经能投影到标准 `TaskBatch`，具备标准批次闭环基础。
- 评论报告已经能基于标准结果生成 `md/html`，可以复用第二轮结果库多来源模型。
- `CommentAiReplyService` 在没有 AI client 时会返回兜底草稿，适合作为“手动草稿产物”，但不能作为自动回复能力宣传。
- MediaCrawler 需要已有 `batchId`，且依赖外部仓库、Python、登录方式和导入目录，适合后续增强，不适合第三轮主线。

## 2. 第三轮进入前置条件

第三轮必须建立在第二轮完成之后。

第二轮完成标准：

- `hot-monitor` 已从 preview 升级为 ready。
- 热点模板能创建 `HotSource` 和关联 `TaskFlow`。
- 热点运行能在运行监控中展示标准批次状态。
- 热点报告能生成、查看并进入结果库。
- 结果库能同时展示 `standard`、`signin`、`hot` 来源。
- 标准结果导出走 Data Center 导出任务。

如果结果库还不能稳定处理 `standard/signin/hot` 三类来源，不应接评论。评论会新增 `comment result`、`comment report`、`ai reply draft` 三类展示对象，过早进入会让结果库边界再次失控。

## 3. 状态与兼容约束

第三轮继续复用现有状态合约。

批次状态只能使用现有 `TaskBatchStatus`：

| 状态 | UI 文案 |
| --- | --- |
| `pending` | 等待中 |
| `running` | 运行中 |
| `success` | 成功 |
| `failed` | 失败 |
| `cancelled` | 已取消 |
| `paused` | 已暂停 |
| `intervention` | 需人工介入 |

第三轮不得新增：

- `commented`
- `reply_generated` 作为批次状态
- `ai_failed` 作为批次状态
- `mediacrawler_running` 作为批次状态

评论报告状态继续只使用：

| 状态来源 | 状态 | 说明 |
| --- | --- | --- |
| `CommentRunSummary.reportStatus` | `pending` | 批次已有结果但报告未生成 |
| `CommentRunSummary.reportStatus` | `generated` | 已有评论报告 |

AI 回复草稿不能改变任务、批次、报告状态。它只能作为评论结果的可选附属产物展示。

## 4. 现有接口盘点

### 4.1 评论源怎么创建和更新

现有接口：

| 能力 | IPC | payload | 返回 | 代码位置 |
| --- | --- | --- | --- | --- |
| 评论源列表 | `COMMENT_SOURCE_LIST` | 无 | `CommentSource[]` | `src/main/ipc/comment-handlers.ts` |
| 评论源详情 | `COMMENT_SOURCE_DETAIL` | `{ sourceId }` | `CommentSource | null` | `src/main/ipc/comment-handlers.ts` |
| 创建评论源 | `COMMENT_SOURCE_CREATE` | `CommentSourceDraft` | `CommentSource` | `CommentSourceService.createSource()` |
| 更新评论源 | `COMMENT_SOURCE_UPDATE` | `{ sourceId, updates }` | `CommentSource` | `CommentSourceService.updateSource()` |
| 删除评论源 | `COMMENT_SOURCE_DELETE` | `{ sourceId }` | 删除结果 | `CommentSourceService.deleteSource()` |

创建链路：

```text
COMMENT_SOURCE_CREATE
  -> CommentSourceService.createSource()
  -> CommentSourceService.normalizeDraft()
  -> CommentTaskCompiler.compile()
  -> TaskService.createTask()
  -> CommentSource(taskId = task.id)
```

关键约束：

- `CommentSourceService.normalizeDraft()` 当前只支持 `draft.platform === 'xhs'`。
- `draft.entryValue` 不能为空。
- 默认 `parserKey = xhs.comment`。
- 默认 `schedule = { type: 'manual' }`。
- 默认 `limits = DEFAULT_COMMENT_LIMITS`。

`DEFAULT_COMMENT_LIMITS`：

| 字段 | 默认值 |
| --- | --- |
| `maxContents` | `5` |
| `maxCommentsPerContent` | `20` |
| `includeSubComments` | `false` |
| `crawlIntervalSeconds` | `2` |

审计判断：

- 第三轮评论模板必须只开放小红书。
- 模板参数应映射到 `CommentSourceDraft`，不直接调用 `TASK_CREATE`。
- 创建后应通过 `CommentSource.taskId` 关联任务台、运行监控和结果库。

边界条件：

- `platform = douyin` 虽然存在于共享类型，但第三轮不能开放。
- 删除评论源会删除关联任务，UI 需要二次确认。
- 评论模板不是新数据库实体。
- 保存草稿仍然是配置状态，不新增任务状态。

验收判断：

- 从评论模板保存后，能得到 `CommentSource.taskId`。
- `TASK_LIST` 能看到关联任务。
- `COMMENT_SOURCE_LIST` 能看到对应评论源。
- 选择非小红书平台不会出现在第三轮 UI。

### 4.2 评论怎么运行和监控

现有接口：

| 能力 | IPC | payload | 返回 | 代码位置 |
| --- | --- | --- | --- | --- |
| 评论运行列表 | `COMMENT_RUN_LIST` | `{ sourceId? }` | `CommentRunSummary[]` | `CommentRunProjectionService.listRuns()` |
| 评论运行详情 | `COMMENT_RUN_DETAIL` | `{ sourceId, batchId }` | `CommentRunDetail | null` | `CommentRunProjectionService.getRunDetail()` |
| 启动评论运行 | `COMMENT_RUN_START` | `{ sourceId }` | `{ sourceId, taskId, started }` | `CommentRunProjectionService.startRun()` |

运行投影链路：

```text
CommentSource.taskId
  -> BatchService.listBatchesByTask(taskId)
  -> ResultService.listResults({ batchId })
  -> CommentReportRepository.getReportByBatchId(batchId)
  -> CommentRunSummary / CommentRunDetail
```

`CommentRunSummary` 关键字段：

- `batchId`
- `sourceId`
- `sourceName`
- `status`
- `startedAt`
- `finishedAt`
- `resultCount`
- `reportStatus`

`CommentRunDetail` 额外字段：

- `taskId`
- `error`
- `breakpoint`
- `stepResults`
- `linkedResultIds`

审计判断：

- 评论运行和热点一样，天然绑定标准批次，适合放入运行监控。
- `reportStatus` 只能展示报告状态，不得污染批次状态。
- 第三轮需要处理 `COMMENT_RUN_START` 返回 `started: false` 的情况。

边界条件：

- 评论运行详情需要 `sourceId + batchId`。
- 批次没有评论结果时 `resultCount = 0` 是合法状态。
- 失败、介入、重试仍使用标准批次行为。

验收判断：

- 评论运行后能在运行监控看到批次状态。
- 批次失败时能看到错误、断点和步骤结果。
- 评论报告状态能和批次状态分开展示。

### 4.3 评论结果怎么取

现有接口：

| 能力 | IPC | payload | 返回 | 代码位置 |
| --- | --- | --- | --- | --- |
| 评论结果列表 | `COMMENT_RESULT_LIST` | `{ batchId? }` | `CommentItem[]` | `comment-handlers.ts` |
| 标准结果列表 | `RESULT_LIST` | `{ taskId?, batchId? }` | `ExtractionResult[]` | `ResultService.listResults()` |
| Data Center 分页 | `DATA_CENTER_RESULTS_LIST` | 标准结果查询 | `DataPage<ExtractionResult>` | `DataCenterService.listResults()` |

`COMMENT_RESULT_LIST` 当前行为：

```text
ResultService.listResults({ batchId })
  -> map(toCommentItem)
  -> filter(Boolean)
  -> CommentItem[]
```

审计判断：

- 评论结果底层仍是标准 `ExtractionResult`。
- 结果库第三轮应同时支持两种视图：
  - 标准视图：按 `ExtractionResult` 展示，支持 Data Center 导出。
  - 评论视图：按 `CommentItem` 展示，支持 AI 回复草稿入口。
- 评论结果不是新的结果表，不需要迁移。

边界条件：

- 如果 `ExtractionResult.data` 缺少 `commentId` 或 `content`，不会成为 `CommentItem`。
- 没有评论结果时仍可以生成空报告，但 UI 要明确“未采集到评论”。
- `COMMENT_RESULT_LIST` 如果不传 `batchId`，会尝试从所有结果映射评论，第三轮应优先传 `batchId`。

验收判断：

- 结果库能显示某个评论批次的评论条目。
- 评论结果仍可通过标准结果导出。
- 评论条目能追溯到任务和批次。

### 4.4 评论报告怎么取

现有接口：

| 能力 | IPC | payload | 返回 | 代码位置 |
| --- | --- | --- | --- | --- |
| 评论报告列表 | `COMMENT_REPORT_LIST` | `{ sourceId?, batchId? }` | `CommentReportSummary[]` | `CommentReportService.listReports()` |
| 评论报告详情 | `COMMENT_REPORT_DETAIL` | `{ reportId }` | `CommentReportSummary | null` | `CommentReportService.getReportDetail()` |
| 生成评论报告 | `COMMENT_REPORT_GENERATE` | `{ sourceId, batchId, format }` | `CommentReportSummary` | `CommentReportService.generateReport()` |
| 删除评论报告 | `COMMENT_REPORT_DELETE` | `{ reportId }` | `{ deleted }` | `CommentReportService.deleteReport()` |
| 打开评论报告 | `COMMENT_REPORT_REVEAL` | `{ reportId }` | `{ revealed }` | `CommentReportService.revealReport()` |

支持报告格式：

| 类型 | 服务支持 | 第三轮建议 |
| --- | --- | --- |
| `md` | 支持 | 进入 |
| `html` | 支持 | 进入 |

审计判断：

- 评论报告可以复用第二轮热点报告的专项结果模式，以 `sourceType = comment` 进入结果库。
- 评论报告详情不能走 `RESULT_DETAIL` 或 Data Center 标准结果详情。
- 评论报告打开文件走 `COMMENT_REPORT_REVEAL`。

边界条件：

- `CommentReportService.getReportDetail()` 当前直接读取文件；文件丢失可能抛错，UI 需要展示读取失败。
- 生成报告会校验 `batch.taskId === source.taskId`。
- 删除报告不删除批次或标准结果。

验收判断：

- 评论报告可生成 `md/html`。
- 评论报告能进入结果库。
- 评论报告能打开详情或文件位置。
- 报告和标准结果详情接口不混用。

### 4.5 AI 回复草稿怎么接

现有接口：

| 能力 | IPC | payload | 返回 | 代码位置 |
| --- | --- | --- | --- | --- |
| 生成 AI 回复草稿 | `COMMENT_AI_REPLY_GENERATE` | `{ comment, tone? }` | `CommentAiReplyDraft` | `CommentAiReplyService.generateReply()` |

`CommentAiReplyService` 行为：

- 如果存在 `aiClient`，使用 AI 生成 1 到 3 条草稿。
- 如果没有 `aiClient` 或输出为空，返回本地兜底草稿。
- `publishMode` 固定为 `manual`。
- 只生成草稿，不执行发布动作。

支持语气：

| tone | 文案 |
| --- | --- |
| `friendly` | 友好自然 |
| `professional` | 专业克制 |
| `concise` | 简短直接 |

审计判断：

- 第三轮可以把 AI 回复作为“评论结果详情里的手动草稿动作”。
- AI 不可用时仍返回兜底草稿，所以不能把 AI 不可用视为评论任务失败。
- AI 草稿不应自动写入标准结果，也不应改变批次状态。

边界条件：

- 不做自动发布。
- 不做批量生成。
- 不把草稿存入数据库，除非另立持久化设计。
- 草稿只能绑定当前 `CommentItem.commentId`。

验收判断：

- 用户能对单条评论生成回复草稿。
- AI 不可用时仍能看到兜底草稿。
- 草稿必须标记为“手动发布”。
- 生成失败不影响原始评论结果查看。

### 4.6 MediaCrawler 为什么暂缓

现有接口：

| 能力 | IPC | payload | 返回 |
| --- | --- | --- | --- |
| 获取配置 | `COMMENT_MEDIACRAWLER_CONFIG_GET` | 无 | `MediaCrawlerConfig` |
| 保存配置 | `COMMENT_MEDIACRAWLER_CONFIG_SAVE` | `MediaCrawlerConfig` | `MediaCrawlerConfig` |
| 测试配置 | `COMMENT_MEDIACRAWLER_TEST` | config 可选 | `{ ok, mainPath }` |
| 外部运行 | `COMMENT_MEDIACRAWLER_RUN` | `MediaCrawlerRunRequest` | `MediaCrawlerRunResult` |

MediaCrawler 外部运行链路：

```text
COMMENT_MEDIACRAWLER_RUN
  -> MediaCrawlerService.run()
  -> MediaCrawlerExternalExecutor.run()
  -> buildMediaCrawlerCommand()
  -> spawn python main.py
  -> MediaCrawlerResultImporter.importResults()
  -> ResultService.saveResult()
```

关键约束：

- `MediaCrawlerRunRequest` 必须包含已有 `taskId` 和 `batchId`。
- 没有已创建批次时不能运行 MediaCrawler。
- `MediaCrawlerConfig.enabled` 为 false 时会抛错。
- `repoPath/main.py` 不存在时会抛错。
- 外部进程非 0 退出码会抛错。
- 导入结果最终写入标准 `ExtractionResult`。

暂缓原因：

- MediaCrawler 是外部执行器，不是评论标准闭环的必需路径。
- 它依赖用户本机仓库、Python、登录方式和外部输出目录。
- 多平台支持口径和 `CommentSourceService` 当前只支持 xhs 的口径不一致。
- 它需要已有批次，不能作为“创建并立即运行”的第一运行路径。

第三轮只允许做：

- 在评论模板或能力提示中标记“MediaCrawler 外部导入为后续增强”。
- 不把 MediaCrawler 作为第三轮立即运行路径。
- 不把 MediaCrawler 多平台暴露为模板能力。

## 5. 第三轮最小闭环可行性确认

### 5.1 闭环路径

第三轮推荐闭环：

```text
任务台
  -> 评论监控模板
  -> 创建小红书评论源和关联任务
  -> 立即运行评论任务
  -> 运行监控查看标准批次
  -> 结果库查看评论结果
  -> 生成评论洞察报告
  -> 对单条评论生成 AI 回复草稿
```

### 5.2 可行性表

| 步骤 | 可复用能力 | 是否可行 | 需要新增 |
| --- | --- | --- | --- |
| 选择评论模板 | 静态模板目录 | 可行 | 将 `comment-monitor` 从 preview 升级为 xhs-only ready |
| 创建评论源 | `COMMENT_SOURCE_CREATE` | 可行 | 模板表单到 `CommentSourceDraft` 适配 |
| 立即运行 | `COMMENT_RUN_START` | 有条件可行 | 处理 `started: false` |
| 运行监控 | `COMMENT_RUN_LIST`、`COMMENT_RUN_DETAIL` | 可行 | 评论运行 view model |
| 评论结果 | `COMMENT_RESULT_LIST`、`RESULT_LIST` | 可行 | 评论结果详情模型 |
| 生成报告 | `COMMENT_REPORT_GENERATE` | 可行 | 报告生成动作 |
| 报告详情 | `COMMENT_REPORT_DETAIL` | 可行 | `sourceType = comment` 详情模型 |
| AI 回复草稿 | `COMMENT_AI_REPLY_GENERATE` | 可行 | 单条评论草稿动作 |
| MediaCrawler | `COMMENT_MEDIACRAWLER_*` | 暂缓 | 后续增强设计 |

### 5.3 最小闭环判定

第三轮可以成立，但必须满足四条边界：

- 评论模板只支持小红书。
- 评论运行使用标准批次，不新增专项运行状态。
- 评论报告以 `sourceType = comment` 进入结果库，不写入 `extraction_results`。
- AI 回复只生成手动草稿，不发布、不落库、不影响任务状态。

## 6. 第三轮需要新增的最小模块

### 6.1 评论模板适配器

建议新增：

- `src/renderer/entries/workbench/task-toolbench/commentTemplateAdapter.ts`

职责：

- 将模板表单转换为 `CommentSourceDraft`。
- 固定 `platform = xhs`。
- 规范默认 limits。
- 阻止第三轮不支持的平台。

最小参数：

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `name` | 是 | 任务名称 |
| `entryKind` | 是 | `keyword`、`note`、`creator` |
| `entryValue` | 是 | 关键词、笔记 URL、创作者主页 URL |
| `sessionId` | 否 | 浏览器会话 |
| `maxContents` | 否 | 默认 5 |
| `maxCommentsPerContent` | 否 | 默认 20 |
| `includeSubComments` | 否 | 默认 false |
| `crawlIntervalSeconds` | 否 | 默认 2 |

默认值：

| 字段 | 默认值 |
| --- | --- |
| `platform` | `xhs` |
| `parserKey` | `xhs.comment` |
| `schedule` | `{ type: 'manual' }` |
| `enabled` | `true` |

### 6.2 评论运行 view model

建议扩展：

- `src/renderer/entries/workbench/task-toolbench/runMonitorViewModel.ts`

新增输入：

- `CommentRunSummary[]`
- `CommentSource[]`

输出模型：

| 字段 | 映射 |
| --- | --- |
| `runId` | `comment:${sourceId}:${batchId}` |
| `sourceType` | `comment` |
| `taskId` | 通过 `CommentSource.sourceId -> taskId` 补齐 |
| `batchId` | `CommentRunSummary.batchId` |
| `rawStatus` | `CommentRunSummary.status` |
| `resultCount` | `CommentRunSummary.resultCount` |
| `reportStatus` | `CommentRunSummary.reportStatus` |
| `actions` | 查看结果、生成报告、生成回复草稿入口 |

边界：

- `reportStatus` 不是运行状态。
- `started: false` 不能展示为运行中。
- 失败重试仍走标准批次重试。

### 6.3 结果库评论模型

建议扩展：

- `src/renderer/entries/workbench/task-toolbench/resultLibraryViewModel.ts`

评论结果模型：

| 字段 | 映射 |
| --- | --- |
| `id` | `comment:${batchId}:${commentId}` |
| `sourceType` | `comment` |
| `taskId` | 通过 `CommentSource.sourceId -> taskId` 或标准结果补齐 |
| `batchId` | 当前批次 ID |
| `title` | 评论作者 + 内容摘要 |
| `statusLabel` | `正常` |
| `createdAt` | 评论创建时间或结果创建时间 |
| `detailRef` | `{ sourceType: 'comment', batchId, commentId }` |
| `exportableFormats` | 标准结果导出由 `standard` 来源负责 |

评论报告模型：

| 字段 | 映射 |
| --- | --- |
| `id` | `comment-report:${reportId}` |
| `sourceType` | `comment` |
| `taskId` | 通过 `CommentSource.sourceId -> taskId` 补齐 |
| `batchId` | `CommentReportSummary.batchId` |
| `title` | `CommentReportSummary.title` |
| `statusLabel` | `已生成` |
| `detailRef` | `{ sourceType: 'comment-report', reportId }` |

边界：

- 评论报告不是标准 `ExtractionResult`。
- 评论报告详情走 `COMMENT_REPORT_DETAIL`。
- 评论条目 AI 草稿走 `COMMENT_AI_REPLY_GENERATE`。

### 6.4 AI 回复草稿动作

建议新增或扩展：

- 评论结果详情组件中的单条动作。
- 不新增主进程接口。

动作：

```text
CommentItem
  -> COMMENT_AI_REPLY_GENERATE({ comment, tone })
  -> CommentAiReplyDraft
  -> UI 展示 1-3 条草稿
```

边界：

- 草稿不自动保存。
- 草稿不自动发布。
- 草稿不改变结果或批次状态。
- 草稿必须显示 `publishMode = manual`。

## 7. 第三轮用例

### UC-J：创建小红书评论监控任务

前置条件：

- 第一、二轮入口和结果库能力已完成。
- `comment-monitor` 模板升级为 xhs-only ready。

流程：

1. 用户从任务台选择“评论监控任务”。
2. 用户填写任务名称、入口类型、入口值和采集上限。
3. 用户点击保存。
4. 页面调用 `COMMENT_SOURCE_CREATE`。
5. 系统创建 `CommentSource` 和关联 `TaskFlow`。
6. 任务台显示新任务。

验收：

- `CommentSource.platform = xhs`。
- `CommentSource.taskId` 不为空。
- `TASK_LIST` 能看到关联任务。
- 不显示抖音和多平台选项。

异常分支：

- `entryValue` 为空时阻止保存。
- 选择未支持平台时阻止保存。
- 保存失败保留表单输入。

### UC-K：评论任务立即运行

前置条件：

- 已存在 `CommentSource`。

流程：

1. 用户点击立即运行。
2. 页面调用 `COMMENT_RUN_START`。
3. 返回 `started = true` 时进入运行监控。
4. 运行监控通过 `COMMENT_RUN_LIST` 获取批次。
5. 用户打开运行详情。

验收：

- 运行详情包含批次状态。
- `resultCount` 能展示。
- `reportStatus` 与批次状态分开展示。
- `started = false` 时显示未启动原因。

异常分支：

- `sourceId` 不存在时显示错误。
- 批次尚未生成时展示等待或刷新入口。

### UC-L：评论结果和报告进入结果库

前置条件：

- 评论运行已有 `batchId`。

流程：

1. 用户进入结果库。
2. 结果库加载评论源、评论运行、评论结果和评论报告。
3. 用户查看单条评论详情。
4. 用户在运行监控或结果库点击生成报告。
5. 页面调用 `COMMENT_REPORT_GENERATE`。
6. 结果库显示 `sourceType = comment` 的报告。

验收：

- 评论条目可查看。
- 评论报告可生成 `md/html`。
- 评论报告可打开详情或文件位置。
- 标准结果导出不受评论报告影响。

异常分支：

- 评论结果为空时展示空结果，不伪造评论。
- 报告文件缺失时展示元数据和读取失败提示。

### UC-M：单条评论生成 AI 回复草稿

前置条件：

- 存在至少一条 `CommentItem`。

流程：

1. 用户打开评论结果详情。
2. 用户选择语气。
3. 用户点击“生成回复草稿”。
4. 页面调用 `COMMENT_AI_REPLY_GENERATE`。
5. 页面展示 1 到 3 条草稿。

验收：

- 草稿绑定当前 `commentId`。
- `publishMode = manual`。
- AI 不可用时展示兜底草稿。
- 生成失败不影响评论详情。

异常分支：

- 评论内容为空时禁止生成。
- IPC 失败时展示错误，不清空原评论。

## 8. 第三轮开发任务

### P1-03A：评论模板适配器

目标：

- 将 `comment-monitor` 从 preview 升级为 xhs-only ready。

进入范围：

- `commentTemplateAdapter.ts`。
- 模板字段定义。
- `CommentSourceDraft` 转换。
- 小红书平台限制。

不进入范围：

- 多平台。
- MediaCrawler。
- AI 回复。

验收：

- 小红书评论模板可见且可配置。
- 不显示抖音等其他平台。
- 参数能转换为 `CommentSourceDraft`。

### P1-03B：评论源创建与编辑

目标：

- 任务编辑器能创建和编辑评论源。

进入范围：

- `COMMENT_SOURCE_CREATE`。
- `COMMENT_SOURCE_UPDATE`。
- 保存后回到任务台。
- 保存并立即运行时调用 `COMMENT_RUN_START`。

不进入范围：

- MediaCrawler 配置。
- AI 回复配置。
- 定时复杂配置。

验收：

- 创建后有 `CommentSource.taskId`。
- 任务台能看到关联任务。
- `started = false` 有明确提示。

### P1-03C：评论运行监控接入

目标：

- 运行监控支持评论运行投影。

进入范围：

- `COMMENT_RUN_LIST`。
- `COMMENT_RUN_DETAIL`。
- 批次状态、结果数量、报告状态展示。

不进入范围：

- MediaCrawler 外部运行。
- 多平台运行。

验收：

- 评论运行能显示标准批次状态。
- 评论失败能显示错误和断点。
- `reportStatus` 不污染批次状态。

### P1-03D：评论结果和报告进入结果库

目标：

- 评论结果、评论报告成为结果库可查看产物。

进入范围：

- `COMMENT_RESULT_LIST`。
- `COMMENT_REPORT_LIST`。
- `COMMENT_REPORT_DETAIL`。
- `COMMENT_REPORT_GENERATE`。
- `COMMENT_REPORT_REVEAL`。

不进入范围：

- 评论报告批量删除。
- 评论结果统一落表迁移。

验收：

- 评论条目可查看。
- 评论报告可生成和打开。
- 评论报告以 `sourceType = comment` 展示。
- 标准导出仍走 Data Center。

### P1-03E：AI 回复草稿最小接入

目标：

- 对单条评论生成手动回复草稿。

进入范围：

- `COMMENT_AI_REPLY_GENERATE`。
- tone 选择：friendly、professional、concise。
- 草稿详情展示。

不进入范围：

- 自动发布。
- 批量生成。
- 草稿持久化。
- AI 助手全局上下文收敛。

验收：

- 单条评论能生成草稿。
- 无 AI client 时兜底草稿可见。
- 草稿显示 `publishMode = manual`。
- 草稿不改变任务、批次、结果状态。

## 9. 暂缓任务

| 任务 | 暂缓原因 | 重新进入条件 |
| --- | --- | --- |
| MediaCrawler 外部执行闭环 | 依赖外部仓库、Python、登录和已有批次 | 小红书标准评论闭环稳定后单独审计 |
| 多平台评论模板 | 当前 `CommentSourceService` 只支持 xhs | 服务层明确支持对应平台后进入 |
| AI 自动发布 | 风险高，需要账号和审核策略 | 有发布权限模型和人工确认设计后进入 |
| AI 任务助手全局收敛 | 横跨多个页面和上下文 | 签到、热点、评论三个模板稳定后进入 |
| 能力中心完整实现 | 仍会变成配置中心大集合 | 模板依赖清单稳定后进入 |
| 评论结果统一落表迁移 | 当前已有标准结果和报告并存 | 多来源结果模型稳定后单独设计 |

## 10. 风险与处理建议

| 风险 | 影响 | 处理建议 |
| --- | --- | --- |
| 误开放多平台 | 用户选择后创建失败 | 第三轮 UI 固定 xhs |
| MediaCrawler 混入主闭环 | 需要外部环境导致闭环不可控 | 第三轮不作为立即运行路径 |
| AI 回复被误解为自动回复 | 存在账号和内容风险 | 明确只生成手动草稿 |
| AI 失败影响评论结果 | 用户无法查看采集结果 | AI 草稿失败不影响原始结果 |
| reportStatus 污染批次状态 | 状态合约漂移 | 独立展示报告状态 |
| 评论报告文件缺失 | 详情页报错 | 展示元数据和读取失败提示 |
| 空评论结果生成报告 | 用户误以为采集成功 | 报告和结果库都提示未采集到评论 |

## 11. 第三轮验收清单

- [ ] `comment-monitor` 模板可从任务台或编辑器进入。
- [ ] 评论模板只支持小红书。
- [ ] 评论模板能保存为 `CommentSource`。
- [ ] `CommentSource.taskId` 能关联到 `TASK_LIST` 中的任务。
- [ ] 评论任务能立即运行或明确显示未启动原因。
- [ ] 运行监控能展示评论批次状态。
- [ ] 运行监控能展示评论 `resultCount`。
- [ ] 运行监控能区分批次状态和 `reportStatus`。
- [ ] 结果库能展示评论条目。
- [ ] 评论报告能生成 `md/html`。
- [ ] 评论报告以 `sourceType = comment` 展示。
- [ ] 单条评论能生成 AI 回复草稿。
- [ ] AI 回复草稿显示 `publishMode = manual`。
- [ ] AI 回复失败不影响评论结果查看。
- [ ] MediaCrawler、多平台、自动发布、能力中心不进入第三轮实现范围。

## 12. 第三轮结论

第三轮可以进入，但主题必须收窄为：

```text
让评论监控成为第二个标准批次型模板，并只支持小红书评论采集、报告和手动 AI 回复草稿。
```

推荐执行顺序：

1. P1-03A 先做评论模板适配器，锁定 xhs-only 边界。
2. P1-03B 接评论源创建和立即运行，复用 `COMMENT_SOURCE_*` 和 `COMMENT_RUN_START`。
3. P1-03C 接运行监控评论投影，复用 `COMMENT_RUN_*`。
4. P1-03D 接评论结果和报告进结果库，复用 `COMMENT_RESULT_LIST` 和 `COMMENT_REPORT_*`。
5. P1-03E 接单条 AI 回复草稿，复用 `COMMENT_AI_REPLY_GENERATE`。

第三轮完成后，再启动第四轮审计：

- MediaCrawler 是否作为评论增强导入能力进入。
- 能力中心是否只展示模板依赖和外部执行器状态。
- AI 任务助手是否可以统一接入任务台、运行监控、结果库上下文。
