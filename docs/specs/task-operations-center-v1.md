# 📦 YClaw 小团队任务运营中台 Spec（V1）

> 范围：聚焦“任务运营中台”的产品层与业务层能力，面向 3~20 人小团队。
> 说明：本文件在现有自动化、Runner、结果、日志、AI、插件能力之上，补充协作、审核、值班、告警处理、复盘沉淀等中台级规格。
> 关联文档：`docs/product/task-operations-center.md`、`docs/specs/automation-browser-ops-v1.md`、`docs/specs/remote-runner-control-plane-v1.md`、`docs/specs/capacity-aware-runner-scheduler-v1.md`。

---

## 实施回写（截至 2026-04-21）

| Spec | 当前状态 | 说明 |
| --- | --- | --- |
| SPEC-T01 工作区与角色 | 部分基础已落地 | 已有工作区模型、成员角色、服务层与切换组件，并补充班次记录、当前/下一班解析、升级负责人解析、工作区展示与轻量班次安排面板，审计留痕与更细权限仍待补齐 |
| SPEC-T02 任务版本与审核 | 基础版已落地 | 已有任务版本、审核、发布、当前版本标记、版本差异对比和自动化页入口，更细粒度字段对比仍待扩展 |
| SPEC-T03 执行运营中心 | 基础版已落地 | 任务、批次、结果、Remote Runner、调度面板已具备基础链路 |
| SPEC-T04 告警与值班中心 | 部分基础已落地 | 已补告警认领、转交、备注、升级、关闭、状态字段、动作历史存储与面板回看，并支持按工作区默认值班员自动指派与超时自动升级，更完整班次日历仍待继续完善 |
| SPEC-T05 结果中心与证据链 | 基础版已落地 | 已补质量状态、证据链引用、版本追溯、跨批次质量分析、必填字段与最小批次数量校验 |
| SPEC-T06 复盘与模板资产中心 | 部分基础已落地 | 已有复盘记录、Review 面板、模板关联、回流建议、可执行回流草稿、草稿应用到模板治理、选择器字段自动改写、模板版本/废弃/说明/插件依赖治理与后续动作沉淀，更复杂字段映射待继续扩展 |
| SPEC-T07 AI 运营副驾驶 | 部分基础已落地 | 已新增任务摘要、告警摘要、Runner 状态、复盘初稿工具，并接入真实中台上下文 |
| SPEC-T08 指标与验收 | 基础版已落地 | 已补统一验收指标服务与 `ops:acceptance:metrics` 接口，自动化页选中任务后展示真实验收指标 |

---

## 文档定位

| 项目 | 说明 |
| --- | --- |
| 文档属性 | 任务运营中台专项规格 |
| 目标问题 | 回答“中台需要交付哪些可验收能力” |
| 与现有 spec 关系 | 扩展而不替代现有自动化、Runner、结果、AI 专项 spec |
| 适用阶段 | V1.5 规划与 V2.0 平台化前置拆解 |
| 对应实施计划 | `docs/plans/task-operations-center-v1.md` |

---

## 与现有 Spec 关系映射

| 本文 Spec | 关联旧 Spec / 专项 | 关系 | 说明 |
| --- | --- | --- | --- |
| SPEC-T01 | `v1.0-baseline.md` SPEC-007、SPEC-009 | 扩展 | 在配置与工作台基础上增加工作区、角色、责任归属 |
| SPEC-T02 | `automation-browser-ops-v1.md` SPEC-A01 | 扩展 | 在任务底座上增加版本、审核、发布、归档 |
| SPEC-T03 | SPEC-A02、`remote-runner-control-plane-v1.md`、`capacity-aware-runner-scheduler-v1.md` | 扩展 | 将调度和执行能力产品化为执行运营中心 |
| SPEC-T04 | SPEC-A07 | 扩展 | 在告警与日志能力上增加认领、升级、交接和值班流 |
| SPEC-T05 | SPEC-A05 | 扩展 | 在结果列表基础上增加质量校验、证据链与追溯 |
| SPEC-T06 | SPEC-A04、SPEC-A05、SPEC-A07 | 扩展 | 将模板、结果、日志、复盘结论串成资产闭环 |
| SPEC-T07 | `v1.1-enhancements.md` SPEC-026、SPEC-027 | 扩展 | AI 从基础聊天升级为运营副驾驶 |
| SPEC-T08 | 全部相关 spec | 新增 | 统一中台验收指标与质量边界 |

