import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CloseOutlined,
  RobotOutlined,
  SendOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Avatar, Badge, Button, Input, Space, Spin, Typography } from 'antd';
import type { ChatMessage } from '@shared/types';
import { useAIChatStore } from './store';

const { TextArea } = Input;

/** 简易 Markdown 渲染 */
function renderMarkdown(text: string): React.ReactNode {
  // Split by code blocks
  const parts = text.split(/(```[\s\S]*?```)/g);

  return parts.map((part, i) => {
    if (part.startsWith('```') && part.endsWith('```')) {
      const code = part.slice(3, -3).replace(/^\w+\n/, '');
      return (
        <pre
          key={i}
          style={{
            background: 'rgba(0,0,0,0.2)',
            padding: '8px 12px',
            borderRadius: 6,
            fontSize: 12,
            overflow: 'auto',
          }}
        >
          <code>{code}</code>
        </pre>
      );
    }
    // Bold
    const withBold = part.replace(
      /\*\*(.+?)\*\*/g,
      '<strong>$1</strong>',
    );
    return (
      <span
        key={i}
        dangerouslySetInnerHTML={{ __html: withBold }}
      />
    );
  });
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: isUser ? 'row-reverse' : 'row',
        gap: 8,
        marginBottom: 12,
      }}
    >
      <Avatar
        size={28}
        icon={isUser ? <UserOutlined /> : <RobotOutlined />}
        style={{
          backgroundColor: isUser ? '#1677ff' : '#722ed1',
          flexShrink: 0,
        }}
      />
      <div
        style={{
          maxWidth: '80%',
          padding: '8px 12px',
          borderRadius: 8,
          backgroundColor: isUser
            ? 'rgba(22, 119, 255, 0.15)'
            : 'rgba(114, 46, 209, 0.1)',
          lineHeight: 1.6,
          fontSize: 13,
        }}
      >
        {renderMarkdown(message.content)}
      </div>
    </div>
  );
}

export default function AIChatPanel() {
  const {
    messages,
    isOpen,
    isLoading,
    toggle,
    close,
    addMessage,
    setConversationId,
    setLoading,
  } = useAIChatStore();

  const [inputValue, setInputValue] = useState('');
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
    setLoading(true);

    try {
      const response = await window.electronAPI.invoke<{
        message: ChatMessage;
        conversationId: string;
      }>('ai:chat', { message: content });

      if (response.success && response.data) {
        addMessage(response.data.message);
        setConversationId(response.data.conversationId);
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
  }, [inputValue, isLoading, addMessage, setConversationId, setLoading]);

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
        data-testid="ai-chat-bubble"
        onClick={toggle}
        style={{
          position: 'fixed',
          right: 24,
          bottom: 24,
          zIndex: 1000,
          cursor: 'pointer',
        }}
      >
        <Badge dot={messages.length === 0}>
          <Avatar
            size={48}
            icon={<RobotOutlined />}
            style={{
              backgroundColor: '#722ed1',
              boxShadow: '0 4px 12px rgba(114, 46, 209, 0.4)',
            }}
          />
        </Badge>
      </div>
    );
  }

  // Expanded panel
  return (
    <div
      data-testid="ai-chat-panel"
      style={{
        position: 'fixed',
        right: 24,
        bottom: 24,
        width: 360,
        maxHeight: 480,
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 12,
        background: 'var(--ant-color-bg-elevated, #1a1a2e)',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Space>
          <RobotOutlined style={{ color: '#722ed1' }} />
          <Typography.Text strong>AI 运营助手</Typography.Text>
        </Space>
        <Button
          type="text"
          size="small"
          icon={<CloseOutlined />}
          onClick={close}
        />
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '12px 16px',
          minHeight: 200,
        }}
      >
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <RobotOutlined style={{ fontSize: 32, color: '#722ed1', opacity: 0.5 }} />
            <Typography.Paragraph type="secondary" style={{ marginTop: 12 }}>
              你好！我是 YClaw 运营助手。
              <br />
              可以问我关于任务状态、系统资源等问题。
            </Typography.Paragraph>
            <Space direction="vertical" size={4}>
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
                  setInputValue('系统资源使用情况如何？');
                }}
              >
                系统资源使用情况如何？
              </Button>
            </Space>
          </div>
        ) : (
          messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
        )}
        {isLoading && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <Avatar
              size={28}
              icon={<RobotOutlined />}
              style={{ backgroundColor: '#722ed1', flexShrink: 0 }}
            />
            <div
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                backgroundColor: 'rgba(114, 46, 209, 0.1)',
              }}
            >
              <Spin size="small" /> <Typography.Text type="secondary">思考中...</Typography.Text>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div
        style={{
          padding: '8px 12px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          gap: 8,
        }}
      >
        <TextArea
          data-testid="ai-chat-input"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="问我任何问题..."
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
      <div
        style={{
          padding: '4px 12px 8px',
          textAlign: 'center',
        }}
      >
        <Typography.Text type="secondary" style={{ fontSize: 11 }}>
          Ctrl+J 打开/关闭 · Shift+Enter 换行
        </Typography.Text>
      </div>
    </div>
  );
}
