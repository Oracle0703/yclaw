# Hot Monitor 回流验证与质量扫描 Phase 7 设计

## 1. 本阶段决策

Phase 7 继续沿着 Hot Monitor 热点采集黄金路径收敛：不横向扩展新模块，也不立即做 AI 修复或质量规则编辑器，而是把 Phase 6 的“复盘可回流”推进到“回流后可验证”。

本阶段目标：

> 用户在失败复盘完成模板回流后，可以在同一条复盘下发起一次验证重跑；系统等待新热点批次完成后，对新批次执行 Data Center 质量扫描，并把运行结果、质量分、问题数和 Top 规则直接展示在 Hot Monitor 中。

这一步解决的问题是：用户已经把失败经验回流到模板，但还缺少一个明确的“这次修复是否真的改善了采集结果”的闭环。Phase 7 不追求自动修复所有问题，而是让用户能用一次重跑和一次质量扫描快速判断修复效果。

## 2. 当前已有基础

| 能力区域 | 当前已有能力 | Phase 7 复用方式 |
| --- | --- | --- |
| Hot Monitor 运行 | `HOT_RUN_START`、`HOT_RUN_LIST`、`HOT_RUN_DETAIL` 已支持启动和查询热点运行 | 复用当前采集源发起验证重跑 |
| Hot Monitor 报告 | 成功运行后可生成 HTML 报告 | 验证重跑成功后继续生成报告，不新增报告链路 |
| 失败复盘 | 已能读取和创建真实 `TaskReviewRecord` | 以单条复盘作为验证入口和状态承载位置 |
| 模板治理 | 复盘可关联模板、生成回流建议、生成回流草稿并应用 | 验证入口放在模板治理附近，表达“回流后验证” |
| Data Center 上下文 | Data Center 可按 `taskId/batchId` 展示结果、导出和质量扫描 | 验证完成后跳转到新批次结果中心 |
| Data Center 质量扫描 | `dataCenter.scanQuality({ query, limit })` 已存在 | 对新批次调用现有扫描，不新增 IPC |
| 质量评分与洞察 | `DataQualityScanResult` 已包含 `batchScore`、`batchInsight`、`rules`、`issues` | 在 Hot Monitor 展示质量摘要 |
| 质量规则保存 | `saveRuleConfig` 只支持保存已知规则 | 本阶段不自动创建新规则，避免扩大范围 |

## 3. 方案选择

| 方案 | 内容 | 优点 | 问题 | 结论 |
| --- | --- | --- | --- | --- |
| A. 直接生成 Data Center 质量规则 | 根据复盘动作自动创建或保存质量规则 | 能把复盘变成质量治理资产 | 现有 `saveRuleConfig` 不支持新增未知规则，范围会扩大到规则编辑器 | 不采用 |
| B. 回流后验证重跑并扫描新批次 | 应用模板回流后，一键重跑当前采集源，并扫描新批次质量 | 复用现有运行和质量能力，能直接验证修复效果 | 需要梳理运行状态和异步 UI | 采用 |
| C. AI 修复建议与自动规则生成 | AI 读取复盘、结果和模板，生成修复建议或规则草稿 | 长期价值高 | 需要权限、模型边界和人工确认机制 | 后置 |

Phase 7 采用方案 B。核心原因是它能直接补齐 Phase 6 后最缺的一步：模板回流是否有效。它不需要新数据库、不需要新 IPC、不需要接 AI，也不会把 Data Center 规则系统强行拉进本阶段。

## 4. 产品范围

| 做 | 不做 |
| --- | --- |
| 在 Hot Monitor 失败复盘卡片中增加“验证重跑”入口 | 不新增数据库表 |
| 重跑当前失败运行对应的采集源 | 不新增 IPC 通道 |
| 等待新批次完成，并忽略当前失败批次 | 不自动创建新的质量规则 |
| 新批次成功后自动生成 HTML 报告 | 不接 AI 修复建议 |
| 新批次成功后调用 Data Center 质量扫描 | 不做跨采集源批量验证 |
| 展示运行状态、结果数量、批次 ID、质量分、等级、问题数、Top 规则 | 不改 Data Center 的质量规则编辑能力 |
| 提供“查看新批次结果中心”入口 | 不扩展到 Comment Monitor 或 Signin |
| 重跑失败时展示失败状态，不执行质量扫描 | 不自动覆盖或删除旧批次结果 |

## 5. 用户路径

