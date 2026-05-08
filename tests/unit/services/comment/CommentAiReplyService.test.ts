import { describe, expect, it, vi } from 'vitest';

import { CommentAiReplyService } from '@main/services/comment/CommentAiReplyService';

describe('CommentAiReplyService', () => {
  it('generates safe manual-review reply drafts for Douyin comments', async () => {
    const generate = vi.fn(async () => '1. 感谢反馈，我们会持续优化。\n2. 这个问题很关键，欢迎继续交流。');
    const service = new CommentAiReplyService({
      aiClient: { generate },
    });

    const result = await service.generateReply({
      comment: {
        platform: 'douyin',
        commentId: 'comment-1',
        content: '这个 AI 工具怎么使用？',
        authorName: '用户A',
        likeCount: 8,
      },
      tone: 'professional',
    });

    expect(generate).toHaveBeenCalledWith(expect.objectContaining({
      prompt: expect.stringContaining('只生成回复草稿'),
    }));
    expect(result).toEqual({
      commentId: 'comment-1',
      platform: 'douyin',
      tone: 'professional',
      drafts: [
        '感谢反馈，我们会持续优化。',
        '这个问题很关键，欢迎继续交流。',
      ],
      publishMode: 'manual',
    });
  });

  it('falls back to deterministic drafts without an AI client', async () => {
    const service = new CommentAiReplyService();

    const result = await service.generateReply({
      comment: {
        platform: 'xhs',
        commentId: 'comment-2',
        content: '价格有点贵',
      },
    });

    expect(result.publishMode).toBe('manual');
    expect(result.drafts.length).toBeGreaterThan(0);
    expect(result.drafts[0]).toContain('反馈');
  });
});
