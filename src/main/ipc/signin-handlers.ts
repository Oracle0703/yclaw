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
}): void {
  const {
    ipcController,
    taskService,
    signinTaskService,
    notificationService,
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

    if (taskId) {
      return taskService.updateTaskFlow(taskId, nextPayload);
    }

    return taskService.createTask(nextPayload);
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
    return '阿里云盘签到';
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : '阿里云盘签到';
}
