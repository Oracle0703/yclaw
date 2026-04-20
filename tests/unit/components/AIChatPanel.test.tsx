import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { IPC_CHANNELS } from '@shared/constants/channels';

vi.mock('@ant-design/icons', () => ({
  CloseOutlined: () => <span>close</span>,
  RobotOutlined: () => <span>robot</span>,
  SendOutlined: () => <span>send</span>,
  UserOutlined: () => <span>user</span>,
}));

vi.mock('antd', () => {
  const TextArea = ({
    'data-testid': dataTestId,
    value,
    onChange,
    onKeyDown,
    placeholder,
  }: {
    'data-testid'?: string;
    value?: string;
    onChange?: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
    onKeyDown?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
    placeholder?: string;
  }) => (
    <textarea
      data-testid={dataTestId}
      value={value ?? ''}
      placeholder={placeholder}
      onChange={onChange}
      onKeyDown={onKeyDown}
    />
  );
  const Input = Object.assign(({
    value,
    onChange,
    placeholder,
  }: {
    value?: string;
    onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder?: string;
  }) => (
    <input
      value={value ?? ''}
      placeholder={placeholder}
      onChange={onChange}
    />
  ), { TextArea });

  return {
    Avatar: ({ children, icon }: { children?: React.ReactNode; icon?: React.ReactNode }) => (
      <div>
        {icon}
        {children}
      </div>
    ),
    Badge: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    Button: ({
      children,
      disabled,
      onClick,
    }: {
      children?: React.ReactNode;
      disabled?: boolean;
      onClick?: () => void;
    }) => (
      <button type="button" disabled={disabled} onClick={onClick}>
        {children}
      </button>
    ),
    Input,
    Space: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    Spin: () => <span>loading</span>,
    Typography: {
      Paragraph: ({ children }: { children?: React.ReactNode }) => <p>{children}</p>,
      Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
    },
  };
});

import AIChatPanel from '@renderer/shared/components/AIChatPanel/AIChatPanel';
import { useAIChatStore } from '@renderer/shared/components/AIChatPanel/store';

