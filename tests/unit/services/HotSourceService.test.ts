import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TaskFlow } from '@shared/types';

import { HotSourceService } from '@main/services/hot/HotSourceService';

describe('HotSourceService', () => {
  const sourceRepository = {
    listSources: vi.fn(),
    getSource: vi.fn(),
    saveSource: vi.fn(),
    deleteSource: vi.fn(),
  };
  const taskService = {
    createTask: vi.fn(),
    updateTaskFlow: vi.fn(),
    deleteTask: vi.fn(),
  };
  const taskCompiler = {
    compile: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    sourceRepository.listSources.mockReturnValue([]);
    sourceRepository.getSource.mockReturnValue(null);
    taskCompiler.compile.mockReturnValue({
      name: '抖音热榜',
      description: '抖音热榜采集',
      entryUrl: 'https://www.douyin.com/hot',
      schedule: { type: 'cron', cron: '0 * * * *' },
      sessionId: 'session-1',
      steps: [],
    } satisfies Pick<TaskFlow, 'name' | 'description' | 'entryUrl' | 'schedule' | 'sessionId' | 'steps'>);
    taskService.createTask.mockReturnValue({
      id: 'task-1',
      name: '抖音热榜',
      steps: [],
      createdAt: '2026-04-27T00:00:00.000Z',
      updatedAt: '2026-04-27T00:00:00.000Z',
    });
  });

  it('requires source repository, task service and compiler injections', () => {
    expect(() => new HotSourceService({ taskService: taskService as never, taskCompiler: taskCompiler as never }))
      .toThrow('sourceRepository is required');
    expect(() => new HotSourceService({ sourceRepository: sourceRepository as never, taskCompiler: taskCompiler as never }))
      .toThrow('taskService is required');
    expect(() => new HotSourceService({ sourceRepository: sourceRepository as never, taskService: taskService as never }))
      .toThrow('taskCompiler is required');
  });

  it('creates a source and its backing task together', () => {
    const service = new HotSourceService({
      sourceRepository: sourceRepository as never,
      taskService: taskService as never,
      taskCompiler: taskCompiler as never,
      now: () => new Date('2026-04-27T00:00:00.000Z'),
      createId: () => 'source-1',
    });

    const created = service.createSource({
      name: '抖音热榜',
      sourceKind: 'browser',
      siteKey: 'douyin',
      entryUrl: 'https://www.douyin.com/hot',
      parserKey: 'douyin.hot',
      sessionId: 'session-1',
      schedule: { type: 'cron', cron: '0 * * * *' },
      enabled: true,
      tags: ['热点'],
    });

    expect(taskCompiler.compile).toHaveBeenCalledWith(
      expect.objectContaining({
        name: '抖音热榜',
        sourceKind: 'browser',
      }),
    );
    expect(taskService.createTask).toHaveBeenCalledWith(
      expect.objectContaining({
        name: '抖音热榜',
        entryUrl: 'https://www.douyin.com/hot',
        schedule: { type: 'cron', cron: '0 * * * *' },
      }),
    );
    expect(sourceRepository.saveSource).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'source-1',
        taskId: 'task-1',
        name: '抖音热榜',
        enabled: true,
      }),
    );
    expect(created).toMatchObject({
      id: 'source-1',
      taskId: 'task-1',
      name: '抖音热榜',
    });
  });

  it('keeps TrendRadar platform ids when creating a batch source and backing task', () => {
    const trendRadarPlatformIds = [
      'toutiao',
      'baidu',
      'wallstreetcn-hot',
      'thepaper',
      'bilibili-hot-search',
      'cls-hot',
      'ifeng',
      'tieba',
      'weibo',
      'douyin',
      'zhihu',
    ];
    taskCompiler.compile.mockImplementation((draft) => ({
      name: draft.name,
      description: 'trendradar · newsnow.batch 采集源',
      entryUrl: draft.entryUrl,
      schedule: draft.schedule,
      sessionId: draft.sessionId,
      enabled: draft.enabled,
      tags: draft.tags,
      steps: [
        {
          id: 'trendradar-request',
          name: '请求多平台 API 数据',
          action: {
            type: 'extract',
            selector: draft.entryUrl,
            params: {
              mode: 'api',
              parserKey: draft.parserKey,
              platformIds: draft.platformIds,
            },
          },
        },
      ],
    } satisfies Pick<TaskFlow, 'name' | 'description' | 'entryUrl' | 'schedule' | 'sessionId' | 'enabled' | 'tags' | 'steps'>));
    const service = new HotSourceService({
      sourceRepository: sourceRepository as never,
      taskService: taskService as never,
      taskCompiler: taskCompiler as never,
      now: () => new Date('2026-05-06T08:00:00.000Z'),
      createId: () => 'source-trendradar',
    });

    service.createSource({
      name: 'TrendRadar 多平台热榜',
      sourceKind: 'api',
      siteKey: 'trendradar',
      entryUrl: 'https://newsnow.busiyi.world/api/s',
      parserKey: 'newsnow.batch',
      platformIds: trendRadarPlatformIds,
      enabled: true,
      tags: ['TrendRadar', '多平台', '热榜'],
    });

    expect(taskCompiler.compile).toHaveBeenCalledWith(
      expect.objectContaining({
        parserKey: 'newsnow.batch',
        platformIds: trendRadarPlatformIds,
      }),
    );
    expect(taskService.createTask).toHaveBeenCalledWith(
      expect.objectContaining({
        entryUrl: 'https://newsnow.busiyi.world/api/s',
        steps: [
          expect.objectContaining({
            action: expect.objectContaining({
              params: expect.objectContaining({
                platformIds: trendRadarPlatformIds,
              }),
            }),
          }),
        ],
      }),
    );
    expect(sourceRepository.saveSource).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'source-trendradar',
        parserKey: 'newsnow.batch',
        platformIds: trendRadarPlatformIds,
      }),
    );
  });

  it('updates source metadata and syncs the backing task', () => {
    sourceRepository.getSource.mockReturnValue({
      id: 'source-1',
      taskId: 'task-1',
      name: '抖音热榜',
      sourceKind: 'browser',
      siteKey: 'douyin',
      entryUrl: 'https://www.douyin.com/hot',
      parserKey: 'douyin.hot',
      sessionId: 'session-1',
      schedule: { type: 'manual' },
      enabled: true,
      tags: ['热点'],
      createdAt: '2026-04-27T00:00:00.000Z',
      updatedAt: '2026-04-27T00:00:00.000Z',
    });

    const service = new HotSourceService({
      sourceRepository: sourceRepository as never,
      taskService: taskService as never,
      taskCompiler: taskCompiler as never,
      now: () => new Date('2026-04-27T01:00:00.000Z'),
    });

    service.updateSource('source-1', {
      name: '抖音热榜更新版',
      sourceKind: 'browser',
      siteKey: 'douyin',
      entryUrl: 'https://www.douyin.com/hot',
      parserKey: 'douyin.hot',
      sessionId: 'session-1',
      schedule: { type: 'manual' },
      enabled: false,
      tags: ['热点', '新版'],
    });

    expect(taskService.updateTaskFlow).toHaveBeenCalledWith(
      'task-1',
      expect.objectContaining({
        name: '抖音热榜',
        entryUrl: 'https://www.douyin.com/hot',
      }),
    );
    expect(sourceRepository.saveSource).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'source-1',
        name: '抖音热榜更新版',
        enabled: false,
        tags: ['热点', '新版'],
      }),
    );
  });

  it('deletes source and backing task together', () => {
    sourceRepository.getSource.mockReturnValue({
      id: 'source-1',
      taskId: 'task-1',
    });

    const service = new HotSourceService({
      sourceRepository: sourceRepository as never,
      taskService: taskService as never,
      taskCompiler: taskCompiler as never,
    });

    service.deleteSource('source-1');

    expect(taskService.deleteTask).toHaveBeenCalledWith('task-1');
    expect(sourceRepository.deleteSource).toHaveBeenCalledWith('source-1');
  });
});
