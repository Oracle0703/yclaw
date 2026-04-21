# Data Center V1

> 状态：P0 已可用，P1 已具备最小雏形。  
> 对应设计：`docs/design/data-center.md`  
> 对应实施计划：`docs/plans/data-center-v1.md`

---

## 1. 目标

`数据中心` 是自动化采集结果的统一收口模块，用于把分散在任务、批次、结果列表中的数据资产，沉淀为可查询、可导出、可复用、可开放的模块化能力。

V1 聚焦三个直接可落地的目标：

1. 把采集结果升级为可筛选、可查看详情的结果资产视图
2. 把导出从一次性操作升级为可追踪、可重试的持久化任务
3. 为后续 webhook、质量规则、外部消费预留统一的数据出口边界

---

## 2. 范围

### 2.1 In Scope

- 新增独立模块入口：`data-center`
- 结果资产总览、结果列表、结果详情抽屉
- 持久化导出任务表与审计表
- `csv` / `json` / `jsonl` 三种文件导出
- `webhook` 目标导出与失败重试
- 失败导出任务重试
- 数据集保存与列表展示
- 本地只读 API 的启动、停止、状态查询
- 本地只读 API 的 token 校验预留
- Webhook 目标列表与保存入口
- Webhook 连通性测试入口
- Webhook 编辑 / 删除入口
- API Token 列表与一次性生成入口
- API Token 吊销入口
- API Token scope 模板入口
- 数据质量一键扫描入口
- 自动化页增加“打开数据中心”跳转入口

### 2.2 Out of Scope

- 可视化拖拽式规则编排器
- 长周期趋势图与历史对比看板
- 外部多租户访问与公网暴露

以下能力已具备最小可用形态，但尚未进入完整治理：

- API Token 更细粒度权限治理与审计
- Webhook 更完整配置治理（自定义请求头、超时、重试策略等）
- 复杂规则编辑器、长期趋势图与更细粒度批次对比

---

## 3. 信息架构

`数据中心` 页面当前包含 7 个标签页：

- `数据总览`：结果量、可疑结果数、失败导出数、最近导出
- `结果资产`：结果列表、结果详情、快速创建 JSONL 导出
- `导出任务`：导出任务列表、状态筛选、取消任务、失败任务重试、手动创建导出
- `数据集`：数据集列表、最小保存入口
- `Webhook`：目标列表、保存/编辑、连通性测试、删除
- `开放接口`：本地只读 API 状态与启动/停止
- `数据质量`：一键扫描、规则命中、问题样例、结果评分、批次洞察

---

## 4. 核心能力

### 4.1 结果资产

- 基于 `ResultService` 聚合任务结果
- 支持按 `taskId`、`batchId`、时间范围、状态、关键词做查询过滤
- 支持查看单条结果详情，附带所属批次、执行日志、关联导出任务

### 4.2 导出任务

- 所有导出以 `data_export_jobs` 表持久化
- 每次导出都有标准状态流转：`pending` → `running` → `succeeded` / `failed`
- 失败任务支持基于原始查询与导出配置重试，重试态记为 `retrying`
- 支持取消 `pending` / `running` / `retrying` 状态任务，取消态记为 `cancelled`
- 导出审计写入 `data_export_audits`
- 当 `targetType=webhook` 时，导出链路走 `WebhookExporter`，并带 HMAC 签名能力

### 4.3 数据集

- 数据集将一组查询条件固化为可复用对象
- V1 支持保存数据集、查询数据集列表、标记是否允许 API 暴露
- 后续可演进为字段映射、脱敏规则、默认出口模板

### 4.4 本地只读 API

V1 提供本机只读 HTTP 服务，默认监听 `127.0.0.1`。

当前开放端点：

- `GET /health`
- `GET /datasets`
- `GET /results?page=1&pageSize=20&taskId=&batchId=`
- `GET /exports?page=1&pageSize=20`

用途：

- 本地脚本读取采集结果
- 为后续远程 Runner / webhook / MCP 工具预留统一出口协议
- 在不直接触碰 SQLite 的前提下暴露稳定只读接口

当注入 token verifier 后，请求需要 `Authorization: Bearer <token>`，并校验 `results:read` scope。

### 4.5 Webhook 与 Token 治理

- Webhook 目标支持列表、保存、编辑回填、连通性测试、删除
- API Token 支持一次性明文签发、列表查看、scope 模板、吊销
- Token 落库仅保存哈希值，明文只在签发时返回一次

### 4.6 数据质量扫描

- `DataQualityService` 基于 `ResultService` 扫描采集结果，不改写原始数据
- 首批内置规则：空数据、失败结果、可疑状态、重复数据指纹
- 支持规则配置持久化，可启用 / 停用默认规则，并为高级规则字段预留持久化结构
- 扫描结果返回总量、问题数、影响结果数、规则命中、问题样例、结果评分与批次洞察
- 扫描过程会持久化 findings 与 batch insight，便于后续查询和复盘
- 已具备复杂规则基础结构：字段规则、状态规则、分组规则、重复指纹规则

