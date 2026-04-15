import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDb = {
  run: vi.fn(),
  get: vi.fn(),
  all: vi.fn(),
  transaction: vi.fn((fn: () => void) => fn()),
};

vi.mock('@main/services/DatabaseService', () => ({
  DatabaseService: {
    getInstance: vi.fn(() => mockDb),
  },
}));

import { TemplateService } from '@main/services/TemplateService';

describe('TemplateService', () => {
  let service: TemplateService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TemplateService();
  });

  it('saves templates and lists them later', () => {
    mockDb.all.mockReturnValueOnce([
      {
        id: 'template-1',
        name: '价格采集',
        fields: JSON.stringify([{ name: 'price', selector: '.price', attribute: 'textContent' }]),
        created_at: '2026-04-15T00:00:00.000Z',
        updated_at: '2026-04-15T00:00:00.000Z',
      },
    ]);

    service.saveTemplate({
      id: 'template-1',
      name: '价格采集',
      fields: [{ name: 'price', selector: '.price', attribute: 'textContent' }],
    });
    const templates = service.listTemplates();

    expect(mockDb.run).toHaveBeenCalled();
    expect(templates).toHaveLength(1);
    expect(templates[0].fields[0].name).toBe('price');
  });

  it('attaches a template to a task', () => {
    service.attachTemplateToTask('task-1', 'template-1');

    expect(mockDb.run).toHaveBeenCalledWith(expect.stringContaining('UPDATE tasks'), [
      'template-1',
      'task-1',
    ]);
  });

  it('preserves createdAt when updating an existing template', () => {
    mockDb.get.mockReturnValueOnce({
      created_at: '2026-04-15T00:00:00.000Z',
    });

    service.saveTemplate({
      id: 'template-1',
      name: '价格采集-更新',
      fields: [{ name: 'price', selector: '.price', attribute: 'textContent' }],
    });

    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO extraction_templates'),
      expect.arrayContaining([
        'template-1',
        '价格采集-更新',
        JSON.stringify([{ name: 'price', selector: '.price', attribute: 'textContent' }]),
        '2026-04-15T00:00:00.000Z',
      ]),
    );
  });

  it('clears task bindings before deleting templates', () => {
    service.deleteTemplate('template-1');

    expect(mockDb.run).toHaveBeenCalledTimes(2);
    expect(mockDb.run).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('UPDATE tasks SET template_id = NULL'),
      ['template-1'],
    );
    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM extraction_templates'),
      ['template-1'],
    );
  });
});
