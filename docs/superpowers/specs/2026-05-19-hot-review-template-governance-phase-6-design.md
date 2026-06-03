# Hot Monitor 复盘到模板治理回流 Phase 6 设计

## 1. 本阶段决策

Phase 6 选择把 Hot Monitor 的失败复盘继续向“可治理资产”推进，而不是新增采集源、扩展报告样式、接 AI 初稿或重做质量规则系统。

本阶段目标：

> 用户在 Hot Monitor 看到失败运行并创建复盘后，可以把这条复盘关联到已有提取模板，生成模板回流建议和回流草稿，并把确认后的草稿应用到模板治理主线。

Phase 5 已经把失败运行沉淀成真实 `TaskReviewRecord`。但如果复盘只停留在“记录一次失败”，系统仍然无法降低下一次失败概率。Phase 6 要把“失败原因”和“处理结论”转成模板层面的治理动作，让选择器、解析规则、质量校验和检查清单逐步回流到可复用模板。

## 2. 当前已有基础

| 能力区域 | 当前已有能力 | Phase 6 复用方式 |
| --- | --- | --- |
| Hot Monitor 失败复盘 | 失败运行详情可读取和创建 `TaskReviewRecord` | 作为模板治理入口，不新增复盘模型 |
| Review 服务 | `ReviewService.suggestTemplateBackflow/createTemplateBackflowDraft` 已存在 | 生成回流建议和草稿 |
| Template 服务 | `TemplateService.linkReview/applyTemplateBackflowDraft` 已存在 | 关联 Review 与 Template，并应用草稿 |
| 模板列表 | `useIpc().automation.listTemplates()` 已封装 `TEMPLATE_LIST` | 在 Hot Monitor 复盘区加载可选模板 |
| 渲染端 API | `taskOperations.linkReviewTemplate/suggestTemplateBackflow/createTemplateBackflowDraft/applyTemplateBackflowDraft` 已存在 | Hot Monitor 直接复用，不新增 IPC |
| Automation 经验 | `ReviewPanel` 已有复盘关联模板、生成建议、生成草稿、应用草稿的最小实现 | 复用交互语义，但不直接搬运 Automation 页面 |
| 回流草稿类型 | `TemplateBackflowDraft` 包含风险、变更项、执行步骤、验收标准 | 在 Hot Monitor 展示给用户确认 |
| 复盘关联字段 | `TaskReviewRecord.linkedTemplateIds` 已存在 | 应用或关联后更新当前复盘展示 |

## 3. 方案选择

| 方案 | 内容 | 优点 | 问题 | 结论 |
| --- | --- | --- | --- | --- |
| A. Hot Monitor 内部提示 | 在失败复盘卡片里显示“建议更新模板”，不调用模板服务 | 改动最小 | 仍然只是提示，不能形成资产回流 | 不采用 |
| B. 接入现有 Review -> Template 回流链路 | Hot Monitor 复盘记录可选择模板、关联模板、生成建议、生成草稿、应用草稿 | 复用已有后端能力，能形成闭环，范围可控 | 需要拆出前端组件和状态管理 | 采用 |
| C. 同时生成 Data Center 质量规则 | 对 `add-quality-check` 直接创建或保存质量规则 | 能覆盖质量治理 | 容易把 Phase 6 扩大为规则编辑器，需要更多验收 | 后置 |

Phase 6 采用方案 B。核心原因是项目已经有 Review、Template、Backflow Draft 和 IPC 通道，Hot Monitor 应该接入这条主线，而不是新增私有“修复建议”状态。

## 4. 产品范围

| 做 | 不做 |
| --- | --- |
| 在 Hot Monitor 失败复盘列表中增加“模板治理”入口 | 不新增数据库表 |
| 加载已有模板列表供复盘选择 | 不新增 IPC 通道 |
| 支持把复盘关联到模板 | 不新增模板创建功能 |
| 支持生成模板回流建议 | 不接 AI 自动修复 |
| 支持生成模板回流草稿 | 不直接打开可视化模板编辑器 |
| 展示草稿风险等级、变更项、执行步骤、验收标准 | 不做质量规则保存或规则生成 |
| 支持应用回流草稿到模板 | 不自动重跑采集源 |
| 应用后更新当前复盘的 `linkedTemplateIds` 展示 | 不扩展到 Comment Monitor 或 Signin |

## 5. 用户路径

