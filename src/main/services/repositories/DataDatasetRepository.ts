import type { DataDataset } from '@shared/types';

interface Executor {
  run(sql: string, params?: unknown[]): { changes?: number };
  all<T = Record<string, unknown>>(sql: string, params?: unknown[]): T[];
  get<T = Record<string, unknown>>(sql: string, params?: unknown[]): T | undefined;
}

interface DataDatasetRow {
  id: string;
  name: string;
  description?: string | null;
  query_json: string;
  field_mapping_json?: string | null;
  default_format: DataDataset['defaultFormat'];
  api_enabled: number;
  created_at: string;
  updated_at: string;
}

export class DataDatasetRepository {
  constructor(private readonly executor: Executor) {}

  listDatasets(): DataDataset[] {
    return this.executor
      .all<DataDatasetRow>(
        `SELECT id, name, description, query_json, field_mapping_json, default_format,
                api_enabled, created_at, updated_at
         FROM data_datasets
         ORDER BY updated_at DESC`,
      )
      .map(mapDatasetRow);
  }

  getDataset(datasetId: string): DataDataset | null {
    const row = this.executor.get<DataDatasetRow>(
      `SELECT id, name, description, query_json, field_mapping_json, default_format,
              api_enabled, created_at, updated_at
       FROM data_datasets
       WHERE id = ?`,
      [datasetId],
    );

    return row ? mapDatasetRow(row) : null;
  }

  saveDataset(dataset: DataDataset): void {
    this.executor.run(
      `INSERT OR REPLACE INTO data_datasets (
        id, name, description, query_json, field_mapping_json, default_format,
        api_enabled, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        dataset.id,
        dataset.name,
        dataset.description ?? null,
        JSON.stringify(dataset.query),
        dataset.fieldMapping ? JSON.stringify(dataset.fieldMapping) : null,
        dataset.defaultFormat,
        dataset.apiEnabled ? 1 : 0,
        dataset.createdAt,
        dataset.updatedAt,
      ],
    );
  }
}

function mapDatasetRow(row: DataDatasetRow): DataDataset {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    query: parseJson(row.query_json, { page: 1, pageSize: 50 }),
    fieldMapping: row.field_mapping_json ? parseJson(row.field_mapping_json, null) : null,
    defaultFormat: row.default_format,
    apiEnabled: row.api_enabled === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
