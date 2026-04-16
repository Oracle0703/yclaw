# YClaw P0 架构收口 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 收口当前最危险的 P0 架构问题，统一数据库实例生命周期、补齐 IPC 边界校验、建立任务执行闭环。

**Architecture:** 以 `App` 作为唯一组合根，显式创建并注入主进程服务，不再允许业务服务自行获取数据库单例。新增 `TaskExecutionCoordinator` 作为自动化执行编排器，负责批次、执行日志、结果与失败断点的完整闭环；同时把 IPC 从“裸 handler”升级为“schema + handler”注册模式，把输入校验前移到边界。

**Tech Stack:** Electron、TypeScript、better-sqlite3、Zod、Vitest

---

## 范围与边界

| 类型 | 内容 |
| --- | --- |
| In Scope | `DatabaseService` 生命周期统一、`TaskService` 执行链收口、IPC 参数校验框架 |
| Out of Scope | `sandbox: false` 安全基线、自动化脚本注入防护、大页面拆分、Repository 深度拆分 |
| 成功标准 | 业务层不再直接调用 `DatabaseService.getInstance()`；任务执行自动生成并更新 batch；主进程关键 IPC 入口不再依赖 `as` 强转 |

## 文件设计

| 路径 | 类型 | 责任 |
| --- | --- | --- |
| `src/main/bootstrap/createMainServices.ts` | Create | 主进程服务组合根，统一创建并返回服务对象 |
| `src/main/services/TaskExecutionCoordinator.ts` | Create | 编排 task/batch/log/result/alert 的执行闭环 |
| `src/main/ipc/IpcController.ts` | Modify | 支持带 Zod schema 的注册方式 |
| `src/main/app.ts` | Modify | 改为只做装配、启动与分模块注册 |
| `src/main/ai/AIService.ts` | Modify | 通过构造参数注入 DB 依赖和工具 |
| `src/main/ai/ContextManager.ts` | Modify | 去掉隐式单例回退，改成显式依赖 |
| `src/main/ai/tools/taskTools.ts` | Modify | 改为工厂函数，使用注入的 task 查询依赖 |
| `src/main/services/DatabaseService.ts` | Modify | 保留连接/事务能力，逐步淡出全局单例入口 |
| `src/main/services/TaskService.ts` | Modify | 只做任务 CRUD 与状态协调，不直接拼执行闭环 |
| `src/main/services/BatchService.ts` | Modify | 纯 batch 读写，不再承担默认依赖兜底 |
| `src/engines/automation/FlowRunner.ts` | Modify | 专注执行步骤，接受外部传入 batchId / hooks |
| `src/shared/utils/validator.ts` | Modify | 补充任务与 IPC schema |
| `tests/unit/services/TaskExecutionCoordinator.test.ts` | Create | 覆盖 batch 生命周期与失败断点 |
| `tests/unit/services/IpcController.test.ts` | Modify | 覆盖 schema 校验成功/失败 |
| `tests/unit/services/TaskService.test.ts` | Modify | 覆盖委托协调器而不是直接 `runner.run` |
| `tests/unit/services/AIService.test.ts` | Modify | 覆盖 AIService 显式依赖注入 |

## 目标接口草图

### `src/main/bootstrap/createMainServices.ts`

```ts
export interface MainServices {
  databaseService: DatabaseService;
  batchService: BatchService;
  resultService: ResultService;
  executionLogService: ExecutionLogService;
  alertService: AlertService;
  taskExecutionCoordinator: TaskExecutionCoordinator;
  taskService: TaskService;
  aiService: AIService;
}

export function createMainServices(): MainServices {
  const databaseService = new DatabaseService();
  const batchService = new BatchService({ databaseService });
  const resultService = new ResultService({ databaseService });
  const executionLogService = new ExecutionLogService({ databaseService });
  const alertService = new AlertService({ databaseService, executionLogService });
  const taskExecutionCoordinator = new TaskExecutionCoordinator({
    batchService,
    resultService,
    executionLogService,
    alertService,
  });
  const taskService = new TaskService({ databaseService, executionCoordinator: taskExecutionCoordinator });
  const aiService = new AIService({ databaseService, openWindow: () => undefined });

  return {
    databaseService,
    batchService,
    resultService,
    executionLogService,
    alertService,
    taskExecutionCoordinator,
    taskService,
    aiService,
  };
}
```

### `src/main/services/TaskExecutionCoordinator.ts`

