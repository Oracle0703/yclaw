import { randomUUID } from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type {
  BatchQualitySummary,
  CrossBatchQualityAnalysis,
  ExtractionResult,
  ResultQualityRule,
  ResultQualityStatus,
} from '@shared/types';
import { ResultRepository } from './repositories';

export interface ResultQuery {
  taskId?: string;
  batchId?: string;
  status?: ExtractionResult['status'][];
  createdFrom?: string;
  createdTo?: string;
  page?: number;
  pageSize?: number;
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
      ...(result.qualityStatus !== undefined ? { qualityStatus: result.qualityStatus } : {}),
      ...(result.evidenceRefs !== undefined ? { evidenceRefs: result.evidenceRefs } : {}),
      ...(result.revisionId !== undefined ? { revisionId: result.revisionId } : {}),
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

  analyzeCrossBatchQuality(
    taskId: string,
    rule: ResultQualityRule = {},
  ): CrossBatchQualityAnalysis {
    const results = this.listResults({ taskId });
    const batchGroups = new Map<string, ExtractionResult[]>();

    for (const result of results) {
      const group = batchGroups.get(result.batchId) ?? [];
      group.push(result);
      batchGroups.set(result.batchId, group);
    }

    const batchSummaries = Array.from(batchGroups.entries()).map(([batchId, batchResults]) =>
      summarizeBatchQuality(batchId, batchResults, rule),
    );

    return {
      taskId,
      totalResults: results.length,
      failedResults: results.filter(isFailedResult).length,
      missingRequiredFieldResults: results.filter((result) =>
        hasMissingRequiredField(result, rule.requiredFields ?? []),
      ).length,
      tracedResults: results.filter(isTraceableResult).length,
      batchSummaries,
    };
  }

  exportResults(query: ResultQuery, format: 'csv' | 'json' | 'jsonl'): string {
    const results = this.listResults(query);
    const outputPath = path.join(os.tmpdir(), `yclaw-results-${Date.now()}.${format}`);

    if (format === 'json') {
      fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf8');
      return outputPath;
    }

    if (format === 'jsonl') {
      fs.writeFileSync(outputPath, results.map((item) => JSON.stringify(item)).join('\n'), 'utf8');
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

function summarizeBatchQuality(
  batchId: string,
  results: ExtractionResult[],
  rule: ResultQualityRule,
): BatchQualitySummary {
  const failedResults = results.filter(isFailedResult).length;
  const missingRequiredFieldResults = results.filter((result) =>
    hasMissingRequiredField(result, rule.requiredFields ?? []),
  ).length;
  const minBatchResultCount = rule.minBatchResultCount ?? 0;

  return {
    batchId,
    totalResults: results.length,
    failedResults,
    missingRequiredFieldResults,
    qualityStatus: resolveBatchQualityStatus({
      failedResults,
      missingRequiredFieldResults,
      totalResults: results.length,
      minBatchResultCount,
    }),
  };
}

function resolveBatchQualityStatus(input: {
  failedResults: number;
  missingRequiredFieldResults: number;
  totalResults: number;
  minBatchResultCount: number;
}): ResultQualityStatus {
  if (input.failedResults > 0 || input.totalResults < input.minBatchResultCount) {
    return 'failed';
  }

  if (input.missingRequiredFieldResults > 0) {
    return 'warning';
  }

  return 'passed';
}

function isFailedResult(result: ExtractionResult): boolean {
  return result.status === 'failed' || result.qualityStatus === 'failed';
}

function hasMissingRequiredField(result: ExtractionResult, requiredFields: string[]): boolean {
  return requiredFields.some((field) => {
    const value = result.data[field];
    return value === undefined || value === null || value === '';
  });
}

function isTraceableResult(result: ExtractionResult): boolean {
  return Boolean(result.batchId)
    && Boolean(result.revisionId)
    && (result.evidenceRefs?.length ?? 0) > 0;
}
