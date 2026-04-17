import { beforeEach, describe, expect, it, vi } from 'vitest';
import React, { useEffect } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { IPC_CHANNELS } from '@shared/constants/channels';

const { invokeMock, messageSuccessMock, messageErrorMock, setThemePreferenceMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  messageSuccessMock: vi.fn(),
  messageErrorMock: vi.fn(),
  setThemePreferenceMock: vi.fn(),
}));

const formValues = {
  theme: 'dark',
  language: 'zh-CN',
  startupBehavior: 'showWorkbench',
  closeToTray: false,
};

vi.mock('antd', () => {
  const mockForm = {
    submit: vi.fn(),
    setFieldsValue: vi.fn(),
  };

  const Form = Object.assign(
    ({
      children,
      form,
      onFinish,
    }: {
      children?: React.ReactNode;
      form?: typeof mockForm;
      onFinish?: (values: typeof formValues) => Promise<boolean>;
    }) => {
    useEffect(() => {
      if (form) {
        form.submit.mockImplementation(() => onFinish?.(formValues) ?? Promise.resolve(true));
      }
    }, [form, onFinish]);

    return <form>{children}</form>;
    },
    {
      useForm: () => [mockForm],
      Item: ({ children, label }: { children?: React.ReactNode; label?: React.ReactNode }) => (
        <label>
          <span>{label}</span>
          {children}
        </label>
      ),
    },
  );

  return {
    App: {
      useApp: () => ({
        message: {
          success: messageSuccessMock,
          error: messageErrorMock,
        },
      }),
    },
    Button: ({
      children,
      onClick,
    }: {
      children?: React.ReactNode;
      onClick?: () => void;
    }) => (
      <button type="button" onClick={onClick}>
        {children}
      </button>
    ),
    Card: ({ children, title }: { children?: React.ReactNode; title?: React.ReactNode }) => (
      <section>
        {title ? <h1>{title}</h1> : null}
        {children}
      </section>
    ),
    Col: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    Descriptions: Object.assign(
      ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
      {
        Item: ({ children, label }: { children?: React.ReactNode; label?: React.ReactNode }) => (
          <div>
            <span>{label}</span>
            <span>{children}</span>
          </div>
        ),
      },
    ),
    Form,
    Row: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    Select: ({ options }: { options?: Array<{ label: string; value: string }> }) => (
      <select>
        {options?.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    ),
    Space: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    Switch: () => <button type="button" role="switch" />,
    Tag: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
    Typography: {
      Title: ({ children }: { children?: React.ReactNode }) => <h2>{children}</h2>,
      Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
      Paragraph: ({ children }: { children?: React.ReactNode }) => <p>{children}</p>,
    },
  };
});

vi.mock('@renderer/shared/components/PageShell', () => ({
  PageShell: ({
    children,
    title,
  }: {
    children: React.ReactNode;
    title: React.ReactNode;
  }) => (
    <div>
      <h1>{title}</h1>
      {children}
    </div>
  ),
}));

vi.mock('@renderer/shared/components/AppProviders', () => ({
  useThemeMode: () => ({
    setThemePreference: setThemePreferenceMock,
  }),
}));

vi.mock('@renderer/shared/hooks', () => ({
  useIpc: () => ({
    invoke: invokeMock,
  }),
}));

import Settings from '@renderer/entries/workbench/pages/Settings';

describe('Settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setThemePreferenceMock.mockResolvedValue(undefined);
    invokeMock.mockImplementation(async (channel: string) => {
      if (channel === IPC_CHANNELS.CONFIG_GET_ALL) {
        return {
          general: {
            theme: 'system',
            language: 'zh-CN',
            startupBehavior: 'showWorkbench',
            closeToTray: false,
          },
          modules: {},
          plugins: {},
        };
      }

      return null;
    });
  });

  it('shows an error when saving settings fails', async () => {
    invokeMock.mockImplementation(async (channel: string) => {
      if (channel === IPC_CHANNELS.CONFIG_GET_ALL) {
        return {
          general: {
            theme: 'system',
            language: 'zh-CN',
            startupBehavior: 'showWorkbench',
            closeToTray: false,
          },
          modules: {},
          plugins: {},
        };
      }

      if (channel === IPC_CHANNELS.CONFIG_SET) {
        throw new Error('save settings failed');
      }

      return null;
    });

    render(<Settings />);

    fireEvent.click(screen.getByRole('button', { name: '保存设置' }));

    await waitFor(() => {
      expect(messageErrorMock).toHaveBeenCalledWith('save settings failed');
    });
    expect(messageSuccessMock).not.toHaveBeenCalled();
  });
});
