import type { SigninRunSummary } from '@shared/types';

interface Executor {
  run(sql: string, params?: unknown[]): { changes?: number };
  all<T = Record<string, unknown>>(sql: string, params?: unknown[]): T[];
  get<T = Record<string, unknown>>(sql: string, params?: unknown[]): T | undefined;
}

interface SigninRunRow {
  task_id: string;
  status: SigninRunSummary['status'];
  strategy_used?: SigninRunSummary['strategyUsed'] | null;
  failure_reason?: SigninRunSummary['failureReason'] | null;
  detail?: string | null;
  debug_json?: string | null;
  reward_json?: string | null;
  run_at: string;
  retry_count: number;
}

export class SigninRunRepository {
  constructor(private readonly executor: Executor) {}

  saveRun(summary: SigninRunSummary): void {
    this.executor.run(
      `INSERT INTO signin_task_runs (
        task_id,
        status,
        strategy_used,
        failure_reason,
        detail,
        debug_json,
        reward_json,
        run_at,
        retry_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        summary.taskId,
        summary.status,
        summary.strategyUsed ?? null,
        summary.failureReason ?? null,
        summary.detail ?? null,
        summary.debug ? JSON.stringify(summary.debug) : null,
        summary.reward ? JSON.stringify(summary.reward) : null,
        summary.runAt,
        summary.retryCount,
      ],
    );
  }

  getLatestRun(taskId: string): SigninRunSummary | null {
    const row = this.executor.get<SigninRunRow>(
      `SELECT
        task_id,
        status,
        strategy_used,
        failure_reason,
        detail,
        debug_json,
        reward_json,
        run_at,
        retry_count
      FROM signin_task_runs
      WHERE task_id = ?
      ORDER BY run_at DESC, id DESC
      LIMIT 1`,
      [taskId],
    );

    if (!row) {
      return null;
    }

    return {
      taskId: row.task_id,
      status: row.status,
      strategyUsed: row.strategy_used ?? undefined,
      failureReason: row.failure_reason ?? undefined,
      detail: row.detail ?? undefined,
      debug: parseJson(row.debug_json, undefined),
      reward: parseJson(row.reward_json, undefined),
      runAt: row.run_at,
      retryCount: row.retry_count,
    };
  }

  listRuns(taskId: string, limit = 10): SigninRunSummary[] {
    return this.executor.all<SigninRunRow>(
      `SELECT
        task_id,
        status,
        strategy_used,
        failure_reason,
        detail,
        debug_json,
        reward_json,
        run_at,
        retry_count
      FROM signin_task_runs
      WHERE task_id = ?
      ORDER BY run_at DESC, id DESC
      LIMIT ?`,
      [taskId, limit],
    ).map((row) => ({
      taskId: row.task_id,
      status: row.status,
      strategyUsed: row.strategy_used ?? undefined,
      failureReason: row.failure_reason ?? undefined,
      detail: row.detail ?? undefined,
      debug: parseJson(row.debug_json, undefined),
      reward: parseJson(row.reward_json, undefined),
      runAt: row.run_at,
      retryCount: row.retry_count,
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
