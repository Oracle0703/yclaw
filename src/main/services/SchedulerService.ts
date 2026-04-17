import { TaskService } from './TaskService';

export interface SchedulerStatus {
  runningCount: number;
  queuedCount: number;
  scheduledCount: number;
}

export interface SchedulerServiceOptions {
  taskService?: Pick<TaskService, 'listTasks'>;
  executeTask?: (taskId: string) => Promise<void>;
  maxConcurrency?: number;
}

type SchedulableTask = {
  id: string;
  enabled?: boolean;
  schedule?: {
    type?: 'manual' | 'once' | 'cron';
  } | null;
};

/**
 * 调度服务 — 当前为 placeholder 实现
 *
 * start() 仅标记可调度的 task ID，不创建实际 timer/cron job。
 * TODO: 对 type:'once' 使用 setTimeout，对 type:'cron' 引入 node-cron。
 */
export class SchedulerService {
  private readonly taskService: Pick<TaskService, 'listTasks'>;
  private readonly executeTask: (taskId: string) => Promise<void>;
  private readonly maxConcurrency: number;
  private readonly scheduledTaskIds = new Set<string>();
  private readonly queue: string[] = [];
  private runningCount = 0;
  private started = false;

  constructor(options: SchedulerServiceOptions = {}) {
    if (!options.taskService) {
      throw new Error('taskService is required');
    }

    this.taskService = options.taskService;
    this.executeTask = options.executeTask ?? (async (_taskId: string) => undefined);
    this.maxConcurrency = options.maxConcurrency ?? 3;
  }

  start(): void {
    this.started = true;
    this.scheduledTaskIds.clear();

    const tasks = this.taskService.listTasks() as SchedulableTask[];
    for (const task of tasks) {
      if (task.enabled === false) {
        continue;
      }
      if (!task.schedule || task.schedule.type === 'manual') {
        continue;
      }
      this.scheduledTaskIds.add(task.id);
    }
  }

  stop(): void {
    this.started = false;
    this.scheduledTaskIds.clear();
    this.queue.length = 0;
    this.runningCount = 0;
  }

  getStatus(): SchedulerStatus {
    return {
      runningCount: this.runningCount,
      queuedCount: this.queue.length,
      scheduledCount: this.scheduledTaskIds.size,
    };
  }

  getScheduledTaskIds(): string[] {
    return Array.from(this.scheduledTaskIds.values());
  }

  async triggerTask(taskId: string): Promise<void> {
    if (!this.started) {
      this.started = true;
    }

    if (this.runningCount >= this.maxConcurrency) {
      this.queue.push(taskId);
      return;
    }

    this.runningCount += 1;
    void this.executeTask(taskId).finally(() => {
      this.runningCount = Math.max(0, this.runningCount - 1);
      const nextTaskId = this.queue.shift();
      if (nextTaskId) {
        void this.triggerTask(nextTaskId);
      }
    });
  }
}
