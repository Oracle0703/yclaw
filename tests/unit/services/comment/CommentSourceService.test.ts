import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CommentSourceService } from '@main/services/comment/CommentSourceService';

describe('CommentSourceService', () => {
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
      name: '小红书评论',
      description: 'xhs · xhs.comment 评论源',
      entryUrl: 'https://www.xiaohongshu.com/search_result?keyword=AI',
      schedule: { type: 'manual' },
      sessionId: null,
      enabled: true,
      tags: ['评论监控'],
      steps: [],
    });
    taskService.createTask.mockReturnValue({ id: 'task-1' });
  });

  it('creates a source and its backing task with safe defaults', () => {
    const service = new CommentSourceService({
      sourceRepository: sourceRepository as never,
      taskService: taskService as never,
      taskCompiler: taskCompiler as never,
      now: () => new Date('2026-05-08T01:00:00.000Z'),
      createId: () => 'source-1',
    });

    const created = service.createSource({
      name: '小红书 AI 评论',
      platform: 'xhs',
      entryKind: 'keyword',
      entryValue: 'AI',
    });

    expect(taskCompiler.compile).toHaveBeenCalledWith(expect.objectContaining({
      id: 'source-1',
      platform: 'xhs',
      parserKey: 'xhs.comment',
      limits: {
        maxContents: 5,
        maxCommentsPerContent: 20,
        includeSubComments: false,
        crawlIntervalSeconds: 2,
      },
    }));
    expect(taskService.createTask).toHaveBeenCalledWith(expect.objectContaining({
      name: '小红书评论',
      entryUrl: 'https://www.xiaohongshu.com/search_result?keyword=AI',
    }));
    expect(sourceRepository.saveSource).toHaveBeenCalledWith(expect.objectContaining({
      id: 'source-1',
      taskId: 'task-1',
      name: '小红书 AI 评论',
      platform: 'xhs',
      parserKey: 'xhs.comment',
    }));
    expect(created.id).toBe('source-1');
  });

  it('rejects unsupported platforms at runtime', () => {
    const service = new CommentSourceService({
      sourceRepository: sourceRepository as never,
      taskService: taskService as never,
      taskCompiler: taskCompiler as never,
    });

    expect(() => service.createSource({
      name: '微博评论',
      platform: 'wb' as never,
      entryKind: 'keyword',
      entryValue: 'AI',
    })).toThrow('Unsupported comment platform');
  });

  it('updates source metadata and syncs backing task', () => {
    sourceRepository.getSource.mockReturnValue({
      id: 'source-1',
      taskId: 'task-1',
      name: '旧评论源',
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
      filter: null,
      enabled: true,
      tags: [],
      createdAt: '2026-05-08T01:00:00.000Z',
      updatedAt: '2026-05-08T01:00:00.000Z',
    });
    const service = new CommentSourceService({
      sourceRepository: sourceRepository as never,
      taskService: taskService as never,
      taskCompiler: taskCompiler as never,
      now: () => new Date('2026-05-08T02:00:00.000Z'),
    });

    service.updateSource('source-1', {
      name: '新评论源',
      platform: 'xhs',
      entryKind: 'note',
      entryValue: 'https://www.xiaohongshu.com/explore/abc',
      enabled: false,
      tags: ['复盘'],
    });

    expect(taskService.updateTaskFlow).toHaveBeenCalledWith('task-1', expect.objectContaining({
      name: '小红书评论',
    }));
    expect(sourceRepository.saveSource).toHaveBeenCalledWith(expect.objectContaining({
      id: 'source-1',
      name: '新评论源',
      entryKind: 'note',
      enabled: false,
      tags: ['复盘'],
      updatedAt: '2026-05-08T02:00:00.000Z',
    }));
  });

  it('deletes source and backing task together', () => {
    sourceRepository.getSource.mockReturnValue({ id: 'source-1', taskId: 'task-1' });
    const service = new CommentSourceService({
      sourceRepository: sourceRepository as never,
      taskService: taskService as never,
      taskCompiler: taskCompiler as never,
    });

    service.deleteSource('source-1');

    expect(taskService.deleteTask).toHaveBeenCalledWith('task-1');
    expect(sourceRepository.deleteSource).toHaveBeenCalledWith('source-1');
  });
});
