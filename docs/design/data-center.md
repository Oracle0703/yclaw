# YClaw 数据中心 — 数据出口中心设计方案

> **定位**：数据中心不是普通结果列表，而是 YClaw 自动化采集链路的“数据资产与出口层”。它把任务结果、批次、日志、Runner 运行上下文统一收口，提供可检索、可追溯、可导出、可推送、可被外部系统消费的数据能力。

---

## 目录

1. [设计目标](#1-设计目标)
2. [产品边界](#2-产品边界)
3. [页面信息架构](#3-页面信息架构)
4. [核心能力](#4-核心能力)
5. [技术架构](#5-技术架构)
6. [数据模型建议](#6-数据模型建议)
7. [IPC 与开放接口](#7-ipc-与开放接口)
8. [预留技能与插件点](#8-预留技能与插件点)
9. [分阶段实施计划](#9-分阶段实施计划)
10. [验收标准](#10-验收标准)
11. [非目标](#11-非目标)

---

## 1. 设计目标

### 1.1 核心问题

当前自动化主链路已具备任务、批次、结果、执行日志、远程 Runner 与容量调度雏形，但数据仍散落在自动化页面的局部面板里。

数据中心要解决三个问题：

| 问题 | 现状 | 数据中心目标 |
| --- | --- | --- |
| 结果难资产化 | 结果表只服务当前任务视角 | 跨任务、跨批次统一检索、详情、标记、导出 |
| 出口能力弱 | 基础 CSV/JSON 导出偏一次性 | 导出任务、历史记录、重试、Webhook、本地 API |
| 运行上下文割裂 | 结果、批次、日志、Runner 状态需要跨页面拼接 | 单条结果可追溯任务、批次、日志、Runner、来源 URL |

### 1.2 设计原则

```
原则一：数据先成为资产，再成为接口
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
先把结果、批次、日志、质量状态统一成可查询资产，再向外提供文件、API、Webhook。

原则二：出口必须可审计、可重试
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
任何对外导出或推送都应有任务记录、状态、错误、重试次数和最近执行时间。

原则三：插件化预留，但 P0 不依赖插件生态
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
先内置 CSV / JSON / JSONL / Webhook / Local API，接口边界按插件扩展方式设计。

原则四：服务自动化主线，不做泛 BI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
数据中心聚焦采集结果、执行上下文、出口任务和数据质量，不做复杂大屏或通用报表系统。
```

---

## 2. 产品边界

### 2.1 菜单定位

新增一级入口：`数据中心`。

推荐入口结构：

| 页面 | 优先级 | 作用 |
| --- | --- | --- |
| 数据总览 | P0 | 展示结果量、导出任务、失败出口、可疑数据、最近批次 |
| 结果资产 | P0 | 跨任务/批次检索结果，查看详情，追溯上下文 |
| 导出任务 | P0/P1 | 管理文件导出、Webhook 推送、本地 API 出口任务 |
| 数据集 | P1 | 将筛选条件保存为可复用数据集，供导出/API 使用 |
| 开放接口 | P1 | 管理本地 HTTP API、Webhook Endpoint、Token 与调用示例 |
| 数据质量 | P1.5 / P2 | 首版已支持扫描、规则启停、质量评分；后续再扩展复杂规则编辑 |
| 批次洞察 | P1.5 / P2 | 首版已支持批次质量分、Top 规则/字段、摘要；后续再扩展趋势与 Runner 关联 |

### 2.2 与现有模块关系

| 模块 | 关系 |
| --- | --- |
| `automation` | 仍负责任务编辑、执行、批次查看；局部结果表可跳转到数据中心 |
| `browser` | 仍负责浏览器介入、录制、现场恢复；数据中心只读取来源 URL / 截图 / 上下文 |
| `runner` | 远程 Runner 继续负责任务执行；数据中心读取 Runner 关联信息与远程结果回传摘要 |
| `ai-assistant` | 后续可读取数据中心上下文，回答“昨晚哪些数据异常 / 哪个出口失败最多” |
| `plugin-center` | 后续可安装自定义 Exporter、Quality Rule、Dataset Provider |

---

## 3. 页面信息架构

### 3.1 数据总览

目标：进入数据中心时给用户一个数据管道健康视图。

| 区域 | 内容 |
| --- | --- |
| 指标卡片 | 今日新增结果、可疑数据、导出成功率、Webhook 待重试、失败批次数 |
| 最近导出 | 最近 10 条导出任务状态、目标、格式、耗时、错误摘要 |
| 最近异常 | 可疑结果、失败出口、Schema 漂移、重复数据 |
| 快捷动作 | 新建导出任务、创建数据集、打开 API 设置、查看失败重试 |

### 3.2 结果资产

目标：把采集结果变成可检索、可解释、可操作的资产。

基础筛选：

- 任务、批次、模板、状态、时间范围、来源 URL、数据集
- 是否可疑、是否已导出、是否包含截图、字段名/字段值关键词
- 后续可扩展 Runner、队列、失败类型、质量规则命中

详情抽屉：

- 结果原始 JSON
- 字段表格视图
- 来源任务 / 批次 / 模板
- 来源 URL / 截图
- 关联执行日志
- 所属导出记录
- 质量标记与备注

### 3.3 导出任务

目标：把“点一下导出文件”升级为可持续的数据出口能力。

导出目标：

| 目标 | P0/P1 | 说明 |
| --- | --- | --- |
| 本地文件 | P0 | CSV / JSON / JSONL，支持重新导出 |
| Webhook | P1 | POST 到外部系统，支持签名、重试、超时 |
| 本地 HTTP API | P1 | 暴露只读查询接口，供 Notebook / BI / 脚本消费 |
| 远程 Runner 回传 | P1 | 接收远程 Runner 的结果摘要和文件路径，统一入库 |
| Parquet / DuckDB | P2 | 专业分析格式，后续按依赖体积和用户需求评估 |

任务状态：

| 状态 | 含义 |
| --- | --- |
| `pending` | 已创建，等待执行 |
| `running` | 正在导出或推送 |
| `succeeded` | 已成功完成 |
| `failed` | 已失败，等待人工处理或自动重试 |
| `retrying` | 正在重试 |
| `cancelled` | 用户取消 |

### 3.4 数据集

目标：把常用筛选条件保存成稳定的数据视图。

数据集包含：

- 名称、描述、数据源类型
- 查询条件：任务、批次、状态、时间范围、字段条件
- 输出字段映射：字段别名、字段顺序、脱敏规则
- 默认导出格式
- 是否允许 API 访问

P1 阶段先做“保存筛选视图”，P2 再做字段映射、脱敏与版本化。

### 3.5 开放接口

目标：让外部工具稳定消费 YClaw 数据。

首批接口建议：

| 接口 | 说明 |
| --- | --- |
| `GET /api/data-center/results` | 查询结果列表 |
| `GET /api/data-center/results/:id` | 查询结果详情 |
| `GET /api/data-center/datasets/:id/results` | 查询数据集结果 |
| `POST /api/data-center/exports` | 创建导出任务 |
| `GET /api/data-center/exports/:id` | 查询导出状态 |
| `POST /api/data-center/webhooks/test` | 测试 Webhook 配置 |

安全边界：

- 默认只监听 `127.0.0.1`
- API Token 明文只显示一次，落库保存哈希
- 写操作需要显式启用
- 高风险能力默认关闭，例如删除结果、批量清空导出记录

---

## 4. 核心能力

### 4.1 结果聚合

复用现有 `ResultService`，在其上增加数据中心聚合查询能力：

- 分页查询
- 时间范围筛选
- 状态筛选
- 字段关键词查询
- 任务 / 批次 / 模板关联
- 是否可疑 / 是否已导出

P0 可先从 `taskId`、`batchId`、`status`、`createdAt` 扩展开始；全文字段搜索可放 P1。

### 4.2 详情追溯

单条结果详情应能串起：

```
Result
  ├── Task
  ├── Batch
  ├── Template
  ├── Execution Logs
  ├── Source URL / Screenshot
  ├── Export Runs
  └── Runner Context（P1）
```

### 4.3 导出执行

导出不应直接阻塞 UI，而是进入导出任务队列：

```
用户创建导出任务
  → DataExportService 校验查询条件与目标
  → ExportJobRepository 创建 pending 记录
  → ExportWorker 执行
  → FileExporter / WebhookExporter / LocalApiPublisher
  → ExportAuditRepository 记录结果
  → UI 展示状态与错误
```

P0 可以先实现同步执行 + 持久化记录，P1 再升级为后台 worker 与重试队列。

### 4.4 Webhook 推送

Webhook 是数据中心从“文件导出”变成“数据管道”的关键能力。

建议能力：

- `POST` JSON payload
- 支持 Header 配置
- 支持 HMAC 签名
- 支持超时配置
- 支持失败重试和退避
- 支持测试发送
- 记录请求状态、响应码、错误摘要

示例 payload：

```json
{
  "event": "export.succeeded",
  "exportId": "exp_xxx",
  "datasetId": "ds_xxx",
  "resultCount": 1284,
  "format": "jsonl",
  "createdAt": "2026-04-21T10:00:00.000Z",
  "data": []
}
```

默认限制：

- 单次 payload 最大大小可配置，默认不超过 5MB
- 大数据量优先发送下载路径或分页 API 链接
- Webhook 失败不会影响原始结果入库

### 4.5 本地 HTTP API

本地 API 面向 Notebook、BI、脚本和外部 Agent。

P1 建议提供最小只读 API：

- 查询结果
- 查询结果详情
- 查询数据集结果
- 查询导出状态

后续再开放创建导出任务、触发重试等写操作。

### 4.6 数据质量

当前已具备首版只读扫描、规则启停、质量评分与批次洞察能力，基于结果状态、字段规则、分组规则和数据指纹发现空数据、失败结果、可疑状态与重复数据，不自动改写原始结果。后续再扩展为可视化复杂规则编排、长期趋势和更强洞察。

P0/P1 已预留结果状态：

- `normal`
- `suspicious`
- `failed`
- `ignored`

质量规则方向：

- 必填字段缺失
- 重复数据
- 数值范围异常
- URL / 时间格式异常
- Schema 漂移
- 与上一批次差异过大

当前首版实现已经落地：

- `RuleCompiler`：字段规则、状态规则、分组规则的编译执行
- `ResultRuleEngine`：生成可持久化的 finding
- `ScoreCalculator`：结果分 / 批次分
- `BatchInsightService`：Top 规则、Top 字段、失败率、摘要文案
- `data_quality_findings` / `data_quality_batch_insights`：复扫后可复盘的持久化表

---

## 5. 技术架构

### 5.1 前端入口

新增目录：

```text
src/renderer/entries/data-center/
├── App.tsx
├── main.tsx
├── components/
│   ├── DataOverview.tsx
│   ├── ResultAssetTable.tsx
│   ├── ResultDetailDrawer.tsx
│   ├── ExportJobTable.tsx
│   ├── DatasetList.tsx
│   ├── ApiAccessPanel.tsx
│   └── QualityRulePanel.tsx
└── styles.css
```

页面复用现有 `PageShell`、`useIpc`、Ant Design / ProComponents 风格，不单独引入新 UI 体系。

### 5.2 主进程服务

新增聚合层与出口层：

```text
src/main/services/data-center/
├── DataCenterService.ts
├── DataExportService.ts
├── DatasetService.ts
├── DataQualityService.ts
├── WebhookDeliveryService.ts
├── LocalDataApiService.ts
└── exporters/
    ├── CsvExporter.ts
    ├── JsonExporter.ts
    ├── JsonlExporter.ts
    └── WebhookExporter.ts
```

职责拆分：

| 服务 | 职责 |
| --- | --- |
| `DataCenterService` | 聚合结果、批次、日志、导出历史 |
| `DataExportService` | 创建导出任务、调度导出、重试、取消 |
| `DatasetService` | 保存和解析数据集查询条件 |
| `DataQualityService` | 执行质量扫描、汇总规则命中与问题样例 |
| `WebhookDeliveryService` | Webhook 签名、超时、重试、审计 |
| `LocalDataApiService` | 管理本地 HTTP API 生命周期 |

### 5.3 依赖关系

```text
Data Center Renderer
  → preload.dataCenter API
  → data-center IPC handlers
  → DataCenterService
      ├── ResultService
      ├── BatchService
      ├── ExecutionLogService
      ├── DataExportService
      ├── DatasetService
      └── DataQualityService
```

设计约束：

- `ResultService` 继续负责原始结果的保存与基础查询。
- `DataCenterService` 不替代 `ResultService`，只做组合查询和产品化聚合。
- `DataExportService` 不直接依赖渲染进程，后续可复用于 CLI / MCP / Remote Runner。
- 本地 API 与 Webhook 走显式配置，默认不自动启动。

---

## 6. 数据模型建议

### 6.1 导出任务表

```sql
CREATE TABLE data_export_jobs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  datasetId TEXT,
  query TEXT NOT NULL,
  targetType TEXT NOT NULL, -- file | webhook | local_api
  targetConfig TEXT NOT NULL,
  format TEXT NOT NULL, -- csv | json | jsonl
  status TEXT NOT NULL DEFAULT 'pending',
  resultCount INTEGER DEFAULT 0,
  outputPath TEXT,
  error TEXT,
  retryCount INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  startedAt TEXT,
  finishedAt TEXT
);

CREATE INDEX idx_data_export_jobs_status ON data_export_jobs(status, updatedAt);
CREATE INDEX idx_data_export_jobs_dataset ON data_export_jobs(datasetId);
```

### 6.2 导出审计表

```sql
CREATE TABLE data_export_audits (
  id TEXT PRIMARY KEY,
  exportJobId TEXT NOT NULL REFERENCES data_export_jobs(id),
  attempt INTEGER NOT NULL,
  status TEXT NOT NULL,
  targetType TEXT NOT NULL,
  requestSummary TEXT,
  responseSummary TEXT,
  error TEXT,
  createdAt TEXT NOT NULL
);

CREATE INDEX idx_data_export_audits_job ON data_export_audits(exportJobId, attempt);
```

### 6.3 数据集表

```sql
CREATE TABLE data_datasets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  query TEXT NOT NULL,
  fieldMapping TEXT,
  defaultFormat TEXT NOT NULL DEFAULT 'jsonl',
  apiEnabled INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
```

### 6.4 Webhook 配置表

```sql
CREATE TABLE data_webhook_targets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  headers TEXT,
  secretHash TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  timeoutMs INTEGER NOT NULL DEFAULT 10000,
  maxRetries INTEGER NOT NULL DEFAULT 3,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
```

### 6.5 API Token 表

```sql
CREATE TABLE data_api_tokens (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  tokenHash TEXT NOT NULL,
  scopes TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  lastUsedAt TEXT,
  createdAt TEXT NOT NULL,
  revokedAt TEXT
);
```

---

## 7. IPC 与开放接口

### 7.1 IPC Channels

建议新增：

| Channel | 方向 | 说明 |
| --- | --- | --- |
| `datacenter:overview` | renderer → main | 获取总览指标 |
| `datacenter:results:list` | renderer → main | 分页查询结果资产 |
| `datacenter:results:detail` | renderer → main | 查询结果详情与上下文 |
| `datacenter:datasets:list` | renderer → main | 查询数据集 |
| `datacenter:datasets:save` | renderer → main | 保存数据集 |
| `datacenter:exports:create` | renderer → main | 创建导出任务 |
| `datacenter:exports:list` | renderer → main | 查询导出任务 |
| `datacenter:exports:retry` | renderer → main | 重试导出任务 |
| `datacenter:exports:cancel` | renderer → main | 取消导出任务 |
| `datacenter:webhooks:test` | renderer → main | 测试 Webhook 目标 |
| `datacenter:api:status` | renderer → main | 查询本地 API 状态 |
| `datacenter:api:start` | renderer → main | 启动本地 API |
| `datacenter:api:stop` | renderer → main | 停止本地 API |
| `datacenter:exportupdated` | main → renderer | 导出任务状态变更事件 |

### 7.2 与现有 IPC 的关系

现有 `result:list`、`result:detail`、`result:export` 继续保留，用于自动化页面的轻量结果面板。

数据中心新增 channels 的原因：

- 需要分页、状态、时间范围、字段条件等更丰富查询
- 需要导出任务持久化和状态事件
- 需要数据集、Webhook、本地 API 等新实体

### 7.3 本地 API 权限

建议 Scope：

| Scope | 能力 |
| --- | --- |
| `results:read` | 查询结果列表与详情 |
| `datasets:read` | 查询数据集与数据集结果 |
| `exports:read` | 查询导出任务状态 |
| `exports:write` | 创建导出任务、重试导出 |
| `admin` | 管理 token、Webhook、API 状态 |

---

## 8. 预留技能与插件点

这里的“技能”指后续可由插件、AI 工具或 MCP 暴露的能力单元。P0 先定义接口边界，P1/P2 再开放注册机制。

### 8.1 `DataExporter`

用于扩展导出目标或格式。

```ts
interface DataExporter {
  id: string;
  label: string;
  formats: Array<'csv' | 'json' | 'jsonl' | string>;
  validate(config: unknown): Promise<void>;
  export(input: DataExportInput): Promise<DataExportOutput>;
}
```

内置实现：

- `csv-file-exporter`
- `json-file-exporter`
- `jsonl-file-exporter`
- `webhook-exporter`

后续插件可扩展：

- `parquet-exporter`
- `s3-exporter`
- `postgres-exporter`
- `notion-exporter`
- `feishu-sheet-exporter`

### 8.2 `DataQualityRule`

用于扩展质量检测规则。

```ts
interface DataQualityRule {
  id: string;
  label: string;
  evaluate(result: unknown, context: DataQualityContext): Promise<DataQualityFinding[]>;
}
```

内置规则：

- 必填字段缺失
- 重复记录
- 字段类型不匹配
- Schema 漂移

### 8.3 `DatasetProvider`

用于扩展数据源。

```ts
interface DatasetProvider {
  id: string;
  label: string;
  query(query: DatasetQuery): Promise<DatasetPage>;
}
```

内置数据源：

- `extraction-results`
- `execution-logs`
- `task-batches`

后续可扩展：

- 股票行情数据
- 插件自定义数据
- Snapshot Replay 存档
- Remote Runner 运行指标

### 8.4 AI / MCP 技能预留

后续可以把数据中心能力注册给 AI 助手和 MCP：

| 技能 | 说明 |
| --- | --- |
| `dataCenter.searchResults` | 搜索结果资产 |
| `dataCenter.explainResult` | 解释单条结果与日志上下文 |
| `dataCenter.createExport` | 创建导出任务，需预览确认 |
| `dataCenter.retryFailedExports` | 重试失败出口，需确认 |
| `dataCenter.inspectQuality` | 分析可疑数据和规则命中 |
| `dataCenter.summarizeBatchData` | 汇总某批次数据质量和失败原因 |

---

## 9. 分阶段实施计划

### 9.1 P0 — 结果资产与文件出口

目标：先把数据中心跑起来，形成独立菜单和结果资产闭环。

| 序号 | 任务 | 交付 |
| --- | --- | --- |
| P0-1 | 新增 `data-center` renderer entry | 工作台可打开数据中心 |
| P0-2 | 新增 `DataCenterService` 聚合查询 | 总览指标、结果分页、详情上下文 |
| P0-3 | 扩展结果查询能力 | 支持任务、批次、状态、时间范围筛选 |
| P0-4 | 新增结果资产表 | 分页、筛选、详情抽屉、可疑标记 |
| P0-5 | 新增 `DataExportService` 基础版 | CSV / JSON / JSONL 文件导出 |
| P0-6 | 新增导出任务表与审计表 | 导出记录、状态、输出路径、错误信息 |
| P0-7 | 新增导出任务页面 | 查看历史、重新导出、失败提示 |
| P0-8 | 自动化结果表联动 | 从 automation 跳转到数据中心并带筛选条件 |
| P0-9 | 单元测试与 IPC 测试 | 覆盖查询、导出、CSV 注入防护、错误状态 |

P0 完成标志：

- 用户能从一级菜单打开数据中心
- 能跨任务/批次查询结果
- 能打开结果详情并看到任务、批次、日志上下文
- 能创建文件导出任务并查看历史
- 能重新导出失败或已完成任务

### 9.2 P1 — 出口任务、Webhook、本地 API

目标：把数据中心变成可被外部系统消费的数据出口。

| 序号 | 任务 | 交付 |
| --- | --- | --- |
| P1-1 | 导出任务队列化 | pending/running/succeeded/failed/retrying 状态完整 |
| P1-2 | 失败重试策略 | 最大次数、退避、手动重试 |
| P1-3 | Webhook 目标管理 | URL、Headers、Secret、测试发送 |
| P1-4 | Webhook 执行与审计 | 响应码、错误摘要、attempt 记录 |
| P1-5 | 数据集保存 | 保存筛选条件，作为导出/API 输入 |
| P1-6 | 本地 HTTP API | 只读结果、数据集、导出状态接口 |
| P1-7 | API Token 管理 | token 创建、撤销、scope、lastUsedAt |
| P1-8 | Remote Runner 结果回传预留 | 接收远程结果摘要、文件路径、Runner 上下文 |
| P1-9 | AI / MCP 只读技能 | 查询结果、解释结果、查询导出状态 |

P1 完成标志：

- Webhook 能稳定推送数据并记录审计
- 外部脚本能通过本地 API 查询数据集
- 导出任务失败后可自动或手动重试
- Token 权限边界明确，默认只监听本机

### 9.3 P1.5 / P2 — 质量规则、批次洞察、专业出口

目标：增强数据可信度和专业用户分析能力。

| 序号 | 任务 | 交付 |
| --- | --- | --- |
| P1.5-1 | 数据质量规则引擎基础版 | 空数据、状态、重复、字段规则、分组规则 |
| P1.5-2 | 质量规则页面基础版 | 开启/关闭规则、查看命中、质量评分与批次洞察 |
| P1.5-3 | 质量评分基础版 | 结果分、批次分、扣分项 |
| P1.5-4 | 批次洞察基础版 | 失败率、Top 规则 / 字段、摘要 |
| P2-1 | 可视化复杂规则编排 | 图形化编辑器、条件嵌套、批次规则 |
| P2-2 | Runner 关联分析 | Runner、队列、lease、失败原因关联 |
| P2-3 | 字段映射与脱敏 | 数据集字段别名、输出顺序、脱敏 |
| P2-4 | Parquet / DuckDB 评估 | 按依赖体积和实际需求决定是否内置 |
| P2-5 | AI 写操作技能 | 创建导出、重试失败出口，必须预览确认 |

P2 完成标志：

- 用户能快速判断某批次数据是否可信
- 能看到失败和 Runner 状态之间的关系
- 数据集能按字段映射稳定输出

---

## 10. 验收标准

### 10.1 功能验收

| 能力 | 验收口径 |
| --- | --- |
| 独立入口 | 工作台能打开 `数据中心`，页面不依赖选中自动化任务 |
| 结果查询 | 支持分页、任务、批次、状态、时间范围筛选 |
| 详情追溯 | 单条结果能看到任务、批次、日志、来源 URL、截图 |
| 文件导出 | CSV / JSON / JSONL 可导出，导出记录持久化 |
| 导出审计 | 每次导出有状态、时间、结果数量、错误摘要 |
| Webhook | 支持测试发送、失败重试、审计记录 |
| 本地 API | 默认本机监听，Token 鉴权，能查询结果和导出状态 |
| 数据集 | 能保存筛选条件，并作为导出和 API 查询输入 |

### 10.2 稳定性验收

| 指标 | 目标 |
| --- | --- |
| 查询性能 | 1 万条结果分页查询 < 500ms |
| 导出可靠性 | 1 万条 JSONL 导出可成功完成并记录状态 |
| Webhook 重试 | 网络失败后按策略重试，最终状态可解释 |
| CSV 安全 | 继续保留公式注入防护 |
| API 安全 | 未授权请求拒绝，Token 不明文落库 |
| UI 可恢复 | 刷新页面后导出任务状态不丢失 |

### 10.3 文档验收

- `docs/design/data-center.md` 描述设计与分阶段路线
- 已新增 `docs/specs/data-center-v1.md` 作为验收规格
- 已新增 `docs/plans/data-center-v1.md` 作为实施计划
- 完成代码后将真实状态回写 `docs/overview/current-status.md`

---

## 11. 非目标

第一阶段不做：

- 云端团队协作和账号系统
- 通用 BI 大屏和复杂图表编排
- 跨设备同步
- 外网公开 API 默认开放
- 自动删除或清洗原始结果
- 插件市场分发
- 大规模数据仓库替代方案

这些能力都可以基于数据中心演进，但不应阻塞 P0/P1 的落地。

---

## 12. 决策结论

建议采用：

> **完整架构一次设计，实施分 P0/P1/P2 推进。**

近期最优先级：

1. 新建 `数据中心` 独立菜单
2. 做强结果资产和详情追溯
3. 将导出升级为持久化任务
4. 补齐 CSV / JSON / JSONL
5. 在 P1 完整实现 Webhook、本地 API、数据集与 Token

这样既能满足“现在有时间，尽量完整实现”的目标，又能保持工程边界清晰，避免一开始就陷入泛 BI 或云平台复杂度。
