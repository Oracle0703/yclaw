import { IPC_CHANNELS } from '@shared/constants';
import type {
  CommentCrawlLimits,
  CommentEntryKind,
  CommentItem,
  CommentPlatform,
  CommentReplyTone,
  CommentReportFormat,
  ExtractionResult,
  MediaCrawlerConfig,
  MediaCrawlerLoginType,
  MediaCrawlerPlatform,
  MediaCrawlerRunRequest,
} from '@shared/types';

type IpcControllerLike = {
  handle(channel: string, handler: (payload: unknown) => unknown): void;
};

export function registerCommentHandlers(options: {
  ipcController: IpcControllerLike;
  commentSourceService: {
    listSources(): unknown;
    getSource(sourceId: string): unknown;
    createSource(payload: unknown): unknown;
    updateSource(sourceId: string, updates: unknown): unknown;
    deleteSource(sourceId: string): unknown;
  };
  commentRunService: {
    listRuns(sourceId?: string): unknown;
    getRunDetail(sourceId: string, batchId: string): unknown;
    startRun(sourceId: string): unknown;
  };
  commentResultService: {
    listResults(query?: { batchId?: string }): ExtractionResult[];
  };
  commentReportService: {
    listReports(query?: unknown): unknown;
    getReportDetail(reportId: string): unknown;
    generateReport(payload: { sourceId: string; batchId: string; format: CommentReportFormat }): unknown;
    deleteReport(reportId: string): unknown;
    revealReport(reportId: string): unknown;
  };
  commentAiReplyService?: {
    generateReply(payload: { comment: CommentItem; tone?: CommentReplyTone }): unknown;
  };
  mediaCrawlerService?: {
    getConfig(): unknown;
    saveConfig(config: MediaCrawlerConfig): unknown;
    testConfig(config?: Partial<MediaCrawlerConfig>): unknown;
    run(request: MediaCrawlerRunRequest): unknown;
  };
}): void {
  const {
    ipcController,
    commentSourceService,
    commentRunService,
    commentResultService,
    commentReportService,
    commentAiReplyService,
    mediaCrawlerService,
  } = options;

  ipcController.handle(IPC_CHANNELS.COMMENT_SOURCE_LIST, () => commentSourceService.listSources());
  ipcController.handle(IPC_CHANNELS.COMMENT_SOURCE_DETAIL, (payload) =>
    commentSourceService.getSource(assertStringField(payload, 'sourceId')),
  );
  ipcController.handle(IPC_CHANNELS.COMMENT_SOURCE_CREATE, (payload) =>
    commentSourceService.createSource(assertObject(payload)),
  );
  ipcController.handle(IPC_CHANNELS.COMMENT_SOURCE_UPDATE, (payload) => {
    const body = assertObject(payload);
    return commentSourceService.updateSource(
      assertStringField(body, 'sourceId'),
      assertObject(body.updates),
    );
  });
  ipcController.handle(IPC_CHANNELS.COMMENT_SOURCE_DELETE, (payload) =>
    commentSourceService.deleteSource(assertStringField(payload, 'sourceId')),
  );

  ipcController.handle(IPC_CHANNELS.COMMENT_RUN_LIST, (payload) => {
    const body = payload == null ? {} : assertObject(payload);
    return commentRunService.listRuns(
      typeof body.sourceId === 'string' && body.sourceId.length > 0 ? body.sourceId : undefined,
    );
  });
  ipcController.handle(IPC_CHANNELS.COMMENT_RUN_DETAIL, (payload) => {
    const body = assertObject(payload);
    return commentRunService.getRunDetail(
      assertStringField(body, 'sourceId'),
      assertStringField(body, 'batchId'),
    );
  });
  ipcController.handle(IPC_CHANNELS.COMMENT_RUN_START, (payload) =>
    commentRunService.startRun(assertStringField(payload, 'sourceId')),
  );
  ipcController.handle(IPC_CHANNELS.COMMENT_RESULT_LIST, (payload) => {
    const body = payload == null ? {} : assertObject(payload);
    const batchId = typeof body.batchId === 'string' && body.batchId.length > 0
      ? body.batchId
      : undefined;
    return commentResultService.listResults({ batchId }).map(toCommentItem).filter(Boolean);
  });
  if (commentAiReplyService) {
    ipcController.handle(IPC_CHANNELS.COMMENT_AI_REPLY_GENERATE, (payload) => {
      const body = assertObject(payload);
      return commentAiReplyService.generateReply({
        comment: assertCommentItem(body.comment),
        tone: body.tone == null ? undefined : assertTone(body.tone),
      });
    });
  }
  if (mediaCrawlerService) {
    ipcController.handle(IPC_CHANNELS.COMMENT_MEDIACRAWLER_CONFIG_GET, () =>
      mediaCrawlerService.getConfig(),
    );
    ipcController.handle(IPC_CHANNELS.COMMENT_MEDIACRAWLER_CONFIG_SAVE, (payload) =>
      mediaCrawlerService.saveConfig(assertMediaCrawlerConfig(assertObject(payload))),
    );
    ipcController.handle(IPC_CHANNELS.COMMENT_MEDIACRAWLER_TEST, (payload) =>
      mediaCrawlerService.testConfig(payload == null ? undefined : assertObject(payload)),
    );
    ipcController.handle(IPC_CHANNELS.COMMENT_MEDIACRAWLER_RUN, (payload) =>
      mediaCrawlerService.run(assertMediaCrawlerRunRequest(assertObject(payload))),
    );
  }

  ipcController.handle(IPC_CHANNELS.COMMENT_REPORT_LIST, (payload) =>
    commentReportService.listReports(payload == null ? {} : assertObject(payload)),
  );
  ipcController.handle(IPC_CHANNELS.COMMENT_REPORT_DETAIL, (payload) =>
    commentReportService.getReportDetail(assertStringField(payload, 'reportId')),
  );
  ipcController.handle(IPC_CHANNELS.COMMENT_REPORT_GENERATE, (payload) => {
    const body = assertObject(payload);
    return commentReportService.generateReport({
      sourceId: assertStringField(body, 'sourceId'),
      batchId: assertStringField(body, 'batchId'),
      format: assertFormat(body.format),
    });
  });
  ipcController.handle(IPC_CHANNELS.COMMENT_REPORT_DELETE, (payload) =>
    commentReportService.deleteReport(assertStringField(payload, 'reportId')),
  );
  ipcController.handle(IPC_CHANNELS.COMMENT_REPORT_REVEAL, (payload) =>
    commentReportService.revealReport(assertStringField(payload, 'reportId')),
  );
}

