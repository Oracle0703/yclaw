import { beforeEach, describe, expect, it, vi } from 'vitest';
import React, { useEffect } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { IPC_CHANNELS } from '@shared/constants/channels';

const { invokeMock, messageSuccessMock, messageErrorMock, setThemePreferenceMock } = vi.hoisted(
  () => ({
    invokeMock: vi.fn(),
    messageSuccessMock: vi.fn(),
    messageErrorMock: vi.fn(),
    setThemePreferenceMock: vi.fn(),
  }),
);

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
    Button: ({ children, onClick }: { children?: React.ReactNode; onClick?: () => void }) => (
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
    Input: Object.assign(
      ({
        onChange,
        placeholder,
        value,
      }: {
        onChange?: (event: { target: { value: string } }) => void;
        placeholder?: string;
        value?: string;
      }) => (
        <input
          placeholder={placeholder}
          value={value ?? ''}
          onChange={(event) => onChange?.({ target: { value: event.target.value } })}
        />
      ),
      {
        TextArea: ({
          onChange,
          placeholder,
          value,
        }: {
          onChange?: (event: { target: { value: string } }) => void;
          placeholder?: string;
          value?: string;
        }) => (
          <textarea
            placeholder={placeholder}
            value={value ?? ''}
            onChange={(event) => onChange?.({ target: { value: event.target.value } })}
          />
        ),
      },
    ),
    InputNumber: ({
      onChange,
      value,
    }: {
      onChange?: (value: number | null) => void;
      value?: number;
    }) => (
      <input
        aria-label="MCP HTTP 端口"
        type="number"
        value={value ?? ''}
        onChange={(event) => onChange?.(event.target.value ? Number(event.target.value) : null)}
      />
    ),
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
    Segmented: ({
      options,
      onChange,
      value,
    }: {
      options?: Array<{ label: string; value: string }>;
      onChange?: (value: string) => void;
      value?: string;
    }) => (
      <div role="tablist">
        {options?.map((option) => (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={value === option.value}
            onClick={() => onChange?.(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    ),
    Slider: ({
      onChangeComplete,
      value,
    }: {
      onChangeComplete?: (value: number) => void;
      value?: number;
    }) => (
      <input
        aria-label="蒙层透明度"
        type="range"
        value={value ?? 0}
        onChange={(event) => onChangeComplete?.(Number(event.target.value))}
      />
    ),
    Radio: Object.assign(
      ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
      {
        Group: ({
          children,
          onChange,
          value,
        }: {
          children?: React.ReactNode;
          onChange?: (event: { target: { value: string } }) => void;
          value?: string;
        }) => (
          <div
            data-value={value}
            onClick={(event) => {
              const target = event.target as HTMLElement;
              const dataValue = target.getAttribute('data-radio-value');
              if (dataValue && onChange) {
                onChange({ target: { value: dataValue } });
              }
            }}
          >
            {children}
          </div>
        ),
        Button: ({ children, value }: { children?: React.ReactNode; value?: string }) => (
          <button type="button" data-radio-value={value}>
            {children}
          </button>
        ),
      },
    ),
    ColorPicker: ({
      value,
      onChangeComplete,
    }: {
      value?: string;
      onChangeComplete?: (color: { toHexString: () => string }) => void;
    }) => (
      <input
        aria-label="背景颜色"
        value={value ?? ''}
        onChange={(event) => onChangeComplete?.({ toHexString: () => event.target.value })}
      />
    ),
    Typography: {
      Title: ({ children }: { children?: React.ReactNode }) => <h2>{children}</h2>,
      Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
      Paragraph: ({ children }: { children?: React.ReactNode }) => <p>{children}</p>,
    },
  };
});

vi.mock('@renderer/shared/components/PageShell', () => ({
  PageShell: ({ children, title }: { children: React.ReactNode; title: React.ReactNode }) => (
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
  useBackground: () => ({
    background: { type: 'preset', value: 'aurora' },
    setBackground: vi.fn().mockResolvedValue(undefined),
    resetBackground: vi.fn().mockResolvedValue(undefined),
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

  it('loads embedded MCP http status on mount', async () => {
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

      if (channel === IPC_CHANNELS.AI_MCP_STATUS) {
        return {
          running: true,
          host: '127.0.0.1',
          port: 3939,
          endpoint: 'http://127.0.0.1:3939/mcp',
          authRequired: true,
        };
      }

      if (channel === IPC_CHANNELS.AI_MCP_CLIENT_STATUS) {
        return [];
      }

      if (channel === IPC_CHANNELS.AI_MCP_AUDIT_LIST) {
        return [];
      }

      return null;
    });

    render(<Settings />);

    await waitFor(() => {
      expect(screen.getByText('运行中')).toBeTruthy();
      expect(screen.getByText('http://127.0.0.1:3939/mcp')).toBeTruthy();
    });
  });

  it('starts and stops embedded MCP http server from settings', async () => {
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

      if (channel === IPC_CHANNELS.AI_MCP_STATUS) {
        return { running: false, authRequired: true };
      }

      if (channel === IPC_CHANNELS.AI_MCP_CLIENT_STATUS) {
        return [];
      }

      if (channel === IPC_CHANNELS.AI_MCP_AUDIT_LIST) {
        return [];
      }

      if (channel === IPC_CHANNELS.AI_MCP_START) {
        return {
          running: true,
          host: '127.0.0.1',
          port: 3939,
          endpoint: 'http://127.0.0.1:3939/mcp',
          authRequired: true,
        };
      }

      if (channel === IPC_CHANNELS.AI_MCP_STOP) {
        return { running: false, authRequired: true };
      }

      return null;
    });

    render(<Settings />);

    await waitFor(() => {
      expect(screen.getByText('未启动')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: '启动 MCP 服务' }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(IPC_CHANNELS.AI_MCP_START, {
        host: '127.0.0.1',
        port: 3939,
      });
      expect(messageSuccessMock).toHaveBeenCalledWith('MCP HTTP 服务已启动');
      expect(screen.getByText('运行中')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: '停止 MCP 服务' }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(IPC_CHANNELS.AI_MCP_STOP);
      expect(messageSuccessMock).toHaveBeenCalledWith('MCP HTTP 服务已停止');
      expect(screen.getByText('未启动')).toBeTruthy();
    });
  });

  it('saves embedded MCP http host, port and token into AI config', async () => {
    invokeMock.mockImplementation(async (channel: string, payload?: unknown) => {
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
          ai: {
            provider: 'openai',
            mcp: {
              embeddedHttp: {
                host: '127.0.0.1',
                port: 3939,
              },
            },
          },
        };
      }

      if (channel === IPC_CHANNELS.AI_MCP_STATUS) {
        return { running: false, authRequired: true };
      }

      if (channel === IPC_CHANNELS.AI_MCP_CLIENT_STATUS) {
        return [];
      }

      if (channel === IPC_CHANNELS.AI_MCP_AUDIT_LIST) {
        return [];
      }

      if (channel === IPC_CHANNELS.AI_CONFIG_SET) {
        return payload;
      }

      return null;
    });

    render(<Settings />);

    const portInput = await screen.findByLabelText('MCP HTTP 端口');
    fireEvent.change(portInput, { target: { value: '4949' } });
    fireEvent.change(screen.getByPlaceholderText('可选：默认使用 YCLAW_MCP_TOKEN'), {
      target: { value: 'ui-token' },
    });
    fireEvent.click(screen.getByRole('button', { name: '保存 MCP 配置' }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(IPC_CHANNELS.AI_CONFIG_SET, {
        mcp: {
          embeddedHttp: {
            host: '127.0.0.1',
            port: 4949,
            token: 'ui-token',
          },
        },
      });
      expect(messageSuccessMock).toHaveBeenCalledWith('MCP HTTP 配置已保存');
    });
  });

  it('saves external MCP server definitions into AI config', async () => {
    invokeMock.mockImplementation(async (channel: string, payload?: unknown) => {
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
          ai: {
            provider: 'openai',
            mcp: {
              embeddedHttp: {
                host: '127.0.0.1',
                port: 3939,
              },
              servers: [
                {
                  id: 'filesystem',
                  name: 'Filesystem',
                  command: 'npx',
                  args: ['-y', '@modelcontextprotocol/server-filesystem', 'E:\\allsite'],
                  env: {},
                  enabled: true,
                },
              ],
            },
          },
        };
      }

      if (channel === IPC_CHANNELS.AI_MCP_STATUS) {
        return { running: false, authRequired: true };
      }

      if (channel === IPC_CHANNELS.AI_MCP_CLIENT_STATUS) {
        return [
          {
            id: 'filesystem',
            name: 'Filesystem',
            enabled: true,
            connected: false,
            state: 'unavailable',
            toolCount: 0,
            lastError: 'spawn failed',
          },
        ];
      }

      if (channel === IPC_CHANNELS.AI_MCP_AUDIT_LIST) {
        return [];
      }

      if (channel === IPC_CHANNELS.AI_CONFIG_SET) {
        return payload;
      }

      return null;
    });

    render(<Settings />);

    const textarea = await screen.findByPlaceholderText('粘贴 MCP servers JSON 数组');
    fireEvent.change(textarea, {
      target: {
        value: JSON.stringify([
          {
            id: 'git',
            name: 'Git',
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-git'],
            env: { GIT_ROOT: 'E:\\allsite\\yclaw' },
            enabled: true,
          },
        ]),
      },
    });
    fireEvent.click(screen.getByRole('button', { name: '保存外部 MCP Servers' }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(IPC_CHANNELS.AI_CONFIG_SET, {
        mcp: {
          servers: [
            {
              id: 'git',
              name: 'Git',
              command: 'npx',
              args: ['-y', '@modelcontextprotocol/server-git'],
              env: { GIT_ROOT: 'E:\\allsite\\yclaw' },
              enabled: true,
            },
          ],
        },
      });
      expect(messageSuccessMock).toHaveBeenCalledWith('外部 MCP Servers 配置已保存');
    });
  });

  it('shows external MCP server availability in settings', async () => {
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
          ai: {
            provider: 'openai',
            mcp: {
              servers: [
                {
                  id: 'filesystem',
                  name: 'Filesystem',
                  command: 'npx',
                  args: ['-y', '@modelcontextprotocol/server-filesystem', 'E:\\allsite'],
                  env: {},
                  enabled: true,
                },
              ],
            },
          },
        };
      }

      if (channel === IPC_CHANNELS.AI_MCP_STATUS) {
        return { running: false, authRequired: true };
      }

      if (channel === IPC_CHANNELS.AI_MCP_CLIENT_STATUS) {
        return [
          {
            id: 'filesystem',
            name: 'Filesystem',
            enabled: true,
            connected: false,
            state: 'unavailable',
            toolCount: 0,
            lastError: 'spawn failed',
          },
        ];
      }

      if (channel === IPC_CHANNELS.AI_MCP_AUDIT_LIST) {
        return [];
      }

      return null;
    });

    render(<Settings />);

    await waitFor(() => {
      expect(screen.getByText('Filesystem')).toBeTruthy();
      expect(screen.getByText('不可用')).toBeTruthy();
      expect(screen.getByText('spawn failed')).toBeTruthy();
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

      if (channel === IPC_CHANNELS.AI_MCP_AUDIT_LIST) {
        return [];
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

  it('renders MCP audit entries and refreshes them', async () => {
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

      if (channel === IPC_CHANNELS.AI_MCP_STATUS) {
        return { running: false, authRequired: true };
      }

      if (channel === IPC_CHANNELS.AI_MCP_CLIENT_STATUS) {
        return [];
      }

      if (channel === IPC_CHANNELS.AI_MCP_AUDIT_LIST) {
        return [
          {
            timestamp: '2026-04-20T10:00:00.000Z',
            level: 'info',
            source: 'main',
            message: 'MCP audit',
            data: { action: 'task.run', taskId: 'task-1' },
          },
        ];
      }

      return null;
    });

    render(<Settings />);

    await waitFor(() => {
      expect(screen.getByText('MCP 审计')).toBeTruthy();
      expect(screen.getByText(/task\.run/)).toBeTruthy();
      expect(screen.getByText(/task-1/)).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: '刷新审计' }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(IPC_CHANNELS.AI_MCP_AUDIT_LIST);
    });
  });

  it('persists SMTP draft into general config before sending a sign-in test email', async () => {
    invokeMock.mockImplementation(async (channel: string, payload?: unknown) => {
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

      if (channel === IPC_CHANNELS.AI_MCP_STATUS) {
        return { running: false, authRequired: true };
      }

      if (channel === IPC_CHANNELS.AI_MCP_CLIENT_STATUS) {
        return [];
      }

      if (channel === IPC_CHANNELS.AI_MCP_AUDIT_LIST) {
        return [];
      }

      if (channel === IPC_CHANNELS.CONFIG_SET) {
        return payload;
      }

      if (channel === IPC_CHANNELS.SIGNIN_NOTIFICATION_TEST_EMAIL) {
        return { delivered: true };
      }

      return null;
    });

    render(<Settings />);

    fireEvent.change(await screen.findByLabelText('SMTP 主机'), {
      target: { value: 'smtp.qq.com' },
    });
    fireEvent.change(screen.getByLabelText('SMTP 端口'), {
      target: { value: '465' },
    });
    fireEvent.change(screen.getByLabelText('SMTP 用户名'), {
      target: { value: 'bot@example.com' },
    });
    fireEvent.change(screen.getByLabelText('SMTP 密码'), {
      target: { value: 'secret' },
    });
    fireEvent.change(screen.getByLabelText('发件人'), {
      target: { value: 'bot@example.com' },
    });
    fireEvent.change(screen.getByLabelText('收件人'), {
      target: { value: 'ops@example.com, owner@example.com' },
    });

    fireEvent.click(screen.getByRole('button', { name: '发送测试邮件' }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(IPC_CHANNELS.CONFIG_SET, {
        key: 'general',
        value: expect.objectContaining({
          notificationEmail: {
            enabled: false,
            host: 'smtp.qq.com',
            port: 465,
            secure: true,
            username: 'bot@example.com',
            password: 'secret',
            from: 'bot@example.com',
            to: ['ops@example.com', 'owner@example.com'],
          },
        }),
      });
      expect(invokeMock).toHaveBeenCalledWith(IPC_CHANNELS.SIGNIN_NOTIFICATION_TEST_EMAIL);
      expect(messageSuccessMock).toHaveBeenCalledWith('测试邮件已发送');
    });
  });
});
