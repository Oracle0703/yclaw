import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExtractionTemplate } from '@shared/types';
import { TemplateRepository } from '@main/services/repositories/TemplateRepository';

function createExecutor() {
  return {
    run: vi.fn(),
    get: vi.fn(),
    all: vi.fn(),
    transaction: vi.fn((fn: () => unknown) => fn()),
  };
}

describe('TemplateRepository', () => {
  let executor: ReturnType<typeof createExecutor>;
  let repository: TemplateRepository;

  beforeEach(() => {
    executor = createExecutor();
    repository = new TemplateRepository(executor);
  });

  it('reads existing created_at and upserts template rows', () => {
    executor.get.mockReturnValueOnce({ created_at: '2026-04-16T00:00:00.000Z' });

    expect(repository.getTemplateCreatedAt('template-1')).toBe('2026-04-16T00:00:00.000Z');

    const template: ExtractionTemplate = {
      id: 'template-1',
      name: '价格模板',
      fields: [{ name: 'price', selector: '.price', attribute: 'textContent' }],
      version: 'v1',
      description: null,
      deprecated: false,
      pluginDependencies: [],
      createdAt: '2026-04-16T00:00:00.000Z',
      updatedAt: '2026-04-17T00:00:00.000Z',
    };
    repository.saveTemplate(template);

    expect(executor.run).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO extraction_templates'),
      [
        'template-1',
        '价格模板',
        JSON.stringify([{ name: 'price', selector: '.price', attribute: 'textContent' }]),
        'v1',
        null,
        0,
        JSON.stringify([]),
        '2026-04-16T00:00:00.000Z',
        '2026-04-17T00:00:00.000Z',
      ],
    );
  });

  it('lists templates with parsed fields payload', () => {
    executor.all.mockReturnValueOnce([
      {
        id: 'template-1',
        name: '价格模板',
        fields: JSON.stringify([{ name: 'price', selector: '.price', attribute: 'textContent' }]),
        version: 'v2',
        description: '价格模板说明',
        deprecated: 1,
        plugin_dependencies: JSON.stringify(['ocr-helper']),
        created_at: '2026-04-16T00:00:00.000Z',
        updated_at: '2026-04-17T00:00:00.000Z',
      },
    ]);

    expect(repository.listTemplates()).toEqual([
      {
        id: 'template-1',
        name: '价格模板',
        fields: [{ name: 'price', selector: '.price', attribute: 'textContent' }],
        version: 'v2',
        description: '价格模板说明',
        deprecated: true,
        pluginDependencies: ['ocr-helper'],
        createdAt: '2026-04-16T00:00:00.000Z',
        updatedAt: '2026-04-17T00:00:00.000Z',
      },
    ]);
  });

  it('gets a single template with governance metadata', () => {
    executor.get.mockReturnValueOnce({
      id: 'template-1',
      name: '价格模板',
      fields: JSON.stringify([{ name: 'price', selector: '.price', attribute: 'textContent' }]),
      version: 'v2',
      description: '价格模板说明',
      deprecated: 0,
      plugin_dependencies: JSON.stringify(['ocr-helper']),
      created_at: '2026-04-16T00:00:00.000Z',
      updated_at: '2026-04-17T00:00:00.000Z',
    });

    expect(repository.getTemplate('template-1')).toEqual({
      id: 'template-1',
      name: '价格模板',
      fields: [{ name: 'price', selector: '.price', attribute: 'textContent' }],
      version: 'v2',
      description: '价格模板说明',
      deprecated: false,
      pluginDependencies: ['ocr-helper'],
      createdAt: '2026-04-16T00:00:00.000Z',
      updatedAt: '2026-04-17T00:00:00.000Z',
    });
  });

  it('updates template governance columns', () => {
    repository.updateTemplateGovernance('template-1', {
      version: 'v2',
      deprecated: true,
      description: '价格模板说明',
      pluginDependencies: ['ocr-helper'],
    });

    expect(executor.run).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE extraction_templates'),
      [
        'v2',
        '价格模板说明',
        1,
        JSON.stringify(['ocr-helper']),
        'template-1',
      ],
    );
  });

  it('clears task bindings before delete and can attach template to task', () => {
    repository.deleteTemplate('template-1');
    repository.attachTemplateToTask('task-1', 'template-1');

    expect(executor.transaction).toHaveBeenCalledTimes(1);
    expect(executor.run).toHaveBeenNthCalledWith(
      1,
      'UPDATE tasks SET template_id = NULL WHERE template_id = ?',
      ['template-1'],
    );
    expect(executor.run).toHaveBeenNthCalledWith(
      2,
      'DELETE FROM extraction_templates WHERE id = ?',
      ['template-1'],
    );
    expect(executor.run).toHaveBeenNthCalledWith(
      3,
      "UPDATE tasks SET template_id = ?, updated_at = datetime('now') WHERE id = ?",
      ['template-1', 'task-1'],
    );
  });
});
