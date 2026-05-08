import type { CommentRunDetail, CommentRunSummary } from '@shared/types';
import type { BatchService } from '../BatchService';
import type { ResultService } from '../ResultService';
import type { CommentReportRepository } from '../repositories/CommentReportRepository';
import type { CommentSourceRepository } from '../repositories/CommentSourceRepository';

type CommentRunStartSource = {
  id: string;
  taskId: string;
  name: string;
  sessionId?: string | null;
};

interface CommentRunProjectionServiceOptions {
  sourceRepository?: Pick<CommentSourceRepository, 'listSources' | 'getSource'>;
  batchService?: Pick<BatchService, 'listBatchesByTask' | 'getBatch'>;
  resultService?: Pick<ResultService, 'listResults'>;
  reportRepository?: Pick<CommentReportRepository, 'getReportByBatchId'>;
  startTask?: (source: CommentRunStartSource) => unknown;
}

export class CommentRunProjectionService {
  private readonly sourceRepository: Pick<CommentSourceRepository, 'listSources' | 'getSource'>;
  private readonly batchService: Pick<BatchService, 'listBatchesByTask' | 'getBatch'>;
  private readonly resultService: Pick<ResultService, 'listResults'>;
  private readonly reportRepository: Pick<CommentReportRepository, 'getReportByBatchId'>;
  private readonly startTask?: (source: CommentRunStartSource) => unknown;

  constructor(options: CommentRunProjectionServiceOptions = {}) {
    if (!options.sourceRepository) throw new Error('sourceRepository is required');
    if (!options.batchService) throw new Error('batchService is required');
    if (!options.resultService) throw new Error('resultService is required');
    if (!options.reportRepository) throw new Error('reportRepository is required');

    this.sourceRepository = options.sourceRepository;
    this.batchService = options.batchService;
    this.resultService = options.resultService;
    this.reportRepository = options.reportRepository;
    this.startTask = options.startTask;
  }

  listRuns(sourceId?: string): CommentRunSummary[] {
    const sources = sourceId
      ? [this.sourceRepository.getSource(sourceId)].filter(Boolean)
      : this.sourceRepository.listSources();

    return sources.flatMap((source) =>
      this.batchService
        .listBatchesByTask(source!.taskId)
        .map((batch) => this.toRunSummary(source!, batch)),
    );
  }

  getRunDetail(sourceId: string, batchId: string): CommentRunDetail | null {
    const source = this.sourceRepository.getSource(sourceId);
    if (!source) return null;

    const batch = this.batchService.getBatch(batchId);
    if (!batch || batch.taskId !== source.taskId) return null;

    const results = this.resultService.listResults({ batchId });
    return {
      ...this.toRunSummary(source, batch),
      taskId: source.taskId,
      error: batch.error ?? null,
      breakpoint: batch.breakpoint ?? null,
      stepResults: batch.stepResults,
      linkedResultIds: results.map((result) => result.id),
    };
  }

  startRun(sourceId: string): { sourceId: string; taskId: string; started: boolean } {
    const source = this.sourceRepository.getSource(sourceId);
    if (!source) {
      throw new Error(`Comment source "${sourceId}" not found`);
    }
    if (!this.startTask) {
      return { sourceId, taskId: source.taskId, started: false };
    }

    this.startTask(source);
    return { sourceId, taskId: source.taskId, started: true };
  }

  private toRunSummary(
    source: { id: string; taskId: string; name: string },
    batch: { id: string; status: string; startedAt?: string | null; finishedAt?: string | null },
  ): CommentRunSummary {
    const results = this.resultService.listResults({ batchId: batch.id });
    const report = this.reportRepository.getReportByBatchId(batch.id);
    return {
      batchId: batch.id,
      sourceId: source.id,
      sourceName: source.name,
      status: batch.status,
      startedAt: batch.startedAt ?? null,
      finishedAt: batch.finishedAt ?? null,
      resultCount: results.length,
      reportStatus: report ? 'generated' : 'pending',
    };
  }
}
