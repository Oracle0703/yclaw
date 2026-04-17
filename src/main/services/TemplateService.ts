import { randomUUID } from 'crypto';
import type { ExtractionTemplate } from '@shared/types';
import { TemplateRepository } from './repositories';

export interface TemplateServiceOptions {
  templateRepository?: Pick<
    TemplateRepository,
    'getTemplateCreatedAt' | 'saveTemplate' | 'listTemplates' | 'deleteTemplate' | 'attachTemplateToTask'
  >;
}

export class TemplateService {
  private readonly templateRepository: Pick<
    TemplateRepository,
    'getTemplateCreatedAt' | 'saveTemplate' | 'listTemplates' | 'deleteTemplate' | 'attachTemplateToTask'
  >;

  constructor(options: TemplateServiceOptions = {}) {
    if (!options.templateRepository) {
      throw new Error('templateRepository is required');
    }

    this.templateRepository = options.templateRepository;
  }

  saveTemplate(
    template: Pick<ExtractionTemplate, 'name' | 'fields'> & Partial<Pick<ExtractionTemplate, 'id'>>,
  ): ExtractionTemplate {
    const now = new Date().toISOString();
    const record: ExtractionTemplate = {
      id: template.id ?? randomUUID(),
      name: template.name,
      fields: template.fields,
      createdAt: template.id ? (this.templateRepository.getTemplateCreatedAt(template.id) ?? now) : now,
      updatedAt: now,
    };

    return this.templateRepository.saveTemplate(record);
  }

  listTemplates(): ExtractionTemplate[] {
    return this.templateRepository.listTemplates();
  }

  deleteTemplate(templateId: string): void {
    this.templateRepository.deleteTemplate(templateId);
  }

  attachTemplateToTask(taskId: string, templateId: string): void {
    this.templateRepository.attachTemplateToTask(taskId, templateId);
  }
}
