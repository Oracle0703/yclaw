import path from 'path';
import type { CommentEntryKind, MediaCrawlerConfig, MediaCrawlerRunRequest } from '@shared/types';

export interface MediaCrawlerCommand {
  command: string;
  args: string[];
  cwd: string;
  env: Record<string, string>;
  outputDir: string;
}

export function buildMediaCrawlerCommand(
  config: MediaCrawlerConfig,
  request: MediaCrawlerRunRequest,
): MediaCrawlerCommand {
  const outputDir = config.outputDir?.trim() || path.join(config.repoPath, 'data');
  const crawlType = toMediaCrawlerType(request.entryKind);
  const env: Record<string, string> = {
    MEDIA_CRAWLER_SOURCE_ID: request.sourceId,
    MEDIA_CRAWLER_TASK_ID: request.taskId,
    MEDIA_CRAWLER_BATCH_ID: request.batchId,
    MEDIA_CRAWLER_ENTRY_VALUE: request.entryValue,
    MEDIA_CRAWLER_MAX_NOTES_COUNT: String(request.limits.maxContents),
    MEDIA_CRAWLER_MAX_COMMENTS_COUNT: String(request.limits.maxCommentsPerContent),
    MEDIA_CRAWLER_ENABLE_GET_SUB_COMMENTS: String(request.limits.includeSubComments),
    MEDIA_CRAWLER_CRAWL_INTERVAL_SECONDS: String(request.limits.crawlIntervalSeconds),
    MEDIA_CRAWLER_OUTPUT_DIR: outputDir,
  };

  if (request.entryKind === 'keyword') {
    env.MEDIA_CRAWLER_KEYWORD = request.entryValue;
  }
  if (request.entryKind === 'note') {
    env.MEDIA_CRAWLER_DETAIL_ID_LIST = request.entryValue;
  }
  if (request.entryKind === 'creator') {
    env.MEDIA_CRAWLER_CREATOR_ID_LIST = request.entryValue;
  }

  return {
    command: config.pythonPath.trim() || 'python',
    args: [
      'main.py',
      '--platform',
      request.platform,
      '--lt',
      config.loginType,
      '--type',
      crawlType,
    ],
    cwd: config.repoPath,
    env,
    outputDir,
  };
}

function toMediaCrawlerType(entryKind: CommentEntryKind): 'search' | 'detail' | 'creator' {
  if (entryKind === 'note') return 'detail';
  if (entryKind === 'creator') return 'creator';
  return 'search';
}