| 步骤 | 用户看到什么 | 系统做什么 | 验收标准 |
| --- | --- | --- | --- |
| 1. 打开失败运行详情 | Hot Monitor 运行详情展示失败复盘列表 | 沿用 Phase 5 的 `HOT_RUN_DETAIL` 和 `REVIEW_LIST` | 用户能看到当前 Task / Batch 的复盘 |
| 2. 查看模板治理入口 | 每条复盘下面出现“模板治理”区域 | 前端加载 `TEMPLATE_LIST` | 用户能选择已有模板 |
| 3. 关联模板 | 点击“关联模板” | 调用 `taskOperations.linkReviewTemplate({ reviewId, templateId })` | 复盘展示已关联模板 ID |
| 4. 生成回流建议 | 点击“生成回流建议” | 调用 `taskOperations.suggestTemplateBackflow({ reviewId, templateId })` | 展示是否推荐和原因 |
| 5. 生成回流草稿 | 点击“生成回流草稿” | 调用 `taskOperations.createTemplateBackflowDraft({ reviewId, templateId })` | 展示草稿风险、变更项、步骤和验收标准 |
| 6. 应用草稿 | 用户确认后点击“应用回流草稿” | 调用 `taskOperations.applyTemplateBackflowDraft({ draft, appliedBy })` | 显示应用成功，并把模板 ID 写入当前复盘展示 |
| 7. 继续验证 | 用户可手动点击“重新运行当前采集源” | 沿用 Phase 5 的 `startRun(sourceId)` | 不新增自动重跑行为 |

## 6. 页面设计

### 6.1 Hot Monitor 运行详情

运行详情仍以失败现场为主，模板治理只挂在复盘记录下，不抢占主路径。

| 区域 | Phase 6 后行为 |
| --- | --- |
| 运行摘要 | 不变，继续展示 Source / Task / Batch / 错误 / 断点 |
| 失败复盘表单 | 不变，继续创建真实 `TaskReviewRecord` |
| 复盘列表 | 每条记录展示结论、原因、负责人、后续动作、已关联模板 |
| 模板治理区 | 每条复盘独立选择模板、生成建议、生成草稿、应用草稿 |
| 底部操作 | 保留“进入介入浏览器”“查看结果中心”“重新运行当前采集源” |

### 6.2 模板选择

模板来源为现有 `automation.listTemplates()`。

| 状态 | 展示 |
| --- | --- |
| 模板加载中 | 按钮禁用，显示“模板加载中” |
| 有模板 | 使用 Ant Design `Select` 展示模板名称，value 为 `template.id` |
| 无模板 | 展示“暂无模板，请先在 Automation 中创建提取模板” |
| 加载失败 | 展示错误文案，复盘和重跑入口不受影响 |

本阶段不在 Hot Monitor 新建模板。模板创建属于 Automation 的已有职责，Phase 6 只做复盘到已有模板的治理回流。

### 6.3 复盘动作与模板治理意图

现有 `ReviewService.suggestTemplateBackflow` 会根据 `followUpActions` 中的 `update-template`、`link-template`、`template-governance` 判断是否推荐回流。Hot Monitor 现有复盘动作如 `update-selector`、`update-parser`、`add-quality-check` 本身也具有模板治理含义。

Phase 6 的处理策略：

| 场景 | 行为 |
| --- | --- |
| 新创建的复盘属于选择器、解析规则或质量校验问题 | 默认追加 `template-governance` 作为后续动作 |
| 历史复盘没有模板治理动作 | 仍允许生成草稿，但建议结果可能提示“不推荐” |
| 用户只想记录失败、不改模板 | 不需要点击模板治理入口 |
| 用户已关联模板 | 复盘卡片展示 `linkedTemplateIds`，避免重复判断 |

这样可以让新复盘更容易进入推荐路径，同时不需要新增 Review 编辑接口。

### 6.4 回流建议展示

建议结果来自 `ReviewService.suggestTemplateBackflow`。

| 字段 | 展示 |
| --- | --- |
| `recommended` | 显示“建议回流”或“谨慎回流” |
| `reason` | 原样展示服务端返回原因 |
| `followUpActions` | 展示动作标签 |

建议只是提示，不阻断草稿生成。原因是 `createTemplateBackflowDraft` 已能从复盘结论生成草稿，用户仍然可以人工判断是否应用。

### 6.5 回流草稿展示

草稿结果来自 `ReviewService.createTemplateBackflowDraft`。

| 字段 | 展示 |
| --- | --- |
| `title` | 草稿标题 |
| `riskLevel` | 风险等级标签 |
| `proposedChanges` | 变更类型和描述 |
| `executionSteps` | 应用前后需要执行的步骤 |
| `acceptanceCriteria` | 应用后的验收标准 |
| `sourceConclusion` | 来源复盘结论 |
| `owner` | 负责人 |

