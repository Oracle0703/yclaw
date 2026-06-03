# YClaw 本地任务工具台 Phase 0 审计

> 关联设计：`docs/design/task-toolbench-redesign.md`  
> 关联拆解：`docs/plans/task-toolbench-v1.md`  
> 审计目标：盘点现有接口与数据链路，确认“京东签到模板最小闭环”是否能在不重写底层模型的前提下进入第一轮开发。

## 1. 审计结论

Phase 0 可以进入开发，但第一轮必须按“复用现有接口 + 前端 view model 聚合 + 京东签到专项适配”的方式推进。

推荐第一轮只验证这条路径：

```text
任务台
  -> 京东签到模板
  -> 创建任务
  -> 立即运行
  -> 运行监控
  -> 结果库
```

可复用能力：

- 任务列表、详情、创建、更新、启动已有 IPC。
- 批次列表、批次详情、重试已有 IPC。
- 基础结果列表、详情、导出已有 IPC。
- Data Center 已有分页结果、详情、导出任务、质量能力。
- 京东签到已是 `TaskFlow.kind = jd-signin` 的专项任务，并已有保存、运行、状态、历史接口。

关键限制：

- 京东签到运行不会自然创建普通 `TaskBatch`。
- 京东签到运行历史不会自然写入 `extraction_results`。
- 第一轮不能把 `needs_intervention` 写成自动化批次状态。
- 第一轮不能新增不兼容的任务、批次、结果状态。

因此第一轮正确实现链路是：

```text
TaskFlow(kind=jd-signin)
  -> SigninRunSummary
  -> TaskWorkbench view model
  -> RunMonitor special-run view model
  -> ResultLibrary unified result view model
```

不是：

```text
TaskFlow
  -> TaskBatch
  -> ExtractionResult
```

后者适合通用自动化、热点、评论等后续模板，不适合直接套在京东签到上。

## 2. 状态与持久化兼容约束

第一轮继续使用现有共享类型。

任务状态使用 `TaskStatus`：

| 状态 | UI 文案 | 说明 |
| --- | --- | --- |
| `idle` | 空闲 | 任务未运行 |
| `running` | 运行中 | 通用任务正在执行 |
| `paused` | 已暂停 | 通用任务暂停 |
| `completed` | 成功 | 最近一次通用任务运行成功 |
| `failed` | 失败 | 最近一次通用任务运行失败 |

批次状态使用 `TaskBatchStatus`：

| 状态 | UI 文案 | 说明 |
| --- | --- | --- |
| `pending` | 等待中 | 批次已创建但未开始 |
| `running` | 运行中 | 批次正在执行 |
| `success` | 成功 | 批次成功结束 |
| `failed` | 失败 | 批次失败结束 |
| `cancelled` | 已取消 | 批次被取消 |
| `paused` | 已暂停 | 批次暂停 |
| `intervention` | 需人工介入 | 批次等待人工处理 |

禁止事项：

- 不引入 `succeeded` 作为批次状态。
- 不引入 `paused_for_intervention` 作为批次状态。
- 不引入 `needs_intervention` 作为批次状态。

签到专项状态继续使用 `SigninRunStatus`：

| 签到原始状态 | 工具台 UI 文案 | 映射边界 |
| --- | --- | --- |
| `pending` | 等待中 | 只用于签到运行记录 |
| `running_browser` | 浏览器运行中 | 只用于签到运行记录 |
| `running_api_fallback` | API 兜底运行中 | 只用于签到运行记录 |
| `retry_scheduled` | 已安排重试 | 只用于签到运行记录 |
| `needs_intervention` | 需人工介入 | 只能映射到 UI，不写入 `TaskBatchStatus` |
| `success` | 成功 | 可投影为结果库正常结果 |
| `failed` | 失败 | 可投影为结果库失败结果 |

## 3. 现有接口盘点

### 3.1 任务列表怎么取

现有接口：

| 能力 | IPC | payload | 返回 | 代码位置 |
| --- | --- | --- | --- | --- |
| 任务列表 | `TASK_LIST` | 无 | `TaskSummary[]` | `src/main/app.ts`, `TaskService.listTasks()` |
| 强制获取任务 | `TASK_GET` | `{ taskId }` | `TaskFlow`，不存在抛错 | `src/main/app.ts`, `TaskService.getTaskFlow()` |
| 任务详情 | `TASK_DETAIL` | `{ taskId }` | `TaskFlow | null` | `src/main/app.ts`, `TaskService.getTaskDetail()` |

