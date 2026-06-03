# Hot Monitor 失败复盘闭环 Phase 5 设计

## 1. 本阶段决策

Phase 5 选择补齐 Hot Monitor 失败运行后的复盘沉淀闭环，而不是继续扩展 AI 摘要、通知渠道、报告格式或 Runner 底层稳定化。

本阶段目标：

> 当热点采集运行失败后，用户可以在 Hot Monitor 的运行详情中看到失败诊断摘要，创建真实复盘记录，并把“失败原因、处理结论、后续动作”沉淀到现有 `ReviewService` 复盘资产中。

Phase 4 已经让失败运行可以进入 Browser 介入台并恢复自动执行。Phase 5 要补的是介入之后的管理动作：用户处理完失败现场后，需要把这次失败归因、修复建议和是否重跑记录下来，否则系统只能“失败可处理”，还不能形成可追踪的改进资产。

## 2. 当前已有基础

| 能力区域 | 当前已有能力 | Phase 5 复用方式 |
| --- | --- | --- |
| 失败运行详情 | `HotRunDetail` 已包含 `taskId / batchId / sourceId / sourceName / status / error / breakpoint / stepResults` | 作为复盘对象和诊断证据 |
| 浏览器介入 | Hot Monitor 失败运行可跳转 Browser 介入台 | Phase 5 不改介入链路，只在运行详情补复盘 |
| 数据中心承接 | Data Center 可按 `taskId/batchId` 查看结果、导出和质量扫描 | 运行详情继续保留“查看结果中心” |
| 复盘服务 | `ReviewService.createReview/listReviews` 已存在 | 使用 `REVIEW_CREATE / REVIEW_LIST` 创建和读取真实复盘 |
| 复盘存储 | `ReviewRepository` 已写入 `task_reviews` | 不新增表，不新增持久化模型 |
| 复盘类型 | `TaskReviewRecord` 支持 `failure / quality / strategy` | 失败运行默认使用 `reviewType: 'failure'` |
| AI 初稿 | `ops_review_draft` 已可基于批次、告警、结果、历史复盘生成初稿 | 本阶段不直接接 AI，只为后续预留入口 |
| 重跑入口 | Hot Monitor 已有按 `sourceId` 重新运行 | 复盘卡片提供同源重跑入口，复用现有 `startRun(sourceId)` |

## 3. 方案选择

| 方案 | 内容 | 优点 | 问题 | 结论 |
| --- | --- | --- | --- | --- |
| A. 前端轻量复盘卡片 | 只在 Hot Monitor 本地展示处理说明，不持久化 | 快，改动少 | 复盘无法被 Automation、AI 工具和模板回流复用 | 不采用 |
| B. 复用现有 Review 主线 | Hot Monitor 调用 `REVIEW_LIST / REVIEW_CREATE` 创建真实复盘记录 | 接入现有复盘资产，可按 Task / Batch 查询，可被 AI 和模板治理复用 | 需要补 UI 状态和测试 | 采用 |
| C. 直接接 AI 复盘初稿 | Hot Monitor 直接调用 `ops_review_draft` 生成复盘文案 | 体验更智能 | 当前 AI 工具需要确认级别，容易扩大范围 | 后置 |

Phase 5 采用方案 B。核心原因是项目已经有 `ReviewService`、`ReviewRepository`、`TaskReviewRecord` 和 task operations IPC，不应该再做一套 Hot Monitor 私有复盘状态。

## 4. 产品范围

| 做 | 不做 |
| --- | --- |
| 在 Hot Monitor 运行详情中增加“失败复盘”区域 | 不新增数据库表 |
| 展示失败诊断摘要：错误类型、断点步骤、错误文本、失败步骤数量 | 不新增后端 IPC 通道 |
| 读取当前 `taskId/batchId` 下已有复盘记录 | 不重构 Automation 的 `ReviewPanel` |
| 创建 `reviewType: 'failure'` 的真实复盘记录 | 不接入 AI 自动生成复盘初稿 |
| 提供原因分类、处理结论、后续动作输入 | 不做模板回流草稿和模板应用 |
| 创建成功后刷新复盘列表 | 不做复盘编辑、删除、评论流 |
| 从复盘区域提供“重新运行当前采集源”入口 | 不扩展到 Comment / Signin / 通用 Automation |

## 5. 用户路径

