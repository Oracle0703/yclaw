# YClaw 本地任务工具台第二轮任务审计

> 前置审计：`docs/plans/task-toolbench-phase0-audit.md`  
> 关联拆解：`docs/plans/task-toolbench-v1.md`  
> 审计目标：在第一轮“京东签到最小闭环”之后，审核第二轮任务是否具备完整接口、清晰边界和可验收闭环，避免把热点、评论、AI、能力中心一次性做成新的大而空模块。

## 1. 审计结论

第二轮不建议直接进入所有 V1 后续任务。

推荐第二轮只进入这条主线：

```text
结果库统一展示增强
  -> 热点监控模板适配
  -> 热点运行监控接入
  -> 热点报告进入结果库
  -> 热点报告查看和导出
```

第二轮可以进入：

- P1-02A 结果库统一展示模型增强。
- P1-02B 热点监控模板适配。
- P1-02C 热点运行监控接入。
- P1-02D 热点报告进入结果库。
- P1-02E 热点结果导出与报告打开。

第二轮不建议进入：

- 评论监控完整闭环。
- AI 任务助手收敛。
- 能力中心完整实现。
- Data Center 深度重构。
- 统一结果落表迁移。

核心原因：

- 热点已有 `source -> taskId -> batch -> result/report` 链路，比京东签到更接近标准批次模型。
- 评论虽然也有 source、run、report，但它引入 MediaCrawler、平台登录、AI 回复，复杂度明显高于热点。
- AI 助手和能力中心属于横切能力，应等任务台、运行监控、结果库至少支持两个真实模板后再收敛。
- 第二轮目标应验证“一个非签到业务模板能否通过标准批次和标准结果闭环运行”，而不是继续堆页面。

## 2. 第二轮进入前置条件

第二轮必须建立在第一轮完成之后。

第一轮完成标准：

- 任务台、模板目录、任务编辑器、运行监控、结果库基本入口已存在。
- 京东签到模板能创建、保存、立即运行。
- 京东签到成功、失败、需介入都能在任务台和运行监控展示。
- 京东签到历史能以 `sourceType = signin` 进入结果库。
- 旧路由保留，一级菜单已收敛。

如果第一轮未完成，不应进入热点模板实现。否则第二轮会同时修导航、修编辑器、修监控、修结果库和接热点，范围失控。

## 3. 状态与兼容约束

第二轮继续复用现有状态合约。

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

第二轮不得新增：

- `succeeded`
- `paused_for_intervention`
- `needs_intervention` 作为批次状态
- `report_generated` 作为批次状态

热点和评论的 `reportStatus = pending | generated` 只能作为报告生成状态，不是批次状态。

结果来源继续使用统一展示来源：

| sourceType | 来源 | 是否第二轮进入 |
| --- | --- | --- |
| `standard` | `ExtractionResult` / Data Center | 是 |
| `signin` | `SigninRunSummary` | 已由第一轮支持，第二轮保持 |
| `hot` | `HotReportSummary` 和热点批次结果 | 是 |
| `comment` | `CommentReportSummary` 和评论结果 | 暂缓 |

## 4. 现有接口盘点

### 4.1 热点源怎么创建和更新

现有接口：

| 能力 | IPC | payload | 返回 | 代码位置 |
| --- | --- | --- | --- | --- |
| 热点源列表 | `HOT_SOURCE_LIST` | 无 | `HotSource[]` | `src/main/ipc/hot-handlers.ts` |
| 热点源详情 | `HOT_SOURCE_DETAIL` | `{ sourceId }` | `HotSource | null` | `src/main/ipc/hot-handlers.ts` |
| 创建热点源 | `HOT_SOURCE_CREATE` | `HotSourceDraft` | `HotSource` | `src/main/ipc/hot-handlers.ts`, `HotSourceService.createSource()` |
| 更新热点源 | `HOT_SOURCE_UPDATE` | `{ sourceId, updates }` | `HotSource` | `src/main/ipc/hot-handlers.ts`, `HotSourceService.updateSource()` |
| 删除热点源 | `HOT_SOURCE_DELETE` | `{ sourceId }` | 删除结果 | `src/main/ipc/hot-handlers.ts` |

创建链路：

