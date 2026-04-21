import crypto from 'crypto';
import type { RemoteExecution, RunnerNode, RunnerQueueItem, RunnerRemoteDispatch } from '@shared/types';

export interface RunnerDispatchInput {
  runnerId: string;
  runner: RunnerNode;
  queueItem: RunnerQueueItem;
}

export interface RunnerDispatchResult {
  executionId: string;
}

export interface RunnerAdapter {
  dispatch(input: RunnerDispatchInput): Promise<RunnerDispatchResult>;
}

interface RemoteRunnerServiceLike {
  startExecution(payload: {
    runnerConnectionId: string;
    taskId: string;
    revisionId: string;
    sessionId?: string | null;
    timeoutMs?: number;
    retry?: {
      maxAttempts: number;
      backoff: 'fixed' | 'exponential';
    };
  }): Promise<Pick<RemoteExecution, 'id'>>;
}

export class LocalRunnerAdapter implements RunnerAdapter {
  async dispatch(): Promise<RunnerDispatchResult> {
    return { executionId: `local-${crypto.randomUUID()}` };
  }
}

export class RemoteRunnerAdapter implements RunnerAdapter {
  constructor(private readonly remoteRunnerService: RemoteRunnerServiceLike) {}

  async dispatch(input: RunnerDispatchInput): Promise<RunnerDispatchResult> {
    const metadata = this.requireRemoteDispatch(input.queueItem);
    const response = await this.remoteRunnerService.startExecution({
      runnerConnectionId: metadata.runnerConnectionId,
      taskId: input.queueItem.taskId,
      revisionId: metadata.revisionId,
      sessionId: metadata.sessionId,
      timeoutMs: metadata.timeoutMs,
      retry: metadata.retry,
    });

    return {
      executionId: this.extractExecutionId(response),
    };
  }

  private extractExecutionId(response: Pick<RemoteExecution, 'id'>): string {
    if (typeof response.id === 'string' && response.id.length > 0) {
      return response.id;
    }

    throw new Error('Remote execution id is required');
  }

  private requireRemoteDispatch(queueItem: RunnerQueueItem): RunnerRemoteDispatch {
    if (!queueItem.remoteDispatch) {
      throw new Error('remoteDispatch is required for remote runner dispatch');
    }

    const { runnerConnectionId, revisionId } = queueItem.remoteDispatch;
    if (runnerConnectionId.length === 0 || revisionId.length === 0) {
      throw new Error('remoteDispatch.runnerConnectionId and remoteDispatch.revisionId are required');
    }

    return queueItem.remoteDispatch;
  }
}
