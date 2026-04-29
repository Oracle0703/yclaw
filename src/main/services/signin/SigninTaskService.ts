import type { BrowserSession, SigninRunSummary, TaskFlow } from '@shared/types';
import type { SigninExecutionContext, SigninProviderResult } from './types';

interface SigninTaskServiceOptions {
  taskService: {
    getTaskDetail: (taskId: string) => TaskFlow | null;
  };
  runRepository: {
    saveRun: (summary: SigninRunSummary) => void;
    getLatestRun: (taskId: string) => SigninRunSummary | null;
    listRuns: (taskId: string, limit?: number) => SigninRunSummary[];
  };
  sessionRegistry: {
    listSessions: () => BrowserSession[];
  };
  provider: {
    run: (context: SigninExecutionContext) => Promise<SigninProviderResult>;
  };
  scheduler: {
    scheduleRetry: (taskId: string, delayMs: number) => void;
  };
  notificationService: {
    notify: (input: {
      taskId: string;
      taskName: string;
      status: SigninRunSummary['status'];
      failureReason?: SigninRunSummary['failureReason'];
      detail?: string;
      strategyUsed?: SigninRunSummary['strategyUsed'];
    }) => Promise<void>;
  };
}

export class SigninTaskService {
  private readonly taskService: SigninTaskServiceOptions['taskService'];
  private readonly runRepository: SigninTaskServiceOptions['runRepository'];
  private readonly sessionRegistry: SigninTaskServiceOptions['sessionRegistry'];
  private readonly provider: SigninTaskServiceOptions['provider'];
  private readonly scheduler: SigninTaskServiceOptions['scheduler'];
  private readonly notificationService: SigninTaskServiceOptions['notificationService'];
  private readonly latestRuns = new Map<string, SigninRunSummary>();
  private readonly retryCounts = new Map<string, number>();

  constructor(options: SigninTaskServiceOptions) {
    this.taskService = options.taskService;
    this.runRepository = options.runRepository;
    this.sessionRegistry = options.sessionRegistry;
    this.provider = options.provider;
    this.scheduler = options.scheduler;
    this.notificationService = options.notificationService;
  }

  async runTask(taskId: string): Promise<SigninRunSummary> {
    return this.execute(taskId, false);
  }

  async markInterventionResolved(taskId: string): Promise<SigninRunSummary> {
    return this.execute(taskId, true);
  }

  getLatestRun(taskId: string): SigninRunSummary | null {
    const inMemory = this.latestRuns.get(taskId);
    if (inMemory) {
      return inMemory;
    }

    const persisted = this.runRepository.getLatestRun(taskId);
    if (persisted) {
      this.latestRuns.set(taskId, persisted);
      this.retryCounts.set(taskId, persisted.retryCount);
    }
    return persisted;
  }

  getRunHistory(taskId: string, limit = 10): SigninRunSummary[] {
    return this.runRepository.listRuns(taskId, limit);
  }

  private async execute(taskId: string, manualRetry: boolean): Promise<SigninRunSummary> {
    const task = this.taskService.getTaskDetail(taskId);
    if (!task || task.kind !== 'aliyundrive-signin' || !task.signin) {
      throw new Error(`Sign-in task "${taskId}" not found`);
    }

    const existingRetryCount = this.getRetryCount(taskId);
    const nextRetryCount = manualRetry ? existingRetryCount + 1 : existingRetryCount;
    if (manualRetry) {
      this.retryCounts.set(taskId, nextRetryCount);
    }

    const result = await this.provider.run({
      taskId,
      sessionPartition: this.resolveSessionPartition(task.sessionId),
      entryUrl: task.entryUrl ?? 'https://www.aliyundrive.com/',
      refreshToken: task.signin.refreshToken ?? null,
      browserFallbackEnabled: task.signin.fallbackApiEnabled,
      maxRetryPerDay: task.signin.maxRetryPerDay,
    });

    const summary: SigninRunSummary = {
      taskId,
      status: result.status,
      strategyUsed: manualRetry
        ? 'manual-retry'
        : result.strategyUsed,
      failureReason: result.failureReason,
      detail: result.detail,
      debug: result.debug,
      runAt: new Date().toISOString(),
      retryCount: result.status === 'retry_scheduled'
        ? existingRetryCount + 1
        : nextRetryCount,
    };

    if (result.status === 'retry_scheduled') {
      this.retryCounts.set(taskId, existingRetryCount + 1);
      this.scheduler.scheduleRetry(taskId, 15_000);
    } else if (result.status === 'success') {
      this.retryCounts.set(taskId, manualRetry ? nextRetryCount : existingRetryCount);
    }

    this.latestRuns.set(taskId, summary);
    this.runRepository.saveRun(summary);

    await this.notificationService.notify({
      taskId,
      taskName: task.name,
      status: summary.status,
      failureReason: summary.failureReason,
      detail: summary.detail,
      strategyUsed: summary.strategyUsed,
    });

    return summary;
  }

  private resolveSessionPartition(sessionId: string | null | undefined): string {
    if (!sessionId) {
      return 'default';
    }

    return this.sessionRegistry.listSessions().find((session) => session.id === sessionId)?.partition
      ?? 'default';
  }

  private getRetryCount(taskId: string): number {
    const current = this.retryCounts.get(taskId);
    if (typeof current === 'number') {
      return current;
    }

    const persisted = this.runRepository.getLatestRun(taskId);
    if (!persisted) {
      return 0;
    }

    this.latestRuns.set(taskId, persisted);
    this.retryCounts.set(taskId, persisted.retryCount);
    return persisted.retryCount;
  }
}
