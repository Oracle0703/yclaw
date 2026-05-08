import { describe, expect, it, vi } from 'vitest';
import { IPC_CHANNELS } from '@shared/constants';
import { registerCommentHandlers } from '@main/ipc/comment-handlers';

describe('registerCommentHandlers', () => {
  it('registers source, run and report channels', async () => {
    const handlers = new Map<string, (payload: unknown) => unknown>();
    const ipcController = {
      handle: vi.fn((channel: string, handler: (payload: unknown) => unknown) => {
        handlers.set(channel, handler);
      }),
    };
    const commentSourceService = {
      listSources: vi.fn(() => [{ id: 'source-1' }]),
      getSource: vi.fn((sourceId) => ({ id: sourceId })),
      createSource: vi.fn((payload) => ({ id: 'source-new', ...payload })),
      updateSource: vi.fn((sourceId, payload) => ({ id: sourceId, ...payload })),
      deleteSource: vi.fn((sourceId) => ({ sourceId })),
    };
    const commentRunService = {
      listRuns: vi.fn(() => [{ batchId: 'batch-1' }]),
      getRunDetail: vi.fn((sourceId, batchId) => ({ sourceId, batchId })),
      startRun: vi.fn((sourceId) => ({ sourceId, started: true })),
    };
    const commentResultService = {
      listResults: vi.fn(() => [
        {
          id: 'result-1',
          taskId: 'task-1',
          batchId: 'batch-1',
          data: {
            platform: 'xhs',
            commentId: 'comment-1',
            content: '这个 AI 工具很实用',
            authorName: '用户A',
          },
          status: 'normal',
          createdAt: '2026-05-08T00:00:00.000Z',
        },
      ]),
    };
    const commentReportService = {
      listReports: vi.fn(() => [{ id: 'report-1' }]),
      getReportDetail: vi.fn((reportId) => ({ id: reportId })),
      generateReport: vi.fn((payload) => ({ id: 'report-2', ...payload })),
      deleteReport: vi.fn((reportId) => ({ reportId, deleted: true })),
      revealReport: vi.fn((reportId) => ({ reportId, revealed: true })),
    };
    const commentAiReplyService = {
      generateReply: vi.fn((payload) => ({
        commentId: payload.comment.commentId,
        drafts: ['感谢反馈'],
        publishMode: 'manual',
      })),
    };
    const mediaCrawlerService = {
      getConfig: vi.fn(() => ({ enabled: true, repoPath: 'E:/MediaCrawler' })),
      saveConfig: vi.fn((payload) => ({ enabled: true, ...payload })),
      testConfig: vi.fn(() => ({ ok: true })),
      run: vi.fn((payload) => ({ batchId: payload.batchId, importedCount: 2 })),
    };

    registerCommentHandlers({
      ipcController,
      commentSourceService,
      commentRunService,
      commentResultService,
      commentReportService,
      commentAiReplyService,
      mediaCrawlerService,
    });

    expect(ipcController.handle).toHaveBeenCalledWith(IPC_CHANNELS.COMMENT_SOURCE_LIST, expect.any(Function));
    expect(ipcController.handle).toHaveBeenCalledWith(IPC_CHANNELS.COMMENT_RUN_START, expect.any(Function));
    expect(ipcController.handle).toHaveBeenCalledWith(IPC_CHANNELS.COMMENT_RESULT_LIST, expect.any(Function));
    expect(ipcController.handle).toHaveBeenCalledWith(IPC_CHANNELS.COMMENT_REPORT_GENERATE, expect.any(Function));
    expect(ipcController.handle).toHaveBeenCalledWith(IPC_CHANNELS.COMMENT_AI_REPLY_GENERATE, expect.any(Function));
    expect(ipcController.handle).toHaveBeenCalledWith(IPC_CHANNELS.COMMENT_MEDIACRAWLER_CONFIG_GET, expect.any(Function));
    expect(ipcController.handle).toHaveBeenCalledWith(IPC_CHANNELS.COMMENT_MEDIACRAWLER_RUN, expect.any(Function));

    expect(await handlers.get(IPC_CHANNELS.COMMENT_SOURCE_LIST)?.({})).toEqual([{ id: 'source-1' }]);
    expect(await handlers.get(IPC_CHANNELS.COMMENT_SOURCE_CREATE)?.({
      name: '小红书评论',
      platform: 'xhs',
      entryKind: 'keyword',
      entryValue: 'AI',
    })).toEqual({
      id: 'source-new',
      name: '小红书评论',
      platform: 'xhs',
      entryKind: 'keyword',
      entryValue: 'AI',
    });
    expect(await handlers.get(IPC_CHANNELS.COMMENT_RUN_START)?.({ sourceId: 'source-1' })).toEqual({
      sourceId: 'source-1',
      started: true,
    });
    expect(await handlers.get(IPC_CHANNELS.COMMENT_RESULT_LIST)?.({ batchId: 'batch-1' })).toEqual([
      expect.objectContaining({
        commentId: 'comment-1',
        content: '这个 AI 工具很实用',
        authorName: '用户A',
      }),
    ]);
    expect(await handlers.get(IPC_CHANNELS.COMMENT_REPORT_GENERATE)?.({
      sourceId: 'source-1',
      batchId: 'batch-1',
      format: 'html',
    })).toEqual({
      id: 'report-2',
      sourceId: 'source-1',
      batchId: 'batch-1',
      format: 'html',
    });
    expect(await handlers.get(IPC_CHANNELS.COMMENT_AI_REPLY_GENERATE)?.({
      comment: {
        platform: 'douyin',
        commentId: 'comment-douyin-1',
        content: '怎么使用？',
      },
      tone: 'friendly',
    })).toEqual({
      commentId: 'comment-douyin-1',
      drafts: ['感谢反馈'],
      publishMode: 'manual',
    });
    expect(await handlers.get(IPC_CHANNELS.COMMENT_MEDIACRAWLER_CONFIG_SAVE)?.({
      repoPath: 'E:/MediaCrawler',
      pythonPath: 'python',
      loginType: 'qrcode',
      enabled: true,
    })).toEqual(expect.objectContaining({
      repoPath: 'E:/MediaCrawler',
      enabled: true,
    }));
    expect(await handlers.get(IPC_CHANNELS.COMMENT_MEDIACRAWLER_RUN)?.({
      sourceId: 'source-1',
      taskId: 'task-1',
      batchId: 'batch-1',
      platform: 'xhs',
      entryKind: 'keyword',
      entryValue: 'AI',
      limits: {
        maxContents: 5,
        maxCommentsPerContent: 20,
        includeSubComments: false,
        crawlIntervalSeconds: 2,
      },
    })).toEqual({
      batchId: 'batch-1',
      importedCount: 2,
    });
  });

  it('rejects invalid report formats', () => {
    const handlers = new Map<string, (payload: unknown) => unknown>();
    registerCommentHandlers({
      ipcController: {
        handle: (channel, handler) => handlers.set(channel, handler),
      },
      commentSourceService: {} as never,
      commentRunService: {} as never,
      commentResultService: { listResults: vi.fn(() => []) },
      commentReportService: {
        generateReport: vi.fn(),
      } as never,
    });

    expect(() => handlers.get(IPC_CHANNELS.COMMENT_REPORT_GENERATE)?.({
      sourceId: 'source-1',
      batchId: 'batch-1',
      format: 'docx',
    })).toThrow('format is required');
  });
});
