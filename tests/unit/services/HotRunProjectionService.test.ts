import { beforeEach, describe, expect, it, vi } from 'vitest';

import { HotRunProjectionService } from '@main/services/hot/HotRunProjectionService';

describe('HotRunProjectionService', () => {
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
    listReports: vi.fn(),
    getReportByBatchId: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    sourceRepository.listSources.mockReturnValue([
      {
        id: 'source-1',
        taskId: 'task-1',
        name: '抖音热榜',
      },
    ]);
    sourceRepository.getSource.mockReturnValue({
      id: 'source-1',
      taskId: 'task-1',
      name: '抖音热榜',
    });
    batchService.listBatchesByTask.mockReturnValue([
      {
        id: 'batch-1',
        taskId: 'task-1',
        status: 'success',
        startedAt: '2026-04-27T00:00:00.000Z',
        finishedAt: '2026-04-27T00:02:00.000Z',
        stepResults: [],
        createdAt: '2026-04-27T00:00:00.000Z',
      },
    ]);
    batchService.getBatch.mockReturnValue({
      id: 'batch-1',
      taskId: 'task-1',
      status: 'failed',
      startedAt: '2026-04-27T00:00:00.000Z',
      finishedAt: '2026-04-27T00:02:00.000Z',
      stepResults: [
        {
          stepId: 'step-1',
          success: false,
          duration: 120,
          error: 'selector missing',
          startedAt: '2026-04-27T00:00:30.000Z',
          finishedAt: '2026-04-27T00:00:30.120Z',
          screenshot: 'shots/step-1.png',
          domSnapshot: 'snapshots/step-1.html',
        },
      ],
      error: 'selector missing',
      breakpoint: {
        stepIndex: 0,
        error: 'selector missing',
      },
      createdAt: '2026-04-27T00:00:00.000Z',
    });
    resultService.listResults.mockReturnValue([
      { id: 'result-1' },
      { id: 'result-2' },
    ]);
    reportRepository.getReportByBatchId.mockReturnValue({
      id: 'report-1',
      sourceId: 'source-1',
      batchId: 'batch-1',
      title: '抖音热榜日报',
      format: 'md',
      filePath: '/tmp/report.md',
      createdAt: '2026-04-27T00:03:00.000Z',
    });
  });

  it('projects task batches into hot run summaries', () => {
    const service = new HotRunProjectionService({
      sourceRepository: sourceRepository as never,
      batchService: batchService as never,
      resultService: resultService as never,
      reportRepository: reportRepository as never,
    });

    expect(service.listRuns()).toEqual([
      {
        batchId: 'batch-1',
        sourceId: 'source-1',
        sourceName: '抖音热榜',
        status: 'success',
        startedAt: '2026-04-27T00:00:00.000Z',
        finishedAt: '2026-04-27T00:02:00.000Z',
        resultCount: 2,
        reportStatus: 'generated',
      },
    ]);
  });

  it('builds hot run detail with linked report and result ids', () => {
    const service = new HotRunProjectionService({
      sourceRepository: sourceRepository as never,
      batchService: batchService as never,
      resultService: resultService as never,
      reportRepository: reportRepository as never,
    });

    expect(service.getRunDetail('source-1', 'batch-1')).toEqual(
      expect.objectContaining({
        batchId: 'batch-1',
        sourceId: 'source-1',
        sourceName: '抖音热榜',
        taskId: 'task-1',
        status: 'failed',
        resultCount: 2,
        breakpoint: {
          stepIndex: 0,
          error: 'selector missing',
        },
        stepResults: [
          expect.objectContaining({
            stepId: 'step-1',
            success: false,
            duration: 120,
            error: 'selector missing',
            screenshot: 'shots/step-1.png',
            domSnapshot: 'snapshots/step-1.html',
          }),
        ],
        linkedResultIds: ['result-1', 'result-2'],
        reportStatus: 'generated',
      }),
    );
  });

  it('starts a hot source without requiring callers to resolve a browser tab first', () => {
    const startTask = vi.fn();
    const service = new HotRunProjectionService({
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
    expect(startTask).toHaveBeenCalledWith({
      id: 'source-1',
      taskId: 'task-1',
      name: '抖音热榜',
    });
  });
});