```text
HOT_SOURCE_CREATE
  -> HotSourceService.createSource()
  -> HotTaskCompiler.compile()
  -> TaskService.createTask()
  -> HotSource(taskId = task.id)
```

`HotSourceDraft` 关键字段：

- `name`
- `sourceKind`
- `siteKey`
- `entryUrl`
- `parserKey`
- `platformIds`
- `sessionId`
- `schedule`
- `filter`
- `timeline`
- `enabled`
- `tags`

审计判断：

- 热点模板第二轮可以直接走 `HOT_SOURCE_CREATE`，不需要手写 `TASK_CREATE`。
- 热点源已经有 `taskId`，可以和任务台、批次、结果库关联。
- 模板目录需要把 `hot-monitor` 从 preview 升级为 ready，但只针对最小参数集。

边界条件：

- 热点模板不是新 DB 实体。
- `HotSource` 是热点专项配置，`TaskFlow` 是运行对象。
- 更新热点源时必须同步更新已绑定 `TaskFlow`。
- 删除热点源会删除关联任务，UI 需要二次确认。

验收判断：

- 从热点模板保存后，能得到 `HotSource.taskId`。
- `TASK_LIST` 能看到对应任务。
- `HOT_SOURCE_LIST` 能看到对应热点源。

### 4.2 热点怎么运行和监控

现有接口：

| 能力 | IPC | payload | 返回 | 代码位置 |
| --- | --- | --- | --- | --- |
| 热点运行列表 | `HOT_RUN_LIST` | `{ sourceId? }` | `HotRunSummary[]` | `HotRunProjectionService.listRuns()` |
| 热点运行详情 | `HOT_RUN_DETAIL` | `{ sourceId, batchId }` | `HotRunDetail | null` | `HotRunProjectionService.getRunDetail()` |
| 启动热点运行 | `HOT_RUN_START` | `{ sourceId }` | `{ sourceId, taskId, started }` | `HotRunProjectionService.startRun()` |

运行投影链路：

```text
HotSource.taskId
  -> BatchService.listBatchesByTask(taskId)
  -> ResultService.listResults({ batchId })
  -> HotReportRepository.getReportByBatchId(batchId)
  -> HotRunSummary / HotRunDetail
```

`HotRunSummary` 关键字段：

- `batchId`
- `sourceId`
- `sourceName`
- `status`
- `startedAt`
- `finishedAt`
- `resultCount`
- `reportStatus`

`HotRunDetail` 额外字段：

- `taskId`
- `error`
- `breakpoint`
- `stepResults`
- `linkedResultIds`

审计判断：

- 热点运行天然绑定标准批次，适合第二轮验证“标准批次模板”。
- 运行监控可以把热点运行投影为 `sourceType = hot` 或复用 `sourceType = batch` 并附带 `templateType = hot`。
- `reportStatus` 只能显示为报告状态，不应改变批次状态。

边界条件：

- `HOT_RUN_START` 返回 `started: false` 时，表示后端没有接入启动函数；UI 必须显示“未启动”，不能假装运行中。
- 热点运行详情需要 `sourceId + batchId`，不能只靠 `batchId`。
- 批次没有结果时，`resultCount = 0` 是合法状态。
- 生成报告必须在有明确 `batchId` 后进行。

验收判断：

- 热点运行后能在运行监控看到批次状态。
- 批次失败时能看到 `error`、`breakpoint`、`stepResults`。
- 报告未生成时显示 `reportStatus = pending`。
- 报告生成后显示 `reportStatus = generated`。

### 4.3 热点结果和报告怎么取

现有接口：

| 能力 | IPC | payload | 返回 | 代码位置 |
| --- | --- | --- | --- | --- |
| 热点报告列表 | `HOT_REPORT_LIST` | `{ sourceId?, batchId? }` | `HotReportSummary[]` | `HotReportService.listReports()` |
| 热点报告详情 | `HOT_REPORT_DETAIL` | `{ reportId }` | `HotReportSummary | null` | `HotReportService.getReportDetail()` |
| 生成热点报告 | `HOT_REPORT_GENERATE` | `{ sourceId, batchId, format }` | `HotReportSummary` | `HotReportService.generateReport()` |
| 删除热点报告 | `HOT_REPORT_DELETE` | `{ reportId }` | `{ deleted }` | `HotReportService.deleteReport()` |
| 打开热点报告 | `HOT_REPORT_REVEAL` | `{ reportId }` | `{ revealed }` | `HotReportService.revealReport()` |
| 热点 AI 摘要 | `HOT_AI_SUMMARIZE` | `{ batchId, interest }` | 摘要结果 | `hot-handlers.ts` |
| 热点通知发送 | `HOT_NOTIFICATION_SEND` | `{ reportId, target }` | 发送结果 | `hot-handlers.ts` |

