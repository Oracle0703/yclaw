import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { IPC_CHANNELS } from '@shared/constants';

const {
  invokeMock,
  navigateMock,
  searchParamsState,
  messageSuccessMock,
  messageErrorMock,
  messageWarningMock,
  formMock,
} = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  navigateMock: vi.fn(),
  searchParamsState: { value: new URLSearchParams('templateId=jd-signin') },
  messageSuccessMock: vi.fn(),
  messageErrorMock: vi.fn(),
  messageWarningMock: vi.fn(),
  formMock: {
    setFieldsValue: vi.fn(),
    setFields: vi.fn(),
    validateFields: vi.fn(),
  },
}));

vi.mock('@renderer/shared/hooks', () => ({
  useIpc: () => ({ invoke: invokeMock }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
  useSearchParams: () => [searchParamsState.value],
}));

vi.mock('@renderer/shared/components/PageShell', () => ({
  PageShell: ({
    children,
    error,
    loading,
    title,
  }: {
    children?: React.ReactNode;
    error?: Error | null;
    loading?: boolean;
    title?: React.ReactNode;
  }) => (
    <section data-loading={String(Boolean(loading))}>
      <h1>{title}</h1>
      {error ? <span>{error.message}</span> : children}
    </section>
  ),
}));

vi.mock('@ant-design/icons', () => ({
  SaveOutlined: () => <span>save</span>,
  ThunderboltOutlined: () => <span>run</span>,
}));

vi.mock('antd', () => {
  const Form = Object.assign(
    ({ children }: { children?: React.ReactNode }) => <form>{children}</form>,
    {
      useForm: () => [formMock],
      Item: ({ children, label }: { children?: React.ReactNode; label?: React.ReactNode }) => (
        <label>
          <span>{label}</span>
          {children}
        </label>
      ),
    },
  );

  function MockList({
    dataSource = [],
    renderItem,
  }: {
    dataSource?: unknown[];
    renderItem?: (item: unknown) => React.ReactNode;
  }) {
    return <div>{dataSource.map((item, index) => <React.Fragment key={index}>{renderItem?.(item)}</React.Fragment>)}</div>;
  }
  function MockListItem({
    children,
    onClick,
  }: {
    children?: React.ReactNode;
    onClick?: () => void;
  }) {
    return (
      <button type="button" onClick={onClick}>
        {children}
      </button>
    );
  }
  function MockListItemMeta({
    title,
    description,
  }: {
    title?: React.ReactNode;
    description?: React.ReactNode;
  }) {
    return (
      <div>
        {title}
        {description}
      </div>
    );
  }
  const List = Object.assign(MockList, {
    Item: Object.assign(MockListItem, {
      Meta: MockListItemMeta,
    }),
  });

  return {
    Alert: ({ message, description }: { message?: React.ReactNode; description?: React.ReactNode }) => (
      <div>
        {message}
        {description}
      </div>
    ),
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
    Card: ({ children, title }: { children?: React.ReactNode; title?: React.ReactNode }) => (
      <section>
        {title ? <h2>{title}</h2> : null}
        {children}
      </section>
    ),
    Col: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    Form,
    Input: ({ placeholder }: { placeholder?: string }) => <input placeholder={placeholder} />,
    InputNumber: () => <input type="number" />,
    List,
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
      Paragraph: ({ children }: { children?: React.ReactNode }) => <p>{children}</p>,
      Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
      Title: ({ children }: { children?: React.ReactNode }) => <h2>{children}</h2>,
    },
    message: {
      success: messageSuccessMock,
      error: messageErrorMock,
      warning: messageWarningMock,
    },
  };
});

import TaskEditor from '@renderer/entries/workbench/pages/TaskEditor';

