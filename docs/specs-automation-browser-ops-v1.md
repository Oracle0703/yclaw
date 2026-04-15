# 📦 YClaw 自动化采集产品化 Spec（V1）

> 范围：聚焦 `自动化采集 + 浏览器介入台` 的一期产品化方案  
> 说明：本文件为新增 spec，**扩展但不替代**现有 `docs/specs.md`（V1.0 SPEC-001 ~ SPEC-022）

---

## 实施回写（2026-04-15）

### 当前实现映射

| Spec | 当前实现情况 | 备注 |
| --- | --- | --- |
| SPEC-A01 任务中心 | 部分完成 | 已有任务列表、手动启动、批次查看、复跑入口；完整任务 CRUD 仍待补齐 |
| SPEC-A02 调度与执行队列 | 最小完成 | 已有 `SchedulerService`、`BatchService`、状态汇总与批次生命周期 |
| SPEC-A03 浏览器介入台 | 最小完成 | 已有介入状态展示、失败信息、恢复自动执行与会话关联 |
| SPEC-A04 规则录制与提取模板 | 最小完成 | 已有 `TemplateService`、`TemplateManager`、`RecorderPanel`、步骤导入 |
| SPEC-A05 结果中心 | 完成基础版 | 已有结果查询、详情查看、导出与可疑标记 |
| SPEC-A06 会话与登录态管理 | 完成基础版 | 已有 `SessionRegistry` 与任务绑定能力 |
| SPEC-A07 告警、日志与复跑 | 完成基础版 | 已有结构化执行日志、告警聚合、已读/未读、批次跳转 |
| SPEC-A08 稳定性与验收指标 | 部分完成 | 已新增 Playwright 验收脚本覆盖核心三场景，完整 Electron 打包态验收待补 |

### 当前限制 / 暂不支持

| 项 | 说明 |
| --- | --- |
| 完整任务资产编辑 | 当前未把任务创建、详情编辑、模板绑定做成完整产品流 |
| 复杂录制动作 | 当前仅覆盖 click/input/change/scroll 的轻量录制 |
| 告警实时推送 | 当前已支持事件广播骨架，但主要以 `alert:list` 拉取为主 |
| 真机端到端 | 当前 E2E 基于 Vite 多入口 + mocked preload，不覆盖 Electron 原生窗口与打包产物 |
| 自动验证/验证码破解 | 明确不做，仅保留人工介入恢复路径 |

---

## 与现有 Spec 关系映射

下表说明本文 Spec 与 V1.0 已有 Spec 的关系。标注「扩展」的表示在原有能力基础上增量演进，标注「新增」的表示全新模块。

| 本文 Spec | 关联旧 Spec                                     | 关系 | 说明                                                                        |
| --------- | ----------------------------------------------- | ---- | --------------------------------------------------------------------------- |
| SPEC-A01  | SPEC-013（任务流执行）、SPEC-014（采集模块 UI） | 扩展 | 在现有 TaskFlow / TaskService 基础上增加产品化任务 CRUD、批次追踪、模板复制 |
| SPEC-A02  | SPEC-013                                        | 扩展 | 为现有 FlowRunner 增加定时调度、并发控制、执行队列                          |
| SPEC-A03  | SPEC-011（内嵌浏览器）、SPEC-012（自动化引擎）  | 扩展 | 复用 TabManager + AutomationEngine，增加失败现场恢复与人工接管协议          |
| SPEC-A04  | SPEC-012                                        | 扩展 | 利用已有 SelectorGenerator + 5 种 ActionType，增加交互式录制与模板持久化    |
| SPEC-A05  | —                                               | 新增 | 全新结果管理模块                                                            |
| SPEC-A06  | SPEC-011                                        | 扩展 | 在 TabManager session 隔离基础上增加登录态持久化与任务绑定                  |
| SPEC-A07  | SPEC-008（日志服务）                            | 扩展 | 在 LogService 基础上增加按任务/批次/步骤的结构化执行日志                    |
| SPEC-A08  | —                                               | 新增 | 一期质量验收基线                                                            |