支持报告格式：

| 类型 | 类型定义 | 服务实际支持 | 第二轮建议 |
| --- | --- | --- | --- |
| `md` | 支持 | 支持 | 进入 |
| `html` | 支持 | 支持 | 进入 |
| `docx` | 类型存在 | `HotReportService.generateReport()` 当前不支持 | 第二轮不进入 |

审计判断：

- 第二轮结果库应优先支持 `HotReportSummary` 的查看和打开文件。
- 热点报告导出不应混用 Data Center 标准结果导出。
- `docx` 虽然在类型中存在，但服务会抛 `Unsupported hot report format`，第二轮 UI 必须禁用。

边界条件：

- 报告详情读取文件失败时，服务可能只返回元数据，UI 要能展示“内容不可读”。
- 报告文件打开依赖 Electron shell，失败时需要展示错误。
- 删除报告不等于删除批次和标准结果。
- 热点 AI 摘要和通知不是第二轮闭环必需项。

验收判断：

- 结果库能展示热点报告。
- `md/html` 报告可打开详情。
- `docx` 不作为可选生成格式。
- 报告可以打开所在位置或等价文件入口。

### 4.4 标准结果和 Data Center 怎么接入

现有接口：

| 能力 | IPC | payload | 返回 | 说明 |
| --- | --- | --- | --- | --- |
| 标准结果列表 | `RESULT_LIST` | `{ taskId?, batchId? }` | `ExtractionResult[]` | 基础列表 |
| 标准结果详情 | `RESULT_DETAIL` | `{ resultId }` | `ExtractionResult | null` | 基础详情 |
| 标准结果导出 | `RESULT_EXPORT` | `{ taskId?, batchId?, format }` | 临时文件路径 | 基础导出 |
| Data Center 分页 | `DATA_CENTER_RESULTS_LIST` | 分页和筛选 payload | `DataPage<ExtractionResult>` | 标准结果分页 |
| Data Center 详情 | `DATA_CENTER_RESULTS_DETAIL` | `{ resultId }` | 结果、批次、日志、导出记录 | 标准结果详情增强 |
| Data Center 创建导出 | `DATA_CENTER_EXPORTS_CREATE` | 导出任务 payload | `DataExportJob` | 标准结果导出任务 |
| Data Center 导出列表 | `DATA_CENTER_EXPORTS_LIST` | 查询 payload | `DataExportJob[]` | 导出状态 |

审计判断：

- 第二轮结果库增强可以引入 Data Center 的分页、详情、导出任务，但只用于 `standard` 来源。
- `hot` 报告结果仍走 `HOT_REPORT_*`。
- `signin` 专项结果仍走 `SIGNIN_TASK_HISTORY`。
- 统一结果库是展示层统一，不是存储层强行统一。

边界条件：

- `DATA_CENTER_RESULTS_DETAIL` 要求标准 `resultId`，不能用于热点报告或签到历史。
- `DATA_CENTER_EXPORTS_CREATE` 当前从 `ResultService.listResults()` 取标准结果，不能导出专项报告。
- 导出任务状态如 `succeeded/failed/cancelled` 属于 `DataExportJob`，不是任务或批次状态。

验收判断：

- 标准结果详情能展示批次和日志。
- 标准结果导出能显示任务状态和错误。
- 专项报告详情不会误调 Data Center 标准结果详情。

### 4.5 评论监控为什么暂缓

现有接口已经较完整：