| 步骤 | 用户看到什么 | 系统做什么 | 验收标准 |
| --- | --- | --- | --- |
| 1. 查看失败运行 | 运行详情显示 Source / Task / Batch / 失败定位 / 错误 | `HOT_RUN_DETAIL` 返回失败详情 | 用户能确认是哪次失败 |
| 2. 阅读诊断摘要 | “失败复盘”区域显示错误类型、断点步骤、失败步骤数、建议动作 | 前端从 `runDetail` 推导诊断文本 | 用户不用打开日志也能得到第一层判断 |
| 3. 查看历史复盘 | 复盘区域列出当前 Task / Batch 已有复盘 | 调用 `taskOperations.listReviews(taskId, batchId)` | 同批次已有复盘可见 |
| 4. 创建复盘 | 用户选择原因分类，填写处理结论，勾选后续动作 | 调用 `taskOperations.createReview(payload)` | 创建的记录包含 `taskId/batchId/reviewType/reasonCategory/conclusion/followUpActions` |
| 5. 复盘后重跑 | 用户点击“重新运行当前采集源” | 复用 `startRun(sourceId)` | 不新增重跑 IPC |
| 6. 继续介入或查结果 | 用户仍可进入介入浏览器或查看结果中心 | 保留 Phase 4 和 Phase 2 入口 | 复盘不会阻断原有闭环 |

## 6. 页面设计

### 6.1 Hot Monitor 运行详情

运行详情 Modal 保留现有结构：

| 区域 | Phase 5 后行为 |
| --- | --- |
| `HotRunDetailView` | 继续展示运行元信息、失败定位、断点错误、错误摘要 |
| 失败复盘区域 | 仅当 `runDetail.status === 'failed'` 或存在 `runDetail.error/breakpoint` 时展示 |
| 操作按钮 | 保留“进入介入浏览器”和“查看结果中心”，新增复盘区域内的“重新运行当前采集源” |

成功运行不展示失败复盘表单，避免把复盘变成普通备注系统。

### 6.2 失败诊断摘要

诊断摘要由前端根据 `HotRunDetail` 规则推导，不依赖 AI。

| 输入 | 推导展示 |
| --- | --- |
| `breakpoint.stepIndex` | “断点步骤：第 N 步” |
| `breakpoint.error` | “断点错误：...” |
| `error` | “运行错误：...” |
| `stepResults` 中失败项 | “失败步骤：X / Y” |
| `linkedResultIds.length` | “已关联结果：N 条” |

建议原因分类采用固定选项：

| 分类值 | 展示文案 | 触发倾向 |
| --- | --- | --- |
| `selector_changed` | 页面结构或选择器变化 | 错误包含 selector、选择器、未找到、timeout |
| `login_required` | 登录态或权限失效 | 错误包含 login、登录、403、401、unauthorized |
| `network_or_rate_limit` | 网络波动或频控 | 错误包含 timeout、rate、429、network |
| `parser_changed` | 返回结构或解析规则变化 | 错误包含 parse、JSON、字段、结构 |
| `quality_issue` | 结果质量或数量异常 | 结果数量为 0 或质量失败 |
| `unknown` | 待继续确认 | 没有明显匹配 |

默认值可以由规则推导，但用户可以修改。

### 6.3 复盘表单

复盘表单只收集最小必要字段。

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `reasonCategory` | 下拉/单选 | 规则推导结果 | 失败原因分类 |
| `conclusion` | 文本域 | 由错误摘要生成一行草稿 | 用户确认后的处理结论 |
| `owner` | 输入框 | `当前值班员` | 与现有 `ReviewPanel` 保持一致 |
| `followUpActions` | 多选 | 按原因分类推导 | 后续动作 |

后续动作固定选项：

| 动作值 | 展示文案 | 用途 |
| --- | --- | --- |
| `retry-source` | 重新运行采集源 | 失败处理后验证 |
| `update-selector` | 更新选择器或页面定位 | 页面结构变化 |
| `refresh-session` | 刷新登录态或会话 | 登录态失效 |
| `update-parser` | 更新解析规则 | API 或页面结构变化 |
| `add-quality-check` | 补充质量校验 | 防止静默产出异常 |
| `monitor-next-run` | 观察下一次运行 | 暂不立即改模板 |

创建 payload：

```ts
{
  taskId: runDetail.taskId,
  batchId: runDetail.batchId,
  reviewType: 'failure',
  reasonCategory,
  conclusion,
  owner,
  followUpActions,
}
```