function assertObject(payload: unknown): Record<string, unknown> {
  if (typeof payload !== 'object' || payload == null) {
    throw new Error('payload object is required');
  }
  return payload as Record<string, unknown>;
}

function assertStringField(payload: unknown, key: string): string {
  if (
    typeof payload === 'object' &&
    payload !== null &&
    key in payload &&
    typeof (payload as Record<string, unknown>)[key] === 'string'
  ) {
    return String((payload as Record<string, unknown>)[key]);
  }

  throw new Error(`${key} is required`);
}

function assertFormat(value: unknown): CommentReportFormat {
  if (value === 'md' || value === 'html') {
    return value;
  }
  throw new Error('format is required');
}

function assertMediaCrawlerConfig(value: Record<string, unknown>): MediaCrawlerConfig {
  return {
    enabled: value.enabled === true,
    repoPath: assertNonEmptyString(value.repoPath, 'repoPath'),
    pythonPath: typeof value.pythonPath === 'string' && value.pythonPath.trim()
      ? value.pythonPath.trim()
      : 'python',
    outputDir: typeof value.outputDir === 'string' && value.outputDir.trim()
      ? value.outputDir.trim()
      : undefined,
    loginType: assertMediaCrawlerLoginType(value.loginType),
  };
}

function assertMediaCrawlerRunRequest(value: Record<string, unknown>): MediaCrawlerRunRequest {
  return {
    sourceId: assertNonEmptyString(value.sourceId, 'sourceId'),
    taskId: assertNonEmptyString(value.taskId, 'taskId'),
    batchId: assertNonEmptyString(value.batchId, 'batchId'),
    platform: assertMediaCrawlerPlatform(value.platform),
    entryKind: assertEntryKind(value.entryKind),
    entryValue: assertNonEmptyString(value.entryValue, 'entryValue'),
    limits: assertCrawlLimits(assertObject(value.limits)),
  };
}

function assertMediaCrawlerPlatform(value: unknown): MediaCrawlerPlatform {
  if (value === 'xhs' || value === 'dy' || value === 'ks' || value === 'bili' || value === 'wb' || value === 'tieba' || value === 'zhihu') {
    return value;
  }
  throw new Error('platform is invalid');
}