`TaskSummary` 当前包含：

- `id`
- `name`
- `status`
- `description`
- `entryUrl`
- `updatedAt`
- `schedule`
- `nextRunAt`
- `lastRunAt`
- `latestBatch`

工具台使用建议：

- 任务台首页以 `TASK_LIST` 作为主数据源。
- `TaskSummary.latestBatch` 用于展示最近普通批次状态。
- 点击任务详情时优先用 `TASK_DETAIL`，因为它允许不存在时返回 `null`。
- 对 `kind = jd-signin` 的任务，任务台必须额外调用 `SIGNIN_TASK_STATUS` 获取最近签到状态。

边界条件：

- `TASK_LIST` 不包含签到历史。
- `TASK_LIST` 不保证每个任务都有 `latestBatch`。
- `TaskSummary.status` 是任务状态，不等同于批次状态。
- 签到任务最近状态不能从 `latestBatch` 推断。

验收判断：

- 无任务时任务台显示创建任务空状态。
- 有普通任务但无批次时显示“未运行”。
- 有京东签到任务但无批次时仍能通过签到状态显示最近运行情况。

### 3.2 任务创建怎么走

现有接口：

| 能力 | IPC | payload | 返回 | 代码位置 |
| --- | --- | --- | --- | --- |
| 通用任务创建 | `TASK_CREATE` | `{ name, description?, steps?, entryUrl?, schedule?, sessionId?, templateId? }` | `TaskFlow` | `src/main/app.ts`, `TaskService.createTask()` |
| 通用任务更新 | `TASK_UPDATE` | `{ taskId, ...payload }` | `TaskFlow | null` | `src/main/app.ts`, `TaskService.updateTaskFlow()` |
| 签到任务保存 | `SIGNIN_TASK_SAVE` | `{ taskId?, name, entryUrl?, sessionId?, enabled?, signin }` | `TaskFlow` | `src/main/ipc/signin-handlers.ts` |
| 旧任务步骤保存 | `TASK_SAVE` | `{ taskId?, name?, steps }` | `TaskFlow` | `src/main/app.ts`, `TaskService.saveTaskFlow()` |

`TaskService.createTask()` 已支持：

- `kind`
- `signin`
- `sessionId`
- `templateId`
- `enabled`
- `tags`
- `schedule`

京东签到第一轮推荐路径：

```text
任务编辑器提交表单
  -> SIGNIN_TASK_SAVE
  -> TaskService.createTask/updateTaskFlow
  -> TaskFlow(kind=jd-signin, signin.site=jd)
```

原因：

- `SIGNIN_TASK_SAVE` 已有默认任务名处理。
- `SIGNIN_TASK_SAVE` 已有签到保存日志。
- `TaskService.createTask()` 会通过 `signin` 配置推导 `kind = jd-signin`。
- `SigninTaskService.runTask()` 会校验 `task.kind === jd-signin` 且 `task.signin.site === jd`。

边界条件：

- 任务模板目录不是新数据库实体，第一轮只做前端静态配置。
- 保存草稿不新增 `TaskStatus`，可用 `enabled = false` 或编辑器本地状态表示。
- 立即运行前必须校验 `signin.site = jd`、入口 URL、会话或登录快照等最小参数。
- `TASK_CREATE` 适合后续通用模板，不作为京东签到第一轮主路径。

验收判断：

- 从京东签到模板创建后得到 `TaskFlow.kind = jd-signin`。
- 保存后任务能出现在 `TASK_LIST`。
- 编辑已有签到任务不会丢失 `signin`、`entryUrl`、`sessionId`、`enabled`。

### 3.3 批次列表和详情怎么取

现有接口：

| 能力 | IPC | payload | 返回 | 代码位置 |
| --- | --- | --- | --- | --- |
| 批次列表 | `TASK_BATCH_LIST` | `{ taskId }` | `TaskBatch[]` | `src/main/app.ts`, `TaskService.listBatches()` |
| 批次详情 | `TASK_BATCH_DETAIL` | `{ batchId }` | `TaskBatch | null` | `src/main/app.ts`, `TaskService.getBatch()` |
| 批次重试 | `BATCH_RETRY` | `{ batchId }` | 新 `TaskBatch` | `src/main/app.ts`, `TaskService.retryBatch()` |
| 通用任务启动 | `TASK_START` | `{ taskId, tabId? }` | `TaskState` | `src/main/app.ts`, `TaskService.startTask()` |