| 能力 | IPC |
| --- | --- |
| 评论源 CRUD | `COMMENT_SOURCE_LIST/DETAIL/CREATE/UPDATE/DELETE` |
| 评论运行 | `COMMENT_RUN_LIST/START/DETAIL` |
| 评论结果 | `COMMENT_RESULT_LIST` |
| 评论报告 | `COMMENT_REPORT_LIST/DETAIL/GENERATE/DELETE/REVEAL` |
| AI 回复 | `COMMENT_AI_REPLY_GENERATE` |
| MediaCrawler | `COMMENT_MEDIACRAWLER_CONFIG_GET/SAVE/TEST/RUN` |

暂缓原因：

- `CommentSourceService.normalizeDraft()` 当前只支持 `platform = xhs`，但类型和 MediaCrawler 又支持更多平台，产品承诺容易超过实现能力。
- 评论闭环有两条运行路径：标准自动化步骤和 MediaCrawler 导入，第二轮若同时接入会造成任务运行来源混乱。
- AI 回复是可选能力，但用户会自然把它理解为评论模板核心卖点，必须单独定义 AI 不可用、失败、人工复核的边界。
- 评论报告和 AI 回复建议都要进入结果库，统一展示模型需要先被热点报告验证。

第二轮只允许做：

- 保持 `comment-monitor` 模板为 preview。
- 在模板卡片中标记“第三轮接入”。
- 不允许从任务编辑器触发评论立即运行。

## 5. 第二轮最小闭环可行性确认

### 5.1 闭环路径

第二轮推荐闭环：

```text
任务台
  -> 热点监控模板
  -> 创建热点源和关联任务
  -> 立即运行热点任务
  -> 运行监控查看标准批次
  -> 生成热点报告
  -> 结果库查看热点报告
  -> 打开或导出报告
```

### 5.2 可行性表

| 步骤 | 可复用能力 | 是否可行 | 需要新增 |
| --- | --- | --- | --- |
| 选择热点模板 | 静态模板目录 | 可行 | 将 `hot-monitor` 升级为 ready |
| 创建热点任务 | `HOT_SOURCE_CREATE` | 可行 | 模板表单到 `HotSourceDraft` 适配 |
| 立即运行 | `HOT_RUN_START` | 有条件可行 | 处理 `started: false` |
| 运行监控 | `HOT_RUN_LIST`、`HOT_RUN_DETAIL` | 可行 | 热点运行 view model |
| 标准结果 | `RESULT_LIST`、`DATA_CENTER_RESULTS_LIST` | 可行 | 结果库 standard 区增强 |
| 生成报告 | `HOT_REPORT_GENERATE` | 可行 | 报告生成动作 |
| 报告详情 | `HOT_REPORT_DETAIL` | 可行 | `sourceType = hot` 详情模型 |
| 报告打开 | `HOT_REPORT_REVEAL` | 可行 | 文件打开动作 |

### 5.3 最小闭环判定

第二轮可以成立，但必须满足三条边界：

- 热点必须走已有 `HotSource` 和 `TaskFlow` 绑定，不新增独立任务模型。
- 热点运行必须以标准批次为主，不新增专项运行状态。
- 热点报告必须以 `sourceType = hot` 进入结果库，不强行写入 `extraction_results`。

## 6. 第二轮需要新增的最小模块

### 6.1 热点模板适配器

建议新增或扩展：

- `src/renderer/entries/workbench/task-toolbench/templates.ts`
- `src/renderer/entries/workbench/task-toolbench/hotTemplateAdapter.ts`

职责：

- 将模板表单转换为 `HotSourceDraft`。
- 定义热点模板最小参数。
- 声明支持的报告格式。
- 屏蔽第二轮不支持的 `docx`。

最小参数：

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `name` | 是 | 任务名称 |
| `sourceKind` | 是 | `api`、`browser`、`rss` |
| `siteKey` | 是 | 站点或聚合源 |
| `entryUrl` | 是 | 入口 URL |
| `parserKey` | 是 | 解析器 |
| `platformIds` | 否 | 聚合源平台列表 |
| `schedule` | 否 | 第二轮可默认手动 |
| `filter` | 否 | 关键词过滤 |

第二轮默认模板建议：

| 字段 | 默认值 |
| --- | --- |
| `sourceKind` | `api` |
| `siteKey` | `trendradar` |
| `parserKey` | `newsnow.batch` |
| `schedule` | `{ type: 'manual' }` |

