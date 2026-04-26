import crypto from 'crypto';
import type { TaskBatch, TaskFlow, TaskStatus } from '@shared/types';
import { TaskStatus as TaskStatusEnum } from '@shared/types';
import { EVENTS } from '@shared/constants';
import type { FlowRunner } from '@engines/automation/FlowRunner';
import type { AutomationPage } from '@engines/automation/types';
import { EventBus } from '@main/ipc/EventBus';
import { BatchService } from './BatchService';
import { randomUUID } from 'crypto';
import { TaskRepository } from './repositories';

export interface TaskSummary {
  id: string;
  name: string;
  status: string;
  description?: string;
  entryUrl?: string;
  updatedAt: string;
  schedule?: {
    type: 'manual' | 'once' | 'cron';
    cron?: string;
    runAt?: string;
    timeoutMs?: number;
    maxConcurrency?: number;
  } | null;
  nextRunAt?: string | null;
  lastRunAt?: string | null;
  latestBatch?: {
    id: string;
    taskId: string;
    status: string;
    createdAt: string;
    stepResults: unknown[];
  } | null;
}

export interface TaskState {
  taskId: string;
  status: TaskStatus;
}

export interface TaskServiceOptions {
  taskRepository?: Pick<
    TaskRepository,
    'getTasks' | 'getTaskFlow' | 'saveTaskFlow' | 'updateTaskStatus' | 'createTask' | 'updateTask' | 'deleteTask'
  >;
  createRunner?: () => FlowRunner;
  eventBus?: EventBus;
  batchService?: Pick<
    BatchService,
    'createBatch' | 'startBatch' | 'finishBatch' | 'failBatch' | 'getBatch' | 'listBatchesByTask'
  >;
}

export interface SaveTaskFlowPayload {
  name?: string;
  steps: TaskFlow['steps'];
}

interface ActiveTask {
  flow: TaskFlow;
  runner: FlowRunner;
}

export class TaskService {
  private readonly taskRepository: Pick<
    TaskRepository,
    'getTasks' | 'getTaskFlow' | 'saveTaskFlow' | 'updateTaskStatus' | 'createTask' | 'updateTask' | 'deleteTask'
  >;
  private readonly createRunner: () => FlowRunner;
  private readonly eventBus: EventBus;
  private batchService?: Pick<
    BatchService,
    'createBatch' | 'startBatch' | 'finishBatch' | 'failBatch' | 'getBatch' | 'listBatchesByTask'
  >;
  private readonly activeTasks = new Map<string, ActiveTask>();

  constructor(options: TaskServiceOptions = {}) {
    if (!options.taskRepository) {
      throw new Error('taskRepository is required');
    }

    if (!options.batchService) {
      throw new Error('batchService is required');
    }

    if (!options.eventBus) {
      throw new Error('eventBus is required');
    }

    if (!options.createRunner) {
      throw new Error('createRunner is required');
    }

    this.taskRepository = options.taskRepository;
    this.eventBus = options.eventBus;
    this.createRunner = options.createRunner;
    this.batchService = options.batchService;
  }

  listTasks(): TaskSummary[] {
    return this.taskRepository.getTasks();
  }

  getTaskFlow(taskId: string): TaskFlow {
    const flow = this.taskRepository.getTaskFlow(taskId);
    if (!flow) {
      throw new Error(`Task "${taskId}" not found`);
    }
    return flow;
  }

  saveTaskFlow(
    taskId: string | null | undefined,
    payload: SaveTaskFlowPayload,
  ): TaskFlow {
    const now = new Date().toISOString();
    const currentFlow = taskId
      ? this.getTaskFlow(taskId)
      : {
          id: crypto.randomUUID(),
          name: '未命名任务',
          steps: [],
          createdAt: now,
          updatedAt: now,
        };
    // undefined → 保留已有任务名称；空串/纯空白 → 回退默认值
    const resolvedName =
      payload.name !== undefined
        ? (payload.name.trim() || '未命名任务')
        : currentFlow.name;
    const nextFlow: TaskFlow = {
      ...currentFlow,
      name: resolvedName,
      steps: payload.steps,
      updatedAt: now,
    };
    this.taskRepository.saveTaskFlow(nextFlow);
    return nextFlow;
  }

