import crypto from 'node:crypto';
import type {
  CreateRemoteExecutionRequest,
  CreateRemoteSessionRequest,
  CreateRemoteTaskRequest,
  RemoteExecution,
  RemoteExecutionLog,
  RemoteSession,
  RemoteTask,
  RunnerHealthMetrics,
  TaskRevision,
  UpdateRemoteSessionRequest,
  UpdateRemoteTaskRequest,
} from '@shared/types';

export const REMOTE_RUNNER_MAX_CONCURRENCY = 1;

export class InMemoryRemoteRunnerRuntime {
  private readonly tasks = new Map<string, RemoteTask>();
  private readonly revisions = new Map<string, TaskRevision[]>();
  private readonly sessions = new Map<string, RemoteSession>();
  private readonly executions = new Map<string, RemoteExecution>();
  private readonly logs = new Map<string, RemoteExecutionLog[]>();

  listTasks(): RemoteTask[] {
    return Array.from(this.tasks.values()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  createTask(payload: CreateRemoteTaskRequest, actorId: string): { task: RemoteTask; revision: TaskRevision } {
    const now = new Date().toISOString();
    const task: RemoteTask = {
      id: crypto.randomUUID(),
      name: payload.name.trim() || 'Remote task',
      description: payload.description,
      tags: payload.tags ?? [],
      enabled: true,
      createdAt: now,
      updatedAt: now,
    };
    const revision: TaskRevision = {
      revisionId: crypto.randomUUID(),
      taskId: task.id,
      revision: 1,
      flow: {
        ...payload.flow,
        id: payload.flow.id || task.id,
        name: payload.flow.name || task.name,
        updatedAt: now,
      },
      createdAt: now,
      createdBy: actorId,
    };

    this.tasks.set(task.id, task);
    this.revisions.set(task.id, [revision]);
    return { task, revision };
  }

  updateTask(
    taskId: string,
    payload: UpdateRemoteTaskRequest,
    actorId: string,
  ): { task: RemoteTask; revision: TaskRevision } {
    const current = this.requireTask(taskId);
    const now = new Date().toISOString();
    const previousRevisions = this.revisions.get(taskId) ?? [];
    const task: RemoteTask = {
      ...current,
      name: payload.name.trim() || current.name,
      description: payload.description,
      tags: payload.tags ?? current.tags,
      enabled: payload.enabled,
      updatedAt: now,
    };
    const revision: TaskRevision = {
      revisionId: crypto.randomUUID(),
      taskId,
      revision: previousRevisions.length + 1,
      flow: {
        ...payload.flow,
        updatedAt: now,
      },
      createdAt: now,
      createdBy: actorId,
    };

    this.tasks.set(taskId, task);
    this.revisions.set(taskId, [...previousRevisions, revision]);
    return { task, revision };
  }

  deleteTask(taskId: string): { ok: true } {
    this.tasks.delete(taskId);
    this.revisions.delete(taskId);
    return { ok: true };
  }

  listSessions(): RemoteSession[] {
    return Array.from(this.sessions.values()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  createSession(payload: CreateRemoteSessionRequest): RemoteSession {
    const now = new Date().toISOString();
    const session: RemoteSession = {
      id: crypto.randomUUID(),
      name: payload.name.trim() || 'Remote session',
      origin: payload.origin,
      status: 'unknown',
      lastValidatedAt: null,
      expiresAt: payload.expiresAt ?? null,
      createdAt: now,
      updatedAt: now,
    };

    this.sessions.set(session.id, session);
    return session;
  }

  updateSession(sessionId: string, payload: UpdateRemoteSessionRequest): RemoteSession {
    const current = this.requireSession(sessionId);
    const updated: RemoteSession = {
      ...current,
      name: payload.name.trim() || current.name,
      origin: payload.origin,
      status: payload.status ?? current.status,
      expiresAt: payload.expiresAt ?? null,
      updatedAt: new Date().toISOString(),
    };

    this.sessions.set(sessionId, updated);
    return updated;
  }

  validateSession(sessionId: string): RemoteSession {
    const current = this.requireSession(sessionId);
    const updated: RemoteSession = {
      ...current,
      status: 'valid',
      lastValidatedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.sessions.set(sessionId, updated);
    return updated;
  }

  deleteSession(sessionId: string): { ok: true } {
    this.requireSession(sessionId);
    this.sessions.delete(sessionId);
    return { ok: true };
  }

  startExecution(payload: CreateRemoteExecutionRequest, actorId: string, runnerId: string): RemoteExecution {
    this.requireTask(payload.taskId);
    const revision = (this.revisions.get(payload.taskId) ?? []).find(
      (candidate) => candidate.revisionId === payload.revisionId,
    );
    if (!revision) {
      throw Object.assign(new Error('Task revision not found'), { code: 'revision_not_found' });
    }

    const now = new Date().toISOString();
    const execution: RemoteExecution = {
      id: crypto.randomUUID(),
      taskId: payload.taskId,
      revisionId: payload.revisionId,
      runnerId,
      status: 'queued',
      triggeredBy: actorId,
      startedAt: null,
      finishedAt: null,
      cancelledBy: null,
      failureReason: null,
      currentStepId: revision.flow.steps[0]?.id ?? null,
      retryCount: 0,
      resultSummary: null,
      createdAt: now,
      updatedAt: now,
    };

    this.executions.set(execution.id, execution);
    this.logs.set(execution.id, [
      {
        id: crypto.randomUUID(),
        executionId: execution.id,
        level: 'info',
        message: `execution queued: ${execution.id}`,
        stepId: null,
        timestamp: now,
      },
    ]);
    return execution;
  }

  getExecution(executionId: string): RemoteExecution {
    const execution = this.executions.get(executionId);
    if (!execution) {
      throw Object.assign(new Error('Execution not found'), { code: 'execution_not_found' });
    }
    return execution;
  }

  cancelExecution(executionId: string, actorId: string): RemoteExecution {
    const execution = this.getExecution(executionId);
    if (execution.status !== 'queued' && execution.status !== 'running') {
      throw Object.assign(new Error('Execution is not cancelable'), {
        code: 'execution_not_cancelable',
      });
    }

    const now = new Date().toISOString();
    const canceled: RemoteExecution = {
      ...execution,
      status: 'canceled',
      cancelledBy: actorId,
      failureReason: 'user_canceled',
      finishedAt: now,
      updatedAt: now,
    };
    this.executions.set(executionId, canceled);
    this.appendLog(executionId, 'warn', `execution canceled by ${actorId}`);
    return canceled;
  }

  getExecutionLogs(executionId: string): RemoteExecutionLog[] {
    this.getExecution(executionId);
    return this.logs.get(executionId) ?? [];
  }

  listExecutions(): RemoteExecution[] {
    return Array.from(this.executions.values());
  }

  getQueuedCount(): number {
    return this.listExecutions().filter((execution) => execution.status === 'queued').length;
  }

  getRunningCount(): number {
    return this.listExecutions().filter((execution) => execution.status === 'running').length;
  }

  getMetrics(): RunnerHealthMetrics {
    return {
      maxConcurrency: REMOTE_RUNNER_MAX_CONCURRENCY,
      runningCount: this.getRunningCount(),
      cpuUsage: 0,
      memoryUsage: 0,
      heartbeatLatencyMs: 0,
      recentFailureRate: this.calculateRecentFailureRate(),
    };
  }

  getHealth(): { queuedCount: number; runningCount: number } {
    return {
      queuedCount: this.getQueuedCount(),
      runningCount: this.getRunningCount(),
    };
  }

  private calculateRecentFailureRate(): number {
    const terminalExecutions = this.listExecutions()
      .filter((execution) => execution.status !== 'queued' && execution.status !== 'running')
      .sort((left, right) => this.terminalTimestamp(left).localeCompare(this.terminalTimestamp(right)))
      .slice(-20);
    if (terminalExecutions.length === 0) {
      return 0;
    }
    const failed = terminalExecutions.filter(
      (execution) => execution.status === 'failed' || execution.status === 'timeout',
    ).length;
    return failed / terminalExecutions.length;
  }

  private terminalTimestamp(execution: RemoteExecution): string {
    return execution.finishedAt ?? execution.updatedAt;
  }

  private requireTask(taskId: string): RemoteTask {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw Object.assign(new Error('Task not found'), { code: 'task_not_found' });
    }
    return task;
  }

  private requireSession(sessionId: string): RemoteSession {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw Object.assign(new Error('Session not found'), { code: 'session_expired' });
    }

    return session;
  }

  private appendLog(executionId: string, level: RemoteExecutionLog['level'], message: string): void {
    const now = new Date().toISOString();
    const nextLogs = this.logs.get(executionId) ?? [];
    nextLogs.push({
      id: crypto.randomUUID(),
      executionId,
      level,
      message,
      stepId: null,
      timestamp: now,
    });
    this.logs.set(executionId, nextLogs);
  }
}
