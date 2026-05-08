import type {
  RemoteExecutionStatus,
  RemoteRunnerErrorEnvelope,
  RunnerConnection,
} from '@shared/types/remote-runner';

export const REMOTE_RUNNER_PROTOCOL_VERSION = 1 as const;

export const REMOTE_RUNNER_STATUSES = [
  'queued',
  'running',
  'succeeded',
  'failed',
  'canceled',
  'timeout',
  'interrupted',
] as const satisfies readonly RemoteExecutionStatus[];

export const REMOTE_RUNNER_API = {
  INFO: '/v1/runner/info',
  HEALTH: '/v1/runner/health',
  TASKS: '/v1/tasks',
  SESSIONS: '/v1/sessions',
  EXECUTIONS: '/v1/executions',
} as const;

export function sanitizeRunnerConnection(connection: RunnerConnection): RunnerConnection {
  return {
    ...connection,
    tokenRef: connection.tokenRef ? '***' : '',
  };
}

export function toRemoteRunnerError(error: unknown): RemoteRunnerErrorEnvelope['error'] {
  if (typeof error === 'object' && error !== null && 'code' in error && 'message' in error) {
    const typed = error as RemoteRunnerErrorEnvelope['error'];
    return {
      code: typed.code,
      message: typed.message,
      data: typed.data,
    };
  }

  return {
    code: 'runner_unavailable',
    message: error instanceof Error ? error.message : String(error),
  };
}