describe('AIChatPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAIChatStore.setState({
      messages: [],
      conversationId: null,
      isOpen: true,
      isLoading: false,
    });
  });

  it('executes a non-dangerous tool and shows tool call summary', async () => {
    vi.mocked(window.electronAPI.invoke)
      .mockResolvedValueOnce({
        success: true,
        data: [
          {
            name: 'mcp.mock.echo',
            description: '回显输入',
            parameters: {},
            confirmationLevel: 0,
            source: 'mcp:mock',
          },
        ],
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          success: true,
          data: {
            echoed: 'hello tool',
          },
        },
      });

    render(<AIChatPanel />);

    await waitFor(() => {
      expect(window.electronAPI.invoke).toHaveBeenCalledWith(IPC_CHANNELS.AI_TOOLS_LIST);
    });

    fireEvent.change(screen.getByPlaceholderText('输入工具名，例如 task_list'), {
      target: { value: 'mcp.mock.echo' },
    });
    fireEvent.change(screen.getByPlaceholderText('输入工具参数 JSON，可留空'), {
      target: { value: '{"text":"hello tool"}' },
    });
    fireEvent.click(screen.getByRole('button', { name: '执行工具' }));

    await waitFor(() => {
      expect(window.electronAPI.invoke).toHaveBeenCalledWith(IPC_CHANNELS.AI_TOOL_EXECUTE, {
        name: 'mcp.mock.echo',
        params: {
          text: 'hello tool',
        },
      });
    });

    expect(screen.getByText(/准备调用工具：mcp\.mock\.echo/)).toBeTruthy();
    expect(screen.getByText(/"text": "hello tool"/)).toBeTruthy();
  });

  it('requires confirmation before executing a dangerous tool', async () => {
    vi.mocked(window.electronAPI.invoke)
      .mockResolvedValueOnce({
        success: true,
        data: [
          {
            name: 'mcp.mock.danger',
            description: '危险操作',
            parameters: {},
            confirmationLevel: 2,
            source: 'mcp:mock',
          },
        ],
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          success: true,
          data: {
            accepted: true,
          },
        },
      });

    render(<AIChatPanel />);

    await waitFor(() => {
      expect(window.electronAPI.invoke).toHaveBeenCalledWith(IPC_CHANNELS.AI_TOOLS_LIST);
    });

    fireEvent.change(screen.getByPlaceholderText('输入工具名，例如 task_list'), {
      target: { value: 'mcp.mock.danger' },
    });
    fireEvent.change(screen.getByPlaceholderText('输入工具参数 JSON，可留空'), {
      target: { value: '{"action":"refresh"}' },
    });
    fireEvent.click(screen.getByRole('button', { name: '执行工具' }));

    expect(screen.getByText(/危险工具需确认/)).toBeTruthy();
    expect(window.electronAPI.invoke).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: '确认执行工具' }));

    await waitFor(() => {
      expect(window.electronAPI.invoke).toHaveBeenCalledWith(IPC_CHANNELS.AI_TOOL_EXECUTE, {
        name: 'mcp.mock.danger',
        params: {
          action: 'refresh',
        },
      });
    });
  });

  it('shows pending confirmation from AI chat response and executes it after approval', async () => {
    vi.mocked(window.electronAPI.invoke)
      .mockResolvedValueOnce({
        success: true,
        data: [
          {
            name: 'mcp.mock.danger',
            description: '危险操作',
            parameters: {},
            confirmationLevel: 2,
            source: 'mcp:mock',
          },
        ],
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          conversationId: 'conv-tool',
          message: {
            id: 'assistant-pending',
            role: 'assistant',
            content: '工具 mcp.mock.danger 需要用户确认，尚未执行。',
            timestamp: 3,
          },
          pendingToolCall: {
            name: 'mcp.mock.danger',
            params: {
              action: 'refresh',
            },
          },
        },
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          success: true,
          data: {
            accepted: true,
          },
        },
      });

    render(<AIChatPanel />);

    await waitFor(() => {
      expect(window.electronAPI.invoke).toHaveBeenCalledWith(IPC_CHANNELS.AI_TOOLS_LIST);
    });

    const input = screen.getByTestId('ai-chat-input');
    fireEvent.change(input, { target: { value: '帮我刷新登录态' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText(/危险工具需确认/)).toBeTruthy();
      expect(screen.getByText(/即将执行 `mcp\.mock\.danger`/)).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: '确认执行工具' }));

    await waitFor(() => {
      expect(window.electronAPI.invoke).toHaveBeenCalledWith(IPC_CHANNELS.AI_TOOL_EXECUTE, {
        name: 'mcp.mock.danger',
        params: {
          action: 'refresh',
        },
      });
    });
  });

  it('shows executed tool summary from AI chat response before tool result', async () => {
    vi.mocked(window.electronAPI.invoke)
      .mockResolvedValueOnce({
        success: true,
        data: [
          {
            name: 'mcp.mock.echo',
            description: '回显输入',
            parameters: {},
            confirmationLevel: 0,
            source: 'mcp:mock',
          },
        ],
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          conversationId: 'conv-auto-tool',
          executedToolCall: {
            name: 'mcp.mock.echo',
            params: {
              text: 'ping',
            },
          },
          message: {
            id: 'assistant-auto-tool',
            role: 'assistant',
            content: '已调用工具：mcp.mock.echo\n\n结果：\n```json\n{"text":"pong"}\n```',
            timestamp: 4,
          },
        },
      });

    render(<AIChatPanel />);

    await waitFor(() => {
      expect(window.electronAPI.invoke).toHaveBeenCalledWith(IPC_CHANNELS.AI_TOOLS_LIST);
    });

    const input = screen.getByTestId('ai-chat-input');
    fireEvent.change(input, { target: { value: '帮我回显 ping' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText(/准备调用工具：mcp\.mock\.echo/)).toBeTruthy();
      expect(screen.getByText(/"text": "ping"/)).toBeTruthy();
      expect(screen.getByText(/已调用工具：mcp\.mock\.echo/)).toBeTruthy();
    });
  });

  it('sends stored conversation id on follow-up messages', async () => {
    vi.mocked(window.electronAPI.invoke)
      .mockResolvedValueOnce({
        success: true,
        data: [],
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          conversationId: 'conv-1',
          message: {
            id: 'assistant-1',
            role: 'assistant',
            content: '第一条回复',
            timestamp: 1,
          },
        },
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          conversationId: 'conv-1',
          message: {
            id: 'assistant-2',
            role: 'assistant',
            content: '第二条回复',
            timestamp: 2,
          },
        },
      });

    render(<AIChatPanel />);

    const input = screen.getByTestId('ai-chat-input');
    fireEvent.change(input, { target: { value: '第一条' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(useAIChatStore.getState().conversationId).toBe('conv-1');
    });

    fireEvent.change(input, { target: { value: '第二条' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(window.electronAPI.invoke).toHaveBeenNthCalledWith(3, 'ai:chat', {
        message: '第二条',
        conversationId: 'conv-1',
      });
    });
  });
});