```ts
export interface TaskExecutionCoordinatorOptions {
  batchService: Pick<BatchService, 'createBatch' | 'startBatch' | 'finishBatch' | 'failBatch'>;
  resultService: Pick<ResultService, 'saveResult'>;
  executionLogService: Pick<ExecutionLogService, 'append'>;
  createRunner?: () => FlowRunner;
}

export class TaskExecutionCoordinator {
  async execute(task: TaskFlow, webContents: WebContents): Promise<TaskExecutionResult> {
    const batch = this.batchService.createBatch(task.id, { reason: 'manual' });
    this.batchService.startBatch(batch.id);
    const runner = this.createRunner();
    const result = await runner.run(task, webContents, 0, batch.id);
    if (result.success) {
      this.batchService.finishBatch(batch.id, result.stepResults);
    } else {
      this.batchService.failBatch(batch.id, result.error ?? 'Task failed');
    }
    return result;
  }
}
```

### `src/main/ipc/IpcController.ts`

```ts
handleValidated<TArgs, TResult>(
  channel: string,
  schema: z.ZodType<TArgs>,
  handler: (args: TArgs) => Promise<TResult> | TResult,
): void {
  this.handle(channel, async (raw: unknown) => {
    const parsed = schema.parse(raw);
    return handler(parsed);
  });
}
```

## Task 1: 统一主进程服务装配与数据库实例所有权

**Files:**
- Create: `src/main/bootstrap/createMainServices.ts`
- Modify: `src/main/app.ts`
- Modify: `src/main/services/DatabaseService.ts`
- Modify: `src/main/ai/AIService.ts`
- Modify: `src/main/ai/ContextManager.ts`
- Modify: `src/main/ai/tools/taskTools.ts`
- Modify: `src/main/services/BatchService.ts`
- Modify: `src/main/services/TaskService.ts`
- Test: `tests/unit/services/AIService.test.ts`
- Test: `tests/unit/services/TaskService.test.ts`

- [ ] **Step 1: 先写失败测试，锁定“显式注入而非隐式单例”**

在 `tests/unit/services/AIService.test.ts` 增加以下场景：

```ts
it('uses injected database service for AI persistence', async () => {
  const databaseService = {
    saveAIMessage: vi.fn(),
    saveAIConversation: vi.fn(),
    deleteAIConversation: vi.fn(),
  };
  const service = new AIService({ databaseService, config: { provider: 'custom', model: 'demo' } });
  await service.chat({ message: 'hello' });
  expect(databaseService.saveAIMessage).toHaveBeenCalled();
});
```

在 `tests/unit/services/TaskService.test.ts` 增加以下场景：

```ts
it('does not create implicit batch service when dependency is injected', () => {
  const executionCoordinator = { execute: vi.fn(), retryBatch: vi.fn() };
  const service = new TaskService({ databaseService: mockDb as never, executionCoordinator: executionCoordinator as never });
  expect(() => service.listTasks()).not.toThrow();
});
```

- [ ] **Step 2: 运行针对性测试，确认当前实现失败**

Run: `npx vitest run tests/unit/services/AIService.test.ts tests/unit/services/TaskService.test.ts`

Expected: 至少出现一条失败，原因是当前实现仍依赖 `DatabaseService.getInstance()` 或未识别 `executionCoordinator`

- [ ] **Step 3: 新建组合根文件，集中创建主进程服务**

在 `src/main/bootstrap/createMainServices.ts` 中创建 `createMainServices()`，只在这里 `new DatabaseService()`，并用同一个实例构建：

```ts
const databaseService = new DatabaseService();
const batchService = new BatchService({ databaseService });
const taskService = new TaskService({ databaseService, executionCoordinator });
const aiService = new AIService({ databaseService, openWindow });
```

- [ ] **Step 4: 把 AI/Task/Batch/Context 的默认单例回退改为显式依赖**

具体要求：

```ts
export interface AIServiceOptions {
  config?: Partial<AIConfig>;
  openWindow?: (module: string) => void;
  databaseService: Pick<DatabaseService, 'saveAIMessage' | 'saveAIConversation' | 'deleteAIConversation' | 'getTasks' | 'getInstalledPlugins'>;
}
```

```ts
export class ContextManager {
  constructor(
    private readonly databaseService: Pick<DatabaseService, 'getTasks' | 'getInstalledPlugins'>,
  ) {}
}
```

```ts
export function createTaskListTool(
  databaseService: Pick<DatabaseService, 'getTasks'>,
): AITool { /* ... */ }
```

- [ ] **Step 5: 让 `App` 改为消费组合根，而不是自行 new 一堆服务**

修改 `src/main/app.ts`，把构造器中的服务初始化替换为：

```ts
const services = createMainServices({
  openWindow: (module) => this.windowManager.openWindow({ module }),
});
this.databaseService = services.databaseService;
this.taskService = services.taskService;
this.aiService = services.aiService;
```

不要在 `App` 中继续出现新的 `DatabaseService()` / `BatchService()` / `AIService()` 链式手工装配。

- [ ] **Step 6: 重新运行测试，确认依赖注入路径成立**

Run: `npx vitest run tests/unit/services/AIService.test.ts tests/unit/services/TaskService.test.ts`

