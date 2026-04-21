import type {
  DataCenterOverview,
  DataCenterResultDetail,
  DataCenterResultQuery,
  DataExportJob,
  DataPage,
  ExtractionResult,
  TaskBatch,
} from '@shared/types';
import type { ResultService } from '../ResultService';
import type { BatchService } from '../BatchService';
import type { ExecutionLogRecord, ExecutionLogService } from '../ExecutionLogService';
import type { DataExportJobRepository } from '../repositories/DataExportJobRepository';

interface DataCenterServiceOptions {
  resultService: Pick<ResultService, 'listResults' | 'getResult'>;
  batchService: Pick<BatchService, 'getBatch'>;
  executionLogService: Pick<ExecutionLogService, 'query'>;
  dataExportJobRepository: Pick<DataExportJobRepository, 'listJobs' | 'listByResultId'>;
}

export class DataCenterService {
  private readonly resultService: Pick<ResultService, 'listResults' | 'getResult'>;
  private readonly batchService: Pick<BatchService, 'getBatch'>;
  private readonly executionLogService: Pick<ExecutionLogService, 'query'>;
  private readonly dataExportJobRepository: Pick<
    DataExportJobRepository,
    'listJobs' | 'listByResultId'
  >;

  constructor(options: DataCenterServiceOptions) {
    this.resultService = options.resultService;
    this.batchService = options.batchService;
    this.executionLogService = options.executionLogService;
    this.dataExportJobRepository = options.dataExportJobRepository;
  }

  async getOverview(): Promise<DataCenterOverview> {
    const results = this.resultService.listResults({});
    const recentExports = this.dataExportJobRepository.listJobs({ page: 1, pageSize: 10 });

    return {
      totalResults: results.length,
      suspiciousResults: results.filter((result) => result.status === 'suspicious').length,
      failedExports: recentExports.items.filter((job) => job.status === 'failed').length,
      recentExports: recentExports.items,
    };
  }

  async listResults(query: DataCenterResultQuery): Promise<DataPage<ExtractionResult>> {
    const results = this.resultService.listResults({
      taskId: query.taskId,
      batchId: query.batchId,
    });
    const filtered = results.filter((result) => {
      if (query.status?.length && !query.status.includes(result.status)) {
        return false;
      }
      if (query.createdFrom && result.createdAt < query.createdFrom) {
        return false;
      }
      if (query.createdTo && result.createdAt > query.createdTo) {
        return false;
      }
      if (query.keyword && !JSON.stringify(result.data).includes(query.keyword)) {
        return false;
      }
      return true;
    });
    const start = (query.page - 1) * query.pageSize;

    return {
      items: filtered.slice(start, start + query.pageSize),
      total: filtered.length,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async getResultDetail(resultId: string): Promise<DataCenterResultDetail> {
    const result = this.resultService.getResult(resultId);
    if (!result) {
      throw new Error(`Result not found: ${resultId}`);
    }

    const batch = this.batchService.getBatch(result.batchId) as TaskBatch | null;
    const logs = this.executionLogService.query({
      taskId: result.taskId,
      batchId: result.batchId,
    }) as ExecutionLogRecord[];
    const exports = this.dataExportJobRepository.listByResultId(resultId) as DataExportJob[];

    return {
      result,
      batch,
      logs,
      exports,
    };
  }
}
