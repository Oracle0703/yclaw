import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MediaCrawlerResultImporter } from '@main/services/comment/MediaCrawlerResultImporter';

describe('MediaCrawlerResultImporter', () => {
  let dir: string;
  const saveResult = vi.fn((result) => result);

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mediacrawler-import-'));
    saveResult.mockClear();
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('imports JSON array comments into YClaw extraction results', () => {
    fs.writeFileSync(
      path.join(dir, 'xhs_comments.json'),
      JSON.stringify([
        {
          comment_id: 'comment-1',
          note_id: 'note-1',
          content: '这个工具很好用',
          nickname: '用户A',
          user_id: 'user-1',
          like_count: '12',
          ip_location: '上海',
        },
      ]),
      'utf8',
    );

    const importer = new MediaCrawlerResultImporter({
      resultService: { saveResult },
    });

    const result = importer.importResults({
      outputDir: dir,
      taskId: 'task-1',
      batchId: 'batch-1',
      sourceId: 'source-1',
      platform: 'xhs',
    });

    expect(result.importedCount).toBe(1);
    expect(saveResult).toHaveBeenCalledWith(expect.objectContaining({
      taskId: 'task-1',
      batchId: 'batch-1',
      status: 'normal',
      data: expect.objectContaining({
        platform: 'xhs',
        sourceId: 'source-1',
        commentId: 'comment-1',
        contentId: 'note-1',
        content: '这个工具很好用',
        authorName: '用户A',
        authorId: 'user-1',
        likeCount: 12,
        ipLocation: '上海',
      }),
    }));
  });

  it('imports JSONL comments and skips invalid rows', () => {
    fs.writeFileSync(
      path.join(dir, 'dy_comment.jsonl'),
      [
        JSON.stringify({
          id: 'comment-2',
          aweme_id: 'video-1',
          text: '想看后续教程',
          user_nickname: '抖音用户',
          likes: 8,
        }),
        JSON.stringify({ id: 'invalid-only' }),
      ].join('\n'),
      'utf8',
    );

    const importer = new MediaCrawlerResultImporter({
      resultService: { saveResult },
    });

    const result = importer.importResults({
      outputDir: dir,
      taskId: 'task-1',
      batchId: 'batch-1',
      sourceId: 'source-1',
      platform: 'dy',
    });

    expect(result.importedCount).toBe(1);
    expect(saveResult).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        platform: 'douyin',
        commentId: 'comment-2',
        contentId: 'video-1',
        content: '想看后续教程',
        authorName: '抖音用户',
        likeCount: 8,
      }),
    }));
  });
});
