import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('@ant-design/icons', () => ({
  CloseOutlined: () => <span>close</span>,
  RobotOutlined: () => <span>robot</span>,
  SendOutlined: () => <span>send</span>,
  UserOutlined: () => <span>user</span>,
}));

vi.mock('antd', () => {
  const TextArea = ({
    value,
    onChange,
    onKeyDown,
    placeholder,
  }: {
    value?: string;
    onChange?: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
    onKeyDown?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
    placeholder?: string;
  }) => (
    <textarea
      data-testid="ai-chat-input"
      value={value ?? ''}
      placeholder={placeholder}
      onChange={onChange}
      onKeyDown={onKeyDown}
    />
  );
  const Input = Object.assign(() => <input />, { TextArea });

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

  it('sends stored conversation id on follow-up messages', async () => {
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
      expect(window.electronAPI.invoke).toHaveBeenNthCalledWith(2, 'ai:chat', {
        message: '第二条',
        conversationId: 'conv-1',
      });
    });
  });
});