describe('TaskEditor page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchParamsState.value = new URLSearchParams('templateId=jd-signin');
    formMock.validateFields.mockResolvedValue({
      name: '京东签到',
      entryUrl: 'https://interact.jd.com/',
      sessionId: 'session-1',
      mode: 'api-first-browser-fallback',
      fallbackApiEnabled: true,
      maxRetryPerDay: 1,
      enabled: true,
    });
    invokeMock.mockImplementation(async (channel: string) => {
      if (channel === IPC_CHANNELS.SIGNIN_TASK_SAVE) {
        return { id: 'task-jd', name: '京东签到' };
      }
      return null;
    });
  });

  it('saves a JD sign-in task and immediately runs it', async () => {
    render(<TaskEditor />);

    fireEvent.click(screen.getByRole('button', { name: /保存并立即运行/ }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(
        IPC_CHANNELS.SIGNIN_TASK_SAVE,
        expect.objectContaining({
          name: '京东签到',
          entryUrl: 'https://interact.jd.com/',
          sessionId: 'session-1',
          signin: expect.objectContaining({
            site: 'jd',
            mode: 'api-first-browser-fallback',
          }),
        }),
      );
      expect(invokeMock).toHaveBeenCalledWith(IPC_CHANNELS.SIGNIN_TASK_RUN_NOW, {
        taskId: 'task-jd',
      });
      expect(navigateMock).toHaveBeenCalledWith('/runs?taskId=task-jd');
    });
  });

  it('creates a hot source from the hot monitor template', async () => {
    searchParamsState.value = new URLSearchParams('templateId=hot-monitor');
    formMock.validateFields.mockResolvedValue({
      name: '热点监控',
      sourceKind: 'api',
      siteKey: 'trendradar',
      entryUrl: 'https://newsnow.busiyi.world/',
      parserKey: 'newsnow.batch',
      platformIds: 'weibo,douyin',
      enabled: true,
    });
    invokeMock.mockImplementation(async (channel: string) => {
      if (channel === IPC_CHANNELS.HOT_SOURCE_CREATE) {
        return {
          id: 'source-hot',
          taskId: 'task-hot',
          name: '热点监控',
          sourceKind: 'api',
          siteKey: 'trendradar',
          entryUrl: 'https://newsnow.busiyi.world/',
          parserKey: 'newsnow.batch',
          enabled: true,
          tags: [],
          createdAt: '2026-06-03T09:00:00.000Z',
          updatedAt: '2026-06-03T09:00:00.000Z',
        };
      }
      return null;
    });

    render(<TaskEditor />);

    fireEvent.click(screen.getByRole('button', { name: /保存草稿/ }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(
        IPC_CHANNELS.HOT_SOURCE_CREATE,
        expect.objectContaining({
          name: '热点监控',
          sourceKind: 'api',
          siteKey: 'trendradar',
          entryUrl: 'https://newsnow.busiyi.world/',
          parserKey: 'newsnow.batch',
          platformIds: ['weibo', 'douyin'],
          tags: ['hot-monitor'],
        }),
      );
    });
  });

  it('runs a saved hot source from the hot monitor template', async () => {
    searchParamsState.value = new URLSearchParams('templateId=hot-monitor');
    formMock.validateFields.mockResolvedValue({
      name: '热点监控',
      sourceKind: 'api',
      siteKey: 'trendradar',
      entryUrl: 'https://newsnow.busiyi.world/',
      parserKey: 'newsnow.batch',
      enabled: true,
    });
    invokeMock.mockImplementation(async (channel: string) => {
      if (channel === IPC_CHANNELS.HOT_SOURCE_CREATE) {
        return {
          id: 'source-hot',
          taskId: 'task-hot',
          name: '热点监控',
          sourceKind: 'api',
          siteKey: 'trendradar',
          entryUrl: 'https://newsnow.busiyi.world/',
          parserKey: 'newsnow.batch',
          enabled: true,
          tags: [],
          createdAt: '2026-06-03T09:00:00.000Z',
          updatedAt: '2026-06-03T09:00:00.000Z',
        };
      }
      if (channel === IPC_CHANNELS.HOT_RUN_START) {
        return { sourceId: 'source-hot', taskId: 'task-hot', started: true };
      }
      return null;
    });

    render(<TaskEditor />);

    fireEvent.click(screen.getByRole('button', { name: /保存并立即运行/ }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(IPC_CHANNELS.HOT_RUN_START, {
        sourceId: 'source-hot',
      });
      expect(navigateMock).toHaveBeenCalledWith('/runs?taskId=task-hot');
    });
  });

  it('keeps preview templates visible but disables immediate run', () => {
    searchParamsState.value = new URLSearchParams('templateId=comment-monitor');

    render(<TaskEditor />);

    expect(screen.getAllByText('后续接入运行').length).toBeGreaterThan(0);
    expect((screen.getByRole('button', { name: /保存并立即运行/ }) as HTMLButtonElement).disabled).toBe(true);
  });
});
