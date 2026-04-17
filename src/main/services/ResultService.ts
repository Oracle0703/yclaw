import { randomUUID } from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { ExtractionResult } from '@shared/types';
import { ResultRepository } from './repositories';

export interface ResultQuery {
  taskId?: string;
  batchId?: string;
}

export interface ResultServiceOptions {
  resultRepository?: Pick<ResultRepository, 'saveResult' | 'listResults' | 'getResult' | 'markSuspicious'>;
}

export class ResultService {
  private readonly resultRepository: Pick<
    ResultRepository,
    'saveResult' | 'listResults' | 'getResult' | 'markSuspicious'
  >;

  constructor(options: ResultServiceOptions = {}) {
    if (!options.resultRepository) {
      throw new Error('resultRepository is required');
    }

    this.resultRepository = options.resultRepository;
  }

  saveResult(result: Omit<ExtractionResult, 'id'> & { id?: string }): ExtractionResult {
    const record: ExtractionResult = {
      id: result.id ?? randomUUID(),
      taskId: result.taskId,
      batchId: result.batchId,
      templateId: result.templateId ?? null,
      data: result.data,
      status: result.status,
      sourceUrl: result.sourceUrl,
      screenshot: result.screenshot,
      createdAt: result.createdAt,
    };

    this.resultRepository.saveResult(record);

    return record;
  }

  listResults(query: ResultQuery = {}): ExtractionResult[] {
    return this.resultRepository.listResults(query);
  }

  getResult(resultId: string): ExtractionResult | null {
    return this.resultRepository.getResult(resultId);
  }

  markSuspicious(resultId: string): void {
    this.resultRepository.markSuspicious(resultId);
  }

  exportResults(query: ResultQuery, format: 'csv' | 'json'): string {
    const results = this.listResults(query);
    const outputPath = path.join(os.tmpdir(), `yclaw-results-${Date.now()}.${format}`);

    if (format === 'json') {
      fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf8');
      return outputPath;
    }

    const fieldNames = Array.from(new Set(results.flatMap((item) => Object.keys(item.data))));
    const escapeCsvCell = (value: unknown): string => {
      const str = value == null ? '' : String(value);
      // Strip leading formula characters to prevent CSV injection
      const sanitized = str.replace(/^[=+\-@\t\r]/, "'$&");
      // Always quote and escape internal double-quotes
      return `"${sanitized.replace(/"/g, '""')}"`;
    };
    const header = ['id', 'taskId', 'batchId', ...fieldNames].map(escapeCsvCell).join(',');
    const lines = results.map((item) =>
      [item.id, item.taskId, item.batchId, ...fieldNames.map((field) => item.data[field] ?? '')]
        .map(escapeCsvCell)
        .join(','),
    );
    fs.writeFileSync(outputPath, [header, ...lines].join('\n'), 'utf8');
    return outputPath;
  }
}
