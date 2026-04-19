# Code Review — Automation Browser Ops V1

**分支**: `feature/hy/automation-browser-ops-v1`  
**基线**: `42e5d41b` → **HEAD**: `f145f5c`  
**范围**: 135 files, +23 219 / −10 748 lines  
**Review 日期**: 2025-07-27

---

## 总评

实现完成度较高，新增 8 个服务（TaskService、BatchService、SchedulerService、SessionRegistry、TemplateService、ExecutionLogService、ResultService、AlertService）、多标签浏览器扩展、录制器、干预面板和 E2E 测试框架。代码结构清晰、测试覆盖广。但存在 **3 个 Critical** 问题需阻塞合并，**9 个 Important** 需在本轮修复，**4 个 Minor** 可在后续迭代处理。

---

## Critical

### C-1 · 14 条 IPC 通道已定义但未注册 Handler — 渲染进程调用必崩

| 文件                                                            | 影响                                   |
| --------------------------------------------------------------- | -------------------------------------- |
| `src/shared/constants/channels.ts`                              | 定义了通道常量                         |
| `src/main/app.ts` `registerIpcHandlers()`                       | **缺少** 对应 `ipcController.handle()` |
| `src/renderer/shared/hooks/useIpc.ts`                           | `automation.*` 方法直接调用这些通道    |
| `src/renderer/entries/browser/components/InterventionPanel.tsx` | 调用 `INTERVENTION_RESUME`             |
| `src/renderer/entries/automation/components/ResultTable.tsx`    | 调用 `result:list`、`result:export`    |

**缺少 Handler 的通道清单**:

```
TASK_CREATE, TASK_UPDATE, TASK_DELETE, TASK_DETAIL, TASK_CLONE
INTERVENTION_STATUS, INTERVENTION_TAKEOVER, INTERVENTION_RESUME,
INTERVENTION_SCREENSHOT, INTERVENTION_STEP_INFO
RESULT_LIST, RESULT_DETAIL, RESULT_EXPORT, RESULT_MARK_SUSPICIOUS
EXEC_LOG_QUERY, RECORDER_ACTION
```

**后果**: 渲染进程任何对上述通道的 `invoke()` 都会被 Electron `ipcMain` 拒绝（"No handler registered for …"），导致白屏或功能不可用。

**修复建议**: 在 `app.ts` `registerIpcHandlers()` 末尾补齐所有通道的 handler，委托给对应 Service。至少 `RESULT_LIST / RESULT_EXPORT / INTERVENTION_RESUME` 是渲染侧已有调用的，必须立即补齐。

---

### C-2 · FlowRunner.executeStep 硬编码 taskId 和 batchId

**文件**: `src/engines/automation/FlowRunner.ts` L187-L195

```ts
const batchId = 'batch:flow-1';
// …
this.executionLogService?.append({
  taskId: 'flow-1',   // ← 硬编码
  batchId,             // ← 硬编码
  …
});
```

`FlowRunner.run()` 接收 `TaskFlow` 参数（含 `flow.id`），但 `executeStep()` 没有传递它，且 `batchId` 完全是占位符。所有 execution_logs 都会写入同一组 `task_id='flow-1'` 记录，导致：

- 日志查询/聚合全部归因到错误的 task
- `AlertService.aggregateFromExecutionLogs()` 永远只向 `flow-1` 推告警

**修复建议**: 在 `FlowRunner` 中保存 `flowId`/`batchId` 为实例属性（`run()` 入口时赋值），并在 `executeStep()` 中引用。

---

### C-3 · ResultService CSV 导出存在 CSV 注入风险

**文件**: `src/main/services/ResultService.ts` L155-L162

```ts
const header = ['id', 'taskId', 'batchId', ...fieldNames].join(',');
const lines = results.map((item) =>
  [
    item.id,
    item.taskId,
    item.batchId,
    ...fieldNames.map((field) => JSON.stringify(item.data[field] ?? '')),
  ].join(','),
);
```

- `header` 中的 `fieldNames` 来自用户提取的数据，**未转义**；含逗号或换行的字段名会破坏 CSV 结构。
- `item.id`、`item.taskId`、`item.batchId` 没有用 `JSON.stringify` 包裹；如果 ID 含特殊字符（尽管目前是 UUID，但接口未校验）也会出错。
- **CSV 注入**: 如果 `data[field]` 的值以 `=`、`+`、`-`、`@` 开头，在 Excel 中打开时会被解析为公式。

