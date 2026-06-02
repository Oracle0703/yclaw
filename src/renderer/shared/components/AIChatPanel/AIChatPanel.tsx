import { type CSSProperties, type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { CloseOutlined, RobotOutlined, SendOutlined, UserOutlined } from '@ant-design/icons';
import { Avatar, Badge, Button, Input, Space, Spin, Typography } from 'antd';
import { IPC_CHANNELS } from '@shared/constants/channels';
import type {
  AIChatResponse,
  AIPendingToolCall,
  ChatMessage,
  ToolResult,
} from '@shared/types';
import { useAIChatStore } from './store';

const { TextArea } = Input;

const AI_CHAT_THEME_STYLE = {
  '--yclaw-ai-chat-bg': 'var(--yclaw-body-gradient)',
  '--yclaw-ai-chat-surface': 'var(--yclaw-card-bg)',
  '--yclaw-ai-chat-border': 'var(--yclaw-card-border)',
  '--yclaw-ai-chat-text': 'var(--yclaw-text)',
  '--yclaw-ai-chat-muted': 'var(--yclaw-text-secondary)',
  '--yclaw-ai-chat-accent': 'var(--yclaw-accent)',
  '--yclaw-ai-chat-shadow': 'var(--yclaw-shadow)',
} as CSSProperties;

/** 简易 Markdown 渲染（安全：不使用 dangerouslySetInnerHTML） */
function renderMarkdown(text: string): ReactNode {
  // Split by code blocks
  const parts = text.split(/(```[\s\S]*?```)/g);

  return parts.map((part, i) => {
    if (part.startsWith('```') && part.endsWith('```')) {
      const code = part.slice(3, -3).replace(/^\w+\n/, '');
      return (
        <pre
          key={i}
          className="yclaw-ai-chat-code"
        >
          <code>{code}</code>
        </pre>
      );
    }
    // Bold — split on **...** and render as React elements (no innerHTML)
    const segments = part.split(/(\*\*.+?\*\*)/g);
    return (
      <span key={i}>
        {segments.map((seg, j) => {
          if (seg.startsWith('**') && seg.endsWith('**')) {
            return <strong key={j}>{seg.slice(2, -2)}</strong>;
          }
          return <span key={j}>{seg}</span>;
        })}
      </span>
    );
  });
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  return (
    <div
      className={`yclaw-ai-chat-message ${isUser ? 'is-user' : 'is-assistant'}`}
    >
      <Avatar
        size={28}
        icon={isUser ? <UserOutlined /> : <RobotOutlined />}
        className={`yclaw-ai-chat-avatar ${isUser ? 'is-user' : 'is-assistant'}`}
      />
      <div className="yclaw-ai-chat-message-bubble">
        {renderMarkdown(message.content)}
      </div>
    </div>
  );
}

export default function AIChatPanel() {
  const {
    messages,
    conversationId,
    isOpen,
    isLoading,
    toggle,
    close,
    addMessage,
    setConversationId,
    setLoading,
  } = useAIChatStore();

  const [inputValue, setInputValue] = useState('');
  const [pendingToolCall, setPendingToolCall] = useState<AIPendingToolCall | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Ctrl+J shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'j') {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggle]);

  const addAssistantMessage = useCallback(
    (content: string) => {
      addMessage({
        id: `${Date.now()}-assistant-${Math.random().toString(36).slice(2, 8)}`,
        role: 'assistant',
        content,
        timestamp: Date.now(),
      });
    },
    [addMessage],
  );

  const formatToolPayload = useCallback((value: unknown) => JSON.stringify(value, null, 2), []);

  const formatToolExecutionMessage = useCallback(
    (name: string, params: Record<string, unknown>, payload: unknown) => {
      if (name === 'task_start') {
        const data = (payload ?? {}) as {
          taskId?: string;
          taskName?: string;
          status?: string;
        };
        const taskLabel =
          data.taskName ||
          (typeof params.taskName === 'string' ? params.taskName : undefined) ||
          (typeof params.taskId === 'string' ? params.taskId : undefined) ||
          '目标任务';

        return [
          `已帮你启动任务「${taskLabel}」。`,
          data.status ? `当前状态：${data.status}` : null,
          data.taskId ? `任务 ID：${data.taskId}` : null,
        ]
          .filter(Boolean)
          .join('\n');
      }

      return [
        `已执行操作「${name}」。`,
        payload ? `返回结果：\n\`\`\`json\n${formatToolPayload(payload)}\n\`\`\`` : null,
      ]
        .filter(Boolean)
        .join('\n\n');
    },
    [formatToolPayload],
  );

  const describePendingToolCall = useCallback((toolCall: AIPendingToolCall) => {
    if (toolCall.name === 'task_start') {
      const label =
        (typeof toolCall.params.taskName === 'string' && toolCall.params.taskName.trim()) ||
        (typeof toolCall.params.taskId === 'string' && toolCall.params.taskId.trim()) ||
        '目标任务';
      return {
        title: '确认开始任务',
        summary: `助手准备帮你启动任务「${label}」。`,
        confirmText: '确认开始任务',
      };
    }

    return {
      title: '确认执行操作',
      summary: `助手准备执行操作「${toolCall.name}」。`,
      confirmText: '确认执行',
    };
  }, []);

  const executeTool = useCallback(
    async (name: string, params: Record<string, unknown>) => {
      try {
        const response = await window.electronAPI.invoke<ToolResult>(IPC_CHANNELS.AI_TOOL_EXECUTE, {
          name,
          params,
        });

        if (!response.success || !response.data) {
          addAssistantMessage(response.error?.message ?? '工具执行失败');
          return;
        }

        if (!response.data.success) {
          if (name === 'task_start') {
            addAssistantMessage(`启动任务失败：${response.data.error ?? '未知错误'}`);
            return;
          }
          addAssistantMessage(`执行操作失败：${response.data.error ?? '未知错误'}`);
          return;
        }

        addAssistantMessage(formatToolExecutionMessage(name, params, response.data.data));
      } catch {
        addAssistantMessage(name === 'task_start' ? '启动任务失败：无法连接主进程。' : '执行操作失败：无法连接主进程。');
      }
    },
    [addAssistantMessage, formatToolExecutionMessage],
  );

  const sendMessage = useCallback(async () => {
    const content = inputValue.trim();
    if (!content || isLoading) return;

    const userMessage: ChatMessage = {
      id: `${Date.now()}-user`,
      role: 'user',
      content,
      timestamp: Date.now(),
    };
    addMessage(userMessage);
    setInputValue('');
    setPendingToolCall(null);
    setLoading(true);

    try {
      const response = await window.electronAPI.invoke<AIChatResponse>(IPC_CHANNELS.AI_CHAT, {
        message: content,
        conversationId: conversationId ?? undefined,
      });

      if (response.success && response.data?.message) {
        addMessage(response.data.message);
        setConversationId(response.data.conversationId);
        if (response.data.pendingToolCall) {
          setPendingToolCall(response.data.pendingToolCall);
        }
      } else {
        addMessage({
          id: `${Date.now()}-error`,
          role: 'assistant',
          content: response.error?.message ?? 'AI 服务暂时不可用，请稍后再试。',
          timestamp: Date.now(),
        });
      }
    } catch {
      addMessage({
        id: `${Date.now()}-error`,
        role: 'assistant',
        content: 'AI 服务连接失败，请检查网络设置。',
        timestamp: Date.now(),
      });
    } finally {
      setLoading(false);
    }
  }, [
    inputValue,
    conversationId,
    isLoading,
    addMessage,
    setConversationId,
    setLoading,
  ]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  // Floating bubble
  if (!isOpen) {
    return (
      <div
        className="yclaw-ai-chat-bubble-button"
        data-testid="ai-chat-bubble"
        onClick={toggle}
        style={AI_CHAT_THEME_STYLE}
      >
        <Badge dot={messages.length === 0}>
          <Avatar
            size={48}
            icon={<RobotOutlined />}
            className="yclaw-ai-chat-launch-avatar"
          />
        </Badge>
      </div>
    );
  }

  // Expanded panel
  const pendingToolMeta = pendingToolCall ? describePendingToolCall(pendingToolCall) : null;

  return (
    <div
      className="yclaw-ai-chat-panel"
      data-testid="ai-chat-panel"
      style={AI_CHAT_THEME_STYLE}
    >
      {/* Header */}
      <div className="yclaw-ai-chat-header">
        <Space>
          <RobotOutlined className="yclaw-ai-chat-title-icon" />
          <Typography.Text strong className="yclaw-ai-chat-title">AI 运营助手</Typography.Text>
        </Space>
        <Button
          type="text"
          size="small"
          icon={<CloseOutlined />}
          onClick={close}
          className="yclaw-ai-chat-close"
        />
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="yclaw-ai-chat-messages"
      >
        {messages.length === 0 ? (
          <div className="yclaw-ai-chat-empty">
            <RobotOutlined className="yclaw-ai-chat-empty-icon" />
            <Typography.Paragraph type="secondary" className="yclaw-ai-chat-empty-copy">
              你好！我是 YClaw 运营助手。
              <br />
              你可以直接问我任务状态、系统资源，或者让我帮你启动任务。
            </Typography.Paragraph>
            <Space direction="vertical" size={4} className="yclaw-ai-chat-empty-actions">
              <Button
                size="small"
                type="dashed"
                onClick={() => {
                  setInputValue('今天任务执行情况怎么样？');
                }}
              >
                今天任务执行情况怎么样？
              </Button>
              <Button
                size="small"
                type="dashed"
                onClick={() => {
                  setInputValue('帮我看看现在有哪些任务在运行');
                }}
              >
                帮我看看现在有哪些任务在运行
              </Button>
              <Button
                size="small"
                type="dashed"
                onClick={() => {
                  setInputValue('帮我启动一个任务');
                }}
              >
                帮我启动一个任务
              </Button>
            </Space>
          </div>
        ) : (
          messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
        )}
        {isLoading && (
          <div className="yclaw-ai-chat-message is-assistant">
            <Avatar
              size={28}
              icon={<RobotOutlined />}
              className="yclaw-ai-chat-avatar is-assistant"
            />
            <div className="yclaw-ai-chat-message-bubble">
              <Spin size="small" /> <Typography.Text type="secondary">思考中...</Typography.Text>
            </div>
          </div>
        )}
      </div>

      <div
        className="yclaw-ai-chat-confirm-wrap"
      >
        {pendingToolCall ? (
          <div className="yclaw-ai-chat-confirm">
            <Typography.Text strong>{pendingToolMeta?.title}</Typography.Text>
            <Typography.Paragraph style={{ marginBottom: 8 }}>
              {pendingToolMeta?.summary}
            </Typography.Paragraph>
            <Typography.Paragraph style={{ marginBottom: 8 }}>
              参数：
            </Typography.Paragraph>
            <pre
              className="yclaw-ai-chat-code is-tool-payload"
            >
              <code>{formatToolPayload(pendingToolCall.params)}</code>
            </pre>
            <Space>
              <Button
                type="primary"
                danger
                onClick={() => {
                  const currentCall = pendingToolCall;
                  setPendingToolCall(null);
                  void executeTool(currentCall.name, currentCall.params);
                }}
              >
                {pendingToolMeta?.confirmText}
              </Button>
              <Button
                onClick={() => {
                  addAssistantMessage(`已取消本次操作。`);
                  setPendingToolCall(null);
                }}
              >
                取消
              </Button>
            </Space>
          </div>
        ) : null}
      </div>

      {/* Input */}
      <div className="yclaw-ai-chat-input-row">
        <TextArea
          data-testid="ai-chat-input"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="直接问我，或说“帮我启动某个任务”"
          autoSize={{ minRows: 1, maxRows: 3 }}
          style={{ flex: 1 }}
        />
        <Button
          type="primary"
          icon={<SendOutlined />}
          onClick={() => void sendMessage()}
          disabled={!inputValue.trim() || isLoading}
          style={{ alignSelf: 'flex-end' }}
        />
      </div>

      {/* Footer */}
      <div className="yclaw-ai-chat-footer">
        <Typography.Text type="secondary" style={{ fontSize: 11 }}>
          Ctrl+J 打开/关闭 · Shift+Enter 换行
        </Typography.Text>
      </div>
    </div>
  );
}