---

## Spec 总览

| ID       | 标题               | 模块         | 优先级 | 依赖                                          |
| -------- | ------------------ | ------------ | :----: | --------------------------------------------- |
| SPEC-A01 | 任务中心           | 自动化产品层 |   P0   | 现有 SPEC-006（SQLite）、SPEC-013（TaskFlow） |
| SPEC-A02 | 调度与执行队列     | 调度层       |   P0   | SPEC-A01                                      |
| SPEC-A03 | 浏览器介入台       | 浏览器控制层 |   P0   | SPEC-A02、现有 SPEC-011（TabManager）         |
| SPEC-A04 | 规则录制与提取模板 | 规则层       |   P0   | SPEC-A01、SPEC-A03                            |
| SPEC-A05 | 结果中心           | 数据结果层   |   P0   | SPEC-A02                                      |
| SPEC-A06 | 会话与登录态管理   | 会话层       |   P1   | SPEC-A03                                      |
| SPEC-A07 | 告警、日志与复跑   | 可观测性     |   P1   | SPEC-A02、SPEC-A05                            |
| SPEC-A08 | 稳定性与验收指标   | 质量保障     |   P1   | SPEC-A01 ~ SPEC-A07                           |

> **依赖变更说明**：SPEC-A05 移除了对 SPEC-A04 的硬依赖——结果入库由执行引擎直接写入，不依赖规则录制器。规则模板是结果的元数据关联，可后续补充。

---

## SPEC-A01：任务中心

| 属性   | 值                                         |
| ------ | ------------------------------------------ |
| 模块   | 自动化产品层                               |
| 优先级 | P0                                         |
| 目标   | 承载任务定义、状态管理、启停操作与批次入口 |

**描述**

任务中心是产品主入口。用户通过任务中心创建采集任务、查看任务状态、启停任务、查看最近批次，并进入结果中心或浏览器介入台。

**验收标准**

| 类型     | 标准                                                         |
| -------- | ------------------------------------------------------------ |
| 创建     | 支持创建基础采集任务，包含名称、入口 URL、执行规则、提取模板 |
| 操作     | 支持启用、停用、手动执行、暂停、恢复、复跑                   |
| 状态     | 展示任务运行状态、最近执行时间、下次执行时间、最近结果摘要   |
| 追踪     | 每个任务能查看历史批次与失败记录                             |
| 可维护性 | 支持复制现有任务为新任务模板                                 |

**数据模型扩展**

> 基于现有 `TaskFlow`（id, name, description, steps[], createdAt, updatedAt），扩展以下字段：

| 字段         | 类型                     | 说明                             |
| ------------ | ------------------------ | -------------------------------- |
| `entryUrl`   | `string`                 | 任务入口 URL                     |
| `schedule`   | `ScheduleConfig \| null` | 调度计划（见 SPEC-A02）          |
| `sessionId`  | `string \| null`         | 绑定的会话容器 ID（见 SPEC-A06） |
| `templateId` | `string \| null`         | 关联的提取模板 ID（见 SPEC-A04） |
| `enabled`    | `boolean`                | 是否启用调度                     |
| `tags`       | `string[]`               | 分类标签                         |
| `lastRunAt`  | `string \| null`         | 最近执行时间                     |
| `nextRunAt`  | `string \| null`         | 下次调度时间                     |

新增 DB 表：