### 6.2 热点运行 view model

建议新增或扩展：

- `src/renderer/entries/workbench/task-toolbench/runMonitorViewModel.ts`

新增输入：

- `HotRunSummary[]`
- `HotRunDetail | null`

输出模型：

| 字段 | 映射 |
| --- | --- |
| `runId` | `hot:${sourceId}:${batchId}` |
| `sourceType` | `hot` |
| `taskId` | `HotRunDetail.taskId` |
| `batchId` | `HotRunSummary.batchId` |
| `rawStatus` | `HotRunSummary.status` |
| `resultCount` | `HotRunSummary.resultCount` |
| `reportStatus` | `HotRunSummary.reportStatus` |
| `actions` | 查看详情、生成报告、查看报告、重试批次 |

边界：

- `reportStatus` 不是运行状态。
- `HotRunDetail` 为空时展示“运行详情不存在”。
- `linkedResultIds` 可用于跳转结果库标准结果。

### 6.3 结果库热点报告模型

建议扩展：

- `src/renderer/entries/workbench/task-toolbench/resultLibraryViewModel.ts`

热点报告模型：

| 字段 | 映射 |
| --- | --- |
| `id` | `hot-report:${reportId}` |
| `sourceType` | `hot` |
| `taskId` | 通过 `HotSource.sourceId -> taskId` 补齐 |
| `batchId` | `HotReportSummary.batchId` |
| `title` | `HotReportSummary.title` |
| `statusLabel` | `已生成` |
| `createdAt` | `HotReportSummary.createdAt` |
| `summary` | `format`、`filePath`、是否有 `content` |
| `detailRef` | `{ sourceType: 'hot', reportId }` |
| `exportableFormats` | `md/html` 或打开文件 |

边界：

- 热点报告不是标准 `ExtractionResult`。
- 热点报告详情不调用 `RESULT_DETAIL`。
- 热点报告打开文件走 `HOT_REPORT_REVEAL`。

### 6.4 结果库标准结果增强

建议扩展：

- 结果库列表分页和筛选使用 `DATA_CENTER_RESULTS_LIST`。
- 标准结果详情使用 `DATA_CENTER_RESULTS_DETAIL`。
- 标准结果导出任务使用 `DATA_CENTER_EXPORTS_CREATE` 和 `DATA_CENTER_EXPORTS_LIST`。

边界：

- 只对 `sourceType = standard` 生效。
- 不强制替换第一轮已经可用的基础 `RESULT_LIST`。
- 签到和热点专项详情仍走各自接口。

## 7. 第二轮用例

### UC-F：创建热点监控任务

前置条件：

- 第一轮任务编辑器和模板目录已完成。
- `hot-monitor` 模板升级为 ready。

流程：

1. 用户从任务台选择“热点监控任务”。
2. 用户填写任务名称、入口 URL、parser、平台参数。
3. 用户点击保存。
4. 页面调用 `HOT_SOURCE_CREATE`。
5. 系统创建 `HotSource` 和关联 `TaskFlow`。
6. 任务台显示新任务。

验收：

- `HotSource.taskId` 不为空。
- `TASK_LIST` 能看到关联任务。
- 保存失败保留表单输入。
- 参数缺失时不允许立即运行。

异常分支：

- `entryUrl` 为空时阻止保存。
- `parserKey` 不支持时显示错误。
- `HOT_SOURCE_CREATE` 失败时不生成假任务。

### UC-G：热点任务立即运行

前置条件：

- 已存在 `HotSource`。

流程：

1. 用户点击立即运行。
2. 页面调用 `HOT_RUN_START`。
3. 返回 `started = true` 时跳转运行监控。
4. 运行监控通过 `HOT_RUN_LIST` 获取批次。
5. 用户打开运行详情。

验收：

- `started = true` 时显示运行状态。
- `started = false` 时显示“未启动”，不进入运行中状态。
- 运行详情包含标准批次状态。

异常分支：

- `sourceId` 不存在时显示错误并返回任务台。
- 批次尚未生成时显示等待状态和刷新入口。

### UC-H：热点报告生成和查看

前置条件：

- 热点运行已有 `batchId`。

流程：