普通自动化链路：

```text
TASK_START
  -> BatchService.createBatch(reason=manual)
  -> BatchService.startBatch
  -> FlowRunner.run(...)
  -> BatchService.finishBatch/failBatch
```

工具台使用建议：

- 运行监控标准批次区使用 `TASK_BATCH_LIST` 和 `TASK_BATCH_DETAIL`。
- 普通任务立即运行可使用 `TASK_START`。
- 失败批次重试可使用 `BATCH_RETRY`，但 UI 必须说明这是“创建重试批次”。

边界条件：

- `BATCH_RETRY` 只创建新批次，不等于自动开始执行。
- 京东签到 `SIGNIN_TASK_RUN_NOW` 返回 `SigninRunSummary`，不保证创建普通批次。
- 京东签到运行监控必须支持 `sourceType = signin` 的专项运行记录。
- 如果运行监控只依赖批次接口，京东签到最小闭环会断。

验收判断：

- 普通批次的 `pending/running/success/failed/cancelled/paused/intervention` 都能展示。
- 签到任务没有批次时仍能展示最近运行和历史。
- 对没有步骤结果的批次，只展示批次级状态，不伪造步骤。

### 3.4 结果列表和导出怎么取

现有接口分两层。

基础结果接口：

| 能力 | IPC | payload | 返回 | 代码位置 |
| --- | --- | --- | --- | --- |
| 结果列表 | `RESULT_LIST` | `{ taskId?, batchId? }` | `ExtractionResult[]` | `src/main/app.ts`, `ResultService.listResults()` |
| 结果详情 | `RESULT_DETAIL` | `{ resultId }` | `ExtractionResult | null` | `src/main/app.ts`, `ResultService.getResult()` |
| 结果导出 | `RESULT_EXPORT` | `{ taskId?, batchId?, format }` | 临时文件路径 | `src/main/app.ts`, `ResultService.exportResults()` |
| 标记可疑 | `RESULT_MARK_SUSPICIOUS` | `{ resultId }` | `{ resultId }` | `src/main/app.ts`, `ResultService.markSuspicious()` |

基础结果格式：

- `json`
- `jsonl`
- `csv`

Data Center 接口：

| 能力 | IPC | payload | 返回 | 代码位置 |
| --- | --- | --- | --- | --- |
| 结果分页 | `DATA_CENTER_RESULTS_LIST` | `{ page, pageSize, taskId?, batchId?, status?, createdFrom?, createdTo? }` | `DataPage<ExtractionResult>` | `src/main/ipc/data-center-handlers.ts` |
| 结果详情 | `DATA_CENTER_RESULTS_DETAIL` | `{ resultId }` | 结果详情 | `src/main/ipc/data-center-handlers.ts` |
| 创建导出 | `DATA_CENTER_EXPORTS_CREATE` | 导出任务 payload | 导出任务 | `src/main/ipc/data-center-handlers.ts` |
| 导出列表 | `DATA_CENTER_EXPORTS_LIST` | 查询 payload | 导出任务列表 | `src/main/ipc/data-center-handlers.ts` |
| 重试导出 | `DATA_CENTER_EXPORTS_RETRY` | `{ jobId }` | 导出任务 | `src/main/ipc/data-center-handlers.ts` |
| 取消导出 | `DATA_CENTER_EXPORTS_CANCEL` | `{ jobId }` | 导出任务 | `src/main/ipc/data-center-handlers.ts` |

工具台使用建议：

- P0 结果库最小版可用基础 `RESULT_LIST`、`RESULT_DETAIL`、`RESULT_EXPORT`。
- P0 同时在 view model 中聚合 `SIGNIN_TASK_HISTORY`，形成专项结果。
- Data Center 的分页、导出任务、质量能力留给结果库增强，不作为 P0 闭环前置条件。

边界条件：

- 标准 `ExtractionResult` 必须有 `taskId` 和 `batchId`。
- 京东签到历史没有 `batchId`，不能伪造批次 ID。
- 基础 `RESULT_EXPORT` 只能导出标准结果，不能自动导出签到历史。
- 签到专项结果 P0 可先提供 JSON 导出或详情查看，CSV 后续补。

验收判断：

- 结果库能展示标准结果。
- 结果库能展示签到历史投影。
- 专项结果显示“未绑定批次”，来源标记为 `signin`。
- 标准结果导出继续走已有接口，不被专项结果破坏。

