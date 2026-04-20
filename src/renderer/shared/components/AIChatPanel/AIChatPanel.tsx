import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CloseOutlined, RobotOutlined, SendOutlined, UserOutlined } from '@ant-design/icons';
import { Avatar, Badge, Button, Input, Space, Spin, Typography } from 'antd';
import { IPC_CHANNELS } from '@shared/constants/channels';
import type {
  AIChatResponse,
  AIPendingToolCall,
  AIToolDef,
  ChatMessage,
  ToolResult,
} from '@shared/types';
import { useAIChatStore } from './store';

const { TextArea } = Input;

/** 简易 Markdown 渲染（安全：不使用 dangerouslySetInnerHTML） */
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
          backgroundColor: isUser ? 'rgba(22, 119, 255, 0.15)' : 'rgba(114, 46, 209, 0.1)',
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
  const [availableTools, setAvailableTools] = useState<AIToolDef[]>([]);
  const [toolName, setToolName] = useState('');
  const [toolParamsText, setToolParamsText] = useState('{}');
  const [pendingToolCall, setPendingToolCall] = useState<AIPendingToolCall | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const selectedTool = useMemo(
    () => availableTools.find((tool) => tool.name === toolName.trim()) ?? null,
    [availableTools, toolName],
  );

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

  const loadTools = useCallback(async () => {
    try {
      const response = await window.electronAPI.invoke<AIToolDef[]>(IPC_CHANNELS.AI_TOOLS_LIST);
      if (response.success && Array.isArray(response.data)) {
        setAvailableTools(response.data);
      }
    } catch {
      setAvailableTools([]);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    void loadTools();
  }, [isOpen, loadTools]);

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
          addAssistantMessage(`工具执行失败：${response.data.error ?? '未知错误'}`);
          return;
        }

        addAssistantMessage(`工具结果：\n\`\`\`json\n${formatToolPayload(response.data.data)}\n\`\`\``);
      } catch {
        addAssistantMessage('工具执行失败：无法连接主进程。');
      }
    },
    [addAssistantMessage, formatToolPayload],
  );

  const requestToolExecution = useCallback(async () => {
    const normalizedName = toolName.trim();
    if (!normalizedName) {
      addAssistantMessage('请输入要执行的工具名。');
      return;
    }

    const matchedTool = availableTools.find((tool) => tool.name === normalizedName);
    if (!matchedTool) {
      addAssistantMessage(`未找到工具：${normalizedName}`);
      return;
    }

    let parsedParams: Record<string, unknown>;
    try {
      const parsed = toolParamsText.trim().length === 0 ? {} : JSON.parse(toolParamsText);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('工具参数必须是 JSON 对象');
      }
      parsedParams = parsed as Record<string, unknown>;
    } catch (error) {
      addAssistantMessage(
        error instanceof Error ? error.message : '工具参数解析失败，请输入合法 JSON。',
      );
      return;
    }

    addAssistantMessage(
      `准备调用工具：${matchedTool.name}\n参数：\n\`\`\`json\n${formatToolPayload(parsedParams)}\n\`\`\``,
    );

    if (matchedTool.confirmationLevel >= 2) {
      setPendingToolCall({
        name: matchedTool.name,
        params: parsedParams,
      });
      return;
    }

    await executeTool(matchedTool.name, parsedParams);
  }, [addAssistantMessage, availableTools, executeTool, formatToolPayload, toolName, toolParamsText]);

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

      if (response.success && response.data) {
        if (response.data.executedToolCall) {
          addAssistantMessage(
            `准备调用工具：${response.data.executedToolCall.name}\n参数：\n\`\`\`json\n${formatToolPayload(response.data.executedToolCall.params)}\n\`\`\``,
          );
          setToolName(response.data.executedToolCall.name);
          setToolParamsText(formatToolPayload(response.data.executedToolCall.params));
        }
        addMessage(response.data.message);
        setConversationId(response.data.conversationId);
        if (response.data.pendingToolCall) {
          setPendingToolCall(response.data.pendingToolCall);
          setToolName(response.data.pendingToolCall.name);
          setToolParamsText(formatToolPayload(response.data.pendingToolCall.params));
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
    addAssistantMessage,
    setConversationId,
    setLoading,
    formatToolPayload,
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
        <Button type="text" size="small" icon={<CloseOutlined />} onClick={close} />
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

      <div
        style={{
          padding: '8px 12px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <Typography.Text strong>工具执行</Typography.Text>
        <Input
          value={toolName}
          placeholder="输入工具名，例如 task_list"
          onChange={(event) => setToolName(event.target.value)}
        />
        <TextArea
          value={toolParamsText}
          placeholder="输入工具参数 JSON，可留空"
          onChange={(event) => setToolParamsText(event.target.value)}
          autoSize={{ minRows: 2, maxRows: 4 }}
        />
        <Space wrap>
          {availableTools.map((tool) => (
            <Button
              key={tool.name}
              size="small"
              onClick={() => {
                setToolName(tool.name);
              }}
            >
              {tool.name}
              {tool.confirmationLevel >= 2 ? '（需确认）' : ''}
            </Button>
          ))}
        </Space>
        {selectedTool ? (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {selectedTool.description}
          </Typography.Text>
        ) : null}
        <Button onClick={() => void requestToolExecution()} disabled={!toolName.trim()}>
          执行工具
        </Button>
        {pendingToolCall ? (
          <div
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              backgroundColor: 'rgba(220, 38, 38, 0.08)',
            }}
          >
            <Typography.Text strong>危险工具需确认</Typography.Text>
            <Typography.Paragraph style={{ marginBottom: 8 }}>
              即将执行 `{pendingToolCall.name}`，请确认参数是否正确。
            </Typography.Paragraph>
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
                确认执行工具
              </Button>
              <Button
                onClick={() => {
                  addAssistantMessage(`已取消工具调用：${pendingToolCall.name}`);
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
