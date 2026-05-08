import { describe, expect, it, vi } from 'vitest';

import { DatasetService } from '@main/services/data-center/DatasetService';

describe('DatasetService', () => {
  it('saves datasets with timestamps when missing', () => {
    const repository = {
      listDatasets: vi.fn(() => []),
      saveDataset: vi.fn(),
    };
    const service = new DatasetService({
      repository,
      now: () => new Date('2026-04-21T00:00:00.000Z'),
    });

    service.saveDataset({
      id: 'dataset-1',
      name: 'Default Results',
      query: { page: 1, pageSize: 50 },
      defaultFormat: 'jsonl',
      apiEnabled: false,
    });

    expect(repository.saveDataset).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'dataset-1',
        createdAt: '2026-04-21T00:00:00.000Z',
        updatedAt: '2026-04-21T00:00:00.000Z',
      }),
    );
  });
});