---

## Spec 总览

| ID | 标题 | 模块 | 优先级 | 依赖 |
| --- | --- | --- | :---: | --- |
| SPEC-T01 | 工作区与角色模型 | 协作基础层 | P0 | SPEC-007、SPEC-009 |
| SPEC-T02 | 任务版本、审核与发布 | 任务资产层 | P0 | SPEC-A01、SPEC-T01 |
| SPEC-T03 | 执行运营中心 | 运营层 | P0 | SPEC-A02、SPEC-T02 |
| SPEC-T04 | 告警与值班中心 | 运营层 | P0 | SPEC-A07、SPEC-T03 |
| SPEC-T05 | 结果中心与证据链 | 结果层 | P1 | SPEC-A05、SPEC-T03 |
| SPEC-T06 | 复盘与模板资产中心 | 资产层 | P1 | SPEC-T05、SPEC-A04、SPEC-A07 |
| SPEC-T07 | AI 运营副驾驶 | 智能层 | P1 | SPEC-026、SPEC-027、SPEC-T03、SPEC-T05 |
| SPEC-T08 | 指标与验收基线 | 质量层 | P1 | SPEC-T01 ~ SPEC-T07 |

---

## SPEC-T01：工作区与角色模型

| 属性 | 值 |
| --- | --- |
| 模块 | 协作基础层 |
| 优先级 | P0 |
| 目标 | 建立小团队任务运营的协作边界、角色边界和责任归属 |

**描述**

工作区是中台的基础协作容器，负责承载成员、默认 Runner 策略、任务标签、通知策略与审计边界。

**验收标准**

| 类型 | 标准 |
| --- | --- |
| 工作区 | 支持创建、编辑、切换工作区 |
| 角色 | 至少支持负责人、编辑者、值班员、查看者四类角色 |
| 归属 | 每个任务、告警、复盘记录均可明确责任人 |
| 值班策略 | 工作区可解析当前值班员、升级负责人和自动升级时限 |
| 班次记录 | 支持存储工作区值班班次，并解析当前班与下一班，自动化页可快速新增班次 |
| 默认策略 | 工作区级可配置默认 Runner 策略、通知规则和标签分类 |
| 留痕 | 角色变更、负责人变更、交接操作都有审计记录 |

**数据模型**

