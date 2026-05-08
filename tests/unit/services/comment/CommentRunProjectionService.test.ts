import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CommentRunProjectionService } from '@main/services/comment/CommentRunProjectionService';

describe('CommentRunProjectionService', () => {
  const sourceRepository = {
    listSources: vi.fn(),
    getSource: vi.fn(),
  };
  const batchService = {
    listBatchesByTask: vi.fn(),
    getBatch: vi.fn(),
  };
  const resultService = {
    listResults: vi.fn(),
  };
  const reportRepository = {
    getReportByBatchId: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    sourceRepository.listSources.mockReturnValue([{ id: 'source-1', taskId: 'task-1', name: '小红书评论' }]);
    sourceRepository.getSource.mockReturnValue({ id: 'source-1', taskId: 'task-1', name: '小红书评论' });
    batchService.listBatchesByTask.mockReturnValue([
      {
        id: 'batch-1',
        taskId: 'task-1',
        status: 'success',
        startedAt: '2026-05-08T01:00:00.000Z',
        finishedAt: '2026-05-08T01:01:00.000Z',
      },
    ]);
    batchService.getBatch.mockReturnValue({
      id: 'batch-1',
      taskId: 'task-1',
      status: 'failed',
      startedAt: '2026-05-08T01:00:00.000Z',
      finishedAt: '2026-05-08T01:01:00.000Z',
      error: '需要人工登录',
      breakpoint: { stepIndex: 1, error: '需要人工登录' },
      stepResults: [],
    });
    resultService.listResults.mockReturnValue([{ id: 'result-1' }, { id: 'result-2' }]);
    reportRepository.getReportByBatchId.mockReturnValue({ id: 'report-1' });
  });

  it('projects task batches into comment run summaries', () => {
    const service = new CommentRunProjectionService({
      sourceRepository: sourceRepository as never,
      batchService: batchService as never,
      resultService: resultService as never,
      reportRepository: reportRepository as never,
    });

    expect(service.listRuns()).toEqual([{
      batchId: 'batch-1',
      sourceId: 'source-1',
      sourceName: '小红书评论',
      status: 'success',
      startedAt: '2026-05-08T01:00:00.000Z',
      finishedAt: '2026-05-08T01:01:00.000Z',
      resultCount: 2,
      reportStatus: 'generated',
    }]);
  });

  it('starts a comment source through the injected task starter', () => {
    const startTask = vi.fn();
    const service = new CommentRunProjectionService({
      sourceRepository: sourceRepository as never,
      batchService: batchService as never,
      resultService: resultService as never,
      reportRepository: reportRepository as never,
      startTask,
    });

    expect(service.startRun('source-1')).toEqual({
      sourceId: 'source-1',
      taskId: 'task-1',
      started: true,
    });
    expect(startTask).toHaveBeenCalledWith({ id: 'source-1', taskId: 'task-1', name: '小红书评论' });
  });
});
