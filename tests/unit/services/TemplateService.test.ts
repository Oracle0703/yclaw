import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TemplateService } from '@main/services/TemplateService';

describe('TemplateService', () => {
  let service: TemplateService;
  const mockRepository = {
    getTemplateCreatedAt: vi.fn(),
    getTemplate: vi.fn(),
    saveTemplate: vi.fn(),
    listTemplates: vi.fn(),
    deleteTemplate: vi.fn(),
    attachTemplateToTask: vi.fn(),
    linkReview: vi.fn(),
    updateTemplateGovernance: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TemplateService({ templateRepository: mockRepository });
  });

  it('requires template repository injection', () => {
    expect(() => new TemplateService()).toThrow('templateRepository is required');
  });

  it('saves templates and lists them later', () => {
    mockRepository.saveTemplate.mockImplementationOnce((template) => ({
      ...template,
      createdAt: '2026-04-15T00:00:00.000Z',
      updatedAt: '2026-04-15T00:00:00.000Z',
    }));
    mockRepository.listTemplates.mockReturnValueOnce([
      {
        id: 'template-1',
        name: '价格采集',
        fields: [{ name: 'price', selector: '.price', attribute: 'textContent' }],
        createdAt: '2026-04-15T00:00:00.000Z',
        updatedAt: '2026-04-15T00:00:00.000Z',
      },
    ]);

    service.saveTemplate({
      id: 'template-1',
      name: '价格采集',
      fields: [{ name: 'price', selector: '.price', attribute: 'textContent' }],
    });
    const templates = service.listTemplates();

    expect(mockRepository.saveTemplate).toHaveBeenCalled();
    expect(templates).toHaveLength(1);
    expect(templates[0].fields[0].name).toBe('price');
  });

  it('attaches a template to a task', () => {
    service.attachTemplateToTask('task-1', 'template-1');

    expect(mockRepository.attachTemplateToTask).toHaveBeenCalledWith('task-1', 'template-1');
  });

  it('preserves createdAt when updating an existing template', () => {
    mockRepository.getTemplateCreatedAt.mockReturnValueOnce('2026-04-15T00:00:00.000Z');
    mockRepository.saveTemplate.mockImplementationOnce((template) => ({
      ...template,
      createdAt: '2026-04-15T00:00:00.000Z',
      updatedAt: '2026-04-16T00:00:00.000Z',
    }));

    const template = service.saveTemplate({
      id: 'template-1',
      name: '价格采集-更新',
      fields: [{ name: 'price', selector: '.price', attribute: 'textContent' }],
    });

    expect(mockRepository.saveTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'template-1',
        name: '价格采集-更新',
        createdAt: '2026-04-15T00:00:00.000Z',
      }),
    );
    expect(template.createdAt).toBe('2026-04-15T00:00:00.000Z');
  });

  it('clears task bindings before deleting templates', () => {
    service.deleteTemplate('template-1');

    expect(mockRepository.deleteTemplate).toHaveBeenCalledWith('template-1');
  });

  it('links template to review for asset traceability', () => {
    service.linkReview('review-1', 'template-1');

    expect(mockRepository.linkReview).toHaveBeenCalledWith('review-1', 'template-1');
  });

  it('updates template governance metadata', () => {
    service.updateTemplateGovernance('template-1', {
      version: 'v2',
      deprecated: true,
      description: '价格模板已迁移到新版 DOM',
      pluginDependencies: ['ocr-helper'],
    });

    expect(mockRepository.updateTemplateGovernance).toHaveBeenCalledWith('template-1', {
      version: 'v2',
      deprecated: true,
      description: '价格模板已迁移到新版 DOM',
      pluginDependencies: ['ocr-helper'],
    });
  });

  it('applies template backflow draft to governance and review link', () => {
    const applied = service.applyTemplateBackflowDraft({
      reviewId: 'review-1',
      templateId: 'template-1',
      title: '回流复盘结论到模板',
      status: 'draft',
      riskLevel: 'medium',
      proposedChanges: [
        { type: 'selector-update', description: '价格字段选择器需要改为 .price-current' },
      ],
      executionSteps: ['更新模板字段或选择器'],
      acceptanceCriteria: ['模板更新后通过一次任务试运行'],
      sourceConclusion: '价格字段选择器需要改为 .price-current',
      owner: 'alice',
    }, 'operator-a');

    expect(mockRepository.updateTemplateGovernance).toHaveBeenCalledWith('template-1', {
      version: 'review-review-1',
      deprecated: false,
      description: '回流复盘结论到模板：价格字段选择器需要改为 .price-current',
      pluginDependencies: [],
    });
    expect(mockRepository.linkReview).toHaveBeenCalledWith('review-1', 'template-1');
    expect(applied).toMatchObject({
      reviewId: 'review-1',
      templateId: 'template-1',
      appliedBy: 'operator-a',
      appliedChanges: ['价格字段选择器需要改为 .price-current'],
    });
  });

  it('rewrites template field selector when applying selector backflow draft', () => {
    mockRepository.getTemplate.mockReturnValueOnce({
      id: 'template-1',
      name: '价格采集',
      fields: [
        { name: 'price', selector: '.price-old', attribute: 'textContent' },
        { name: 'title', selector: '.title', attribute: 'textContent' },
      ],
      version: 'v1',
      description: '旧模板',
      deprecated: false,
      pluginDependencies: ['ocr-helper'],
      createdAt: '2026-04-20T00:00:00.000Z',
      updatedAt: '2026-04-20T00:00:00.000Z',
    });

    service.applyTemplateBackflowDraft({
      reviewId: 'review-1',
      templateId: 'template-1',
      title: '回流复盘结论到模板',
      status: 'draft',
      riskLevel: 'medium',
      proposedChanges: [
        { type: 'selector-update', description: '价格字段选择器需要改为 .price-current' },
      ],
      executionSteps: ['更新模板字段或选择器'],
      acceptanceCriteria: ['模板更新后通过一次任务试运行'],
      sourceConclusion: '价格字段选择器需要改为 .price-current',
      owner: 'alice',
    });

    expect(mockRepository.saveTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'template-1',
        fields: [
          { name: 'price', selector: '.price-current', attribute: 'textContent' },
          { name: 'title', selector: '.title', attribute: 'textContent' },
        ],
        version: 'review-review-1',
        pluginDependencies: ['ocr-helper'],
      }),
    );
  });
});
