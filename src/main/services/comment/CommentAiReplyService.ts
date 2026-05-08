import type { CommentAiReplyDraft, CommentItem, CommentReplyTone } from '@shared/types';

export interface CommentAiReplyClient {
  generate(input: {
    prompt: string;
    comment: CommentItem;
    tone: CommentReplyTone;
  }): Promise<string>;
}

export class CommentAiReplyService {
  constructor(private readonly options: { aiClient?: CommentAiReplyClient } = {}) {}

  async generateReply(input: {
    comment: CommentItem;
    tone?: CommentReplyTone;
  }): Promise<CommentAiReplyDraft> {
    const tone = input.tone ?? 'friendly';
    const rawDrafts = this.options.aiClient
      ? await this.options.aiClient.generate({
        prompt: buildReplyPrompt(input.comment, tone),
        comment: input.comment,
        tone,
      })
      : '';
    const drafts = parseDrafts(rawDrafts);

    return {
      commentId: input.comment.commentId,
      platform: input.comment.platform,
      tone,
      drafts: drafts.length > 0 ? drafts : buildFallbackDrafts(tone),
      publishMode: 'manual',
    };
  }
}

function buildReplyPrompt(comment: CommentItem, tone: CommentReplyTone): string {
  const toneText = {
    friendly: '友好自然',
    professional: '专业克制',
    concise: '简短直接',
  }[tone];

  return [
    '你是品牌评论运营助手。只生成回复草稿，不要执行发布动作。',
    '输出 1 到 3 条可供人工选择的中文评论回复，每条不超过 60 个字。',
    '回复必须避免夸大承诺、引战、诱导关注、诱导交易、攻击或敏感表达。',
    `语气：${toneText}`,
    `平台：${comment.platform}`,
    `评论用户：${comment.authorName ?? '未知用户'}`,
    `原评论：${comment.content}`,
    '请按编号列表输出。',
  ].join('\n');
}

function parseDrafts(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:\d+[.、)]|[-*])\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 3);
}

function buildFallbackDrafts(tone: CommentReplyTone): string[] {
  if (tone === 'concise') {
    return ['感谢反馈，我们会继续关注这个问题。'];
  }
  if (tone === 'professional') {
    return ['感谢你的反馈，我们会认真评估并持续优化。'];
  }
  return ['感谢反馈，后续我们会继续优化体验。'];
}
