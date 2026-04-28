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
  description?: string | null;
  flowJson?: string | null;
  updatedAt: string;
  scheduleJson?: string | null;
  enabled?: number | null;
  tagsJson?: string | null;
  nextRunAt?: string | null;
  lastRunAt?: string | null;
  currentRevisionId?: string | null;
  latestBatchJson?: string | null;
}

interface TaskFlowRow {
  id: string;
  name: string;
  description?: string | null;
  flowJson: string;
  scheduleJson?: string | null;
  sessionId?: string | null;
  templateId?: string | null;
  enabled?: number | null;
  tagsJson?: string | null;
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
    description?: string;
    entryUrl?: string;
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
    currentRevisionId?: string | null;
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
          tasks.description,
          tasks.flow_json AS flowJson,
          tasks.schedule_json AS scheduleJson,
          tasks.enabled AS enabled,
          tasks.tags_json AS tagsJson,
          tasks.next_run_at AS nextRunAt,
          tasks.last_run_at AS lastRunAt,
          tasks.current_revision_id AS currentRevisionId,
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
      description: task.description ?? undefined,
      entryUrl: parseJson<{ entryUrl?: string }>(task.flowJson, {}).entryUrl,
      kind: parseJson<Partial<TaskFlow>>(task.flowJson, {}).kind ?? 'generic',
      signin: parseJson<Partial<TaskFlow>>(task.flowJson, {}).signin ?? null,
      schedule: parseJson(task.scheduleJson, null),
      enabled: task.enabled == null ? true : task.enabled === 1,
      tags: parseJson(task.tagsJson, [] as string[]),
      nextRunAt: task.nextRunAt ?? null,
      lastRunAt: task.lastRunAt ?? null,
      currentRevisionId: task.currentRevisionId ?? null,
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
          schedule_json AS scheduleJson,
          session_id AS sessionId,
          template_id AS templateId,
          enabled AS enabled,
          tags_json AS tagsJson,
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
      kind: parsed.kind ?? 'generic',
      description: task.description ?? undefined,
      entryUrl: parsed.entryUrl,
      steps,
      schedule: parseJson(task.scheduleJson, null),
      signin: parsed.signin ?? null,
      sessionId: task.sessionId ?? null,
      templateId: task.templateId ?? null,
      enabled: task.enabled == null ? true : task.enabled === 1,
      tags: parseJson(task.tagsJson, [] as string[]),
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

  /** 仅返回 created_at；用于 Task-as-Code 幂等导入决策。 */
  getTaskCreatedAt(taskId: string): string | null {
    const row = this.executor.get<{ createdAt: string }>(
      'SELECT created_at AS createdAt FROM tasks WHERE id = ?',
      [taskId],
    );
    return row?.createdAt ?? null;
  }

  createTask(task: {
    id: string;
    name: string;
    description?: string;
    flowJson: string;
    scheduleJson?: string | null;
    sessionId?: string | null;
    templateId?: string | null;
    enabled?: boolean;
    tagsJson?: string | null;
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
          template_id,
          enabled,
          tags_json
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        task.id,
        task.name,
        task.description ?? null,
        task.flowJson,
        task.scheduleJson ?? null,
        task.sessionId ?? null,
        task.templateId ?? null,
        task.enabled === false ? 0 : 1,
        task.tagsJson ?? '[]',
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
      enabled?: boolean;
      tagsJson?: string | null;
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
      ['enabled', 'enabled'],
      ['tagsJson', 'tags_json'],
    ];

    fieldMap.forEach(([key, column]) => {
      if (Object.prototype.hasOwnProperty.call(updates, key)) {
        fields.push(`${column} = ?`);
        params.push(
          key === 'enabled'
            ? updates[key] === false
              ? 0
              : 1
            : updates[key],
        );
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

  /**
   * 保存完整 TaskFlow（双写策略）：
   * - `tasks.flow_json` 存 `{ steps, entryUrl }`，作为「快照 / 容灾恢复」的源；name/description/时间戳走列。
   * - `task_steps` 表存归一化的逐步行，供 SQL 查询/索引/外键引用使用。
   * 两者由本方法在同一事务中刷新；不存在 = INSERT，存在 = UPDATE 后清空 + 重新插入。
   */
  saveTaskFlow(flow: TaskFlow): void {
    this.executor.transaction(() => {
      const flowJson = JSON.stringify({
        steps: flow.steps,
        entryUrl: flow.entryUrl,
        kind: flow.kind ?? 'generic',
        signin: flow.signin ?? null,
      });
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
            INSERT INTO tasks (
              id,
              name,
              description,
              flow_json,
              schedule_json,
              session_id,
              template_id,
              enabled,
              tags_json,
              created_at,
              updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            flow.id,
            flow.name,
            flow.description ?? null,
            flowJson,
            flow.schedule ? JSON.stringify(flow.schedule) : null,
            flow.sessionId ?? null,
            flow.templateId ?? null,
            flow.enabled === false ? 0 : 1,
            JSON.stringify(flow.tags ?? []),
            flow.createdAt,
            flow.updatedAt,
          ],
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
