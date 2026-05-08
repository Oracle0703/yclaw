import { describe, expect, it, vi } from 'vitest';
import { CommentReportRepository } from '@main/services/repositories/CommentReportRepository';
import { CommentSourceRepository } from '@main/services/repositories/CommentSourceRepository';

describe('comment repositories', () => {
  it('saves source rows with serialized limits, filter and tags', () => {
    const run = vi.fn();
    const repository = new CommentSourceRepository({
      all: vi.fn(() => []),
      get: vi.fn(() => undefined),
      run,
    });

    repository.saveSource({
      id: 'source-1',
      taskId: 'task-1',
      name: '小红书 AI 评论',
      platform: 'xhs',
      entryKind: 'keyword',
      entryValue: 'AI',
      parserKey: 'xhs.comment',
      sessionId: null,
      schedule: { type: 'manual' },
      limits: {
        maxContents: 5,
        maxCommentsPerContent: 20,
        includeSubComments: false,
        crawlIntervalSeconds: 2,
      },
      filter: { includeKeywords: ['AI'] },
      enabled: true,
      tags: ['评论监控'],
      createdAt: '2026-05-08T00:00:00.000Z',
      updatedAt: '2026-05-08T00:00:00.000Z',
    });

    expect(run).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO comment_sources'),
      expect.arrayContaining([
        'source-1',
        'task-1',
        '小红书 AI 评论',
        'xhs',
        'keyword',
        'AI',
        'xhs.comment',
      ]),
    );
  });

  it('parses source rows from list results', () => {
    const repository = new CommentSourceRepository({
      all: vi.fn(() => [
        {
          id: 'source-1',
          task_id: 'task-1',
          name: '小红书 AI 评论',
          platform: 'xhs',
          entry_kind: 'keyword',
          entry_value: 'AI',
          parser_key: 'xhs.comment',
          session_id: 'session-1',
          schedule_json: '{"type":"manual"}',
          limits_json: '{"maxContents":5,"maxCommentsPerContent":20,"includeSubComments":false,"crawlIntervalSeconds":2}',
          filter_json: '{"includeKeywords":["AI"]}',
          enabled: 1,
          tags_json: '["评论监控"]',
          created_at: '2026-05-08T00:00:00.000Z',
          updated_at: '2026-05-08T00:00:01.000Z',
        },
      ]),
      get: vi.fn(() => undefined),
      run: vi.fn(),
    });

    expect(repository.listSources()).toEqual([
      {
        id: 'source-1',
        taskId: 'task-1',
        name: '小红书 AI 评论',
        platform: 'xhs',
        entryKind: 'keyword',
        entryValue: 'AI',
        parserKey: 'xhs.comment',
        sessionId: 'session-1',
        schedule: { type: 'manual' },
        limits: {
          maxContents: 5,
          maxCommentsPerContent: 20,
          includeSubComments: false,
          crawlIntervalSeconds: 2,
        },
        filter: { includeKeywords: ['AI'] },
        enabled: true,
        tags: ['评论监控'],
        createdAt: '2026-05-08T00:00:00.000Z',
        updatedAt: '2026-05-08T00:00:01.000Z',
      },
    ]);
  });

  it('saves and lists report records', () => {
    const repository = new CommentReportRepository({
      all: vi.fn(() => [
        {
          id: 'report-1',
          source_id: 'source-1',
          batch_id: 'batch-1',
          title: '小红书 AI 评论 评论洞察',
          format: 'html',
          file_path: '/tmp/comment-report.html',
          created_at: '2026-05-08T00:10:00.000Z',
        },
      ]),
      get: vi.fn(() => undefined),
      run: vi.fn(),
    });

    repository.saveReport({
      id: 'report-1',
      sourceId: 'source-1',
      batchId: 'batch-1',
      title: '小红书 AI 评论 评论洞察',
      format: 'html',
      filePath: '/tmp/comment-report.html',
      createdAt: '2026-05-08T00:10:00.000Z',
    });

    expect(repository.listReports({ sourceId: 'source-1' })).toEqual([
      {
        id: 'report-1',
        sourceId: 'source-1',
        batchId: 'batch-1',
        title: '小红书 AI 评论 评论洞察',
        format: 'html',
        filePath: '/tmp/comment-report.html',
        createdAt: '2026-05-08T00:10:00.000Z',
      },
    ]);
  });
});