### 3.5 京东签到运行历史怎么映射到任务结果

现有接口：

| 能力 | IPC | payload | 返回 | 代码位置 |
| --- | --- | --- | --- | --- |
| 保存签到任务 | `SIGNIN_TASK_SAVE` | `{ taskId?, name, entryUrl?, sessionId?, enabled?, signin }` | `TaskFlow` | `src/main/ipc/signin-handlers.ts` |
| 获取签到任务 | `SIGNIN_TASK_GET` | `{ taskId }` | `TaskFlow | null` | `src/main/ipc/signin-handlers.ts` |
| 立即运行 | `SIGNIN_TASK_RUN_NOW` | `{ taskId }` | `SigninRunSummary` | `src/main/ipc/signin-handlers.ts`, `SigninTaskService.runTask()` |
| 介入后重试 | `SIGNIN_TASK_INTERVENTION_RETRY` | `{ taskId }` | `SigninRunSummary` | `src/main/ipc/signin-handlers.ts` |
| 最新状态 | `SIGNIN_TASK_STATUS` | `{ taskId }` | `SigninRunSummary | null` | `src/main/ipc/signin-handlers.ts` |
| 历史记录 | `SIGNIN_TASK_HISTORY` | `{ taskId }` | `SigninRunSummary[]` | `src/main/ipc/signin-handlers.ts` |
| 登录采集 | `SIGNIN_TASK_LOGIN_CAPTURE` | `{ taskId }` | 登录快照结果 | `src/main/app.ts` |

`SigninRunSummary` 关键字段：

- `taskId`
- `status`
- `strategyUsed`
- `failureReason`
- `detail`
- `debug`
- `reward`
- `runAt`
- `retryCount`

结果库投影模型：

| 展示字段 | 映射 |
| --- | --- |
| `id` | `signin:${taskId}:${runAt}` |
| `sourceType` | `signin` |
| `taskId` | `SigninRunSummary.taskId` |
| `batchId` | `null`，展示“未绑定批次” |
| `title` | `京东签到` |
| `status` | `success -> normal`，`failed/needs_intervention -> failed`，其他状态作为运行中或等待展示态 |
| `statusLabel` | 从 `SigninRunStatus` 映射中文 |
| `createdAt` | `runAt` |
| `summary` | `reward.detailText`、`detail`、`failureReason` 的优先级摘要 |
| `debug` | `debug` 原样保留给详情页 |
| `exportableFormats` | P0 可先为 `json` |

运行监控投影模型：

| 展示字段 | 映射 |
| --- | --- |
| `runId` | `signin:${taskId}:${runAt}` |
| `sourceType` | `signin` |
| `taskId` | `SigninRunSummary.taskId` |
| `rawStatus` | `SigninRunSummary.status` |
| `statusLabel` | 签到状态中文文案 |
| `startedAt` | `runAt` |
| `finishedAt` | 对终态使用 `runAt`，非终态为空 |
| `error` | `failureReason` 或 `detail` |
| `debug` | `debug` |
| `actions` | `needs_intervention` 时显示介入重试；`failed` 时显示重新运行 |

边界条件：

- `needs_intervention` 只作为签到原始状态。
- 不把签到历史写入 `extraction_results`。
- 不给签到历史伪造 `batchId`。
- 如果 `runAt` 重复，投影 ID 需要追加数组索引或哈希，避免列表 key 冲突。

验收判断：

- 京东签到成功后，结果库能看到一条 `sourceType = signin` 的结果。
- 京东签到失败后，任务台待处理区能看到失败或需介入项。
- 京东签到历史能进入运行监控详情。
- 结果库详情能显示奖励、策略、失败原因和调试信息。

## 4. 最小闭环可行性确认

### 4.1 闭环主流程

主流程：

1. 用户进入任务台。
2. 用户点击“从模板创建”。
3. 用户选择“京东签到任务”模板。
4. 用户填写任务名称、入口 URL、会话、签到策略。
5. 用户点击“保存并立即运行”。
6. 页面调用 `SIGNIN_TASK_SAVE` 创建或更新 `TaskFlow`。
7. 页面调用 `SIGNIN_TASK_RUN_NOW` 执行签到。
8. 页面跳转运行监控，展示 `SigninRunSummary` 最新状态和历史。
9. 运行结束后，结果库通过 `SIGNIN_TASK_HISTORY` 展示专项结果。
10. 用户可以回到任务台查看最近状态，也可以进入结果库查看详情。

