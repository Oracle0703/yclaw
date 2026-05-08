import type { DataDataset } from '@shared/types';
import type { DataDatasetRepository } from '../repositories/DataDatasetRepository';

interface DatasetServiceOptions {
  repository: Pick<DataDatasetRepository, 'listDatasets' | 'saveDataset' | 'getDataset'>;
  now?: () => Date;
}

type DatasetSaveInput = Omit<DataDataset, 'createdAt' | 'updatedAt'> & {
  createdAt?: string;
  updatedAt?: string;
};

export class DatasetService {
  private readonly repository: Pick<DataDatasetRepository, 'listDatasets' | 'saveDataset' | 'getDataset'>;
  private readonly now: () => Date;

  constructor(options: DatasetServiceOptions) {
    this.repository = options.repository;
    this.now = options.now ?? (() => new Date());
  }

  listDatasets(): DataDataset[] {
    return this.repository.listDatasets();
  }

  getDataset(datasetId: string): DataDataset | null {
    return this.repository.getDataset(datasetId);
  }

  saveDataset(input: DatasetSaveInput): DataDataset {
    const timestamp = this.now().toISOString();
    const dataset: DataDataset = {
      ...input,
      description: input.description ?? null,
      fieldMapping: input.fieldMapping ?? null,
      createdAt: input.createdAt ?? timestamp,
      updatedAt: timestamp,
    };

    this.repository.saveDataset(dataset);
    return dataset;
  }
}
