import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { IPC_CHANNELS } from '@shared/constants/channels';

vi.mock('@ant-design/icons', () => ({
  CloseOutlined: ({ style }: { style?: React.CSSProperties }) => <span style={style}>close</span>,
  RobotOutlined: ({ style }: { style?: React.CSSProperties }) => <span style={style}>robot</span>,
  SendOutlined: ({ style }: { style?: React.CSSProperties }) => <span style={style}>send</span>,
  UserOutlined: ({ style }: { style?: React.CSSProperties }) => <span style={style}>user</span>,
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
  const Input = Object.assign(
    ({
      value,
      onChange,
      placeholder,
    }: {
      value?: string;
      onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
      placeholder?: string;
    }) => <input value={value ?? ''} placeholder={placeholder} onChange={onChange} />,
    { TextArea },
  );

  return {
    Avatar: ({
      children,
      icon,
      style,
    }: {
      children?: React.ReactNode;
      icon?: React.ReactNode;
      style?: React.CSSProperties;
    }) => (
      <div style={style}>
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
    vi.mocked(window.electronAPI.invoke).mockReset();
    vi.mocked(window.electronAPI.invoke).mockResolvedValue({ success: true, data: null });
    useAIChatStore.setState({
      messages: [],
      conversationId: null,
      isOpen: true,
      isLoading: false,
    });
  });

  it('renders a conversational empty state without the manual tool console', () => {
    render(<AIChatPanel />);

    expect(screen.getByText(/你好！我是 YClaw 运营助手。/)).toBeTruthy();
    expect(screen.getByPlaceholderText('直接问我，或说“帮我启动某个任务”')).toBeTruthy();
    expect(screen.queryByText('工具执行')).toBeNull();
    expect(screen.queryByPlaceholderText('输入工具名，例如 task_list')).toBeNull();
    expect(screen.queryByPlaceholderText('输入工具参数 JSON，可留空')).toBeNull();
  });

  it('uses YClaw theme variables instead of the old purple assistant styling', () => {
    const { unmount } = render(<AIChatPanel />);

    const panel = screen.getByTestId('ai-chat-panel');
    const panelStyle = panel.getAttribute('style') ?? '';
    const panelMarkup = panel.outerHTML;

    expect(panelStyle).toContain('--yclaw-ai-chat-bg: var(--yclaw-body-gradient)');
    expect(panelStyle).toContain('--yclaw-ai-chat-text: var(--yclaw-text)');
    expect(panelStyle).toContain('--yclaw-ai-chat-accent: var(--yclaw-accent)');
    expect(panelMarkup).toContain('--yclaw-body-gradient');
    expect(panelMarkup).toContain('--yclaw-accent');
    expect(panelMarkup).not.toContain('#722ed1');
    expect(panelMarkup).not.toContain('114, 46, 209');

    unmount();
    useAIChatStore.setState({ isOpen: false });
    render(<AIChatPanel />);

    const bubbleMarkup = screen.getByTestId('ai-chat-bubble').outerHTML;
    expect(bubbleMarkup).toContain('--yclaw-body-gradient');
    expect(bubbleMarkup).toContain('--yclaw-accent');
    expect(bubbleMarkup).not.toContain('#722ed1');
    expect(bubbleMarkup).not.toContain('114, 46, 209');
  });

  it('shows pending task-start confirmation from chat and executes it after approval', async () => {
    vi.mocked(window.electronAPI.invoke)
      .mockResolvedValueOnce({
        success: true,
        data: {
          conversationId: 'conv-tool',
          message: {
            id: 'assistant-pending',
            role: 'assistant',
            content: '我可以帮你启动任务「早盘巡检」。',
            timestamp: 3,
          },
          pendingToolCall: {
            name: 'task_start',
            params: {
              taskName: '早盘巡检',
            },
          },
        },
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          success: true,
          data: {
            taskId: 'task-1',
            taskName: '早盘巡检',
            status: 'running',
          },
        },
      });

    render(<AIChatPanel />);

    const input = screen.getByTestId('ai-chat-input');
    fireEvent.change(input, { target: { value: '帮我启动早盘巡检' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(screen.getAllByText('确认开始任务')).toHaveLength(2);
      expect(screen.getByText('助手准备帮你启动任务「早盘巡检」。')).toBeTruthy();
      expect(screen.getByText(/"taskName": "早盘巡检"/)).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: '确认开始任务' }));

    await waitFor(() => {
      expect(window.electronAPI.invoke).toHaveBeenCalledWith(IPC_CHANNELS.AI_TOOL_EXECUTE, {
        name: 'task_start',
        params: {
          taskName: '早盘巡检',
        },
      });
      expect(screen.getByText(/已帮你启动任务「早盘巡检」。/)).toBeTruthy();
      expect(screen.getByText(/当前状态：running/)).toBeTruthy();
    });
  });

  it('renders task-start replies as normal conversation instead of a tool console', async () => {
    vi.mocked(window.electronAPI.invoke).mockResolvedValueOnce({
      success: true,
      data: {
        conversationId: 'conv-auto-tool',
        executedToolCall: {
          name: 'task_start',
          params: {
            taskName: '盘后复盘',
          },
        },
        message: {
          id: 'assistant-auto-tool',
          role: 'assistant',
          content: '已帮你启动任务「盘后复盘」。\n当前状态：running',
          timestamp: 4,
        },
      },
    });

    render(<AIChatPanel />);

    const input = screen.getByTestId('ai-chat-input');
    fireEvent.change(input, { target: { value: '帮我启动盘后复盘' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText(/已帮你启动任务「盘后复盘」。/)).toBeTruthy();
      expect(screen.getByText(/当前状态：running/)).toBeTruthy();
    });

    expect(screen.queryByText('工具执行')).toBeNull();
  });

  it('sends the stored conversation id on follow-up messages', async () => {
    vi.mocked(window.electronAPI.invoke)
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
      expect(window.electronAPI.invoke).toHaveBeenNthCalledWith(2, IPC_CHANNELS.AI_CHAT, {
        message: '第二条',
        conversationId: 'conv-1',
      });
    });
  });
});