```sql
-- 扩展 tasks 表增加上述字段（ALTER TABLE）
-- 新增批次表
CREATE TABLE task_batches (
  id          TEXT PRIMARY KEY,
  taskId      TEXT NOT NULL REFERENCES tasks(id),
  status      TEXT NOT NULL DEFAULT 'pending', -- pending | running | success | failed | cancelled
  startedAt   TEXT,
  finishedAt  TEXT,
  stepResults TEXT, -- JSON: StepResult[]
  error       TEXT,
  createdAt   TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**IPC Channels**

| Channel              | 方向            | 说明                                 |
| -------------------- | --------------- | ------------------------------------ |
| `task:create`        | renderer → main | 创建任务                             |
| `task:update`        | renderer → main | 更新任务定义                         |
| `task:delete`        | renderer → main | 删除任务                             |
| `task:list`          | renderer → main | 获取任务列表（含状态摘要）           |
| `task:detail`        | renderer → main | 获取单个任务详情                     |
| `task:start`         | renderer → main | 手动触发执行                         |
| `task:pause`         | renderer → main | 暂停执行                             |
| `task:resume`        | renderer → main | 恢复执行                             |
| `task:stop`          | renderer → main | 停止执行                             |
| `task:clone`         | renderer → main | 复制任务为模板                       |
| `task:statusChanged` | main → renderer | 任务状态变更通知（EventBus fan-out） |

---

## SPEC-A02：调度与执行队列

| 属性   | 值                                         |
| ------ | ------------------------------------------ |
| 模块   | 调度层                                     |
| 优先级 | P0                                         |
| 目标   | 让任务按计划自动运行，并具备可靠的执行控制 |

**描述**

调度器负责在指定时间触发任务，执行队列负责管理并发、超时、重试、取消与批次状态流转。

**验收标准**

| 类型     | 标准                                              |
| -------- | ------------------------------------------------- |
| 调度     | 支持手动执行、固定周期执行、一次性执行            |
| 队列     | 支持待执行、运行中、成功、失败、暂停、取消等状态  |
| 重试     | 支持配置失败重试次数与退避策略                    |
| 资源控制 | 支持基础并发上限，避免任务互相抢占浏览器资源      |
| 记录     | 为每次执行生成独立批次记录                        |
| 恢复     | 进程重启后，从 DB 读取 enabled 任务并重建调度计划 |

**技术方案**

| 项             | 方案                                                | 说明                                                                                     |
| -------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 调度引擎       | 主进程内 `node-cron`（或轻量 `croner`）             | 避免系统级定时器的跨平台差异；cron 表达式存储在 DB                                       |
| 调度计划持久化 | `tasks.schedule` JSON 字段                          | 存储 `ScheduleConfig`，进程启动时扫描 enabled 任务并注册 cron job                        |
| 执行队列       | 内存优先队列 + DB 批次表                            | 队列深度 = `maxConcurrency`（默认 3），超出排队等待                                      |
| 并发控制       | `SchedulerService` 维护 `runningCount`              | 到达上限时新任务进入 pending 队列                                                        |
| 超时           | 每次执行设置 `AbortController` + 任务级 `timeoutMs` | 超时自动标记 failed 并释放资源                                                           |
| 进程重启恢复   | `SchedulerService.start()` 扫描 `tasks` 表          | `enabled && schedule != null` 的任务重新注册；运行中的批次标记为 `failed`（interrupted） |

**数据模型**

```typescript
interface ScheduleConfig {
  type: 'manual' | 'once' | 'cron';
  /** cron 表达式，type='cron' 时必填 */
  cron?: string;
  /** 一次性执行时间（ISO 字符串），type='once' 时必填 */
  runAt?: string;
  /** 任务级超时（ms），默认 300000 */
  timeoutMs?: number;
  /** 最大并发（覆盖全局） */
  maxConcurrency?: number;
}
```

**IPC Channels**

| Channel            | 方向            | 说明                                     |
| ------------------ | --------------- | ---------------------------------------- |
| `scheduler:status` | renderer → main | 获取调度器全局状态（运行中数、队列深度） |
| `batch:list`       | renderer → main | 按任务 ID 获取批次列表                   |
| `batch:detail`     | renderer → main | 获取单个批次详情（含 stepResults）       |
| `batch:retry`      | renderer → main | 从失败批次发起复跑                       |

---

## SPEC-A03：浏览器介入台

| 属性   | 值                                     |
| ------ | -------------------------------------- |
| 模块   | 浏览器控制层                           |
| 优先级 | P0                                     |
| 目标   | 为自动任务提供观察、接管与恢复执行能力 |

**描述**

浏览器介入台用于展示当前执行页面、失败现场与会话上下文。任务失败后，用户可以接管页面完成登录、验证码或修正步骤，再恢复自动执行。

**验收标准**

| 类型 | 标准                                       |
| ---- | ------------------------------------------ |
| 观察 | 可查看当前任务绑定的页面会话与执行状态     |
| 接管 | 失败后可一键进入人工介入状态               |
| 恢复 | 人工介入后可恢复自动执行，无需新开任务     |
| 关联 | 介入台与具体任务、批次、步骤保持关联       |
| 调试 | 支持查看当前步骤、目标选择器、最近错误信息 |

**与 FlowRunner 衔接**

现有 `FlowRunner.breakpoint` 为纯内存状态（`Breakpoint { flowId, stepIndex, error, timestamp }`），进程重启即丢失。为支持介入台的完整闭环：

| 需求             | 方案                                                                                                                               |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 断点持久化       | FlowRunner 失败时将 breakpoint 写入 `task_batches.breakpoint` JSON 字段，包含 `{ stepIndex, error, screenshot?, domSnapshot? }`    |
| 介入台获取状态   | 通过 `intervention:status` IPC 查询指定任务的当前 FlowRunner 状态 + 绑定的 TabManager webContentsId                                |
| 人工操作完成通知 | 介入台 UI 点击「恢复自动执行」→ `intervention:resume` IPC → 主进程调用 `FlowRunner.resume()` 从 breakpoint stepIndex 继续          |
| 失败现场恢复     | 主进程根据 batch.breakpoint 中的 stepIndex + 任务的 entryUrl + 绑定的 sessionPartition，通过 TabManager 重新打开页面或复用已有 tab |

**IPC Channels**

| Channel                   | 方向            | 说明                                                              |
| ------------------------- | --------------- | ----------------------------------------------------------------- |
| `intervention:status`     | renderer → main | 查询指定任务的介入状态（FlowRunner 状态 + tab 信息 + breakpoint） |
| `intervention:takeover`   | renderer → main | 标记进入人工接管模式（暂停 FlowRunner）                           |
| `intervention:resume`     | renderer → main | 人工操作完成，恢复自动执行                                        |
| `intervention:screenshot` | renderer → main | 对当前介入页面截图                                                |
| `intervention:stepInfo`   | main → renderer | 推送当前步骤 / 选择器 / 错误信息（EventBus）                      |

---

## SPEC-A04：规则录制与提取模板

| 属性   | 值                               |
| ------ | -------------------------------- |
| 模块   | 规则层                           |
| 优先级 | P0                               |
| 目标   | 降低任务配置门槛，提升规则复用率 |

**描述**

规则录制器负责把页面操作沉淀为步骤序列，提取模板负责定义要采集的字段、选择器和数据结构。

**验收标准**

| 类型 | 标准                                         |
| ---- | -------------------------------------------- |
| 录制 | 支持基础点击、输入、等待、提取、截图步骤定义 |
| 编辑 | 支持调整步骤顺序、修改参数、禁用单步         |
| 提取 | 支持定义多个字段及其选择器                   |
| 模板 | 支持保存为模板并复用到其他任务               |
| 校验 | 保存前校验关键步骤与提取字段完整性           |

**录制机制技术方案**

| 项         | 方案                                                                       | 说明                                                                                          |
| ---------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 事件捕获   | 在 WebContentsView 中注入录制脚本（Content Script）                        | 通过 `webContents.executeJavaScript()` 注入，监听 `click`、`input`、`change`、`scroll` 等事件 |
| 选择器生成 | 复用已有 `SelectorGenerator`                                               | 事件触发时调用 `generateSelector(event.target)` 生成最优 CSS 选择器                           |
| 产物格式   | 直接映射为 `TaskStep[]`                                                    | 录制产物与现有 `TaskAction`（click / input / scroll / extract / screenshot）一一对应          |
| 提取定义   | 用户在录制模式下选中页面元素 → 定义字段名 + 选择器 + 提取属性              | 生成 `ExtractionField[]` 并关联到 `ExtractionTemplate`                                        |
| 通信方式   | 注入脚本通过 `window.postMessage` → WebContentsView `ipc-message` → 主进程 | 符合 contextIsolation + sandbox 安全模型                                                      |

**数据模型**

```typescript
interface ExtractionField {
  name: string; // 字段名，如 'price'
  selector: string; // CSS 选择器
  attribute: string; // 提取属性，默认 'textContent'
  transform?: string; // 可选后处理，如 'trim' | 'number'
}