| 步骤 | 用户看到什么 | 系统做什么 | 验收标准 |
| --- | --- | --- | --- |
| 1. 打开失败运行详情 | 失败复盘和模板治理区域 | 沿用 Phase 5 / Phase 6 的运行详情加载 | 用户能看到当前失败批次的复盘 |
| 2. 完成模板回流 | 已关联模板、回流建议、回流草稿和应用结果 | 沿用 Phase 6 的模板治理链路 | 用户能明确知道复盘已经进入模板治理 |
| 3. 发起验证重跑 | 点击“验证重跑并扫描新批次” | 调用 `HOT_RUN_START({ sourceId })` | 按钮进入运行中状态 |
| 4. 等待新批次完成 | 页面显示“等待新批次完成” | 轮询 `HOT_RUN_LIST({ sourceId })`，忽略旧失败批次 | 不把旧失败批次误判成验证结果 |
| 5. 新批次成功 | 页面显示新 `batchId`、结果数量和报告状态 | 调用 `HOT_REPORT_GENERATE` 生成 HTML 报告 | 成功运行有报告可追踪 |
| 6. 扫描质量 | 页面显示“扫描新批次质量” | 调用 `scanQuality({ query: { taskId, batchId }, limit: 200 })` | 扫描只针对新批次 |
| 7. 查看验证结果 | 展示质量分、等级、问题数、Top 规则 | 前端格式化 `DataQualityScanResult` | 用户能判断修复后结果质量 |
| 8. 深入查看 | 点击“查看新批次结果中心” | 跳转 `/data-center` 并传入新 `taskId/batchId` | Data Center 默认限定新批次 |

## 6. 页面设计

### 6.1 复盘卡片中的验证区域

验证入口挂在单条复盘卡片内，位置在“模板治理”之后。它不抢占运行详情主区域，也不改变已有复盘表单。

| 区域 | Phase 7 后行为 |
| --- | --- |
| 复盘摘要 | 不变，继续展示结论、原因、负责人 |
| 模板治理 | 不变，继续选择模板、生成建议、生成草稿、应用草稿 |
| 验证重跑 | 新增，展示验证按钮和最近一次验证状态 |
| 验证结果 | 新增，展示新批次运行摘要和质量扫描摘要 |
| 跳转入口 | 新增，进入新批次 Data Center |

### 6.2 验证状态

| 状态 | 展示文案 | 允许操作 |
| --- | --- | --- |
| `idle` | 尚未执行验证重跑 | 可点击验证按钮 |
| `running` | 正在启动并等待新批次完成 | 禁用验证按钮 |
| `scanning` | 新批次已完成，正在扫描质量 | 禁用验证按钮 |
| `succeeded` | 验证完成，展示运行和质量摘要 | 可再次验证 |
| `failed` | 验证失败，展示失败原因 | 可再次验证 |

同一条复盘只展示最近一次验证状态。历史验证批次仍然通过 Data Center 和报告列表追踪，本阶段不新增验证历史表。

### 6.3 验证结果摘要

| 字段 | 来源 | 展示 |
| --- | --- | --- |
| 新批次 ID | `HotRunSummary.batchId` | `新批次：batch-xxx` |
| 运行状态 | `HotRunSummary.status` | 成功 / 失败 / 运行中 |
| 结果数量 | `HotRunSummary.resultCount` | `结果：N 条` |
| 报告状态 | `HotRunSummary.reportStatus` | 已生成 / 待生成 |
| 批次质量分 | `DataQualityScanResult.batchScore.score` | 无分数时显示 `-` |
| 评分等级 | `DataQualityScanResult.batchScore.grade` | 显示中文等级 |
| 质量问题 | `DataQualityScanResult.issueCount` | `质量问题：N 个` |
| 影响结果 | `DataQualityScanResult.affectedResults` | `影响结果：N 条` |
| Top 规则 | `DataQualityScanResult.batchInsight.topRules` 或 `rules` | 显示最多 3 条规则 |

评分等级中文映射：

| 原值 | 中文 |
| --- | --- |
| `excellent` | 优秀 |
| `good` | 良好 |
| `watch` | 关注 |
| `poor` | 较差 |

## 7. 数据流

```text
用户打开 Hot Monitor 失败运行详情
  -> HOT_RUN_DETAIL({ sourceId, batchId })
  -> REVIEW_LIST({ taskId, batchId })
  -> TEMPLATE_LIST()

用户在某条复盘下点击验证重跑
  -> HOT_RUN_START({ sourceId: runDetail.sourceId })
  -> HOT_RUN_LIST({ sourceId }) 轮询
  -> 忽略 runDetail.batchId，等待新的 success / failed 批次

如果新批次成功
  -> HOT_REPORT_GENERATE({ sourceId, batchId: newBatchId, format: 'html' })
  -> DATA_CENTER_QUALITY_SCAN({
       query: { taskId: runDetail.taskId, batchId: newBatchId },
       limit: 200
     })
  -> 在复盘卡片展示运行摘要和质量摘要

如果新批次失败
  -> 展示失败状态
  -> 不调用 DATA_CENTER_QUALITY_SCAN

用户点击查看新批次结果中心
  -> navigate('/data-center', {
       state: {
         source: 'hot-monitor',
         taskId: runDetail.taskId,
         batchId: newBatchId
       }
     })
```

## 8. 关键设计约束

### 8.1 忽略旧失败批次

当前失败详情的 `batchId` 已经是一个终态批次。如果验证重跑后轮询运行列表时直接取第一条运行，可能误把旧失败批次当成验证结果。

