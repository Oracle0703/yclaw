import { describe, expect, it, vi } from 'vitest';
import { HotReportRepository } from '@main/services/repositories/HotReportRepository';
import { HotSourceRepository } from '@main/services/repositories/HotSourceRepository';

describe('hot repositories', () => {
  it('saves source rows with serialized schedule and tags', () => {
    const run = vi.fn();
    const repository = new HotSourceRepository({
      all: vi.fn(() => []),
      get: vi.fn(() => undefined),
      run,
    });

    repository.saveSource({
      id: 'source-1',
      taskId: 'task-1',
      name: '抖音热榜',
      sourceKind: 'browser',
      siteKey: 'douyin',
      entryUrl: 'https://www.douyin.com/hot',
      parserKey: 'douyin.hot',
      sessionId: null,
      schedule: { type: 'manual' },
      enabled: true,
      tags: [],
      createdAt: '2026-04-27T00:00:00.000Z',
      updatedAt: '2026-04-27T00:00:00.000Z',
    });

    expect(run).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO hot_sources'),
      expect.arrayContaining([
        'source-1',
        'task-1',
        '抖音热榜',
        'browser',
        'douyin',
        'https://www.douyin.com/hot',
        'douyin.hot',
      ]),
    );
  });

  it('parses source rows from list results', () => {
    const repository = new HotSourceRepository({
      all: vi.fn(() => [
        {
          id: 'source-1',
          task_id: 'task-1',
          name: '抖音热榜',
          source_kind: 'browser',
          site_key: 'douyin',
          entry_url: 'https://www.douyin.com/hot',
          parser_key: 'douyin.hot',
          session_id: 'session-1',
          schedule_json: '{"type":"cron","cron":"0 * * * *"}',
          enabled: 1,
          tags_json: '["热点","抖音"]',
          created_at: '2026-04-27T00:00:00.000Z',
          updated_at: '2026-04-27T00:00:01.000Z',
        },
      ]),
      get: vi.fn(() => undefined),
      run: vi.fn(),
    });

    expect(repository.listSources()).toEqual([
      {
        id: 'source-1',
        taskId: 'task-1',
        name: '抖音热榜',
        sourceKind: 'browser',
        siteKey: 'douyin',
        entryUrl: 'https://www.douyin.com/hot',
        parserKey: 'douyin.hot',
        sessionId: 'session-1',
        schedule: { type: 'cron', cron: '0 * * * *' },
        enabled: true,
        tags: ['热点', '抖音'],
        createdAt: '2026-04-27T00:00:00.000Z',
        updatedAt: '2026-04-27T00:00:01.000Z',
      },
    ]);
  });

  it('saves and lists report records', () => {
    const reportRepository = new HotReportRepository({
      all: vi.fn(() => [
        {
          id: 'report-1',
          source_id: 'source-1',
          batch_id: 'batch-1',
          title: '抖音热榜日报',
          format: 'md',
          file_path: '/tmp/hot-report.md',
          created_at: '2026-04-27T00:10:00.000Z',
        },
      ]),
      get: vi.fn(() => undefined),
      run: vi.fn(),
    });

    reportRepository.saveReport({
      id: 'report-1',
      sourceId: 'source-1',
      batchId: 'batch-1',
      title: '抖音热榜日报',
      format: 'md',
      filePath: '/tmp/hot-report.md',
      createdAt: '2026-04-27T00:10:00.000Z',
    });

    expect(reportRepository.listReports({ sourceId: 'source-1' })).toEqual([
      {
        id: 'report-1',
        sourceId: 'source-1',
        batchId: 'batch-1',
        title: '抖音热榜日报',
        format: 'md',
        filePath: '/tmp/hot-report.md',
        createdAt: '2026-04-27T00:10:00.000Z',
      },
    ]);
  });
});
