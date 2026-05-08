import { beforeEach, describe, expect, it, vi } from 'vitest';
import path from 'path';

import { CommentReportService } from '@main/services/comment/CommentReportService';

describe('CommentReportService', () => {
  const sourceRepository = { getSource: vi.fn() };
  const batchService = { getBatch: vi.fn() };
  const resultService = { listResults: vi.fn() };
  const reportRepository = {
    saveReport: vi.fn(),
    listReports: vi.fn(),
    getReport: vi.fn(),
    deleteReport: vi.fn(),
  };
  const writeFile = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    sourceRepository.getSource.mockReturnValue({
      id: 'source-1',
      taskId: 'task-1',
      name: '小红书 AI 评论',
    });
    batchService.getBatch.mockReturnValue({
      id: 'batch-1',
      taskId: 'task-1',
      status: 'success',
      stepResults: [],
    });
    resultService.listResults.mockReturnValue([
      {
        id: 'result-1',
        taskId: 'task-1',
        batchId: 'batch-1',
        data: {
          platform: 'xhs',
          commentId: 'comment-1',
          content: '这个 AI 工具很实用',
          authorName: '用户A',
          likeCount: 12,
        },
        status: 'normal',
        createdAt: '2026-05-08T01:00:00.000Z',
      },
      {
        id: 'result-2',
        taskId: 'task-1',
        batchId: 'batch-1',
        data: {
          platform: 'xhs',
          commentId: 'comment-2',
          content: '价格虚假需要退款',
          authorName: '用户B',
          likeCount: 3,
        },
        status: 'normal',
        createdAt: '2026-05-08T01:00:00.000Z',
      },
    ]);
  });

  it('generates markdown report and persists metadata after writing file', () => {
    const service = new CommentReportService({
      sourceRepository: sourceRepository as never,
      batchService: batchService as never,
      resultService: resultService as never,
      reportRepository: reportRepository as never,
      outputDir: '/tmp/comment-reports',
      now: () => new Date('2026-05-08T02:00:00.000Z'),
      createId: () => 'report-1',
      writeFile,
    });

    const report = service.generateReport({ sourceId: 'source-1', batchId: 'batch-1', format: 'md' });

    expect(writeFile).toHaveBeenCalledWith(
      path.join('/tmp/comment-reports', 'report-1.md'),
      expect.stringContaining('# 小红书 AI 评论 评论洞察'),
    );
    const content = writeFile.mock.calls[0][1] as string;
    expect(content).toContain('评论总数：2');
    expect(content).toContain('用户A：这个 AI 工具很实用');
    expect(content).toContain('潜在风险评论');
    expect(reportRepository.saveReport).toHaveBeenCalledWith(expect.objectContaining({
      id: 'report-1',
      sourceId: 'source-1',
      batchId: 'batch-1',
      format: 'md',
      filePath: path.join('/tmp/comment-reports', 'report-1.md'),
    }));
    expect(report.filePath).toBe(path.join('/tmp/comment-reports', 'report-1.md'));
  });

  it('generates html report and handles empty comments', () => {
    resultService.listResults.mockReturnValue([]);
    const service = new CommentReportService({
      sourceRepository: sourceRepository as never,
      batchService: batchService as never,
      resultService: resultService as never,
      reportRepository: reportRepository as never,
      outputDir: '/tmp/comment-reports',
      createId: () => 'report-html',
      writeFile,
    });

    service.generateReport({ sourceId: 'source-1', batchId: 'batch-1', format: 'html' });

    expect(writeFile).toHaveBeenCalledWith(
      path.join('/tmp/comment-reports', 'report-html.html'),
      expect.stringContaining('<!doctype html>'),
    );
    expect(writeFile.mock.calls[0][1]).toContain('未采集到评论');
  });
});
