import type { TaskFlow } from '@shared/types';
import type { TaskSummary } from '@main/services/TaskService';

export type TaskToolbenchTask = TaskSummary | TaskFlow;

export function isJdSigninTask(task: Pick<TaskToolbenchTask, 'kind'> & Partial<TaskFlow>): boolean {
  return task.kind === 'jd-signin' || task.signin?.site === 'jd' || task.templateId === 'jd-signin';
}

export function createDefaultJdSigninConfig(
  overrides: Partial<NonNullable<TaskFlow['signin']>> = {},
): NonNullable<TaskFlow['signin']> {
  return {
    site: 'jd',
    mode: 'api-first-browser-fallback',
    fallbackApiEnabled: true,
    maxRetryPerDay: 1,
    manualInterventionEnabled: true,
    ...overrides,
  };
}

export function normalizeIpcError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