### 4.2 可行性表

| 步骤 | 可复用能力 | 是否可行 | 需要新增 |
| --- | --- | --- | --- |
| 任务台展示任务 | `TASK_LIST`、`SIGNIN_TASK_STATUS` | 可行 | 任务台 view model |
| 选择京东签到模板 | 前端静态模板目录 | 可行 | 模板目录 |
| 创建任务 | `SIGNIN_TASK_SAVE` | 可行 | 模板到签到 payload 适配 |
| 立即运行 | `SIGNIN_TASK_RUN_NOW` | 可行 | 运行后跳转和状态缓存 |
| 运行监控 | `SIGNIN_TASK_STATUS`、`SIGNIN_TASK_HISTORY` | 可行 | 签到专项运行 view model |
| 结果库 | `SIGNIN_TASK_HISTORY`、`RESULT_LIST` | 有条件可行 | 统一结果展示模型 |

### 4.3 完整用例

#### UC-A：无任务时创建第一个京东签到任务

前置条件：

- `TASK_LIST` 返回空数组。

流程：

1. 任务台展示空状态。
2. 用户点击“从模板创建”。
3. 模板目录展示“京东签到任务”。
4. 用户进入任务编辑器。
5. 用户保存任务。
6. `SIGNIN_TASK_SAVE` 返回 `TaskFlow`。
7. 任务台重新拉取 `TASK_LIST`，展示新任务。

验收：

- 不显示假数据。
- 不需要用户理解旧“自动签到”模块。
- 保存失败时保留表单输入并展示错误。

#### UC-B：京东签到立即运行成功

前置条件：

- 已存在 `TaskFlow.kind = jd-signin`。
- 签到配置可运行。

流程：

1. 用户点击“立即运行”。
2. 页面调用 `SIGNIN_TASK_RUN_NOW`。
3. 返回 `SigninRunSummary.status = success`。
4. 运行监控显示成功状态、策略、奖励摘要。
5. 结果库显示 `sourceType = signin` 的专项结果。

验收：

- 不要求存在普通 `TaskBatch`。
- 不要求存在标准 `ExtractionResult`。
- 结果库能从专项结果回到任务详情。

#### UC-C：京东签到需要人工介入

前置条件：

- 签到运行返回 `SigninRunSummary.status = needs_intervention`。

流程：

1. 任务台待处理区显示“需人工介入”。
2. 用户进入运行监控。
3. 运行监控显示失败原因、调试信息和介入操作。
4. 用户完成处理后调用 `SIGNIN_TASK_INTERVENTION_RETRY`。
5. 新的 `SigninRunSummary` 进入历史。

验收：

- UI 显示“需人工介入”。
- 不把 `needs_intervention` 写入 `TaskBatchStatus`。
- 原历史记录保留，重试结果追加展示。

#### UC-D：京东签到失败

前置条件：

- 签到运行返回 `SigninRunSummary.status = failed`。

流程：

1. 任务台待处理区显示失败任务。
2. 用户进入运行监控。
3. 页面展示 `failureReason`、`detail` 和可用 `debug`。
4. 用户点击重新运行。
5. 页面再次调用 `SIGNIN_TASK_RUN_NOW`。

验收：

- 失败原因不能只显示“未知错误”。
- 失败历史不被后续成功记录覆盖。
- 结果库能查看失败专项结果。

#### UC-E：标准结果与签到专项结果并存

前置条件：

- `RESULT_LIST` 返回至少一条标准结果。
- `SIGNIN_TASK_HISTORY` 返回至少一条签到历史。

流程：

1. 用户进入结果库。
2. 结果库拉取标准结果和签到历史。
3. view model 统一排序和分组。
4. 标准结果展示 `sourceType = standard`。
5. 签到结果展示 `sourceType = signin` 和“未绑定批次”。

验收：

- 两类结果都能打开详情。
- 标准结果导出继续走 `RESULT_EXPORT`。
- 签到专项结果不会调用标准结果详情接口。

## 5. 需要新增的最小模块

### 5.1 任务模板目录

建议新增：

- `src/renderer/entries/workbench/task-toolbench/templates.ts`

职责：

- 定义内置模板。
- 提供模板查询。
- 声明模板参数字段。
- 声明模板所需能力。
- 声明模板适配器类型。

建议类型：

