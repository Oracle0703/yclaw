import type { ExtractionTemplate, TemplateGovernanceUpdate } from '@shared/types';

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
  version?: string | null;
  description?: string | null;
  deprecated?: number | null;
  plugin_dependencies?: string | null;
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

  getTemplate(templateId: string): ExtractionTemplate | null {
    const row = this.executor.get<TemplateRow>(
      `SELECT id, name, fields, version, description, deprecated, plugin_dependencies, created_at, updated_at
       FROM extraction_templates
       WHERE id = ?`,
      [templateId],
    );

    return row ? mapTemplateRow(row) : null;
  }

  saveTemplate(template: ExtractionTemplate): ExtractionTemplate {
    this.executor.run(
      `INSERT INTO extraction_templates (
         id, name, fields, version, description, deprecated, plugin_dependencies, created_at, updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         fields = excluded.fields,
         version = excluded.version,
         description = excluded.description,
         deprecated = excluded.deprecated,
         plugin_dependencies = excluded.plugin_dependencies,
         updated_at = excluded.updated_at`,
      [
        template.id,
        template.name,
        JSON.stringify(template.fields),
        template.version ?? 'v1',
        template.description ?? null,
        template.deprecated ? 1 : 0,
        JSON.stringify(template.pluginDependencies ?? []),
        template.createdAt,
        template.updatedAt,
      ],
    );

    return template;
  }

  listTemplates(): ExtractionTemplate[] {
    return this.executor
      .all<TemplateRow>(
        `SELECT id, name, fields, version, description, deprecated, plugin_dependencies, created_at, updated_at
         FROM extraction_templates
         ORDER BY updated_at DESC`,
      )
      .map(mapTemplateRow);
  }

  updateTemplateGovernance(
    templateId: string,
    governance: TemplateGovernanceUpdate,
  ): void {
    this.executor.run(
      `UPDATE extraction_templates
       SET version = ?,
           description = ?,
           deprecated = ?,
           plugin_dependencies = ?,
           updated_at = datetime('now')
       WHERE id = ?`,
      [
        governance.version ?? 'v1',
        governance.description ?? null,
        governance.deprecated ? 1 : 0,
        JSON.stringify(governance.pluginDependencies ?? []),
        templateId,
      ],
    );
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

  linkReview(reviewId: string, templateId: string): void {
    this.executor.run(
      `INSERT INTO template_review_links (review_id, template_id, linked_at)
       VALUES (?, ?, datetime('now'))
       ON CONFLICT(review_id, template_id) DO NOTHING`,
      [reviewId, templateId],
    );
  }
}

function mapTemplateRow(row: TemplateRow): ExtractionTemplate {
  return {
    id: row.id,
    name: row.name,
    fields: parseJson<ExtractionTemplate['fields']>(row.fields, []),
    version: row.version ?? 'v1',
    description: row.description ?? null,
    deprecated: row.deprecated === 1,
    pluginDependencies: parseJson<string[]>(row.plugin_dependencies ?? '[]', []),
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