**修复建议**:

1. 所有单元格统一用 `JSON.stringify()` 包裹
2. 对公式字符前缀 `'` 或输出 BOM + 使用 `csv-stringify` 库
3. `fieldNames` 也需要转义

---

## Important

### I-1 · SchedulerService 无实际定时调度 — start() 仅标记不触发

**文件**: `src/main/services/SchedulerService.ts`

`start()` 把非手动任务 ID 放入 `scheduledTaskIds` Set，但 **没有创建任何 timer / cron job**。`executeTask` 默认回调是 `async () => undefined`。App 构造函数传入的也是无参默认值。

**后果**: 调度功能形同虚设；带 `cron` 或 `once` schedule 的任务永远不会自动执行。

**建议**: 至少对 `type: 'once'` 用 `setTimeout`、对 `type: 'cron'` 用 `node-cron`（specs 已推荐），或在 README 中标注为 "placeholder"。

---

### I-2 · TabManager 录制器 scroll handler 无去抖 — 可生成数千步

**文件**: `src/main/browser/TabManager.ts` L254-L260（注入脚本内）

```js
const scrollHandler = () => {
  pushStep(toStep('页面滚动', { … }));
};
window.addEventListener('scroll', scrollHandler, true);
```

每次 scroll 事件都产生一个步骤。正常页面每秒触发 15-60 次 scroll event，10 秒即 150-600 条记录。

**建议**: 对 `scrollHandler` 做 `debounce(300)`，或仅在 scroll 停止后记录最终位置。

---

### I-3 · DB migration v3 多条 ALTER TABLE 无事务保护

**文件**: `src/main/services/DatabaseService.ts` L420-L490

Migration 3 包含 7 条 `ALTER TABLE` + 5 条 `CREATE TABLE` + 4 条 `CREATE INDEX` + 1 条 `INSERT INTO migrations`。`this.db!.exec(...)` 把它们作为一个字符串执行，SQLite 会自动 autocommit 每条语句。如果中途失败（如列名已存在），后续表/索引不会被创建，但 `migrations` 记录也不写入，导致重启后再次跑迁移但部分列重复报错。

**建议**: 用 `this.db!.transaction(() => { ... })()` 包裹整个迁移块，或在每条 ALTER TABLE 前先判断列是否存在。

---

### I-4 · BatchService.createBatch 把 reason 写入 error 列

**文件**: `src/main/services/BatchService.ts` L37-L46

```ts
this.databaseService.run(
  `INSERT INTO task_batches (…) VALUES (…)`,
  [ …, options.reason ?? null, … ]
);
```

参数位置对应的列是 `error`。这意味着 `reason: 'retry'` 会作为 "error" 存入数据库，与真正的失败 error 混淆。

**建议**: 新增 `reason` 列，或将 `reason` 存入 `breakpoint_json` 的子字段。

---

### I-5 · TemplateService.deleteTemplate 两次 DB 调用无事务

**文件**: `src/main/services/TemplateService.ts` L74-L76

```ts
this.databaseService.run('UPDATE tasks SET template_id = NULL WHERE template_id = ?', [templateId]);
this.databaseService.run('DELETE FROM extraction_templates WHERE id = ?', [templateId]);
```

如果第二条失败（如外键约束），tasks 已被更新但模板仍存在。反过来，如果先删模板会违反外键。

**建议**: 用 `databaseService.transaction()` 包裹。

---

### I-6 · useIpc.automation 硬编码通道字符串

**文件**: `src/renderer/shared/hooks/useIpc.ts` L18-L33

```ts
automation: {
  listTasks: () => invoke('task:list'),      // 应使用 IPC_CHANNELS.TASK_LIST
  startTask: (taskId) => invoke('task:start', …),
  retryBatch: (batchId) => invoke('batch:retry', …),
  // …
}
```

同一文件中，`ExecutionPanel.tsx` 使用 `IPC_CHANNELS` 常量，但 `useIpc.automation` 全部硬编码字符串。如果有人重命名通道常量值，这些调用会静默失败。

**建议**: 统一使用 `IPC_CHANNELS.TASK_LIST` 等常量。

---

### I-7 · AlertService.aggregateFromExecutionLogs 无限制全表扫描

**文件**: `src/main/services/AlertService.ts` L96-L97

