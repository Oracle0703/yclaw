import { IPC_CHANNELS } from '@shared/constants';
import type { TaskFlow } from '@shared/types';

interface IpcControllerLike {
  handle(channel: string, handler: (payload: unknown) => unknown): void;
}

interface SigninTaskServiceLike {
  runTask(taskId: string): Promise<unknown>;
  markInterventionResolved(taskId: string): Promise<unknown>;
  getLatestRun(taskId: string): unknown;
  getRunHistory(taskId: string): unknown;
}

interface NotificationServiceLike {
  sendTestEmail(): Promise<unknown>;
}

interface LogServiceLike {
  info(source: 'main', message: string, data?: unknown): void;
  error(source: 'main', message: string, data?: unknown): void;
}

interface TaskServiceLike {
  createTask(payload: {
    name: string;
    entryUrl?: string;
    sessionId?: string | null;
    enabled?: boolean;
    signin: TaskFlow['signin'];
  }): unknown;
  updateTaskFlow(
    taskId: string,
    payload: {
      name?: string;
      entryUrl?: string;
      sessionId?: string | null;
      enabled?: boolean;
      signin?: TaskFlow['signin'];
    },
  ): unknown;
  getTaskDetail(taskId: string): unknown;
}

export function registerSigninHandlers(options: {
  ipcController: IpcControllerLike;
  taskService: TaskServiceLike;
  signinTaskService: SigninTaskServiceLike;
  notificationService: NotificationServiceLike;
  logService?: LogServiceLike;
}): void {
  const {
    ipcController,
    taskService,
    signinTaskService,
    notificationService,
    logService,
  } = options;

  ipcController.handle(IPC_CHANNELS.SIGNIN_TASK_SAVE, (payload) => {
    const body = assertObject(payload);
    const taskId = typeof body.taskId === 'string' && body.taskId.length > 0
      ? body.taskId
      : null;
    const nextPayload = {
      name: normalizeTaskName(body.name),
      entryUrl: typeof body.entryUrl === 'string' ? body.entryUrl : undefined,
      sessionId: typeof body.sessionId === 'string' ? body.sessionId : null,
      enabled: typeof body.enabled === 'boolean' ? body.enabled : undefined,
      signin: body.signin as TaskFlow['signin'],
    };
    const signinPayload = nextPayload.signin;
    const signinSite =
      signinPayload && typeof signinPayload === 'object' && 'site' in signinPayload
        ? signinPayload.site
        : null;
    const hasLoginSnapshot =
      signinPayload && typeof signinPayload === 'object' &&
      (
        ('userName' in signinPayload &&
          typeof signinPayload.userName === 'string' &&
          signinPayload.userName.length > 0) ||
        ('localStorageSnapshot' in signinPayload &&
          signinPayload.localStorageSnapshot != null)
      );
    const requestLog = {
      taskId,
      name: nextPayload.name,
      entryUrl: nextPayload.entryUrl ?? null,
      sessionId: nextPayload.sessionId ?? null,
      enabled: nextPayload.enabled ?? null,
      signinSite,
      hasLoginSnapshot,
    };
    logService?.info('main', 'signin task save requested', requestLog);

    try {
      const saved = taskId
        ? taskService.updateTaskFlow(taskId, nextPayload)
        : taskService.createTask(nextPayload);

      logService?.info('main', 'signin task save succeeded', {
        ...requestLog,
        taskId,
        created: !taskId,
        savedTaskId: extractTaskId(saved) ?? taskId,
      });

      return saved;
    } catch (error) {
      logService?.error('main', 'signin task save failed', {
        ...requestLog,
        error: serializeError(error),
      });
      throw error;
    }
  });

  ipcController.handle(IPC_CHANNELS.SIGNIN_TASK_GET, (payload) => {
    const body = assertObject(payload);
    return taskService.getTaskDetail(assertString(body.taskId, 'taskId'));
  });

  ipcController.handle(IPC_CHANNELS.SIGNIN_TASK_RUN_NOW, (payload) => {
    const body = assertObject(payload);
    return signinTaskService.runTask(assertString(body.taskId, 'taskId'));
  });

  ipcController.handle(IPC_CHANNELS.SIGNIN_TASK_INTERVENTION_RETRY, (payload) => {
    const body = assertObject(payload);
    return signinTaskService.markInterventionResolved(assertString(body.taskId, 'taskId'));
  });

  ipcController.handle(IPC_CHANNELS.SIGNIN_TASK_STATUS, (payload) => {
    const body = assertObject(payload);
    return signinTaskService.getLatestRun(assertString(body.taskId, 'taskId'));
  });

  ipcController.handle(IPC_CHANNELS.SIGNIN_TASK_HISTORY, (payload) => {
    const body = assertObject(payload);
    return signinTaskService.getRunHistory(assertString(body.taskId, 'taskId'));
  });

  ipcController.handle(IPC_CHANNELS.SIGNIN_NOTIFICATION_TEST_EMAIL, () => {
    return notificationService.sendTestEmail();
  });
}

function assertObject(payload: unknown): Record<string, unknown> {
  if (typeof payload !== 'object' || payload === null) {
    throw new Error('payload object is required');
  }
  return payload as Record<string, unknown>;
}

function assertString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${field} is required`);
  }
  return value;
}

function normalizeTaskName(value: unknown): string {
  if (typeof value !== 'string') {
    return '京东签到';
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : '京东签到';
}

function extractTaskId(value: unknown): string | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const taskId = (value as { id?: unknown }).id;
  return typeof taskId === 'string' && taskId.length > 0 ? taskId : null;
}

function serializeError(error: unknown): {
  message: string;
  stack?: string;
} {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    message: String(error),
  };
}