### 6.4 复盘列表

复盘列表展示当前 Task / Batch 下的记录。

| 字段 | 展示 |
| --- | --- |
| `createdAt` | 北京时间 |
| `reviewType` | 复盘类型 |
| `reasonCategory` | 原因分类 |
| `conclusion` | 处理结论 |
| `owner` | 负责人 |
| `followUpActions` | 后续动作标签 |

没有复盘时展示“当前批次暂无复盘记录”。创建成功后把新记录插入列表顶部。

## 7. 数据流

```text
用户打开 Hot Monitor 失败运行详情
  -> HOT_RUN_DETAIL({ sourceId, batchId })
  -> runDetail 包含 taskId / batchId / sourceId / error / breakpoint

运行详情 Modal 打开
  -> taskOperations.listReviews(taskId, batchId)
  -> 展示当前批次已有复盘

用户填写失败原因和处理结论
  -> taskOperations.createReview({
       taskId,
       batchId,
       reviewType: 'failure',
       reasonCategory,
       conclusion,
       owner,
       followUpActions
     })
  -> ReviewService.createReview
  -> ReviewRepository 写入 task_reviews
  -> 前端刷新复盘列表

用户点击重新运行当前采集源
  -> startRun(runDetail.sourceId)
  -> HOT_RUN_START({ sourceId })
```

## 8. 错误处理

| 场景 | 处理方式 |
| --- | --- |
| `taskId` 缺失 | 不展示创建复盘按钮，提示“缺少 Task 上下文，无法创建复盘” |
| `batchId` 缺失 | 不展示创建复盘按钮，提示“缺少 Batch 上下文，无法创建复盘” |
| 复盘列表加载失败 | 显示错误提示，但不影响查看失败详情和进入介入浏览器 |
| 创建复盘失败 | 保留用户填写内容，显示错误提示 |
| `conclusion` 为空 | 禁用“创建复盘”按钮 |
| 后续动作为空 | 允许创建，但默认空数组 |
| 重跑失败 | 复用 `startRun` 当前错误提示 |
| 成功运行 | 不展示失败复盘表单 |

## 9. 测试策略

| 层级 | 测试内容 |
| --- | --- |
| 纯函数单测 | 从 `HotRunDetail` 推导原因分类、结论草稿和后续动作 |
| Hot Monitor 组件测试 | 失败运行详情加载当前 Task / Batch 的复盘列表 |
| Hot Monitor 组件测试 | 填写复盘并调用 `REVIEW_CREATE` |
| Hot Monitor 组件测试 | 创建成功后展示新复盘记录 |
| Hot Monitor 组件测试 | 成功运行不展示失败复盘区域 |
| Hot Monitor 组件测试 | 缺少 `taskId` 时不允许创建复盘 |
| 回归测试 | Phase 4 的介入浏览器入口仍存在 |
| 回归测试 | Data Center 跳转和报告预览路径仍通过 |

## 10. 实施拆分

| 顺序 | 目标 | 可能涉及文件 |
| --- | --- | --- |
| 1 | 抽出失败复盘推导函数和单测 | `src/renderer/entries/hot-monitor/failureReview.ts`、`tests/unit/renderer/hot-monitor/failureReview.test.ts` |
| 2 | 在 Hot Monitor 运行详情中加载当前批次复盘 | `src/renderer/entries/hot-monitor/App.tsx`、`tests/unit/components/HotMonitorApp.test.tsx` |
| 3 | 增加失败复盘表单和创建逻辑 | `src/renderer/entries/hot-monitor/App.tsx`、`tests/unit/components/HotMonitorApp.test.tsx` |
| 4 | 增加复盘列表和重跑入口 | `src/renderer/entries/hot-monitor/App.tsx`、`tests/unit/components/HotMonitorApp.test.tsx` |
| 5 | 更新当前状态文档并跑聚焦验证 | `docs/overview/current-status.md` |

## 11. 成功标准

Phase 5 完成后，用户应该能说清楚：

> 我在 Hot Monitor 看到一次失败运行后，可以进入运行详情，查看失败诊断，创建这次批次的复盘记录，并决定是更新规则、刷新会话、补质量校验还是重新运行。

这一步完成后，热点黄金路径会从“失败可处理”提升到“失败可复盘”。后续再接 AI 复盘初稿、模板回流和自动修复建议时，都能基于真实 `TaskReviewRecord` 继续扩展，而不是重新补数据结构。
