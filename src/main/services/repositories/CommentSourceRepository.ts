import type { CommentSource } from '@shared/types';

interface CommentSourceRepositoryExecutor {
  all<T = Record<string, unknown>>(sql: string, params?: unknown[]): T[];
  get<T = Record<string, unknown>>(sql: string, params?: unknown[]): T | undefined;
  run(sql: string, params?: unknown[]): { changes?: number };
}

interface CommentSourceRow {
  id: string;
  task_id: string;
  name: string;
  platform: CommentSource['platform'];
  entry_kind: CommentSource['entryKind'];
  entry_value: string;
  parser_key: string;
  session_id?: string | null;
  schedule_json?: string | null;
  limits_json: string;
  filter_json?: string | null;
  enabled: number;
  tags_json?: string | null;
  created_at: string;
  updated_at: string;
}

export class CommentSourceRepository {
  constructor(private readonly executor: CommentSourceRepositoryExecutor) {}

  listSources(): CommentSource[] {
    return this.executor
      .all<CommentSourceRow>(
        `SELECT
          id,
          task_id,
          name,
          platform,
          entry_kind,
          entry_value,
          parser_key,
          session_id,
          schedule_json,
          limits_json,
          filter_json,
          enabled,
          tags_json,
          created_at,
          updated_at
        FROM comment_sources
        ORDER BY updated_at DESC`,
      )
      .map(mapCommentSourceRow);
  }

  getSource(sourceId: string): CommentSource | null {
    const row = this.executor.get<CommentSourceRow>(
      `SELECT
        id,
        task_id,
        name,
        platform,
        entry_kind,
        entry_value,
        parser_key,
        session_id,
        schedule_json,
        limits_json,
        filter_json,
        enabled,
        tags_json,
        created_at,
        updated_at
      FROM comment_sources
      WHERE id = ?`,
      [sourceId],
    );
    return row ? mapCommentSourceRow(row) : null;
  }

  saveSource(source: CommentSource): void {
    this.executor.run(
      `INSERT INTO comment_sources (
        id,
        task_id,
        name,
        platform,
        entry_kind,
        entry_value,
        parser_key,
        session_id,
        schedule_json,
        limits_json,
        filter_json,
        enabled,
        tags_json,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        task_id = excluded.task_id,
        name = excluded.name,
        platform = excluded.platform,
        entry_kind = excluded.entry_kind,
        entry_value = excluded.entry_value,
        parser_key = excluded.parser_key,
        session_id = excluded.session_id,
        schedule_json = excluded.schedule_json,
        limits_json = excluded.limits_json,
        filter_json = excluded.filter_json,
        enabled = excluded.enabled,
        tags_json = excluded.tags_json,
        updated_at = excluded.updated_at`,
      [
        source.id,
        source.taskId,
        source.name,
        source.platform,
        source.entryKind,
        source.entryValue,
        source.parserKey,
        source.sessionId ?? null,
        source.schedule ? JSON.stringify(source.schedule) : null,
        JSON.stringify(source.limits),
        source.filter ? JSON.stringify(source.filter) : null,
        source.enabled ? 1 : 0,
        JSON.stringify(source.tags ?? []),
        source.createdAt,
        source.updatedAt,
      ],
    );
  }

  deleteSource(sourceId: string): void {
    this.executor.run('DELETE FROM comment_sources WHERE id = ?', [sourceId]);
  }
}

function mapCommentSourceRow(row: CommentSourceRow): CommentSource {
  return {
    id: row.id,
    taskId: row.task_id,
    name: row.name,
    platform: row.platform,
    entryKind: row.entry_kind,
    entryValue: row.entry_value,
    parserKey: row.parser_key,
    sessionId: row.session_id ?? null,
    schedule: parseJson(row.schedule_json, null),
    limits: parseJson(row.limits_json, {
      maxContents: 5,
      maxCommentsPerContent: 20,
      includeSubComments: false,
      crawlIntervalSeconds: 2,
    }),
    filter: parseJson(row.filter_json, null),
    enabled: row.enabled === 1,
    tags: parseJson(row.tags_json, []),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