---

## 5. 存储模型

V1 新增以下 SQLite 表：

- `data_export_jobs`
- `data_export_audits`
- `data_datasets`
- `data_webhook_targets`
- `data_api_tokens`
- `data_quality_rules`
- `data_quality_findings`
- `data_quality_batch_insights`

当前实际已接入的主链路表：

- `data_export_jobs`
- `data_export_audits`
- `data_datasets`
- `data_webhook_targets`
- `data_api_tokens`
- `data_quality_rules`
- `data_quality_findings`
- `data_quality_batch_insights`

---

## 6. 主进程边界

### 6.1 Services

- `DataCenterService`：结果聚合、总览、详情拼装
- `DataExportService`：导出任务创建、执行、重试
- `DatasetService`：数据集保存与查询
- `LocalDataApiService`：本地只读 API 生命周期
- `WebhookDeliveryService`：Webhook 投递、签名、重试、审计
- `WebhookTargetService`：Webhook 目标保存、测试、删除
- `ApiTokenService`：Token 签发、列表、吊销
- `DataQualityService`：结果质量扫描、规则命中汇总、问题样例生成
- `RuleCompiler`：把规则配置编译为可执行谓词
- `ResultRuleEngine`：执行结果级规则并产出 findings
- `ScoreCalculator`：计算结果分与批次分
- `BatchInsightService`：生成批次洞察摘要

### 6.2 Repositories

- `DataExportJobRepository`
- `DataDatasetRepository`
- `DataWebhookTargetRepository`
- `DataApiTokenRepository`
- `DataQualityRuleRepository`
- `DataQualityFindingRepository`
- `DataQualityBatchInsightRepository`

---

## 7. IPC 契约

V1 已落地下列 IPC 通道：

- `datacenter:overview`
- `datacenter:results:list`
- `datacenter:results:detail`
- `datacenter:exports:create`
- `datacenter:exports:list`
- `datacenter:exports:retry`
- `datacenter:exports:cancel`
- `datacenter:datasets:list`
- `datacenter:datasets:save`
- `datacenter:webhooks:list`
- `datacenter:webhooks:save`
- `datacenter:webhooks:test`
- `datacenter:webhooks:delete`
- `datacenter:apitokens:list`
- `datacenter:apitokens:create`
- `datacenter:apitokens:revoke`
- `datacenter:api:status`
- `datacenter:api:start`
- `datacenter:api:stop`
- `datacenter:quality:scan`
- `datacenter:quality:score:batch`
- `datacenter:quality:insight:batch`
- `datacenter:quality:rules:list`
- `datacenter:quality:rules:save`
- `datacenter:exportupdated`

---

## 8. 验收标准

### 8.1 P0

- 可以从工作台进入 `数据中心`
- 可以看到结果总览、结果列表、导出任务列表
- 可以查看单条结果详情
- 可以创建 `jsonl` 导出任务
- 导出任务可持久化并展示状态
- 失败导出任务可以重试
- 自动化采集页可打开 `数据中心`

### 8.2 P1

- 可以保存数据集
- 可以查看数据集列表
- 可以启动 / 停止本地只读 API
- 本地 API 可读取 `results`、`datasets`、`exports`
- 可以保存 Webhook 目标
- 可以查看 Webhook 目标列表
- 可以测试 Webhook 连通性
- 可以编辑 / 删除 Webhook 目标
- 可以生成一次性明文 API Token
- 可以查看 API Token 列表
- 可以吊销已签发的 API Token
- 可以通过 scope 模板快速生成 Token scope
- 可以通过弹窗手动创建导出任务
- 可以按状态筛选导出任务
- 可以取消 `pending/running/retrying` 状态导出任务
- Webhook 导出链路具备底层可用雏形
- API token 校验具备底层可用雏形

### 8.3 P1.5

- 可以在 `数据质量` 标签页点击“立即扫描”
- 可以看到扫描结果总数、质量问题数、影响结果数
- 可以看到空数据、失败结果、可疑状态、重复数据的规则命中
- 可以查看问题样例的结果 ID、任务 ID、批次 ID 与说明
- 可以看到默认质量规则列表
- 可以启用 / 停用单条质量规则，并影响后续扫描结果
- 可以看到结果级质量评分与扣分项
- 可以看到批次质量分、Top 规则、Top 字段与摘要文案
- 可以通过 IPC 查询指定批次的质量分与批次洞察

---

## 9. 当前实现结论

截至 `2026-04-22`，本规格的实现状态为：

- P0：已可用
- P1：已具备最小可运行雏形
- P1.5：数据质量一键扫描、规则启停、质量评分与批次洞察已具备首版可用雏形
- P2：复杂规则编辑器、长期趋势与专业洞察仍未进入完整实现

这意味着 `数据中心` 已经可以作为当前产品中的一个独立可用模块继续迭代，而不是停留在纯设计阶段。