```sql
CREATE TABLE workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  defaultRunnerPolicy TEXT,
  notificationPolicy TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE workspace_members (
  id TEXT PRIMARY KEY,
  workspaceId TEXT NOT NULL REFERENCES workspaces(id),
  name TEXT NOT NULL,
  role TEXT NOT NULL, -- owner | editor | operator | viewer
  status TEXT NOT NULL DEFAULT 'active',
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**IPC Channels**

| Channel | 方向 | 说明 |
| --- | --- | --- |
| `workspace:list` | renderer → main | 获取工作区列表 |
| `workspace:create` | renderer → main | 创建工作区 |
| `workspace:update` | renderer → main | 更新工作区配置 |
| `workspace:duty:get` | renderer → main | 获取当前值班策略 |
| `workspace:duty:shift:list` | renderer → main | 获取工作区班次记录 |
| `workspace:duty:shift:save` | renderer → main | 新增或更新工作区班次 |
| `workspace:member:list` | renderer → main | 获取成员列表 |
| `workspace:member:updateRole` | renderer → main | 更新成员角色 |

---

## SPEC-T02：任务版本、审核与发布

| 属性 | 值 |
| --- | --- |
| 模块 | 任务资产层 |
| 优先级 | P0 |
| 目标 | 让任务从“可执行配置”升级为“可发布、可追踪、可回退的团队资产” |

**描述**

在现有任务 CRUD 和任务流底座之上，引入版本、审核、发布、归档机制，避免直接在运行任务上无审计地修改。

**验收标准**

| 类型 | 标准 |
| --- | --- |
| 版本 | 每次发布形成独立任务版本 |
| 审核 | 高风险任务或高权限插件组合发布前必须审核 |
| 对比 | 支持查看版本变更摘要，并可对比前后版本差异 |
| 回看 | 历史批次可关联到执行时的任务版本 |
| 归档 | 任务支持下线、归档、重新发布 |

**状态机**

| 状态 | 含义 | 可流转到 |
| --- | --- | --- |
| 草稿 | 编辑中 | 待审核、已废弃 |
| 待审核 | 等待负责人确认 | 已发布、退回修改 |
| 已发布 | 可执行 | 暂停中、已下线 |
| 暂停中 | 临时停止调度 | 已发布、已下线 |
| 已下线 | 不再接受新批次 | 已归档、重新发布 |
| 已归档 | 保留历史资产 | 重新发布 |

**数据模型**

```sql
CREATE TABLE task_revisions (
  id TEXT PRIMARY KEY,
  taskId TEXT NOT NULL REFERENCES tasks(id),
  version TEXT NOT NULL,
  snapshot TEXT NOT NULL,
  changeSummary TEXT,
  reviewStatus TEXT NOT NULL DEFAULT 'draft', -- draft | pending | approved | rejected
  reviewer TEXT,
  createdBy TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**IPC Channels**

| Channel | 方向 | 说明 |
| --- | --- | --- |
| `task:revision:list` | renderer → main | 获取任务版本列表 |
| `task:revision:publish` | renderer → main | 发布新版本 |
| `task:revision:review` | renderer → main | 审核通过 / 驳回 |
| `task:revision:compare` | renderer → main | 获取版本差异摘要 |

---

## SPEC-T03：执行运营中心

| 属性 | 值 |
| --- | --- |
| 模块 | 运营层 |
| 优先级 | P0 |
| 目标 | 将任务、批次、Runner、调度、实例统一收敛为运营工作台 |

**描述**

执行运营中心是值班员和负责人日常使用的主界面，关注“现在在跑什么、哪里卡住了、资源够不够、下一步要处理什么”。

**验收标准**

| 类型 | 标准 |
| --- | --- |
| 总览 | 可查看排队中、运行中、待介入、最近失败批次 |
| Runner | 可查看本地 / 远程 Runner 健康、容量、占用率 |
| 批次 | 每个批次可查看任务版本、触发来源、执行路径、异常节点 |
| 干预 | 支持暂停、继续、重试、终止、跳转介入台 |
| 解释性 | 可查看为何被分配到某个 Runner、为何排队或失败 |

**页面建议**

| 区域 | 内容 |
| --- | --- |
| 顶部指标 | 今日成功率、失败数、待处理告警、Runner 可用率 |
| 队列区 | 待执行队列、优先级、预计等待时间 |
| 执行区 | 当前运行批次、当前步骤、占用 Runner |
| 异常区 | 待介入批次、最近失败、超时任务 |
| 资源区 | Runner 池、scoreBreakdown、lease 状态 |

**IPC Channels**

| Channel | 方向 | 说明 |
| --- | --- | --- |
| `ops:dashboard:summary` | renderer → main | 获取执行运营总览数据 |
| `ops:batch:timeline` | renderer → main | 获取批次时间线 |
| `ops:runner:allocation:reason` | renderer → main | 获取某次分配解释 |

---

## SPEC-T04：告警与值班中心

| 属性 | 值 |
| --- | --- |
| 模块 | 运营层 |
| 优先级 | P0 |
| 目标 | 让告警可认领、可升级、可交接、可关闭，而不是只停留在“有错误提示” |

**描述**

在现有告警聚合基础上增加处理流程，使值班工作可管理、可追责、可交接。

**验收标准**

| 类型 | 标准 |
| --- | --- |
| 分级 | 至少支持 info / warning / critical |
| 认领 | 告警支持认领和转交 |
| 升级 | 超时未处理或高风险异常可升级，支持基于工作区时限自动升级 |
| 备注 | 每次处理动作可附备注 |
| 关闭 | 告警关闭前必须填写处理结论 |

**状态机**

| 状态 | 含义 | 可流转到 |
| --- | --- | --- |
| 新告警 | 刚被系统发现 | 已认领、已忽略 |
| 已认领 | 已有处理人 | 处理中、已升级 |
| 处理中 | 正在介入 | 已恢复、已关闭、已升级 |
| 已升级 | 升级给负责人 | 处理中、已关闭 |
| 已恢复 | 对应任务已恢复 | 已关闭 |
| 已关闭 | 流程结束 | — |

**数据模型**

```sql
CREATE TABLE alerts (
  id TEXT PRIMARY KEY,
  workspaceId TEXT,
  taskId TEXT,
  batchId TEXT,
  level TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  assignee TEXT,
  summary TEXT NOT NULL,
  detail TEXT,
  resolution TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE alert_actions (
  id TEXT PRIMARY KEY,
  alertId TEXT NOT NULL REFERENCES alerts(id),
  action TEXT NOT NULL, -- claim | assign | escalate | recover | close
  operator TEXT,
  note TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**IPC Channels**

| Channel | 方向 | 说明 |
| --- | --- | --- |
| `alert:claim` | renderer → main | 认领告警 |
| `alert:assign` | renderer → main | 转交告警 |
| `alert:note` | renderer → main | 补充处理备注 |
| `alert:escalate` | renderer → main | 升级告警 |
| `alert:close` | renderer → main | 关闭告警 |
| `alert:action:list` | renderer → main | 获取处理历史 |

---

## SPEC-T05：结果中心与证据链

| 属性 | 值 |
| --- | --- |
| 模块 | 结果层 |
| 优先级 | P1 |
| 目标 | 让结果不仅“能看”，还“能证明、能追溯、能校验” |

**描述**

结果中心在现有结果列表基础上增加质量校验、异常标注和证据链关联，用于支撑运营验收与复盘。

**验收标准**

| 类型 | 标准 |
| --- | --- |
| 聚合 | 支持按任务、批次、站点、时间区间查看 |
| 校验 | 支持字段缺失、数量异常、阈值偏差等规则；基础版已支持必填字段与最小批次数量校验 |
| 跨批次分析 | 支持按任务聚合多个批次的结果数量、失败数、字段缺失数与追溯完整数 |
| 证据链 | 每条结果可关联日志、截图、步骤、页面上下文 |
| 导出 | 支持 CSV / JSON / 调试包导出 |
| 追溯 | 支持从结果跳回任务、批次、任务版本 |

**扩展字段建议**

| 字段 | 说明 |
| --- | --- |
| `qualityStatus` | `passed` / `warning` / `failed` |
| `evidenceRefs` | 日志、截图、快照等引用 |
| `revisionId` | 结果对应的任务版本 |

**IPC Channels**

| Channel | 方向 | 说明 |
| --- | --- | --- |
| `result:quality:analyze` | renderer → main | 按任务执行跨批次质量分析，支持 `requiredFields` 与 `minBatchResultCount` 规则 |

---

## SPEC-T06：复盘与模板资产中心

| 属性 | 值 |
| --- | --- |
| 模块 | 资产层 |
| 优先级 | P1 |
| 目标 | 把失败经验从“聊天记录”沉淀为“可复用资产” |

**描述**

复盘中心承接失败批次、连续异常、人工介入记录，并把结论反哺到模板、选择器规则、插件配置和调度策略。

**验收标准**

| 类型 | 标准 |
| --- | --- |
| 复盘记录 | 支持记录原因分类、结论、负责人、后续动作 |
| 触发规则 | 连续失败达到阈值时自动进入待复盘 |
| 资产回流 | 复盘结论可关联模板更新或规则修复任务，并生成包含风险等级、变更项、执行步骤和验收标准的回流草稿，草稿可应用到模板治理记录，选择器类变更可自动改写目标字段 |
| 模板治理 | 模板支持版本、废弃、适用说明、依赖插件说明，模板列表可展示治理元数据并快速标记废弃 |

**数据模型**

```sql
CREATE TABLE task_reviews (
  id TEXT PRIMARY KEY,
  taskId TEXT NOT NULL,
  batchId TEXT,
  reviewType TEXT NOT NULL, -- failure | quality | strategy
  reasonCategory TEXT,
  conclusion TEXT,
  owner TEXT,
  followUpActions TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**IPC Channels**

| Channel | 方向 | 说明 |
| --- | --- | --- |
| `review:create` | renderer → main | 创建复盘记录 |
| `review:list` | renderer → main | 获取复盘记录列表 |
| `review:templateBackflow:suggest` | renderer → main | 根据复盘后续动作生成模板回流建议 |
| `review:templateBackflow:draft` | renderer → main | 根据复盘结论生成可执行模板回流草稿 |
| `template:backflow:apply` | renderer → main | 将回流草稿应用到模板治理并关联复盘 |
| `template:linkReview` | renderer → main | 关联模板与复盘 |

---

## SPEC-T07：AI 运营副驾驶

| 属性 | 值 |
| --- | --- |
| 模块 | 智能层 |
| 优先级 | P1 |
| 目标 | 让 AI 从“聊天面板”升级为“任务运营助手” |

**描述**

AI 运营副驾驶不追求泛聊天，而聚焦于任务状态问答、失败摘要、处理建议、复盘初稿与风险提醒。

**验收标准**

| 类型 | 标准 |
| --- | --- |
| 问答 | 能查询任务状态、Runner 健康、最近失败原因 |
| 摘要 | 能总结某任务近 N 次失败的共性问题 |
| 建议 | 能给出重试、切换 Runner、介入、模板修复建议 |
| 复盘 | 能基于日志和结果生成复盘初稿 |
| 风险提醒 | 高权限任务发布前给出风险提示 |

**建议工具集**

| 工具 | 说明 |
| --- | --- |
| `ops_task_summary` | 汇总任务近况、负责人、成功率 |
| `ops_alert_summary` | 汇总当前严重告警与超时未认领项 |
| `ops_runner_status` | 查询 Runner 健康、容量与最近失败率 |
| `ops_review_draft` | 基于批次、日志、结果生成复盘初稿 |

---

## SPEC-T08：指标与验收基线

| 属性 | 值 |
| --- | --- |
| 模块 | 质量层 |
| 优先级 | P1 |
| 目标 | 为任务运营中台建立统一的业务验收口径 |

**验收指标**

| 指标 | 目标 | 验证方式 |
| --- | --- | --- |
| 任务执行成功率 | 成功批次占比 ≥ 90% | `ops:acceptance:metrics` 基于批次状态统计 |
| 告警认领及时率 | 严重告警 10 分钟内认领率 ≥ 95% | 告警处理时延统计 |
| 结果追溯完整率 | 95% 以上结果可追溯到任务 / 批次 / 日志 / 截图 | 抽样复核 |
| 复盘资产回流率 | 80% 以上复盘记录关联模板或规则修复动作 | 复盘后续动作统计 |
| 任务交接完整率 | 95% 以上交接记录包含处理进展与下一步建议 | 交接记录抽样 |
| 模板复用率 | 新建任务中 50% 以上来自模板复制 | 新建任务来源统计 |
| AI 辅助有效率 | 50% 以上失败批次可生成可采纳摘要或建议 | 人工评审抽样 |

**指标接口**

| Channel | 方向 | 说明 |
| --- | --- | --- |
| `ops:acceptance:metrics` | renderer → main | 返回任务成功率、告警认领及时率、结果追溯完整率、复盘资产回流率；支持按 `taskId` 收敛到选中任务 |

**一期验收 Checklist**

| # | 场景 | 通过标准 |
| --- | --- | --- |
| 1 | 创建工作区并配置成员角色 | 工作区、角色、默认策略可保存并生效 |
| 2 | 任务从草稿提交审核并发布 | 形成任务版本，审核与发布留痕完整 |
| 3 | 执行中心查看排队、运行、失败与 Runner 状态 | 关键状态可在单一界面查看 |
| 4 | 严重告警认领、升级、关闭 | 告警全流程留痕可追踪 |
| 5 | 从结果跳回批次、日志、截图并查看跨批次质量分析 | 证据链完整，质量分析能暴露字段缺失与批次数量异常 |
| 6 | 连续失败任务触发复盘并回流模板 | 复盘记录与模板更新建立关联，并可产出和应用可执行回流草稿 |
| 7 | AI 对失败批次给出摘要和建议 | 生成内容能引用真实任务上下文 |
| 8 | 自动化页展示选中任务验收指标 | 指标来自 `ops:acceptance:metrics`，口径与服务端一致 |

---

## 建议实现顺序

| 顺序 | Spec | 原因 |
| --- | --- | --- |
| 1 | SPEC-T01 | 先明确协作边界和责任边界 |
| 2 | SPEC-T02 | 再把任务从配置升级为可发布资产 |
| 3 | SPEC-T03 | 形成统一运营主界面 |
| 4 | SPEC-T04 | 补齐值班与告警处理流 |
| 5 | SPEC-T05 | 完善结果与证据链 |
| 6 | SPEC-T06 | 沉淀复盘和模板治理 |
| 7 | SPEC-T07 | 在稳定上下文之上增强 AI |
| 8 | SPEC-T08 | 最后统一业务验收口径 |

> 说明：如果近期目标是快速落地，可先做 `SPEC-T02 + SPEC-T03 + SPEC-T04`，先把“任务发布 → 执行运营 → 告警值班”这条主闭环跑通。
