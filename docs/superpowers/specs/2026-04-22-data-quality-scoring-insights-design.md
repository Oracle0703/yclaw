# Data Quality Scoring and Insights Design

> 状态：已批准进入实施计划。  
> 所属主线：`docs/specs/data-center-v1.md`  
> 关联设计：`docs/design/data-center.md`

---

## 1. 背景

`数据中心` 已具备结果资产、导出任务、Webhook、本地 API、API Token、数据质量一键扫描与默认规则启停能力。当前质量能力仍停留在“扫描结果 + 规则命中 + 问题样例”，还缺少三个生产化能力：

1. 复杂规则编排：把固定规则升级为可配置条件与规则组。
2. 质量评分：把规则命中转为可解释的 result / batch / task 分数。
3. 批次洞察：把单条结果质量汇总成批次级运营视图。

本设计把三者拆成连续层级：规则是事实源，评分是规则命中的函数结果，洞察是评分与 finding 的聚合。

---

## 2. 目标

- 支持复杂规则条件：状态、字段存在、字段空值、数值范围、字符串匹配、重复数据。
- 支持两层规则组合：`all` 与 `any`。
- 支持规则权重、严重级别、启停、参数持久化。
- 产出标准化 quality finding，供评分与洞察复用。
- 产出 result / batch / task 质量分与扣分解释。
- 产出批次洞察：问题率、严重级别分布、Top 规则、Top 字段、摘要文本。

---

## 3. 非目标

- 不做可视化拖拽规则编排器。
- 不允许用户自定义 JS 表达式。
- 不做无限嵌套规则树。
- 不做机器学习评分。
- 不做跨多批次长期趋势图。
- 不做跨任务复杂基线建模。

---

## 4. 架构

```text
QualityRuleRepository
  -> DataQualityService
      -> RuleCompiler
      -> ResultRuleEngine
      -> FingerprintBuilder
      -> ScoreCalculator
      -> BatchInsightService
          -> BatchComparator
          -> InsightSummaryBuilder
```

### 4.1 DataQualityService

作为 orchestration 层，负责：

- 加载启用规则。
- 调用规则引擎生成 findings。
- 调用评分器生成 result / batch / task score。
- 调用洞察服务生成 batch insight。
- 暴露 IPC 所需的主入口。

### 4.2 RuleCompiler

负责把数据库中的规则配置编译为可执行谓词。

支持条件字段：

- `ruleType`: `status | field-exists | field-empty | number-range | string-match | duplicate | group`
- `scope`: `result | batch`
- `fieldPath`: 例如 `data.price`
- `operator`: `exists | isEmpty | eq | ne | gt | gte | lt | lte | in | contains | regex`
- `expectedValue`
- `group`: `all | any`

### 4.3 ResultRuleEngine

负责执行 result 范围规则，输入结果列表和已编译规则，输出 findings。

标准 finding：

```ts
interface DataQualityFinding {
  id: string;
  ruleId: string;
  severity: 'warning' | 'error';
  resultId: string;
  taskId: string;
  batchId: string;
  message: string;
  fieldPath?: string;
  actualValue?: unknown;
  expectedValue?: unknown;
  scoreImpact: number;
  createdAt: string;
}
```

### 4.4 ScoreCalculator

负责把 findings 转成分数。

规则：

- 初始分 100。
- `error` 默认扣 `20 * weight`。
- `warning` 默认扣 `8 * weight`。
- 同一规则对同一结果只扣一次。
- 最低分 0。
- 输出扣分明细，保证可解释。

等级映射：

- `90-100`: `excellent`
- `75-89`: `good`
- `60-74`: `watch`
- `<60`: `risk`

### 4.5 BatchInsightService

负责批次级聚合：

- `batchScore`
- `totalResults`
- `issueCount`
- `affectedResults`
- `failedRate`
- `suspiciousRate`
- `duplicateRate`
- `topRules`
- `topFields`
- `severityBreakdown`
- `statusBreakdown`
- `scoreTrendHint`
- `summary`

首版只比较当前批次与同任务最近上一批。

---

## 5. 数据模型

### 5.1 扩展 `data_quality_rules`

新增字段：

- `rule_type TEXT`
- `scope TEXT`
- `field_path TEXT`
- `operator TEXT`
- `expected_value_json TEXT`
- `weight REAL DEFAULT 1`
- `group_json TEXT`

### 5.2 新增 `data_quality_findings`

用于记录扫描结果和评分依据。

关键字段：

- `id`
- `scan_id`
- `rule_id`
- `result_id`
- `task_id`
- `batch_id`
- `severity`
- `field_path`
- `message`
- `actual_value_json`
- `expected_value_json`
- `score_impact`
- `created_at`

### 5.3 新增 `data_quality_batch_insights`

用于缓存批次洞察。

关键字段：

- `id`
- `batch_id`
- `task_id`
- `score`
- `grade`
- `total_results`
- `issue_count`
- `affected_results`
- `failed_rate`
- `suspicious_rate`
- `duplicate_rate`
- `top_rules_json`
- `top_fields_json`
- `severity_breakdown_json`
- `status_breakdown_json`
- `trend_hint`
- `summary`
- `created_at`

---

## 6. IPC 契约

新增通道：

- `datacenter:quality:rules:saveAdvanced`
- `datacenter:quality:scan:detail`
- `datacenter:quality:score:batch`
- `datacenter:quality:insight:batch`

现有通道继续保留：

- `datacenter:quality:scan`
- `datacenter:quality:rules:list`
- `datacenter:quality:rules:save`

---

## 7. UI 设计

`数据质量` 标签页分为四块：

1. 质量总览：扫描结果数、问题数、影响结果数、平均分。
2. 规则配置：启停、权重、条件摘要。
3. 质量评分：批次分、等级、扣分来源。
4. 批次洞察：问题率、Top 规则、Top 字段、趋势提示、摘要。

首版不引入图表库，使用 Statistic、Table、Tag、Alert 即可。

---

## 8. 验收标准

- 可以保存高级规则配置。
- 可以执行状态、字段、数值、字符串、重复、组合规则。
- 扫描结果包含 findings 和 scoreImpact。
- 可以计算单批次质量分与等级。
- 可以查看批次洞察摘要。
- 禁用规则后，该规则不再影响 findings、评分和洞察。
- TypeScript 类型检查通过。
- data-center 定向测试通过。
