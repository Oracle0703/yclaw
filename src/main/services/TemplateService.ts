import { randomUUID } from 'crypto';
import type { DatabaseService } from './DatabaseService';
import type { ExtractionTemplate } from '@shared/types';
import { DatabaseService as DatabaseServiceSingleton } from './DatabaseService';

export interface TemplateServiceOptions {
  databaseService?: Pick<DatabaseService, 'run' | 'all' | 'get' | 'transaction'>;
}

export class TemplateService {
  private readonly databaseService: Pick<DatabaseService, 'run' | 'all' | 'get' | 'transaction'>;

  constructor(options: TemplateServiceOptions = {}) {
    this.databaseService = options.databaseService ?? DatabaseServiceSingleton.getInstance();
  }

  saveTemplate(
    template: Pick<ExtractionTemplate, 'name' | 'fields'> & Partial<Pick<ExtractionTemplate, 'id'>>,
  ): ExtractionTemplate {
    const now = new Date().toISOString();
    const existing = template.id
      ? this.databaseService.get<{ created_at: string }>(
          'SELECT created_at FROM extraction_templates WHERE id = ?',
          [template.id],
        )
      : undefined;
    const record: ExtractionTemplate = {
      id: template.id ?? randomUUID(),
      name: template.name,
      fields: template.fields,
      createdAt: existing?.created_at ?? now,
      updatedAt: now,
    };

    this.databaseService.run(
      `INSERT INTO extraction_templates (id, name, fields, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         fields = excluded.fields,
         updated_at = excluded.updated_at`,
      [record.id, record.name, JSON.stringify(record.fields), record.createdAt, record.updatedAt],
    );

    return record;
  }

  listTemplates(): ExtractionTemplate[] {
    const rows = this.databaseService.all<{
      id: string;
      name: string;
      fields: string;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT id, name, fields, created_at, updated_at
       FROM extraction_templates
       ORDER BY updated_at DESC`,
    );

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      fields: JSON.parse(row.fields) as ExtractionTemplate['fields'],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  deleteTemplate(templateId: string): void {
    this.databaseService.transaction(() => {
      this.databaseService.run('UPDATE tasks SET template_id = NULL WHERE template_id = ?', [
        templateId,
      ]);
      this.databaseService.run('DELETE FROM extraction_templates WHERE id = ?', [templateId]);
    });
  }

  attachTemplateToTask(taskId: string, templateId: string): void {
    this.databaseService.run(
      "UPDATE tasks SET template_id = ?, updated_at = datetime('now') WHERE id = ?",
      [templateId, taskId],
    );
  }
}
