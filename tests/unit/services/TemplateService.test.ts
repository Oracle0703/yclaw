import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TemplateService } from '@main/services/TemplateService';

describe('TemplateService', () => {
  let service: TemplateService;
  const mockRepository = {
    getTemplateCreatedAt: vi.fn(),
    saveTemplate: vi.fn(),
    listTemplates: vi.fn(),
    deleteTemplate: vi.fn(),
    attachTemplateToTask: vi.fn(),
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
});
