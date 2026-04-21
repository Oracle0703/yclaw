import type { DataExportFormat, DataExportJob, ExtractionResult } from '@shared/types';
import type { ResultService } from '../ResultService';
import type { DataExportJobRepository } from '../repositories/DataExportJobRepository';
import { randomUUID } from 'crypto';

export interface DataExportInput {
  name: string;
  datasetId?: string | null;
  query: {
    taskId?: string;
    batchId?: string;
    page: number;
    pageSize: number;
  };
  format: DataExportFormat;
  targetType: 'file' | 'webhook' | 'local-api';
  targetConfig: Record<string, unknown>;
}

export interface DataExporter {
  export(input: {
    records: ExtractionResult[];
    targetConfig: Record<string, unknown>;
    fileName: string;
  }): Promise<{ outputPath: string; resultCount: number }>;
}

type DataExporterKey = DataExportFormat | 'webhook';

interface DataExportServiceOptions {
  resultService: Pick<ResultService, 'listResults'>;
  exportJobRepository: Pick<
    DataExportJobRepository,
    | 'createJob'
    | 'markRetrying'
    | 'markRunning'
    | 'markSucceeded'
    | 'markFailed'
    | 'markCancelled'
    | 'appendAudit'
    | 'getJob'
    | 'listJobs'
  >;
  exporters: Partial<Record<DataExporterKey, DataExporter>>;
  now?: () => Date;
  createId?: () => string;
}

export class DataExportService {
  private readonly resultService: Pick<ResultService, 'listResults'>;
  private readonly exportJobRepository: Pick<
    DataExportJobRepository,
    | 'createJob'
    | 'markRetrying'
    | 'markRunning'
    | 'markSucceeded'
    | 'markFailed'
    | 'markCancelled'
    | 'appendAudit'
    | 'getJob'
    | 'listJobs'
  >;
  private readonly exporters: Partial<Record<DataExporterKey, DataExporter>>;
  private readonly now: () => Date;
  private readonly createId: () => string;

  constructor(options: DataExportServiceOptions) {
    this.resultService = options.resultService;
    this.exportJobRepository = options.exportJobRepository;
    this.exporters = options.exporters;
    this.now = options.now ?? (() => new Date());
    this.createId = options.createId ?? (() => randomUUID());
  }

  async createAndRun(input: DataExportInput): Promise<DataExportJob> {
    const now = this.now().toISOString();
    const job: DataExportJob = {
      id: this.createId(),
      name: input.name,
      datasetId: input.datasetId ?? null,
      query: input.query,
      targetType: input.targetType,
      targetConfig: input.targetConfig,
      format: input.format,
      status: 'pending',
      resultCount: 0,
      outputPath: null,
      error: null,
      retryCount: 0,
      createdAt: now,
      updatedAt: now,
      startedAt: null,
      finishedAt: null,
    };

    this.exportJobRepository.createJob(job);
    this.exportJobRepository.markRunning(job.id, now);

    try {
      const exporter = this.resolveExporter(input.targetType, input.format);
      if (!exporter) {
        throw new Error(`Unsupported export format: ${input.format}`);
      }

      const records = this.resultService.listResults({
        taskId: input.query.taskId,
        batchId: input.query.batchId,
      });
      const output = await exporter.export({
        records,
        targetConfig: input.targetConfig,
        fileName: job.id,
      });
      const finishedAt = this.now().toISOString();

      return this.exportJobRepository.markSucceeded(job.id, {
        resultCount: output.resultCount,
        outputPath: output.outputPath,
        finishedAt,
      }) as DataExportJob;
    } catch (error) {
      const finishedAt = this.now().toISOString();
      return this.exportJobRepository.markFailed(
        job.id,
        error instanceof Error ? error.message : String(error),
        finishedAt,
      ) as DataExportJob;
    }
  }

  listJobs(query?: { page?: number; pageSize?: number; status?: DataExportJob['status'] }) {
    return this.exportJobRepository.listJobs(query);
  }

  async retryJob(exportJobId: string): Promise<DataExportJob | null> {
    const existingJob = this.exportJobRepository.getJob(exportJobId);
    if (!existingJob) {
      return null;
    }

    const retryAt = this.now().toISOString();
    this.exportJobRepository.markRetrying(exportJobId, retryAt);
    this.exportJobRepository.markRunning(exportJobId, retryAt);

    try {
      const exporter = this.resolveExporter(existingJob.targetType, existingJob.format);
      if (!exporter) {
        throw new Error(`Unsupported export format: ${existingJob.format}`);
      }

      const records = this.resultService.listResults({
        taskId: existingJob.query.taskId,
        batchId: existingJob.query.batchId,
      });
      const output = await exporter.export({
        records,
        targetConfig: existingJob.targetConfig,
        fileName: existingJob.id,
      });
      const finishedAt = this.now().toISOString();

      return this.exportJobRepository.markSucceeded(existingJob.id, {
        resultCount: output.resultCount,
        outputPath: output.outputPath,
        finishedAt,
      }) as DataExportJob;
    } catch (error) {
      const finishedAt = this.now().toISOString();
      return this.exportJobRepository.markFailed(
        existingJob.id,
        error instanceof Error ? error.message : String(error),
        finishedAt,
      ) as DataExportJob;
    }
  }

  cancelJob(exportJobId: string): DataExportJob | null {
    const existingJob = this.exportJobRepository.getJob(exportJobId);
    if (!existingJob || ['succeeded', 'failed', 'cancelled'].includes(existingJob.status)) {
      return existingJob;
    }

    return this.exportJobRepository.markCancelled(exportJobId, this.now().toISOString());
  }

  private resolveExporter(targetType: DataExportInput['targetType'], format: DataExportFormat): DataExporter | undefined {
    if (targetType === 'webhook') {
      return this.exporters.webhook;
    }

    return this.exporters[format];
  }
}