```ts
export type TaskTemplateAdapter = 'signin' | 'hot' | 'comment' | 'generic';

export interface TaskTemplateDefinition {
  id: string;
  name: string;
  description: string;
  category: 'signin' | 'monitoring' | 'collection';
  adapter: TaskTemplateAdapter;
  requiredCapabilities: string[];
  status: 'ready' | 'preview';
  defaultEntryUrl?: string;
  defaultSchedule?: unknown;
}
```

第一批模板：

| 模板 ID | 名称 | adapter | 第一轮状态 |
| --- | --- | --- | --- |
| `jd-signin` | 京东签到任务 | `signin` | 必做，支持创建和运行 |
| `hot-monitor` | 热点监控任务 | `hot` | 只展示，可后续接运行 |
| `comment-monitor` | 评论监控任务 | `comment` | 只展示，可后续接运行 |

验收：

- 三个模板可被任务台和任务编辑器复用。
- 只有 `jd-signin` 在第一轮允许进入完整运行。
- preview 模板不阻塞京东签到闭环。

### 5.2 任务台 view model

建议新增：

- `src/renderer/entries/workbench/task-toolbench/taskWorkbenchViewModel.ts`

输入：

- `TaskSummary[]`
- `SigninRunSummary | null` 按任务聚合
- 标准结果列表
- 模板目录

输出：

| 字段 | 说明 |
| --- | --- |
| `runningItems` | 正在运行任务或专项运行 |
| `failedItems` | 失败或需介入任务 |
| `recentCompletedItems` | 最近完成任务 |
| `recentResults` | 最近标准结果和专项结果 |
| `recommendedTemplates` | 推荐模板 |
| `emptyState` | 空状态 |
| `errors` | 接口错误集合 |

边界：

- `TASK_LIST` 失败时输出错误状态。
- 没有批次但有签到状态时，以签到状态作为最近状态。
- 没有任何任务时输出空状态。
- 同一任务既有失败批次又有成功签到历史时，按更近时间展示。

验收：

- 空任务、普通任务、签到任务、失败任务都有独立单测。
- 不在 view model 内伪造任务、批次或结果。

### 5.3 运行监控 view model

建议新增：

- `src/renderer/entries/workbench/task-toolbench/runMonitorViewModel.ts`

职责：

- 同时支持标准批次和专项运行记录。
- 给运行监控页面提供统一列表和详情模型。

建议模型：

| 字段 | 说明 |
| --- | --- |
| `runId` | `batch:${batchId}` 或 `signin:${taskId}:${runAt}` |
| `taskId` | 任务 ID |
| `sourceType` | `batch` 或 `signin` |
| `statusLabel` | UI 状态文案 |
| `rawStatus` | 原始状态 |
| `startedAt` | 开始时间 |
| `finishedAt` | 结束时间，如无则为空 |
| `error` | 错误或失败原因 |
| `debug` | 截图、诊断信息或日志摘要 |
| `actions` | 可用动作，如重试、人工介入、查看结果 |

边界：

- 标准批次使用 `TASK_BATCH_DETAIL`。
- 签到专项使用 `SIGNIN_TASK_STATUS` / `SIGNIN_TASK_HISTORY`。
- `needs_intervention` 只作为签到原始状态，不写入 `TaskBatchStatus`。
- `BATCH_RETRY` 生成的新批次必须单独展示，不能覆盖原批次。

验收：

- `batch` 和 `signin` 两类运行记录都能生成稳定 `runId`。
- 运行中、成功、失败、需介入都有 UI 操作定义。
- 详情页能显示缺失日志、缺失截图、缺失批次的空状态。

### 5.4 结果库统一展示模型

建议新增：

- `src/renderer/entries/workbench/task-toolbench/resultLibraryViewModel.ts`

职责：

- 聚合标准结果和专项结果。
- 给结果库提供统一列表、详情入口和导出能力提示。

建议模型：

| 字段 | 说明 |
| --- | --- |
| `id` | 展示结果 ID |
| `sourceType` | `standard`、`signin`、后续 `hot`、`comment` |
| `taskId` | 任务 ID |
| `batchId` | 批次 ID，可为空 |
| `title` | 展示标题 |
| `statusLabel` | 状态文案 |
| `createdAt` | 创建时间 |
| `summary` | 简短摘要 |
| `detailRef` | 详情打开方式 |
| `exportableFormats` | 可导出格式 |

边界：

- `standard` 来自 `RESULT_LIST` 或 Data Center。
- `signin` 来自 `SIGNIN_TASK_HISTORY`。
- 无 `batchId` 时不能伪造。
- V1 至少支持打开详情；导出可先支持 JSON。