1. 用户在运行监控点击“生成报告”。
2. 页面调用 `HOT_REPORT_GENERATE`，格式为 `md` 或 `html`。
3. 生成后运行监控显示 `reportStatus = generated`。
4. 用户进入结果库。
5. 结果库显示 `sourceType = hot` 的报告。
6. 用户打开报告详情或文件位置。

验收：

- `md/html` 能生成报告。
- `docx` 不出现在可选格式中。
- 报告详情文件读取失败时仍显示报告元数据。
- 报告不会被当作标准 `ExtractionResult`。

异常分支：

- `batchId` 不属于该 `sourceId` 时报告生成失败。
- 批次结果为空时仍允许生成空报告，但报告内容提示无结果。

### UC-I：标准结果导出任务

前置条件：

- 存在热点运行产生的标准结果。

流程：

1. 用户在结果库筛选某个任务或批次。
2. 用户选择标准结果导出。
3. 页面调用 `DATA_CENTER_EXPORTS_CREATE`。
4. 页面通过 `DATA_CENTER_EXPORTS_LIST` 或事件显示导出状态。
5. 导出成功后展示输出路径。

验收：

- 导出只作用于 `sourceType = standard`。
- 导出失败保留错误状态。
- 热点报告导出不走 Data Center 标准结果导出。

异常分支：

- 标准结果为空时允许创建空导出或明确提示无结果，两者必须择一并固定。
- 不支持的目标类型显示错误，不丢失筛选条件。

## 8. 第二轮开发任务

### P1-02A：结果库统一展示模型增强

目标：

- 支持 `standard`、`signin`、`hot` 三类来源并存。

进入范围：

- 扩展 `resultLibraryViewModel.ts`。
- 支持热点报告列表投影。
- 标准结果可接 Data Center 分页。
- 专项结果和标准结果详情分流。

不进入范围：

- 评论结果。
- 统一结果落表。
- Data Center 全量重构。

验收：

- 标准结果、签到历史、热点报告能在一个列表中展示。
- 每条结果显示来源。
- 无 `batchId` 的结果不伪造批次。
- 不同来源打开详情时调用不同接口。

### P1-02B：热点监控模板适配

目标：

- 将 `hot-monitor` 从 preview 升级为可创建任务的模板。

进入范围：

- 热点模板表单最小字段。
- `HotSourceDraft` 适配。
- 保存调用 `HOT_SOURCE_CREATE` / `HOT_SOURCE_UPDATE`。
- 保存后回到任务台。

不进入范围：

- 复杂时间线配置。
- 通知发送。
- AI 摘要。
- docx 报告。

验收：

- 用户能创建热点源。
- 创建后有 `HotSource.taskId`。
- 任务台能看到关联任务。
- 参数不足时阻止立即运行。

### P1-02C：热点运行监控接入

目标：

- 运行监控支持热点运行投影。

进入范围：

- `HOT_RUN_START`。
- `HOT_RUN_LIST`。
- `HOT_RUN_DETAIL`。
- 批次状态、结果数量、报告状态展示。

不进入范围：

- Runner 控制台。
- 调度队列管理。
- 热点通知。

验收：

- 运行详情能显示批次状态和错误。
- `reportStatus` 与批次状态分开展示。
- `started = false` 有明确错误或未启动状态。

### P1-02D：热点报告进入结果库

目标：

- 热点报告成为结果库中的专项结果。

进入范围：

- `HOT_REPORT_LIST`。
- `HOT_REPORT_DETAIL`。
- `HOT_REPORT_GENERATE`。
- `HOT_REPORT_REVEAL`。

不进入范围：

- 报告删除批量操作。
- 通知发送。
- AI 摘要。

验收：

- 热点报告可生成、查看、打开文件。
- 结果库中显示 `sourceType = hot`。
- `docx` 不作为可选生成格式。

### P1-02E：标准结果导出与 Data Center 接入

目标：

- 让结果库对标准结果具备任务化导出能力。

进入范围：

- `DATA_CENTER_RESULTS_LIST`。
- `DATA_CENTER_RESULTS_DETAIL`。
- `DATA_CENTER_EXPORTS_CREATE`。
- `DATA_CENTER_EXPORTS_LIST`。
- `DATA_CENTER_EXPORTS_RETRY`。
- `DATA_CENTER_EXPORTS_CANCEL`。

