import type { ExtractionTemplate } from '@shared/types';

interface TemplateRepositoryExecutor {
  run(sql: string, params?: unknown[]): { changes?: number };
  get<T = Record<string, unknown>>(sql: string, params?: unknown[]): T | undefined;
  all<T = Record<string, unknown>>(sql: string, params?: unknown[]): T[];
  transaction<T>(fn: () => T): T;
}

interface TemplateRow {
  id: string;
  name: string;
  fields: string;
  created_at: string;
  updated_at: string;
}

export class TemplateRepository {
  constructor(private readonly executor: TemplateRepositoryExecutor) {}

  getTemplateCreatedAt(templateId: string): string | null {
    const row = this.executor.get<{ created_at: string }>(
      'SELECT created_at FROM extraction_templates WHERE id = ?',
      [templateId],
    );

    return row?.created_at ?? null;
  }

  saveTemplate(template: ExtractionTemplate): ExtractionTemplate {
    this.executor.run(
      `INSERT INTO extraction_templates (id, name, fields, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         fields = excluded.fields,
         updated_at = excluded.updated_at`,
      [
        template.id,
        template.name,
        JSON.stringify(template.fields),
        template.createdAt,
        template.updatedAt,
      ],
    );

    return template;
  }

  listTemplates(): ExtractionTemplate[] {
    return this.executor
      .all<TemplateRow>(
        `SELECT id, name, fields, created_at, updated_at
         FROM extraction_templates
         ORDER BY updated_at DESC`,
      )
      .map((row) => ({
        id: row.id,
        name: row.name,
        fields: parseJson<ExtractionTemplate['fields']>(row.fields, []),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
  }

  deleteTemplate(templateId: string): void {
    this.executor.transaction(() => {
      this.executor.run('UPDATE tasks SET template_id = NULL WHERE template_id = ?', [templateId]);
      this.executor.run('DELETE FROM extraction_templates WHERE id = ?', [templateId]);
    });
  }

  attachTemplateToTask(taskId: string, templateId: string): void {
    this.executor.run(
      "UPDATE tasks SET template_id = ?, updated_at = datetime('now') WHERE id = ?",
      [templateId, taskId],
    );
  }
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
