import { randomUUID } from 'crypto';
import type {
  ExtractionTemplate,
  TemplateBackflowApplyResult,
  TemplateBackflowDraft,
  TemplateGovernanceUpdate,
} from '@shared/types';
import { TemplateRepository } from './repositories';

export interface TemplateServiceOptions {
  templateRepository?: Pick<
    TemplateRepository,
    | 'getTemplateCreatedAt'
    | 'getTemplate'
    | 'saveTemplate'
    | 'listTemplates'
    | 'deleteTemplate'
    | 'attachTemplateToTask'
    | 'linkReview'
    | 'updateTemplateGovernance'
  >;
}

export class TemplateService {
  private readonly templateRepository: Pick<
    TemplateRepository,
    | 'getTemplateCreatedAt'
    | 'getTemplate'
    | 'saveTemplate'
    | 'listTemplates'
    | 'deleteTemplate'
    | 'attachTemplateToTask'
    | 'linkReview'
    | 'updateTemplateGovernance'
  >;

  constructor(options: TemplateServiceOptions = {}) {
    if (!options.templateRepository) {
      throw new Error('templateRepository is required');
    }

    this.templateRepository = options.templateRepository;
  }

  saveTemplate(
    template: Pick<ExtractionTemplate, 'name' | 'fields'>
      & Partial<Pick<
        ExtractionTemplate,
        'id' | 'version' | 'description' | 'deprecated' | 'pluginDependencies'
      >>,
  ): ExtractionTemplate {
    const now = new Date().toISOString();
    const record: ExtractionTemplate = {
      id: template.id ?? randomUUID(),
      name: template.name,
      fields: template.fields,
      version: template.version ?? 'v1',
      description: template.description ?? null,
      deprecated: template.deprecated ?? false,
      pluginDependencies: template.pluginDependencies ?? [],
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

  linkReview(reviewId: string, templateId: string): void {
    this.templateRepository.linkReview(reviewId, templateId);
  }

  updateTemplateGovernance(templateId: string, governance: TemplateGovernanceUpdate): void {
    this.templateRepository.updateTemplateGovernance(templateId, governance);
  }

  applyTemplateBackflowDraft(
    draft: TemplateBackflowDraft,
    appliedBy = 'current-operator',
  ): TemplateBackflowApplyResult {
    const appliedChanges = draft.proposedChanges.map((change) => change.description);
    const summary = draft.sourceConclusion ?? appliedChanges.join('；') ?? draft.title;
    const existingTemplate = this.templateRepository.getTemplate(draft.templateId);
    const rewrittenTemplate = existingTemplate
      ? rewriteTemplateFromDraft(existingTemplate, draft)
      : null;

    const governance = {
      version: `review-${draft.reviewId}`,
      deprecated: false,
      description: `${draft.title}：${summary}`,
      pluginDependencies: existingTemplate?.pluginDependencies ?? [],
    };

    if (rewrittenTemplate) {
      this.templateRepository.saveTemplate({
        ...rewrittenTemplate,
        ...governance,
        updatedAt: new Date().toISOString(),
      });
    } else {
      this.templateRepository.updateTemplateGovernance(draft.templateId, governance);
    }
    this.templateRepository.linkReview(draft.reviewId, draft.templateId);

    return {
      reviewId: draft.reviewId,
      templateId: draft.templateId,
      appliedBy,
      appliedAt: new Date().toISOString(),
      appliedChanges,
    };
  }
}

function rewriteTemplateFromDraft(
  template: ExtractionTemplate,
  draft: TemplateBackflowDraft,
): ExtractionTemplate | null {
  const selectorChange = draft.proposedChanges.find((change) => change.type === 'selector-update');
  if (!selectorChange) {
    return null;
  }

  const nextSelector = extractSelector(selectorChange.description);
  if (!nextSelector) {
    return null;
  }

  const targetIndex = findTargetFieldIndex(template.fields, selectorChange.description);
  if (targetIndex < 0) {
    return null;
  }

  return {
    ...template,
    fields: template.fields.map((field, index) => (
      index === targetIndex ? { ...field, selector: nextSelector } : field
    )),
  };
}

function extractSelector(description: string): string | null {
  const match = description.match(/(?:改为|更新为|->|to)\s*([.#:[\]\w-]+)/i);
  return match?.[1] ?? null;
}

function findTargetFieldIndex(fields: ExtractionTemplate['fields'], description: string): number {
  const directIndex = fields.findIndex((field) => description.includes(field.name));
  if (directIndex >= 0) {
    return directIndex;
  }

  if (description.includes('价格')) {
    const priceIndex = fields.findIndex((field) => /price/i.test(field.name));
    if (priceIndex >= 0) {
      return priceIndex;
    }
  }

  return fields.length > 0 ? 0 : -1;
}
