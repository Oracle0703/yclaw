import type { WebContents } from 'electron';
import type { TaskFlow, TaskStatus } from '@shared/types';
import { TaskStatus as TaskStatusEnum } from '@shared/types';
import { EVENTS } from '@shared/constants';
import { FlowRunner } from '@engines/automation/FlowRunner';
import { EventBus } from '@main/ipc/EventBus';
import { DatabaseService } from './DatabaseService';

export interface TaskSummary {
  id: string;
  name: string;
  status: string;
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
  databaseService?: Pick<DatabaseService, 'getTasks' | 'getTaskFlow' | 'updateTaskStatus'>;
  createRunner?: () => FlowRunner;
  eventBus?: EventBus;
}

interface ActiveTask {
  flow: TaskFlow;
  runner: FlowRunner;
}

export class TaskService {
  private readonly databaseService: Pick<
    DatabaseService,
    'getTasks' | 'getTaskFlow' | 'updateTaskStatus'
  >;
  private readonly createRunner: () => FlowRunner;
  private readonly eventBus: EventBus;
  private readonly activeTasks = new Map<string, ActiveTask>();

  constructor(options: TaskServiceOptions = {}) {
    this.databaseService = options.databaseService ?? DatabaseService.getInstance();
    this.createRunner = options.createRunner ?? (() => new FlowRunner());
    this.eventBus = options.eventBus ?? EventBus.getInstance();
  }

  listTasks(): TaskSummary[] {
    return this.databaseService.getTasks();
  }

  startTask(taskId: string, webContents: WebContents): TaskState {
    const flow = this.databaseService.getTaskFlow(taskId);
    if (!flow) {
      throw new Error(`Task "${taskId}" not found`);
    }

    const runner = this.createRunner();
    this.activeTasks.set(taskId, { flow, runner });
    this.updateStatus(taskId, TaskStatusEnum.RUNNING, flow.id);

    const runTask = async () => {
      try {
        const result = await runner.run(flow, webContents, 0);
        this.activeTasks.delete(taskId);
        this.updateStatus(
          taskId,
          result.success ? TaskStatusEnum.COMPLETED : TaskStatusEnum.FAILED,
          flow.id,
        );
        if (!result.success) {
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

  resumeTask(taskId: string, webContents: WebContents): TaskState {
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

  private getActiveTask(taskId: string): ActiveTask {
    const task = this.activeTasks.get(taskId);
    if (!task) {
      throw new Error(`Task "${taskId}" is not active`);
    }
    return task;
  }

  private updateStatus(taskId: string, status: TaskStatus, flowId: string): void {
    this.databaseService.updateTaskStatus(taskId, status);
    this.eventBus.emit(EVENTS.TASK_STATUS_CHANGED, { flowId, taskId, status });
  }
}
