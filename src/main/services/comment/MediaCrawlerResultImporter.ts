import fs from 'fs';
import path from 'path';
import type { CommentItem, MediaCrawlerPlatform } from '@shared/types';
import type { ResultService } from '../ResultService';

interface ImportInput {
  outputDir: string;
  taskId: string;
  batchId: string;
  sourceId: string;
  platform: MediaCrawlerPlatform;
}

export class MediaCrawlerResultImporter {
  private readonly resultService: Pick<ResultService, 'saveResult'>;

  constructor(options: { resultService?: Pick<ResultService, 'saveResult'> } = {}) {
    if (!options.resultService) {
      throw new Error('resultService is required');
    }
    this.resultService = options.resultService;
  }

  importResults(input: ImportInput): { importedCount: number; files: string[] } {
    if (!fs.existsSync(input.outputDir)) {
      return { importedCount: 0, files: [] };
    }

    const files = listResultFiles(input.outputDir);
    let importedCount = 0;
    for (const file of files) {
      for (const row of readRows(file)) {
        const comment = normalizeMediaCrawlerComment(row, input.platform, input.sourceId);
        if (!comment) continue;
        this.resultService.saveResult({
          taskId: input.taskId,
          batchId: input.batchId,
          templateId: null,
          data: comment as unknown as Record<string, unknown>,
          status: 'normal',
          sourceUrl: comment.contentUrl,
          createdAt: new Date().toISOString(),
        });
        importedCount += 1;
      }
    }

    return { importedCount, files };
  }
}

function listResultFiles(root: string): string[] {
  const entries = fs.readdirSync(root, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) return listResultFiles(fullPath);
    if (!/\.(json|jsonl)$/i.test(entry.name)) return [];
    if (!/comment|comments|xhs|dy|douyin|bili|wb|weibo|tieba|zhihu|ks|kuaishou/i.test(entry.name)) {
      return [];
    }
    return [fullPath];
  });
}

function readRows(filePath: string): unknown[] {
  const raw = fs.readFileSync(filePath, 'utf8').trim();
  if (!raw) return [];
  if (filePath.toLowerCase().endsWith('.jsonl')) {
    return raw
      .split(/\r?\n/)
      .map((line) => parseJson(line))
      .filter((item) => item !== null);
  }
  const parsed = parseJson(raw);
  if (Array.isArray(parsed)) return parsed;
  if (isRecord(parsed) && Array.isArray(parsed.data)) return parsed.data;
  return parsed ? [parsed] : [];
}

function parseJson(value: string): unknown | null {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function normalizeMediaCrawlerComment(
  row: unknown,
  platform: MediaCrawlerPlatform,
  sourceId: string,
): CommentItem | null {
  if (!isRecord(row)) return null;
  const content = pickString(row, ['content', 'text', 'comment_content', 'commentContent']);
  const commentId = pickString(row, ['comment_id', 'commentId', 'id']);
  if (!content || !commentId) return null;

  return {
    platform: normalizePlatform(platform),
    sourceId,
    contentId: pickString(row, ['note_id', 'aweme_id', 'video_id', 'content_id', 'contentId']),
    contentUrl: pickString(row, ['content_url', 'contentUrl', 'note_url', 'url']),
    contentTitle: pickString(row, ['title', 'note_title', 'contentTitle']),
    commentId,
    parentCommentId: pickString(row, ['parent_comment_id', 'parentCommentId']) ?? null,
    content,
    authorId: pickString(row, ['user_id', 'author_id', 'authorId']),
    authorName: pickString(row, ['nickname', 'user_nickname', 'authorName', 'author_name']),
    avatar: pickString(row, ['avatar', 'avatar_url']),
    createdAt: pickString(row, ['created_at', 'create_time', 'createdAt']),
    likeCount: pickNumber(row, ['like_count', 'likes', 'likeCount']),
    ipLocation: pickString(row, ['ip_location', 'ipLocation']),
    subCommentCount: pickNumber(row, ['sub_comment_count', 'subCommentCount']),
  };
}

function normalizePlatform(platform: MediaCrawlerPlatform): CommentItem['platform'] {
  return platform === 'dy' ? 'douyin' : 'xhs';
}

function pickString(row: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }
  }
  return undefined;
}

function pickNumber(row: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
