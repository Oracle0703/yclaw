import type { HotSource } from '@shared/types';

interface HotSourceRepositoryExecutor {
  all<T = Record<string, unknown>>(sql: string, params?: unknown[]): T[];
  get<T = Record<string, unknown>>(sql: string, params?: unknown[]): T | undefined;
  run(sql: string, params?: unknown[]): { changes?: number };
}

interface HotSourceRow {
  id: string;
  task_id: string;
  name: string;
  source_kind: HotSource['sourceKind'];
  site_key: string;
  entry_url: string;
  parser_key: string;
  platform_ids_json?: string | null;
  session_id?: string | null;
  schedule_json?: string | null;
  filter_json?: string | null;
  timeline_json?: string | null;
  enabled: number;
  tags_json?: string | null;
  created_at: string;
  updated_at: string;
}

export class HotSourceRepository {
  constructor(private readonly executor: HotSourceRepositoryExecutor) {}

  listSources(): HotSource[] {
    return this.executor
      .all<HotSourceRow>(
        `SELECT
          id,
          task_id,
          name,
          source_kind,
          site_key,
          entry_url,
          parser_key,
          platform_ids_json,
          session_id,
          schedule_json,
          filter_json,
          timeline_json,
          enabled,
          tags_json,
          created_at,
          updated_at
        FROM hot_sources
        ORDER BY updated_at DESC`,
      )
      .map(mapHotSourceRow);
  }

  getSource(sourceId: string): HotSource | null {
    const row = this.executor.get<HotSourceRow>(
      `SELECT
        id,
        task_id,
        name,
        source_kind,
        site_key,
        entry_url,
        parser_key,
        platform_ids_json,
        session_id,
        schedule_json,
        filter_json,
        timeline_json,
        enabled,
        tags_json,
        created_at,
        updated_at
      FROM hot_sources
      WHERE id = ?`,
      [sourceId],
    );

    return row ? mapHotSourceRow(row) : null;
  }

  saveSource(source: HotSource): void {
    this.executor.run(
      `INSERT INTO hot_sources (
        id,
        task_id,
        name,
        source_kind,
        site_key,
        entry_url,
        parser_key,
        platform_ids_json,
        session_id,
        schedule_json,
        filter_json,
        timeline_json,
        enabled,
        tags_json,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        task_id = excluded.task_id,
        name = excluded.name,
        source_kind = excluded.source_kind,
        site_key = excluded.site_key,
        entry_url = excluded.entry_url,
        parser_key = excluded.parser_key,
        platform_ids_json = excluded.platform_ids_json,
        session_id = excluded.session_id,
        schedule_json = excluded.schedule_json,
        filter_json = excluded.filter_json,
        timeline_json = excluded.timeline_json,
        enabled = excluded.enabled,
        tags_json = excluded.tags_json,
        updated_at = excluded.updated_at`,
      [
        source.id,
        source.taskId,
        source.name,
        source.sourceKind,
        source.siteKey,
        source.entryUrl,
        source.parserKey,
        JSON.stringify(source.platformIds ?? []),
        source.sessionId ?? null,
        source.schedule ? JSON.stringify(source.schedule) : null,
        source.filter ? JSON.stringify(source.filter) : null,
        source.timeline ? JSON.stringify(source.timeline) : null,
        source.enabled ? 1 : 0,
        JSON.stringify(source.tags ?? []),
        source.createdAt,
        source.updatedAt,
      ],
    );
  }

  deleteSource(sourceId: string): void {
    this.executor.run('DELETE FROM hot_sources WHERE id = ?', [sourceId]);
  }
}

function mapHotSourceRow(row: HotSourceRow): HotSource {
  return {
    id: row.id,
    taskId: row.task_id,
    name: row.name,
    sourceKind: row.source_kind,
    siteKey: row.site_key,
    entryUrl: row.entry_url,
    parserKey: row.parser_key,
    platformIds: parseJson(row.platform_ids_json, []),
    sessionId: row.session_id ?? null,
    schedule: parseJson(row.schedule_json, null),
    filter: parseJson(row.filter_json, null),
    timeline: parseJson(row.timeline_json, null),
    enabled: row.enabled === 1,
    tags: parseJson(row.tags_json, []),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
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