不进入范围：

- 专项报告统一导出任务。
- Webhook、Dataset、API Token 管理。
- 质量规则完整配置。

验收：

- 标准结果支持分页、筛选、详情。
- 标准结果导出能看到状态。
- 导出失败可重试或取消。
- 专项报告不误用标准结果导出。

## 9. 暂缓任务

| 任务 | 暂缓原因 | 重新进入条件 |
| --- | --- | --- |
| 评论监控模板完整适配 | MediaCrawler、平台登录、AI 回复混合，范围大 | 热点报告闭环稳定，结果库能处理第二个专项来源 |
| AI 任务助手收敛 | 横跨任务台、运行监控、结果库，需要真实上下文 | 至少签到和热点两个模板稳定运行 |
| 能力中心完整实现 | 容易变成配置大杂烩 | 模板能力依赖清单稳定后再做 |
| Data Center 深度重构 | 会影响现有数据中心功能 | 结果库展示层验证通过后单独立项 |
| 统一结果落表迁移 | 涉及数据模型和历史迁移 | 标准、签到、热点、评论来源都跑通后再设计 |
| 热点 AI 摘要和通知 | 不是热点闭环必需项 | 报告生成和查看稳定后再进入 |

## 10. 风险与处理建议

| 风险 | 影响 | 处理建议 |
| --- | --- | --- |
| 第二轮范围过大 | 热点、评论、AI、能力中心互相阻塞 | 第二轮只做热点和结果库增强 |
| `HOT_RUN_START` 可能返回 `started=false` | UI 误判为运行中 | 明确展示未启动，不创建假批次 |
| `docx` 类型存在但服务不支持 | 用户选择后必失败 | 第二轮 UI 禁用 `docx` |
| 报告状态和批次状态混淆 | 批次状态被污染 | `reportStatus` 单独展示 |
| 热点报告不是标准结果 | 详情接口调用错误 | `sourceType = hot` 走 `HOT_REPORT_*` |
| Data Center 导出只支持标准结果 | 专项报告导出失败 | 专项报告用报告打开或后续专项导出 |
| 评论平台支持口径不一致 | 用户选择未支持平台 | 评论模板继续 preview |

## 11. 第二轮验收清单

- [x] `hot-monitor` 模板可从任务台或编辑器进入。
- [x] 热点模板能保存为 `HotSource`。
- [x] `HotSource.taskId` 能关联到 `TASK_LIST` 中的任务。
- [x] 热点任务能立即运行或明确显示未启动原因。
- [x] 运行监控能展示热点批次状态。
- [x] 运行监控能展示热点 `resultCount`。
- [x] 运行监控能区分批次状态和 `reportStatus`。
- [x] 热点报告能生成 `md/html`。
- [x] `docx` 不作为第二轮可选格式。
- [x] 结果库能展示 `standard`、`signin`、`hot` 来源。
- [x] 标准结果详情走 Data Center 或基础结果接口。
- [x] 热点报告详情走 `HOT_REPORT_DETAIL`。
- [x] 签到专项详情仍走签到历史投影。
- [x] 标准结果导出不影响热点报告。
- [x] 评论、AI、能力中心不进入第二轮开发范围。

## 12. 第二轮结论

第二轮可以进入，但建议主题收窄为：

```text
让热点监控成为第一个标准批次型模板，并让结果库真正支持多来源结果。
```

推荐执行顺序：

1. P1-02A 先增强结果库统一展示模型，明确 `standard/signin/hot` 分流。
2. P1-02B 接热点模板创建，复用 `HOT_SOURCE_CREATE`。
3. P1-02C 接热点运行监控，复用 `HOT_RUN_*`。
4. P1-02D 接热点报告生成和结果库展示，复用 `HOT_REPORT_*`。
5. P1-02E 对标准结果接 Data Center 分页、详情和导出任务。

第二轮完成后，再启动第三轮审计：

- 评论模板是否只先支持小红书。
- MediaCrawler 是否作为独立能力接入。
- AI 回复建议是否进入评论闭环。
- 能力中心是否只展示模板依赖，不做完整配置中心。