应用按钮只在已生成草稿后可用。用户点击应用后才调用 `TEMPLATE_BACKFLOW_APPLY`。

## 7. 数据流

```text
用户打开 Hot Monitor 失败运行详情
  -> HOT_RUN_DETAIL({ sourceId, batchId })
  -> REVIEW_LIST({ taskId, batchId })
  -> TEMPLATE_LIST()

用户选择某条复盘和模板
  -> TEMPLATE_LINK_REVIEW({ reviewId, templateId })
  -> 前端把 templateId 写入当前 review.linkedTemplateIds

用户生成建议
  -> REVIEW_TEMPLATE_BACKFLOW_SUGGEST({ reviewId, templateId })
  -> 展示 recommended / reason / followUpActions

用户生成草稿
  -> REVIEW_TEMPLATE_BACKFLOW_DRAFT({ reviewId, templateId })
  -> 展示 TemplateBackflowDraft

用户应用草稿
  -> TEMPLATE_BACKFLOW_APPLY({ draft, appliedBy: '当前值班员' })
  -> TemplateService 应用治理元信息或选择器改写
  -> TemplateService.linkReview(reviewId, templateId)
  -> 前端展示应用成功，并更新当前复盘关联模板
```

## 8. 错误处理

| 场景 | 处理方式 |
| --- | --- |
| 模板列表加载失败 | 显示错误提示，不影响失败复盘、介入浏览器和重跑 |
| 没有可用模板 | 禁用模板治理按钮，提示去 Automation 创建模板 |
| 未选择模板 | 禁用“关联模板”“生成建议”“生成草稿” |
| 关联模板失败 | 保留当前选择，显示错误提示 |
| 生成建议失败 | 显示错误提示，不清空已生成草稿 |
| 生成草稿失败 | 显示错误提示，不清空复盘记录 |
| 应用草稿失败 | 保留草稿，显示错误提示，允许重试 |
| Review 缺少 `id` | 不展示该条复盘的模板治理按钮 |
| Template 已关联 | 允许再次生成建议或草稿，但“关联模板”按钮显示为已关联状态 |

## 9. 测试策略

| 层级 | 测试内容 |
| --- | --- |
| 纯函数单测 | 判断复盘是否具有模板治理意图 |
| 纯函数单测 | 合并 `linkedTemplateIds` 时去重并保持不可变 |
| 组件测试 | 模板治理组件加载模板并选择模板 |
| 组件测试 | 点击“关联模板”调用 `linkReviewTemplate` 并更新展示 |
| 组件测试 | 点击“生成回流建议”展示服务端原因 |
| 组件测试 | 点击“生成回流草稿”展示风险、变更、步骤、验收标准 |
| 组件测试 | 点击“应用回流草稿”调用 `applyTemplateBackflowDraft` |
| Hot Monitor 回归 | 失败运行详情仍能创建复盘、进入介入浏览器、查看结果中心、重跑 |
| 服务回归 | `ReviewService` 与 `TemplateService` 既有回流测试继续通过 |

## 10. 实施拆分

| 顺序 | 目标 | 可能涉及文件 |
| --- | --- | --- |
| 1 | 抽出模板治理纯函数和单测 | `src/renderer/entries/hot-monitor/templateGovernance.ts`、`tests/unit/renderer/hot-monitor/templateGovernance.test.ts` |
| 2 | 新增复盘模板治理组件 | `src/renderer/entries/hot-monitor/components/ReviewTemplateGovernancePanel.tsx`、`tests/unit/components/ReviewTemplateGovernancePanel.test.tsx` |
| 3 | 在 Hot Monitor 运行详情接入模板列表和治理组件 | `src/renderer/entries/hot-monitor/App.tsx`、`tests/unit/components/HotMonitorApp.test.tsx` |
| 4 | 调整新建失败复盘的默认后续动作 | `src/renderer/entries/hot-monitor/failureReview.ts`、`tests/unit/renderer/hot-monitor/failureReview.test.ts` |
| 5 | 更新当前状态文档并跑 Phase 1-6 聚焦回归 | `docs/overview/current-status.md` |

## 11. 成功标准

Phase 6 完成后，用户应该能说清楚：

> 我在 Hot Monitor 处理一次失败采集后，不只是记录原因，还能把这条复盘关联到提取模板，生成回流草稿，并把确认后的治理动作应用到模板，让下一次采集复用这次修复经验。

这一步完成后，热点黄金路径会从“失败可复盘”提升到“复盘可回流”。后续 Phase 7 再做质量规则生成或 AI 修复建议时，可以基于已关联的 Review、Template 和 Batch 上下文继续扩展。