interface ExtractionTemplate {
  id: string;
  name: string;
  fields: ExtractionField[];
  createdAt: string;
  updatedAt: string;
}
```

新增 DB 表：

```sql
CREATE TABLE extraction_templates (
  id        TEXT PRIMARY KEY,
  name      TEXT NOT NULL,
  fields    TEXT NOT NULL, -- JSON: ExtractionField[]
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**IPC Channels**

| Channel           | 方向            | 说明                           |
| ----------------- | --------------- | ------------------------------ |
| `recorder:start`  | renderer → main | 开始录制（指定 webContentsId） |
| `recorder:stop`   | renderer → main | 停止录制，返回 `TaskStep[]`    |
| `recorder:action` | main → renderer | 录制过程中实时推送捕获到的操作 |
| `template:save`   | renderer → main | 保存提取模板                   |
| `template:list`   | renderer → main | 获取模板列表                   |
| `template:delete` | renderer → main | 删除模板                       |

---

## SPEC-A05：结果中心

| 属性   | 值                                     |
| ------ | -------------------------------------- |
| 模块   | 数据结果层                             |
| 优先级 | P0                                     |
| 目标   | 提供结果查看、筛选、导出与批次回溯能力 |

**描述**

结果中心用于统一管理采集结果。用户可以按任务、批次、时间、状态查看结果，并关联查看日志、截图与异常信息。

**验收标准**

| 类型     | 标准                                         |
| -------- | -------------------------------------------- |
| 列表     | 支持按任务、批次、时间范围筛选               |
| 详情     | 单条结果可查看采集字段、来源任务、执行上下文 |
| 导出     | 一期支持 CSV 和 JSON 两种导出格式            |
| 回溯     | 支持从结果跳转到对应批次与执行日志           |
| 异常识别 | 支持标记失败结果或可疑结果                   |

**数据模型**

```sql
CREATE TABLE extraction_results (
  id          TEXT PRIMARY KEY,
  taskId      TEXT NOT NULL REFERENCES tasks(id),
  batchId     TEXT NOT NULL REFERENCES task_batches(id),
  templateId  TEXT REFERENCES extraction_templates(id),
  data        TEXT NOT NULL, -- JSON: Record<string, unknown> (字段名 → 值)
  status      TEXT NOT NULL DEFAULT 'normal', -- normal | suspicious | failed
  sourceUrl   TEXT,
  screenshot  TEXT, -- base64 截图（可选）
  createdAt   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_results_task ON extraction_results(taskId);
CREATE INDEX idx_results_batch ON extraction_results(batchId);
```

**IPC Channels**

| Channel                 | 方向            | 说明                                    |
| ----------------------- | --------------- | --------------------------------------- |
| `result:list`           | renderer → main | 按筛选条件查询结果列表（分页）          |
| `result:detail`         | renderer → main | 获取单条结果详情                        |
| `result:export`         | renderer → main | 导出指定任务/批次的结果（返回文件路径） |
| `result:markSuspicious` | renderer → main | 标记结果为可疑                          |

---

## SPEC-A06：会话与登录态管理

| 属性   | 值                                 |
| ------ | ---------------------------------- |
| 模块   | 会话层                             |
| 优先级 | P1                                 |
| 目标   | 让任务在相对稳定的登录上下文中运行 |

**描述**

会话中心负责站点账号隔离、登录态复用、任务绑定会话，以及人工介入后继续沿用当前会话上下文。

**验收标准**

| 类型 | 标准                               |
| ---- | ---------------------------------- |
| 隔离 | 不同站点或账号可使用不同会话容器   |
| 绑定 | 任务可明确绑定指定会话             |
| 复用 | 常规执行可复用已存在登录态         |
| 续跑 | 人工接管后恢复执行时不丢失当前会话 |
| 提示 | 登录失效时有明确提示并可跳转介入台 |

**与 TabManager 衔接**

现有 `TabManager` 已支持 `sessionPartition`（`persist:xxx`）和 `createIsolatedTab()`（`temp:xxx`）。会话管理需在此基础上明确：

| 需求         | 方案                                                                                                     |
| ------------ | -------------------------------------------------------------------------------------------------------- |
| 持久化登录态 | 任务绑定会话一律使用 `persist:{sessionId}` 分区（非 `temp:`），Electron 自动持久化 cookie / localStorage |
| 会话容器注册 | 新增 `SessionRegistry` 管理会话元数据（id, name, domain, partition, createdAt），存入 DB                 |
| 任务绑定     | `TaskFlow.sessionId` 关联到 `SessionRegistry.id`；执行时 TabManager 使用对应 partition 创建 tab          |
| 临时会话     | 未绑定 session 的任务使用临时 `temp:` 分区（执行后销毁）                                                 |
| 登录失效检测 | 执行引擎在 extract 步骤中检查关键特征（如登录按钮是否出现），失败时标记 `loginExpired` 并触发介入通知    |

**数据模型**

```sql
CREATE TABLE sessions (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,        -- 如 '淘宝-账号A'
  domain      TEXT NOT NULL,        -- 关联域名
  partition   TEXT NOT NULL UNIQUE, -- 'persist:session_{id}'
  createdAt   TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt   TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**IPC Channels**

| Channel          | 方向            | 说明                                |
| ---------------- | --------------- | ----------------------------------- |
| `session:list`   | renderer → main | 获取会话列表                        |
| `session:create` | renderer → main | 创建新会话容器                      |
| `session:delete` | renderer → main | 删除会话（清除对应 partition 数据） |
| `session:bind`   | renderer → main | 将会话绑定到任务                    |

---

## SPEC-A07：告警、日志与复跑

| 属性   | 值                             |
| ------ | ------------------------------ |
| 模块   | 可观测性                       |
| 优先级 | P1                             |
| 目标   | 提高失败定位效率并缩短恢复路径 |

**描述**

系统需要对任务失败、超时、站点异常、提取异常给出明确告警，并让用户快速进入日志与复跑流程。

**验收标准**

| 类型 | 标准                                     |
| ---- | ---------------------------------------- |
| 告警 | 失败、超时、登录失效等关键事件有统一提示 |
| 日志 | 执行日志按任务、批次、步骤可检索         |
| 附件 | 关键失败场景保留截图或必要现场信息       |
| 复跑 | 用户可以从失败记录直接发起复跑           |
| 归因 | 常见失败原因可被分类展示                 |

**与现有 LogService 的关系**

现有 `LogService` 是文件级通用日志（按日轮转、7 天保留），不支持按任务/批次/步骤结构化检索。本 Spec 不替换 LogService，而是**新增结构化执行日志表**：

| 项                  | 说明                                                                                                 |
| ------------------- | ---------------------------------------------------------------------------------------------------- |
| `LogService`        | 继续承担应用级系统日志（启动、错误、IPC 调试等）                                                     |
| `execution_logs` 表 | 新增 DB 表，存储任务执行过程中的每步日志（含 taskId、batchId、stepIndex、level、message、timestamp） |
| 日志写入            | FlowRunner 执行每步前后写入 `execution_logs`，失败时附带 error + screenshot                          |
| 告警聚合            | 定期扫描最近 N 分钟内的 `level='error'` 日志，按 taskId 聚合后推送到渲染进程                         |

**数据模型**

```sql
CREATE TABLE execution_logs (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  taskId    TEXT NOT NULL,
  batchId   TEXT NOT NULL,
  stepIndex INTEGER,
  level     TEXT NOT NULL DEFAULT 'info', -- info | warn | error
  message   TEXT NOT NULL,
  metadata  TEXT, -- JSON: { screenshot?, selector?, errorType? }
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_execlog_task ON execution_logs(taskId, batchId);
CREATE INDEX idx_execlog_level ON execution_logs(level, createdAt);
```

**IPC Channels**

| Channel         | 方向            | 说明                              |
| --------------- | --------------- | --------------------------------- |
| `execlog:query` | renderer → main | 按任务/批次/步骤/级别查询执行日志 |
| `alert:list`    | renderer → main | 获取最近告警列表                  |
| `alert:dismiss` | renderer → main | 标记告警已读                      |
| `alert:pushed`  | main → renderer | 推送新告警通知（EventBus）        |

---

## SPEC-A08：稳定性与验收指标

| 属性   | 值                                 |
| ------ | ---------------------------------- |
| 模块   | 质量保障                           |
| 优先级 | P1                                 |
| 目标   | 为一期产品建立验收边界与稳定性标准 |

**描述**

本 Spec 不新增业务能力，而是定义一期必须达到的产品质量底线，确保系统可以作为日常工具使用。

**验收 Checklist**

> 所有条目全部通过方可视为一期验收完成。

| #   | 维度   | 验收场景                                          | 通过标准                                           |
| --- | ------ | ------------------------------------------------- | -------------------------------------------------- |
| 1   | 主链路 | 创建任务 → 手动执行 → 查看结果 → 导出             | 端到端可跑通，结果数据完整                         |
| 2   | 主链路 | 创建定时任务 → 等待触发 → 自动执行 → 批次记录生成 | cron 调度正确触发，批次状态流转正常                |
| 3   | 主链路 | 任务执行失败 → 接管页面 → 人工操作 → 恢复自动执行 | 恢复后从断点步骤继续，不重复已完成步骤             |
| 4   | 主链路 | 从失败批次发起复跑                                | 复跑执行独立批次，不影响历史批次记录               |
| 5   | 可观测 | 查看指定批次的执行日志                            | 日志按步骤逐条展示，失败步骤有 error 和截图        |
| 6   | 追溯   | 从结果条目跳转到批次 → 跳转到任务                 | 三级关联跳转可用                                   |
| 7   | 稳定性 | 1 个任务执行失败，另 2 个任务继续调度执行         | 单任务故障不阻塞调度队列                           |
| 8   | 稳定性 | 进程重启后，enabled 的定时任务自动恢复调度        | 重启后 30s 内调度器恢复正常                        |
| 9   | 性能   | 10,000 条结果批量查询                             | 列表渲染 < 2s，分页查询 < 500ms                    |
| 10  | 可扩展 | 新增一个 ActionType 不需要修改核心调度逻辑        | 仅需在 AutomationEngine.dispatchAction 中增加 case |

---

## 建议实现顺序

| 顺序 | Spec     | 原因                                         |
| ---- | -------- | -------------------------------------------- |
| 1    | SPEC-A01 | 先建立产品主入口与任务定义模型、DB 表结构    |
| 2    | SPEC-A02 | 跑通自动化核心执行闭环与调度能力             |
| 3    | SPEC-A03 | 在可运行基础上补上人工接管与断点恢复         |
| 4    | SPEC-A04 | 降低任务配置门槛，提升规则配置效率与模板复用 |
| 5    | SPEC-A05 | 让执行结果可见、可查、可回溯、可导出         |
| 6    | SPEC-A06 | 增强登录态稳定性与多账号支持                 |
| 7    | SPEC-A07 | 完善告警、结构化日志、复跑体验               |
| 8    | SPEC-A08 | 以统一验收 Checklist 完成一期验收            |

> **说明**：A05 已移除对 A04 的硬依赖（结果由执行引擎直接写入），但 A03 应排在 A04 之前（A04 依赖 A03 的浏览器能力进行交互式录制）。
