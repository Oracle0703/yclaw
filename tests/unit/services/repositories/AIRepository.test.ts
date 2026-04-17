import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatMessage, Conversation } from '@shared/types';
import { AIRepository } from '@main/services/repositories/AIRepository';

describe('AIRepository', () => {
  let run: ReturnType<typeof vi.fn>;
  let repository: AIRepository;

  const conversation: Conversation = {
    id: 'conv-1',
    title: '对话标题',
    messages: [],
    createdAt: 1000,
    updatedAt: 2000,
  };

  const message: ChatMessage = {
    id: 'msg-1',
    role: 'assistant',
    content: '你好',
    timestamp: 3000,
  };

  beforeEach(() => {
    run = vi.fn();
    repository = new AIRepository({ run });
  });

  it('upserts ai conversation metadata', () => {
    repository.saveAIConversation(conversation);

    expect(run).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO ai_conversations'), [
      'conv-1',
      '对话标题',
      1000,
      2000,
    ]);
  });

  it('saves ai message with conversation id', () => {
    repository.saveAIMessage('conv-1', message);

    expect(run).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO ai_messages'), [
      'msg-1',
      'conv-1',
      'assistant',
      '你好',
      3000,
    ]);
  });

  it('returns deletion result based on affected rows', () => {
    run.mockReturnValueOnce({ changes: 0 }).mockReturnValueOnce({ changes: 1 });

    expect(repository.deleteAIConversation('missing')).toBe(false);
    expect(repository.deleteAIConversation('conv-1')).toBe(true);
  });
});