function assertMediaCrawlerLoginType(value: unknown): MediaCrawlerLoginType {
  if (value === 'qrcode' || value === 'phone' || value === 'cookie' || value === 'browser') {
    return value;
  }
  throw new Error('loginType is invalid');
}

function assertEntryKind(value: unknown): CommentEntryKind {
  if (value === 'keyword' || value === 'note' || value === 'creator') {
    return value;
  }
  throw new Error('entryKind is invalid');
}

function assertCrawlLimits(value: Record<string, unknown>): CommentCrawlLimits {
  return {
    maxContents: assertPositiveNumber(value.maxContents, 'maxContents'),
    maxCommentsPerContent: assertPositiveNumber(value.maxCommentsPerContent, 'maxCommentsPerContent'),
    includeSubComments: value.includeSubComments === true,
    crawlIntervalSeconds: assertNonNegativeNumber(value.crawlIntervalSeconds, 'crawlIntervalSeconds'),
  };
}

function assertNonEmptyString(value: unknown, key: string): string {
  if (typeof value === 'string' && value.trim()) return value.trim();
  throw new Error(`${key} is required`);
}

function assertPositiveNumber(value: unknown, key: string): number {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  throw new Error(`${key} is required`);
}

function assertNonNegativeNumber(value: unknown, key: string): number {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return value;
  throw new Error(`${key} is required`);
}

function assertTone(value: unknown): CommentReplyTone {
  if (value === 'friendly' || value === 'professional' || value === 'concise') {
    return value;
  }
  throw new Error('tone is invalid');
}

function assertPlatform(value: unknown): CommentPlatform {
  if (value === 'xhs' || value === 'douyin') {
    return value;
  }
  throw new Error('platform is required');
}

function assertCommentItem(value: unknown): CommentItem {
  const body = assertObject(value);
  return {
    platform: assertPlatform(body.platform),
    sourceId: typeof body.sourceId === 'string' ? body.sourceId : undefined,
    contentId: typeof body.contentId === 'string' ? body.contentId : undefined,
    contentUrl: typeof body.contentUrl === 'string' ? body.contentUrl : undefined,
    contentTitle: typeof body.contentTitle === 'string' ? body.contentTitle : undefined,
    commentId: assertStringField(body, 'commentId'),
    parentCommentId: typeof body.parentCommentId === 'string' ? body.parentCommentId : null,
    content: assertStringField(body, 'content'),
    authorId: typeof body.authorId === 'string' ? body.authorId : undefined,
    authorName: typeof body.authorName === 'string' ? body.authorName : undefined,
    avatar: typeof body.avatar === 'string' ? body.avatar : undefined,
    createdAt: typeof body.createdAt === 'string' ? body.createdAt : undefined,
    likeCount: typeof body.likeCount === 'number' ? body.likeCount : undefined,
    ipLocation: typeof body.ipLocation === 'string' ? body.ipLocation : undefined,
    subCommentCount: typeof body.subCommentCount === 'number' ? body.subCommentCount : undefined,
  };
}

function toCommentItem(result: ExtractionResult): CommentItem | null {
  const data = result.data;
  if (typeof data.commentId !== 'string' || typeof data.content !== 'string') {
    return null;
  }
  return {
    platform: data.platform === 'douyin' ? 'douyin' : 'xhs',
    sourceId: typeof data.sourceId === 'string' ? data.sourceId : undefined,
    contentId: typeof data.contentId === 'string' ? data.contentId : undefined,
    contentUrl: typeof data.contentUrl === 'string' ? data.contentUrl : result.sourceUrl,
    contentTitle: typeof data.contentTitle === 'string' ? data.contentTitle : undefined,
    commentId: data.commentId,
    parentCommentId: typeof data.parentCommentId === 'string' ? data.parentCommentId : null,
    content: data.content,
    authorId: typeof data.authorId === 'string' ? data.authorId : undefined,
    authorName: typeof data.authorName === 'string' ? data.authorName : undefined,
    avatar: typeof data.avatar === 'string' ? data.avatar : undefined,
    createdAt: typeof data.createdAt === 'string' ? data.createdAt : result.createdAt,
    likeCount: typeof data.likeCount === 'number' ? data.likeCount : undefined,
    ipLocation: typeof data.ipLocation === 'string' ? data.ipLocation : undefined,
    subCommentCount: typeof data.subCommentCount === 'number' ? data.subCommentCount : undefined,
  };
}
