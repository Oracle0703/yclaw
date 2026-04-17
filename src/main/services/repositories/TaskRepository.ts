import type { TaskFlow, TaskStep } from '@shared/types';

interface TaskRepositoryExecutor {
  all<T = Record<string, unknown>>(sql: string, params?: unknown[]): T[];
  get<T = Record<string, unknown>>(sql: string, params?: unknown[]): T | undefined;
  run(sql: string, params?: unknown[]): { changes?: number };
  transaction<T>(fn: () => T): T;
}

interface TaskListRow {
  id: string;
  name: string;
  status: string;
  updatedAt: string;
  scheduleJson?: string | null;
  nextRunAt?: string | null;
  lastRunAt?: string | null;
  latestBatchJson?: string | null;
}

interface TaskFlowRow {
  id: string;
  name: string;
  description?: string | null;
  flowJson: string;
  createdAt: string;
  updatedAt: string;
}

interface TaskStepRow {
  id: string;
  name: string;
  actionJson: string;
  retryCount?: number | null;
  retryDelay?: number | null;
}

export class TaskRepository {
  constructor(private readonly executor: TaskRepositoryExecutor) {}

  getTasks(): Array<{
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
  }> {
    return this.executor.all<TaskListRow>(
      `
        SELECT
          tasks.id,
          tasks.name,
          tasks.status,
          tasks.schedule_json AS scheduleJson,
          tasks.next_run_at AS nextRunAt,
          tasks.last_run_at AS lastRunAt,
          tasks.updated_at AS updatedAt,
          (
            SELECT json_object(
              'id', task_batches.id,
              'taskId', task_batches.task_id,
              'status', task_batches.status,
              'createdAt', task_batches.created_at,
              'stepResults', json(task_batches.step_results)
            )
            FROM task_batches
            WHERE task_batches.task_id = tasks.id
            ORDER BY task_batches.created_at DESC
            LIMIT 1
          ) AS latestBatchJson
        FROM tasks
        ORDER BY tasks.updated_at DESC
      `,
    ).map((task) => ({
      id: task.id,
      name: task.name,
      status: task.status,
      schedule: parseJson(task.scheduleJson, null),
      nextRunAt: task.nextRunAt ?? null,
      lastRunAt: task.lastRunAt ?? null,
      updatedAt: task.updatedAt,
      latestBatch: parseJson(task.latestBatchJson, null),
    }));
  }

  getTaskFlow(taskId: string): TaskFlow | null {
    const task = this.executor.get<TaskFlowRow>(
      `
        SELECT
          id,
          name,
          description,
          flow_json AS flowJson,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM tasks
        WHERE id = ?
      `,
      [taskId],
    );

    if (!task) {
      return null;
    }

    const parsed = parseJson<Partial<TaskFlow>>(task.flowJson, {});
    const steps = parsed.steps && parsed.steps.length > 0
      ? parsed.steps
      : this.getTaskSteps(taskId);

    return {
      id: task.id,
      name: task.name,
      description: task.description ?? undefined,
      steps,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    };
  }

  updateTaskStatus(taskId: string, status: string): void {
    this.executor.run(
      `
        UPDATE tasks
        SET status = ?, updated_at = datetime('now')
        WHERE id = ?
      `,
      [status, taskId],
    );
  }

  createTask(task: {
    id: string;
    name: string;
    description?: string;
    flowJson: string;
    scheduleJson?: string | null;
    sessionId?: string | null;
    templateId?: string | null;
  }): void {
    this.executor.run(
      `
        INSERT INTO tasks (
          id,
          name,
          description,
          flow_json,
          schedule_json,
          session_id,
          template_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        task.id,
        task.name,
        task.description ?? null,
        task.flowJson,
        task.scheduleJson ?? null,
        task.sessionId ?? null,
        task.templateId ?? null,
      ],
    );
  }

  updateTask(
    taskId: string,
    updates: {
      name?: string;
      description?: string;
      flowJson?: string;
      scheduleJson?: string | null;
      sessionId?: string | null;
      templateId?: string | null;
    },
  ): void {
    const fields: string[] = [];
    const params: unknown[] = [];
    const fieldMap: Array<[keyof typeof updates, string]> = [
      ['name', 'name'],
      ['description', 'description'],
      ['flowJson', 'flow_json'],
      ['scheduleJson', 'schedule_json'],
      ['sessionId', 'session_id'],
      ['templateId', 'template_id'],
    ];

    fieldMap.forEach(([key, column]) => {
      if (Object.prototype.hasOwnProperty.call(updates, key)) {
        fields.push(`${column} = ?`);
        params.push(updates[key]);
      }
    });

    if (fields.length === 0) {
      return;
    }

    params.push(taskId);
    this.executor.run(
      `
        UPDATE tasks
        SET ${fields.join(', ')}, updated_at = datetime('now')
        WHERE id = ?
      `,
      params,
    );
  }

  deleteTask(taskId: string): void {
    this.executor.run('DELETE FROM tasks WHERE id = ?', [taskId]);
  }

  saveTaskFlow(flow: TaskFlow): void {
    this.executor.transaction(() => {
      const flowJson = JSON.stringify({ steps: flow.steps });
      const updateResult = this.executor.run(
        `
          UPDATE tasks
          SET name = ?, description = ?, flow_json = ?, updated_at = datetime('now')
          WHERE id = ?
        `,
        [flow.name, flow.description ?? null, flowJson, flow.id],
      );

      if ((updateResult.changes ?? 0) === 0) {
        this.executor.run(
          `
            INSERT INTO tasks (id, name, description, flow_json, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
          `,
          [flow.id, flow.name, flow.description ?? null, flowJson, flow.createdAt, flow.updatedAt],
        );
      }

      this.executor.run('DELETE FROM task_steps WHERE task_id = ?', [flow.id]);

      flow.steps.forEach((step, index) => {
        this.executor.run(
          `
            INSERT INTO task_steps (
              id,
              task_id,
              step_index,
              name,
              action_json,
              retry_count,
              retry_delay
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `,
          [
            step.id,
            flow.id,
            index,
            step.name,
            JSON.stringify(step.action),
            step.retryCount ?? 3,
            step.retryDelay ?? 1000,
          ],
        );
      });
    });
  }

  private getTaskSteps(taskId: string): TaskStep[] {
    return this.executor.all<TaskStepRow>(
      `
        SELECT id, name, action_json AS actionJson, retry_count AS retryCount, retry_delay AS retryDelay
        FROM task_steps
        WHERE task_id = ?
        ORDER BY step_index ASC
      `,
      [taskId],
    ).map((step) => ({
      id: step.id,
      name: step.name,
      action: parseJson(step.actionJson, { type: 'click', selector: '' } as TaskStep['action']),
      retryCount: step.retryCount ?? 3,
      retryDelay: step.retryDelay ?? 1000,
    }));
  }
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