  saveTaskSteps(taskId: string | null | undefined, steps: TaskFlow['steps']): TaskFlow {
    return this.saveTaskFlow(taskId, { steps });
  }

  startTask(taskId: string, webContents: AutomationPage): TaskState {
    const flow = this.getTaskFlow(taskId);

    const runner = this.createRunner();
    const batch = this.getBatchService().createBatch(taskId, { reason: 'manual' });
    this.getBatchService().startBatch(batch.id);
    this.activeTasks.set(taskId, { flow, runner });
    this.updateStatus(taskId, TaskStatusEnum.RUNNING, flow.id);

    const runTask = async () => {
      try {
        const result = await runner.run(flow, webContents, 0, batch.id);
        this.activeTasks.delete(taskId);
        this.updateStatus(
          taskId,
          result.success ? TaskStatusEnum.COMPLETED : TaskStatusEnum.FAILED,
          flow.id,
        );
        if (result.success) {
          this.getBatchService().finishBatch(batch.id, result.stepResults);
        }
        if (!result.success) {
          this.getBatchService().failBatch(
            batch.id,
            result.error ?? 'Task failed',
            result.breakpoint,
          );
          this.eventBus.emit(EVENTS.TASK_FAILED, {
            flowId: flow.id,
            error: result.error ?? 'Task failed',
          });
        }
      } catch (error) {
        this.eventBus.emit(EVENTS.TASK_FAILED, {
          flowId: flow.id,
          error: error instanceof Error ? error.message : String(error),
        });
        this.getBatchService().failBatch(
          batch.id,
          error instanceof Error ? error.message : String(error),
        );
        this.activeTasks.delete(taskId);
        this.updateStatus(taskId, TaskStatusEnum.FAILED, flow.id);
      }
    };
    void runTask();

    return { taskId, status: TaskStatusEnum.RUNNING };
  }

  pauseTask(taskId: string): TaskState {
    const task = this.getActiveTask(taskId);
    task.runner.pause();
    this.updateStatus(taskId, TaskStatusEnum.PAUSED, task.flow.id);
    this.eventBus.emit(EVENTS.TASK_PAUSED, { flowId: task.flow.id });
    return { taskId, status: TaskStatusEnum.PAUSED };
  }

  resumeTask(taskId: string, webContents: AutomationPage): TaskState {
    const task = this.getActiveTask(taskId);
    const status = task.runner.getStatus();

    if (status === TaskStatusEnum.PAUSED) {
      task.runner.unpause();
    } else {
      void task.runner.resume(task.flow, webContents).catch((error) => {
        this.eventBus.emit(EVENTS.TASK_FAILED, {
          flowId: task.flow.id,
          error: error instanceof Error ? error.message : String(error),
        });
        this.activeTasks.delete(taskId);
        this.updateStatus(taskId, TaskStatusEnum.FAILED, task.flow.id);
      });
    }

    this.updateStatus(taskId, TaskStatusEnum.RUNNING, task.flow.id);
    return { taskId, status: TaskStatusEnum.RUNNING };
  }

  stopTask(taskId: string): TaskState {
    const task = this.getActiveTask(taskId);
    task.runner.abort();
    this.activeTasks.delete(taskId);
    this.updateStatus(taskId, TaskStatusEnum.IDLE, task.flow.id);
    return { taskId, status: TaskStatusEnum.IDLE };
  }

  attachTask(taskId: string, flow: TaskFlow, runner: FlowRunner): void {
    this.activeTasks.set(taskId, { flow, runner });
  }

  listBatches(taskId: string): TaskBatch[] {
    return this.getBatchService().listBatchesByTask(taskId);
  }