验收：

- 标准结果详情调用 `RESULT_DETAIL`。
- 签到专项详情使用本地投影数据或重新拉取 `SIGNIN_TASK_HISTORY`。
- 标准导出和专项导出入口不混用。

## 6. 第一轮开发任务

第一轮只进入以下任务，不扩展热点、评论、AI 和能力中心深水区。

### P0-01：导航与路由收敛

目标：

- 将一级菜单收敛为任务台、任务编辑器、运行监控、结果库、能力中心。
- 保留旧路由兼容。

建议改动：

- `src/renderer/shared/components/AdminPageLayout.tsx`
- `src/renderer/entries/workbench/App.tsx`
- `src/renderer/shared/components/CommandPalette/CommandPalette.tsx`

进入范围：

- 新一级菜单。
- 新路由映射。
- 命令面板入口排序。
- 旧路由直达保留。

不进入范围：

- 删除旧页面。
- 重写旧模块业务逻辑。
- 能力中心深度实现。

验收：

- 一级菜单不再展示股票、浏览器、插件、热点、评论、签到。
- 旧路由仍可直接访问。
- 命令面板优先展示新入口。
- 从旧页面能返回任务台。

### P0-02：任务台首页

目标：

- 首页从模块列表改为任务台。
- 首屏展示真实任务、运行、失败、结果和模板入口。

建议改动：

- `src/renderer/entries/workbench/pages/Home.tsx`
- `src/renderer/entries/workbench/styles.css`
- 新增 `taskWorkbenchViewModel.ts`

数据来源：

- `TASK_LIST`
- `SIGNIN_TASK_STATUS`
- `RESULT_LIST`
- 静态模板目录

进入范围：

- 空状态。
- 运行中分组。
- 失败待处理分组。
- 最近完成。
- 最近结果。
- 推荐模板。

不进入范围：

- 假 KPI。
- Data Center 深度分页。
- 热点和评论运行接入。

验收：

- 无任务时显示创建任务空状态。
- 有京东签到任务时显示最近签到状态。
- 失败或需介入状态进入待处理区。
- 点击待处理项进入运行监控。
- 点击最近结果进入结果库。

### P0-03：任务模板目录

目标：

- 提供静态模板目录，支撑任务台和任务编辑器。

建议改动：

- 新增 `src/renderer/entries/workbench/task-toolbench/templates.ts`

进入范围：

- `jd-signin` 模板。
- `hot-monitor` preview 模板。
- `comment-monitor` preview 模板。
- 模板能力和状态文案。

不进入范围：

- 后端模板存储。
- 插件市场。
- 模板动态安装。

验收：

- 京东签到、热点监控、评论监控三个模板可见。
- 京东签到模板可进入任务编辑器。
- 热点和评论模板显示“后续接入运行”或等价状态。
- preview 模板不能触发不可用运行。

### P0-04：任务编辑器最小版

目标：

- 支持基于京东签到模板创建任务并立即运行。

建议改动：

- 新增或改造任务编辑器页面。
- 复用 `SIGNIN_TASK_SAVE` 和 `SIGNIN_TASK_RUN_NOW`。

进入范围：

- 京东签到表单。
- 保存草稿。
- 保存并立即运行。
- 运行后跳转运行监控。
- 编辑已有京东签到任务。

不进入范围：

- 通用步骤录制完整编辑器。
- 热点和评论配置完整表单。
- 定时调度复杂配置。

验收：

- 用户能填写任务名称、入口 URL、会话、签到策略。
- 保存调用 `SIGNIN_TASK_SAVE`。
- 立即运行调用 `SIGNIN_TASK_RUN_NOW`。
- 成功后跳转运行监控。
- 保存失败时保留输入。
- 立即运行参数不足时阻止运行并展示原因。

### P0-05：运行监控最小版

目标：

- 同时展示普通批次和京东签到专项运行。

建议改动：

- 新增或改造运行监控页面。
- 新增 `runMonitorViewModel.ts`。

数据来源：

- 标准批次：`TASK_BATCH_LIST`、`TASK_BATCH_DETAIL`。
- 京东签到：`SIGNIN_TASK_STATUS`、`SIGNIN_TASK_HISTORY`。

进入范围：

- 批次运行记录。
- 签到专项运行记录。
- 失败原因。
- 调试摘要。
- 重试和介入入口。

不进入范围：