Phase 7 要让等待逻辑支持 `ignoreBatchId`：

| 场景 | 行为 |
| --- | --- |
| 普通运行按钮 | 不传 `ignoreBatchId`，保持当前行为 |
| 失败复盘验证 | 传入当前失败 `batchId`，等待不同批次 |
| 新批次仍在运行 | 继续轮询 |
| 新批次成功 | 进入报告生成和质量扫描 |
| 新批次失败 | 展示失败，不扫描质量 |

### 8.2 只扫描新批次

质量扫描 payload 必须同时带 `taskId` 和新 `batchId`：

```ts
{
  query: {
    taskId: runDetail.taskId,
    batchId: completedRun.batchId,
  },
  limit: 200,
}
```

这样可以避免扫描旧失败批次、同任务历史批次或全局结果。

### 8.3 不新增持久化

验证状态只存在于当前 Hot Monitor 页面状态中。原因：

| 原因 | 说明 |
| --- | --- |
| 批次本身已持久化 | 新批次可在运行列表和 Data Center 中查询 |
| 报告本身已持久化 | 成功验证会生成 HTML 报告 |
| 质量扫描会持久化 findings / insight | Data Center 已保存批次质量洞察 |
| 降低范围 | 不需要新增 `review_verifications` 表或迁移 |

如果后续需要审计“某次复盘验证了几次”，再设计独立验证记录模型。

## 9. 错误处理

| 场景 | 处理方式 |
| --- | --- |
| 缺少 `runDetail.sourceId` | 禁用验证按钮，提示缺少采集源上下文 |
| 缺少 `runDetail.taskId` | 禁用验证按钮，提示缺少 Task 上下文 |
| `HOT_RUN_START` 失败 | 状态置为 `failed`，展示启动失败原因 |
| 等待超时 | 状态置为 `failed`，提示未等到新批次完成 |
| 新批次失败 | 状态置为 `failed`，展示新批次 ID 和失败状态，不扫描质量 |
| 报告生成失败 | 验证仍可继续质量扫描，但提示报告生成失败 |
| 质量扫描失败 | 状态置为 `failed`，保留新批次信息，允许进入 Data Center 手动扫描 |
| 扫描结果为空 | 展示 0 条结果、0 个问题和空质量摘要 |
| 无 `batchScore` | 分数显示 `-`，不阻断结果中心跳转 |
| 用户重复点击 | 运行中和扫描中禁用按钮 |

## 10. 测试策略

| 层级 | 测试内容 |
| --- | --- |
| 纯函数单测 | 构造新批次质量扫描 payload |
| 纯函数单测 | 格式化质量等级和质量摘要 |
| 组件测试 | 验证面板在空闲、运行、扫描、成功、失败状态下展示正确 |
| 组件测试 | 点击验证按钮调用父级验证回调 |
| 组件测试 | 点击“查看新批次结果中心”调用跳转回调 |
| Hot Monitor 集成测试 | 验证重跑成功后扫描新批次质量 |
| Hot Monitor 集成测试 | 新批次失败时不调用质量扫描 |
| Hot Monitor 集成测试 | 等待逻辑忽略当前失败批次 |
| 回归测试 | Phase 5 失败复盘、Phase 6 模板治理继续可用 |
| 质量门禁 | `npm run typecheck`、`npm run lint`、聚焦 Vitest 测试通过 |

## 11. 实施拆分

| 顺序 | 目标 | 可能涉及文件 |
| --- | --- | --- |
| 1 | 新增验证质量纯函数和单测 | `src/renderer/entries/hot-monitor/verification.ts`、`tests/unit/renderer/hot-monitor/verification.test.ts` |
| 2 | 新增复盘验证面板组件 | `src/renderer/entries/hot-monitor/components/ReviewVerificationPanel.tsx`、`tests/unit/components/ReviewVerificationPanel.test.tsx` |
| 3 | 抽出可返回 `HotRunSummary` 的运行 helper | `src/renderer/entries/hot-monitor/App.tsx`、`tests/unit/components/HotMonitorApp.test.tsx` |
| 4 | 接入验证重跑和新批次质量扫描 | `src/renderer/entries/hot-monitor/App.tsx`、`tests/unit/components/HotMonitorApp.test.tsx` |
| 5 | 更新当前状态并跑 Phase 7 聚焦验证 | `docs/overview/current-status.md` |

## 12. 成功标准

Phase 7 完成后，用户应该能说清楚：

> 我在 Hot Monitor 处理失败采集后，不只是记录复盘和回流模板，还能立刻重跑一次当前采集源，并看到新批次的结果数量、质量分和质量问题。如果新批次通过，我就知道这次治理有效；如果仍然失败，我可以继续介入或进入 Data Center 查明问题。

这一步完成后，热点黄金路径会从“复盘可回流”提升到“回流可验证”。后续再做质量规则生成、AI 复盘初稿或自动修复时，会有更清晰的输入和验收基线。
