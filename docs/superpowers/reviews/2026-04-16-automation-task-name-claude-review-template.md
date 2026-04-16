# Claude Code Review 模板

> 用途：把下面内容直接发给 Claude，让它针对本次“自动化任务名称编辑/保存”改动做代码审核。

---

## 一、直接可用版（已填充当前任务）

```md
请你作为资深 TypeScript / Electron / React 代码审查工程师，对我当前这个分支做一次严格 code review。

你的目标不是解释代码，而是：
1. 找出真实缺陷
2. 找出潜在回归风险
3. 找出设计/边界不一致
4. 找出测试遗漏
5. 明确区分：
   - 必修问题（blocking）
   - 建议优化（non-blocking）

请按下面规则输出：

## 输出要求
- 使用中文
- 先给结论摘要
- 再按严重程度排序
- 每条问题尽量包含：
  - 问题级别：`blocking` / `major` / `minor`
  - 文件路径
  - 问题描述
  - 为什么有风险
  - 建议修复方案
- 如果你认为某处“看起来可疑但证据不足”，请明确标注“需进一步验证”
- 不要泛泛而谈，不要输出空洞风格建议
- 如果没有发现 blocking 问题，也请明确说明“未发现 blocking 问题”

## 本次审查范围
功能目标：为自动化任务增加“任务名称编辑/统一保存”能力

重点关注：
1. 任务名称是否在“新建任务 / 编辑已有任务”两种场景下都正确保存
2. IPC 参数是否前后端一致
3. `TaskService` 的边界是否合理
4. 是否有状态同步问题（taskId、taskName、steps、selectedTaskSummary）
5. 是否会误伤已有 `saveTaskSteps` 调用
6. 测试是否覆盖了核心行为与边界情况

## 主要代码位置
- `src/main/services/TaskService.ts`
- `src/main/app.ts`
- `src/renderer/entries/automation/App.tsx`
- `tests/unit/services/TaskService.test.ts`
- `tests/unit/services/AppIpcIntegration.test.ts`
- `tests/unit/components/AutomationApp.test.tsx`

## 关键实现点
- 服务层新增 `SaveTaskFlowPayload`
- `TaskService.saveTaskFlow(taskId, { name, steps })`
- 保留 `saveTaskSteps()` 兼容旧调用，内部转调 `saveTaskFlow()`
- `task:save` IPC 现在会透传 `name`
- 自动化页面新增 `taskName` 状态与输入框
- “保存任务”时统一提交 `{ taskId, name, steps }`
- 新建任务时若名称为空，服务端回退为 `未命名任务`

## 本次相关提交
- `7b04818 feat: save automation task names in service`
- `e9e7bb5 feat: pass automation task names through ipc`
- `ea0b694 feat: add automation task name editor`

## 已完成验证
- 定向测试通过：
  - `tests/unit/services/TaskService.test.ts`
  - `tests/unit/services/AppIpcIntegration.test.ts`
  - `tests/unit/components/AutomationApp.test.tsx`
- `npm run typecheck` 通过
- 定向 `eslint` 通过

## 已知背景
- 全量 `npm test` 时，当前仓库存在一个与本次改动无直接关系的历史问题：
  - `tests/unit/components/LoadingRegression.test.tsx`
  - 报错：`[vitest-worker]: Timeout calling "onTaskUpdate"`
- 请你在 review 时区分：
  - 本次改动引入的问题
  - 仓库中已存在、但与本次任务无直接关系的问题

请开始 review。
```

---

## 二、通用模板（以后复用）

```md
请你作为资深 TypeScript / Electron / React 代码审查工程师，对我当前分支做一次严格 code review。

你的目标不是解释代码，而是：
1. 找出真实缺陷
2. 找出潜在回归风险
3. 找出设计/边界不一致
4. 找出测试遗漏
5. 明确区分：
   - 必修问题（blocking）
   - 建议优化（non-blocking）

## 输出要求
- 使用中文
- 先给结论摘要
- 再按严重程度排序
- 每条问题尽量包含：
  - 问题级别：`blocking` / `major` / `minor`
  - 文件路径
  - 问题描述
  - 为什么有风险
  - 建议修复方案
- 对证据不足的问题标记“需进一步验证”
- 不要输出空洞风格建议
- 如果未发现 blocking 问题，请明确说明

## 本次审查范围
功能目标：
- [在这里写本次目标]

重点关注：
1. [关注点 1]
2. [关注点 2]
3. [关注点 3]

## 主要代码位置
- `[file-1]`
- `[file-2]`
- `[file-3]`

## 关键实现点
- [实现点 1]
- [实现点 2]
- [实现点 3]

## 本次相关提交
- `[commit-1]`
- `[commit-2]`

## 已完成验证
- [测试/类型检查/lint/build]

## 已知背景
- [仓库已有问题 / 非本次范围]

请开始 review。
```

