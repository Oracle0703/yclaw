import type { HotRunDetail, HotRunSummary } from '@shared/types';
import type { BatchService } from '../BatchService';
import type { ResultService } from '../ResultService';
import type { HotReportRepository } from '../repositories/HotReportRepository';
import type { HotSourceRepository } from '../repositories/HotSourceRepository';

type HotRunStartSource = {
  id: string;
  taskId: string;
  name: string;
  sourceKind?: string;
};

interface HotRunProjectionServiceOptions {
  sourceRepository?: Pick<HotSourceRepository, 'listSources' | 'getSource'>;
  batchService?: Pick<BatchService, 'listBatchesByTask' | 'getBatch'>;
  resultService?: Pick<ResultService, 'listResults'>;
  reportRepository?: Pick<HotReportRepository, 'getReportByBatchId'>;
  startTask?: (source: HotRunStartSource) => unknown;
}

export class HotRunProjectionService {
  private readonly sourceRepository: Pick<HotSourceRepository, 'listSources' | 'getSource'>;
  private readonly batchService: Pick<BatchService, 'listBatchesByTask' | 'getBatch'>;
  private readonly resultService: Pick<ResultService, 'listResults'>;
  private readonly reportRepository: Pick<HotReportRepository, 'getReportByBatchId'>;
  private readonly startTask?: (source: HotRunStartSource) => unknown;

  constructor(options: HotRunProjectionServiceOptions = {}) {
    if (!options.sourceRepository) {
      throw new Error('sourceRepository is required');
    }
    if (!options.batchService) {
      throw new Error('batchService is required');
    }
    if (!options.resultService) {
      throw new Error('resultService is required');
    }
    if (!options.reportRepository) {
      throw new Error('reportRepository is required');
    }

    this.sourceRepository = options.sourceRepository;
    this.batchService = options.batchService;
    this.resultService = options.resultService;
    this.reportRepository = options.reportRepository;
    this.startTask = options.startTask;
  }

  listRuns(sourceId?: string): HotRunSummary[] {
    const sources = sourceId
      ? [this.sourceRepository.getSource(sourceId)].filter(Boolean)
      : this.sourceRepository.listSources();

    return sources.flatMap((source) =>
      this.batchService
        .listBatchesByTask(source!.taskId)
        .map((batch) => this.toRunSummary(source!, batch)),
    );
  }

  getRunDetail(sourceId: string, batchId: string): HotRunDetail | null {
    const source = this.sourceRepository.getSource(sourceId);
    if (!source) {
      return null;
    }

    const batch = this.batchService.getBatch(batchId);
    if (!batch || batch.taskId !== source.taskId) {
      return null;
    }

    const results = this.resultService.listResults({ batchId });
    const summary = this.toRunSummary(source, batch);

    return {
      ...summary,
      taskId: source.taskId,
      error: batch.error ?? null,
      breakpoint: batch.breakpoint ?? null,
      stepResults: batch.stepResults,
      linkedResultIds: results.map((item) => item.id),
    };
  }

  startRun(sourceId: string): { sourceId: string; taskId: string; started: boolean } {
    const source = this.sourceRepository.getSource(sourceId);
    if (!source) {
      throw new Error(`Hot source "${sourceId}" not found`);
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
  ): HotRunSummary {
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