```ts
const errorLogs = this.executionLogService
  .query({ level: 'error' })
  .filter((record) => Date.parse(record.createdAt ?? '') >= cutoff);
```

`query({ level: 'error' })` 会取回 execution_logs 表中所有 error 级别的记录，然后在 JS 层做时间过滤。当错误日志积累到万级时，内存和 CPU 开销显著。

**建议**: 在 `ExecutionLogService.query()` 增加 `since?: string` 参数，生成 `WHERE created_at >= ?` 条件。

---

### I-8 · AutomationEngine.runAction timeout timer 永不清除

**文件**: `src/engines/automation/AutomationEngine.ts` L88-L93

```ts
const timeoutPromise = new Promise((_, reject) =>
  setTimeout(() => reject(…), timeout),
);
return Promise.race([actionPromise, timeoutPromise]);
```

如果 `actionPromise` 先 resolve，`setTimeout` 仍在后台运行直到到期。虽然 Promise 已结算所以 reject 无效，但 **timer 本身保留了闭包引用**，大量短期成功 action 会累积无用 timer。

**建议**: 保存 timer ID，在 `.finally()` 中 `clearTimeout()`。

---

### I-9 · E2E 测试用 evaluate(el.click()) 而非 Playwright 原生 click

**文件**: `tests/e2e/automation-browser-ops.spec.ts` L117-L119

```ts
const startButton = page
  .locator('tr', { hasText: '价格监控' })
  .getByRole('button', { name: '启动' });
await startButton.evaluate((element: HTMLButtonElement) => element.click());
```

`evaluate(el.click())` 绕过了 Playwright 的可见性/可操作性检查，测试可能在按钮不可见/不可点击时也通过。

**建议**: 使用 `await startButton.click()` 以获得更真实的交互断言。

---

## Minor

### M-1 · FlowRunner 使用字符串字面量而非枚举

**文件**: `src/engines/automation/FlowRunner.ts` 多处

```ts
this.status = 'running' as TaskStatus; // 应使用 TaskStatusEnum.RUNNING
```

`TaskStatus` enum 已定义在 `@shared/types`，但 FlowRunner 中全部用字符串 + 类型断言。

---

### M-2 · browser.ts Tab 类型与 TabManager.TabInfo 重复定义

**文件**: `src/shared/types/browser.ts` `Tab` vs `src/main/browser/TabManager.ts` `TabInfo`

两个接口字段完全相同，但无继承关系。修改一处容易遗漏另一处。

**建议**: 让 `TabManager.TabInfo` 直接引用 `@shared/types/browser.Tab`。

---

### M-3 · TemplateManager 对简单布尔做 useMemo

**文件**: `src/renderer/entries/automation/components/TemplateManager.tsx` L22

```ts
const hasDraftFields = useMemo(() => draftFields.length > 0, [draftFields]);
```

`draftFields.length > 0` 是 O(1) 操作，不需要 memoize。

---

### M-4 · ResultTable 直接 JSON.stringify 渲染 — 大数据溢出单元格

**文件**: `src/renderer/entries/automation/components/ResultTable.tsx` L56

```tsx
<Typography.Text>{JSON.stringify(record.data)}</Typography.Text>
```

当 `data` 很大时（如包含 HTML 片段），单元格会被撑开且不可读。

**建议**: 使用 `ellipsis` 属性或 `<Typography.Paragraph ellipsis={{ rows: 2 }}>`。

---

## 附录：审查覆盖矩阵

| 审查维度                    | 覆盖 | 要点                                        |
| --------------------------- | ---- | ------------------------------------------- |
| 功能回归                    | ✅   | AppIpcIntegration 405 行覆盖所有现有通道    |
| 类型/测试空白               | ⚠️   | 14 条新通道无 handler → 无法测试            |
| 耦合度                      | ✅   | Service 均支持 DI（options 注入），解耦良好 |
| 边界/资源释放               | ⚠️   | timeout timer 泄漏、scroll handler 无去抖   |
| 文档一致性                  | ✅   | channels.ts 与 specs 38 通道吻合            |
| IPC 校验/DB 迁移/浏览器脚本 | ⚠️   | 迁移无事务、CSV 注入、recorder 无 debounce  |
| E2E 覆盖                    | ✅   | 3 场景覆盖最小闭环，但 click 方式需改进     |
