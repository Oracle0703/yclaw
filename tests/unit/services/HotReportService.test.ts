import { beforeEach, describe, expect, it, vi } from 'vitest';

import { HotReportService } from '@main/services/hot/HotReportService';

describe('HotReportService', () => {
  const sourceRepository = {
    getSource: vi.fn(),
  };
  const batchService = {
    getBatch: vi.fn(),
  };
  const resultService = {
    listResults: vi.fn(),
  };
  const executionLogService = {
    query: vi.fn(),
  };
  const reportRepository = {
    saveReport: vi.fn(),
    listReports: vi.fn(),
    getReportByBatchId: vi.fn(),
  };
  const writeFile = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    sourceRepository.getSource.mockReturnValue({
      id: 'source-1',
      taskId: 'task-1',
      name: '抖音热榜',
      siteKey: 'douyin',
      entryUrl: 'https://www.douyin.com/hot',
    });
    batchService.getBatch.mockReturnValue({
      id: 'batch-1',
      taskId: 'task-1',
      status: 'success',
      startedAt: '2026-04-27T00:00:00.000Z',
      finishedAt: '2026-04-27T00:02:00.000Z',
      stepResults: [],
      createdAt: '2026-04-27T00:00:00.000Z',
    });
    resultService.listResults.mockReturnValue([
      {
        id: 'result-1',
        taskId: 'task-1',
        batchId: 'batch-1',
        data: { title: '热点 1', heat: 9999 },
        status: 'normal',
        createdAt: '2026-04-27T00:01:00.000Z',
      },
    ]);
    executionLogService.query.mockReturnValue([
      {
        level: 'info',
        message: '采集完成',
        createdAt: '2026-04-27T00:02:00.000Z',
      },
    ]);
  });

  it('generates a markdown report file and persists the report metadata', () => {
    const service = new HotReportService({
      sourceRepository: sourceRepository as never,
      batchService: batchService as never,
      resultService: resultService as never,
      executionLogService: executionLogService as never,
      reportRepository: reportRepository as never,
      writeFile,
      outputDir: '/tmp/hot-reports',
      now: () => new Date('2026-04-27T00:05:00.000Z'),
      createId: () => 'report-1',
    });

    const report = service.generateReport({
      sourceId: 'source-1',
      batchId: 'batch-1',
      format: 'md',
    });

    expect(writeFile).toHaveBeenCalledWith(
      '/tmp/hot-reports/report-1.md',
      expect.stringContaining('# 抖音热榜 报告'),
    );
    expect(reportRepository.saveReport).toHaveBeenCalledWith({
      id: 'report-1',
      sourceId: 'source-1',
      batchId: 'batch-1',
      title: '抖音热榜 报告',
      format: 'md',
      filePath: '/tmp/hot-reports/report-1.md',
      createdAt: '2026-04-27T00:05:00.000Z',
    });
    expect(report).toEqual({
      id: 'report-1',
      sourceId: 'source-1',
      batchId: 'batch-1',
      title: '抖音热榜 报告',
      format: 'md',
      filePath: '/tmp/hot-reports/report-1.md',
      createdAt: '2026-04-27T00:05:00.000Z',
    });
  });
});