  getBatch(batchId: string): TaskBatch | null {
    return this.getBatchService().getBatch(batchId);
  }

  retryBatch(batchId: string): TaskBatch {
    const batch = this.getBatchService().getBatch(batchId);
    if (!batch) {
      throw new Error(`Batch "${batchId}" not found`);
    }

    return this.getBatchService().createBatch(batch.taskId, {
      sourceBatchId: batchId,
      reason: 'retry',
    });
  }

  createTask(payload: {
    name: string;
    description?: string;
    steps?: unknown[];
    entryUrl?: string;
    schedule?: unknown;
    sessionId?: string | null;
    templateId?: string | null;
  }): TaskFlow {
    const id = randomUUID();
    const now = new Date().toISOString();
    const flow: TaskFlow = {
      id,
      name: payload.name,
      description: payload.description,
      steps: (payload.steps ?? []) as TaskFlow['steps'],
      entryUrl: payload.entryUrl,
      schedule: payload.schedule as TaskFlow['schedule'],
      sessionId: payload.sessionId ?? null,
      templateId: payload.templateId ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.taskRepository.createTask({
      id,
      name: payload.name,
      description: payload.description,
      flowJson: JSON.stringify({ steps: flow.steps, entryUrl: flow.entryUrl }),
      scheduleJson: payload.schedule ? JSON.stringify(payload.schedule) : null,
      sessionId: payload.sessionId ?? null,
      templateId: payload.templateId ?? null,
    });
    return flow;
  }

  updateTaskFlow(
    taskId: string,
    payload: {
      name?: string;
      description?: string;
      steps?: unknown[];
      entryUrl?: string;
      schedule?: unknown;
      sessionId?: string | null;
      templateId?: string | null;
    },
  ): TaskFlow | null {
    const existing = this.taskRepository.getTaskFlow(taskId);
    if (!existing) throw new Error(`Task "${taskId}" not found`);
    const flowJson =
      payload.steps || payload.entryUrl !== undefined
        ? JSON.stringify({
            steps: payload.steps ?? existing.steps,
            entryUrl: payload.entryUrl ?? existing.entryUrl,
          })
        : undefined;
    this.taskRepository.updateTask(taskId, {
      name: payload.name,
      description: payload.description,
      flowJson,
      scheduleJson: payload.schedule !== undefined ? JSON.stringify(payload.schedule) : undefined,
      sessionId: payload.sessionId,
      templateId: payload.templateId,
    });
    return this.taskRepository.getTaskFlow(taskId);
  }

  deleteTask(taskId: string): void {
    this.activeTasks.delete(taskId);
    this.taskRepository.deleteTask(taskId);
  }

  getTaskDetail(taskId: string): TaskFlow | null {
    return this.taskRepository.getTaskFlow(taskId);
  }

  cloneTask(taskId: string): TaskFlow {
    const source = this.taskRepository.getTaskFlow(taskId);
    if (!source) throw new Error(`Task "${taskId}" not found`);
    return this.createTask({
      name: `${source.name} (副本)`,
      description: source.description,
      steps: source.steps,
      entryUrl: source.entryUrl,
      schedule: source.schedule,
      sessionId: source.sessionId ?? null,
      templateId: source.templateId ?? null,
    });
  }

  private getBatchService(): Pick<
    BatchService,
    'createBatch' | 'startBatch' | 'finishBatch' | 'failBatch' | 'getBatch' | 'listBatchesByTask'
  > {
    return this.batchService!;
  }

  private getActiveTask(taskId: string): ActiveTask {
    const task = this.activeTasks.get(taskId);
    if (!task) {
      throw new Error(`Task "${taskId}" is not active`);
    }
    return task;
  }

  private updateStatus(taskId: string, status: TaskStatus, flowId: string): void {
    this.taskRepository.updateTaskStatus(taskId, status);
    this.eventBus.emit(EVENTS.TASK_STATUS_CHANGED, { flowId, taskId, status });
  }
}