Expected: PASS

- [ ] **Step 7: 运行类型检查，确认构造参数调整没有留下悬空调用**

Run: `npm run typecheck`

Expected: PASS

## Task 2: 建立任务执行闭环协调器

**Files:**
- Create: `src/main/services/TaskExecutionCoordinator.ts`
- Modify: `src/main/services/TaskService.ts`
- Modify: `src/main/services/BatchService.ts`
- Modify: `src/engines/automation/FlowRunner.ts`
- Modify: `src/main/services/ExecutionLogService.ts`
- Modify: `src/main/services/ResultService.ts`
- Test: `tests/unit/services/TaskExecutionCoordinator.test.ts`
- Test: `tests/unit/services/TaskService.test.ts`
- Test: `tests/unit/engines/FlowRunner.test.ts`

- [ ] **Step 1: 先写协调器失败测试，锁定 batch 生命周期**

创建 `tests/unit/services/TaskExecutionCoordinator.test.ts`：

```ts
it('creates, starts and finishes batch for a successful task', async () => {
  const batchService = {
    createBatch: vi.fn(() => ({ id: 'batch-1', taskId: 'task-1', status: 'pending', createdAt: 'x', stepResults: [] })),
    startBatch: vi.fn(),
    finishBatch: vi.fn(),
    failBatch: vi.fn(),
  };
  const runner = { run: vi.fn().mockResolvedValue({ success: true, stepResults: [] }) };
  const coordinator = new TaskExecutionCoordinator({
    batchService,
    resultService: { saveResult: vi.fn() } as never,
    executionLogService: { append: vi.fn() } as never,
    createRunner: () => runner as never,
  });

  await coordinator.execute(sampleFlow, webContents);

  expect(batchService.createBatch).toHaveBeenCalledWith('task-1', { reason: 'manual' });
  expect(batchService.startBatch).toHaveBeenCalledWith('batch-1');
  expect(batchService.finishBatch).toHaveBeenCalledWith('batch-1', []);
});
```

- [ ] **Step 2: 运行测试，确认当前缺少协调器实现**

Run: `npx vitest run tests/unit/services/TaskExecutionCoordinator.test.ts`

Expected: FAIL with `Cannot find module '@main/services/TaskExecutionCoordinator'`

- [ ] **Step 3: 实现 `TaskExecutionCoordinator`，把 batch、runner、日志与结果归档串起来**

最小实现要求：

```ts
const batch = this.batchService.createBatch(task.id, options);
this.batchService.startBatch(batch.id);
const result = await runner.run(task, webContents, fromStep, batch.id);
if (result.success) {
  this.batchService.finishBatch(batch.id, result.stepResults);
} else {
  this.batchService.failBatch(batch.id, result.error ?? 'Task failed', breakpoint);
}
```

成功场景下把 `stepResults` 逐条交给 `resultService.saveResult(...)`；失败场景下追加 `executionLogService.append(...)` 记录错误。

- [ ] **Step 4: 重构 `TaskService`，改为委托协调器执行**

要求把 `startTask()` 的核心逻辑从：

```ts
const runner = this.createRunner();
const result = await runner.run(flow, webContents, 0);
```

替换为：

```ts
const result = await this.executionCoordinator.execute(flow, webContents, {
  reason: 'manual',
});
```

`retryBatch()` 不能只 `createBatch()`；应调用 `executionCoordinator.retryBatch(batchId, webContents)` 或返回一个“待重试任务”描述给上层驱动真正重跑。

- [ ] **Step 5: 让 `FlowRunner` 专注执行，不再偷偷生成默认 batchId**

把：

```ts
this.batchId = batchId ?? `batch:${flow.id}`;
```

改成：

```ts
this.batchId = batchId ?? '';
```

并在日志输出里只在 `batchId` 存在时附带该字段，避免伪造批次号污染链路。

- [ ] **Step 6: 扩展单测覆盖失败断点和 retry 语义**

在 `tests/unit/services/TaskService.test.ts` 中新增：

```ts
it('delegates task start to execution coordinator', async () => {
  const executionCoordinator = {
    execute: vi.fn().mockResolvedValue({ success: true, stepResults: [] }),
  };
  const service = new TaskService({
    databaseService: mockDb as never,
    executionCoordinator: executionCoordinator as never,
  });
  await service.startTask('task-1', webContents);
  expect(executionCoordinator.execute).toHaveBeenCalled();
});
```

- [ ] **Step 7: 运行相关测试**

Run: `npx vitest run tests/unit/services/TaskExecutionCoordinator.test.ts tests/unit/services/TaskService.test.ts tests/unit/engines/FlowRunner.test.ts`

Expected: PASS

- [ ] **Step 8: 运行类型检查与关键主进程集成测试**