- Runner 调度器完整控制台。
- 分布式 Runner 管理。
- 完整日志检索系统。

验收：

- 京东签到运行中、成功、失败、需介入状态可展示。
- `needs_intervention` 显示为“需人工介入”，但不写入批次状态。
- 有调试信息时展示截图或诊断摘要。
- 无批次时不报错。
- 普通批次仍按原状态展示。

### P1-01：京东签到模板适配

目标：

- 让京东签到成为第一个完整工具台模板。

建议改动：

- 模板目录增加 `jd-signin`。
- 任务编辑器适配 `SIGNIN_TASK_SAVE`。
- 任务台和运行监控识别 `kind = jd-signin`。
- 结果库统一展示模型支持 `signin`。

进入范围：

- 创建。
- 保存。
- 立即运行。
- 状态查看。
- 历史查看。
- 专项结果投影。

不进入范围：

- 把签到历史迁移到 `extraction_results`。
- 把签到状态改造成 `TaskBatchStatus`。
- 多站点签到。

验收：

- 创建、保存、立即运行、查看状态、查看历史结果完整走通。
- 登录态缺失、需人工介入、失败、成功都有明确状态。
- 结果库能展示签到历史。
- 标准结果接口不因签到专项结果被破坏。

## 7. 暂缓任务

| 任务 | 暂缓原因 |
| --- | --- |
| P0-06 结果库任务化完整增强 | Phase 0 只需要签到专项投影，不需要完整 Data Center 重构 |
| 热点监控运行适配 | 需要先稳定通用任务结果闭环 |
| 评论监控运行适配 | 涉及 MediaCrawler 和 AI 分支，复杂度高 |
| AI 任务助手收敛 | 应等任务台、运行监控、结果库上下文稳定后再做 |
| 能力中心 | 第一轮只需模板能力提示，不需要完整中心 |
| Data Center 深度重构 | 先以结果库包装和统一 view model 验证方向 |
| 统一结果落表迁移 | 需要单独迁移设计，不属于 Phase 0 |

## 8. 风险与处理建议

| 风险 | 影响 | 处理建议 |
| --- | --- | --- |
| 京东签到不产生标准批次 | 运行监控如果只看批次会断链 | 运行监控支持 `sourceType = signin` |
| 京东签到不写入 `extraction_results` | 结果库如果只看标准结果会空 | 结果库支持 `sourceType = signin` |
| `BATCH_RETRY` 只创建重试批次 | 用户以为点击后已经运行 | UI 文案写清“创建重试批次”，后续再接启动 |
| Data Center 和基础 `RESULT_*` 都能导出 | 实现时可能混用 | P0 用基础导出，增强再接 Data Center 导出任务 |
| 静态模板目录过早复杂化 | 容易做成插件市场 | 第一轮模板只做内置配置 |
| 旧路由删除过早 | 破坏测试和历史入口 | 旧路由保留，一级菜单隐藏 |
| 签到历史 ID 不稳定 | 结果库列表 key 冲突 | 用 `signin:${taskId}:${runAt}`，必要时追加索引 |
| 立即运行失败后丢表单 | 用户需要重新填写 | 失败时保留编辑器状态 |

## 9. Phase 0 开发清单

第一轮只进入：

- [x] P0-01 导航与路由收敛。
- [x] P0-02 任务台首页。
- [x] P0-03 任务模板目录。
- [x] P0-04 任务编辑器最小版。
- [x] P0-05 运行监控最小版。
- [x] P1-01 京东签到模板适配。

第一轮不进入：

- [ ] 热点监控运行闭环。
- [ ] 评论监控运行闭环。
- [ ] AI 助手深度收敛。
- [ ] 能力中心完整实现。
- [ ] Data Center 深度重构。
- [ ] 统一结果落表迁移。

## 10. Phase 0 结论

可以进入第一轮开发。

推荐执行顺序：

1. P0-03 先建模板目录和类型，给后续页面提供统一输入。
2. P0-01 收敛导航和路由，让产品入口先稳定。
3. P0-02 改造任务台首页，接入 `TASK_LIST` 和签到状态。
4. P0-04 做京东签到任务编辑器最小版。
5. P0-05 做运行监控最小版。
6. P1-01 把京东签到的结果库投影补齐，完成闭环验收。

完成 Phase 0 后，再评估是否进入：

- 热点模板运行闭环。
- 评论模板运行闭环。
- Data Center 结果库深度改造。
- AI 任务助手上下文改造。
