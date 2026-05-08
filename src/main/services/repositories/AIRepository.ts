import type { ChatMessage, Conversation } from '@shared/types';

interface AIRepositoryExecutor {
  run(sql: string, params?: unknown[]): { changes?: number };
}

export class AIRepository {
  constructor(private readonly executor: AIRepositoryExecutor) {}

  saveAIConversation(conversation: Conversation): void {
    this.executor.run(
      `
        INSERT INTO ai_conversations (id, title, created_at, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          title = excluded.title,
          updated_at = excluded.updated_at
      `,
      [conversation.id, conversation.title, conversation.createdAt, conversation.updatedAt],
    );
  }

  saveAIMessage(conversationId: string, message: ChatMessage): void {
    this.executor.run(
      `
        INSERT INTO ai_messages (id, conversation_id, role, content, timestamp)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          role = excluded.role,
          content = excluded.content,
          timestamp = excluded.timestamp
      `,
      [message.id, conversationId, message.role, message.content, message.timestamp],
    );
  }

  deleteAIConversation(conversationId: string): boolean {
    const result = this.executor.run('DELETE FROM ai_conversations WHERE id = ?', [conversationId]);
    return (result.changes ?? 0) > 0;
  }
}