Run: `npm run typecheck`

Run: `npx vitest run tests/unit/services/AppIpcIntegration.test.ts`

Expected: PASS

## Task 3: 把 IPC 改成 schema 驱动的边界校验

**Files:**
- Modify: `src/main/ipc/IpcController.ts`
- Modify: `src/main/app.ts`
- Modify: `src/shared/utils/validator.ts`
- Test: `tests/unit/services/IpcController.test.ts`
- Test: `tests/unit/services/AppIpcIntegration.test.ts`
- Test: `tests/unit/shared/validator.test.ts`

- [ ] **Step 1: 先写失败测试，锁定非法输入要在边界被拒绝**

在 `tests/unit/services/IpcController.test.ts` 中新增：

```ts
it('rejects invalid payload before invoking handler', async () => {
  const controller = new IpcController();
  const handler = vi.fn();
  controller.handleValidated('window:open', windowOpenParamsSchema, handler);
  const registeredHandler = handlers.get('window:open')!;

  const response = await registeredHandler({}, { module: '' });

  expect(response.success).toBe(false);
  expect(handler).not.toHaveBeenCalled();
  expect(response.error?.message).toContain('String must contain at least 1 character');
});
```

- [ ] **Step 2: 运行测试，确认当前控制器还没有 `handleValidated`**

Run: `npx vitest run tests/unit/services/IpcController.test.ts`

Expected: FAIL with `controller.handleValidated is not a function`

- [ ] **Step 3: 在 `IpcController` 中新增校验注册能力**

实现：

```ts
handleValidated<TArgs, TResult>(
  channel: string,
  schema: z.ZodType<TArgs>,
  handler: (args: TArgs) => Promise<TResult> | TResult,
): void {
  this.handle(channel, async (raw: unknown) => {
    const args = schema.parse(raw);
    return handler(args);
  });
}
```

校验失败时保持现有 `IpcResponse` 结构，错误码可新增 `INVALID_ARGUMENT`。

- [ ] **Step 4: 把 `App` 中最容易出错的入口先切到 schema**

第一批至少替换这些 handler：

```ts
IPC_CHANNELS.WINDOW_OPEN
IPC_CHANNELS.LOG_WRITE
IPC_CHANNELS.AI_CHAT
IPC_CHANNELS.CONFIG_SET
IPC_CHANNELS.TASK_CREATE
IPC_CHANNELS.TASK_UPDATE
IPC_CHANNELS.BATCH_RETRY
```

要求使用：

```ts
this.ipcController.handleValidated(IPC_CHANNELS.WINDOW_OPEN, windowOpenParamsSchema, ({ module, options }) => {
  this.windowManager.openWindow({ module, options });
  return { module };
});
```

- [ ] **Step 5: 补充缺失 schema，禁止在 handler 里继续 `unknown as xxx`**

在 `src/shared/utils/validator.ts` 中新增：

```ts
export const taskCreateSchema = z.object({
  name: z.string().min(1).max(128),
  description: z.string().max(512).optional(),
  steps: z.array(taskStepSchema).optional(),
  entryUrl: z.string().url().optional(),
  sessionId: z.string().nullable().optional(),
  templateId: z.string().nullable().optional(),
});
```

`TaskService.createTask()` 和 `updateTaskFlow()` 的参数类型改为吃 schema 推导结果，而不是 `unknown[]` / `unknown`。

- [ ] **Step 6: 运行校验与集成测试**

Run: `npx vitest run tests/unit/services/IpcController.test.ts tests/unit/shared/validator.test.ts tests/unit/services/AppIpcIntegration.test.ts`

Expected: PASS

- [ ] **Step 7: 最后跑一次主验证**

Run: `npm run typecheck`

Run: `npm run lint`

Expected: PASS

## 验收清单

| 检查项 | 验收方式 |
| --- | --- |
| 主进程业务服务不再使用 `DatabaseService.getInstance()` | `rg -n "DatabaseService\\.getInstance\\(" src/main` 仅允许测试或兼容层命中 |
| `TaskService.startTask()` 不直接 `new FlowRunner()` 执行闭环 | 查看 `src/main/services/TaskService.ts` |
| `retryBatch()` 不再只是创建新 batch | 查看 `tests/unit/services/TaskService.test.ts` 与 `TaskExecutionCoordinator` |
| IPC 关键入口具备 schema 校验 | 查看 `src/main/app.ts` 中 `handleValidated(...)` 注册 |
| 类型与静态检查通过 | `npm run typecheck`、`npm run lint` |

## 实施顺序建议

1. 先做 Task 1，确保所有服务的实例生命周期可控。  
2. 再做 Task 2，把自动化执行链闭环收口。  
3. 最后做 Task 3，把边界校验统一起来。  

不要并行做 3 个任务；这三个任务有明确依赖关系。
