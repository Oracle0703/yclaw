import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { IPC_CHANNELS } from '@shared/constants';

const { invokeMock, confirmOptionsRef } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  confirmOptionsRef: {
    current: null as null | {
      onOk?: () => void | Promise<void>;
    },
  },
}));

vi.mock('antd', () => ({
  Button: ({
    children,
    onClick,
    disabled,
  }: {
    children?: React.ReactNode;
    onClick?: (event?: { stopPropagation?: () => void }) => void;
    disabled?: boolean;
  }) => (
    <button type="button" onClick={() => onClick?.({ stopPropagation: () => {} })} disabled={disabled}>
      {children}
    </button>
  ),
  Drawer: ({
    children,
    open,
    title,
  }: {
    children?: React.ReactNode;
    open?: boolean;
    title?: React.ReactNode;
  }) => (open ? <section><h2>{title}</h2>{children}</section> : null),
  Modal: {
    confirm: (options: { onOk?: () => void | Promise<void> }) => {
      confirmOptionsRef.current = options;
    },
  },
  Space: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Tag: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  message: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('@ant-design/icons', () => ({
  PlusOutlined: () => <span>plus</span>,
  ReloadOutlined: () => <span>reload</span>,
}));

vi.mock('@ant-design/pro-components', () => ({
  ProCard: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  ProTable: ({
    dataSource = [],
    columns = [],
    onRow,
  }: {
    dataSource?: Array<Record<string, unknown>>;
    columns?: Array<Record<string, unknown>>;
    onRow?: (record: Record<string, unknown>) => { onClick?: () => void };
  }) => (
    <table>
      <tbody>
        {dataSource.map((record, rowIndex) => (
          <tr
            key={String(record.id ?? rowIndex)}
            onClick={() => onRow?.(record)?.onClick?.()}
          >
            {columns.map((column, columnIndex) => {
              const key = String(column.key ?? column.dataIndex ?? columnIndex);
              const value =
                typeof column.dataIndex === 'string' ? record[column.dataIndex] : undefined;
              const content =
                typeof column.render === 'function'
                  ? column.render(value, record, rowIndex)
                  : value;
              return <td key={key}>{content as React.ReactNode}</td>;
            })}
          </tr>
        ))}
      </tbody>
    </table>
  ),
}));

vi.mock('@renderer/shared/components/PageShell', () => ({
  PageShell: ({
    children,
    extra,
    title,
  }: {
    children: React.ReactNode;
    extra?: React.ReactNode;
    title?: React.ReactNode;
  }) => (
    <div>
      <h1>{title}</h1>
      <div>{extra}</div>
      <div>{children}</div>
    </div>
  ),
}));

vi.mock('@renderer/entries/automation/components/WorkspaceSwitcher', () => ({
  WorkspaceSwitcher: () => <div>WorkspaceSwitcher</div>,
}));

vi.mock('@renderer/entries/automation/components/SigninTaskPanel', () => ({
  SigninTaskPanel: ({
    initialTaskName,
    onSubmit,
    taskId,
  }: {
    initialTaskName?: string;
    taskId?: string | null;
    onSubmit: (payload: {
      taskId: string | null;
      name: string;
      entryUrl: string;
      sessionId: string | null;
      enabled: boolean;
      signin: {
        site: 'aliyundrive';
        mode: 'browser-first-api-fallback';
        fallbackApiEnabled: boolean;
        refreshToken: string | null;
        maxRetryPerDay: number;
        manualInterventionEnabled: true;
      };
    }) => void | Promise<void>;
  }) => (
    <div>
      <span>SigninTaskPanel:{initialTaskName}</span>
      <button
        type="button"
        onClick={() =>
          onSubmit({
            taskId: taskId ?? null,
            name: initialTaskName ?? '阿里云盘签到',
            entryUrl: 'https://www.aliyundrive.com/',
            sessionId: null,
            enabled: true,
            signin: {
              site: 'aliyundrive',
              mode: 'browser-first-api-fallback',
              fallbackApiEnabled: false,
              refreshToken: null,
              maxRetryPerDay: 1,
              manualInterventionEnabled: true,
            },
          })
        }
      >
        保存签到任务
      </button>
    </div>
  ),
}));

vi.mock('@renderer/entries/automation/components/SigninRunStatusCard', () => ({
  SigninRunStatusCard: ({
    taskId,
    summary,
    history,
    onRunNow,
  }: {
    taskId?: string | null;
    summary?: { status?: string } | null;
    history?: Array<unknown>;
    onRunNow: (taskId: string) => void;
  }) => (
    <div>
      <span>SigninResultCard:{taskId ?? 'empty'}</span>
      <span>SigninStatus:{summary?.status ?? 'none'}</span>
      <span>SigninHistoryCount:{history?.length ?? 0}</span>
      {taskId ? (
        <button type="button" onClick={() => onRunNow(taskId)}>
          立即执行
        </button>
      ) : null}
    </div>
  ),
}));

vi.mock('@renderer/shared/hooks', () => ({
  useIpc: () => ({
    invoke: invokeMock,
  }),
  useIpcEvent: vi.fn(),
}));

import SigninApp from '@renderer/entries/signin/App';

describe('SigninApp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    confirmOptionsRef.current = null;
    invokeMock.mockImplementation((channel: string, payload?: { taskId?: string }) => {
      if (channel === IPC_CHANNELS.SESSION_LIST) {
        return Promise.resolve([]);
      }
      if (channel === IPC_CHANNELS.TASK_LIST) {
        return Promise.resolve([
          {
            id: 'task-signin-1',
            name: '阿里云盘签到',
            kind: 'aliyundrive-signin',
            enabled: true,
            signin: { site: 'aliyundrive' },
            updatedAt: '2026-04-28 10:00:00',
          },
          {
            id: 'task-signin-2',
            name: '阿里云盘签到-失败',
            kind: 'aliyundrive-signin',
            enabled: true,
            signin: { site: 'aliyundrive' },
            updatedAt: '2026-04-28 11:00:00',
          },
        ]);
      }
      if (channel === IPC_CHANNELS.SIGNIN_TASK_STATUS) {
        if (payload?.taskId === 'task-signin-2') {
          return Promise.resolve({
            taskId: 'task-signin-2',
            status: 'needs_intervention',
            runAt: '2026-04-28T08:10:00.000Z',
            retryCount: 0,
          });
        }
        return Promise.resolve({
          taskId: payload?.taskId ?? 'task-signin-1',
          status: 'success',
          runAt: '2026-04-28T08:00:00.000Z',
          retryCount: 0,
        });
      }
      if (channel === IPC_CHANNELS.SIGNIN_TASK_HISTORY) {
        return Promise.resolve([
          {
            taskId: payload?.taskId ?? 'task-signin-1',
            status: 'success',
            runAt: '2026-04-28T08:00:00.000Z',
            retryCount: 0,
          },
        ]);
      }
      if (channel === IPC_CHANNELS.SIGNIN_TASK_GET) {
        return Promise.resolve({
          id: payload?.taskId ?? 'task-signin-1',
          name: payload?.taskId === 'task-signin-2' ? '阿里云盘签到-失败' : '阿里云盘签到',
          kind: 'aliyundrive-signin',
          steps: [],
          entryUrl: 'https://www.aliyundrive.com/',
          sessionId: null,
          enabled: true,
          signin: {
            site: 'aliyundrive',
            mode: 'browser-first-api-fallback',
            fallbackApiEnabled: false,
            maxRetryPerDay: 1,
            manualInterventionEnabled: true,
          },
          createdAt: '2026-04-28T00:00:00.000Z',
          updatedAt: '2026-04-28T00:00:00.000Z',
        });
      }
      if (channel === IPC_CHANNELS.SIGNIN_TASK_SAVE) {
        return Promise.resolve({
          id: payload?.taskId ?? 'task-signin-new',
          name: '阿里云盘签到',
          kind: 'aliyundrive-signin',
          steps: [],
          entryUrl: 'https://www.aliyundrive.com/',
          sessionId: null,
          enabled: true,
          signin: {
            site: 'aliyundrive',
            mode: 'browser-first-api-fallback',
            fallbackApiEnabled: false,
            maxRetryPerDay: 1,
            manualInterventionEnabled: true,
          },
          createdAt: '2026-04-28T00:00:00.000Z',
          updatedAt: '2026-04-28T00:00:00.000Z',
        });
      }
      if (channel === IPC_CHANNELS.SIGNIN_TASK_RUN_NOW) {
        return Promise.resolve({
          taskId: payload?.taskId ?? 'task-signin-1',
          status: 'success',
          runAt: '2026-04-28T09:00:00.000Z',
          retryCount: 0,
        });
      }
      if (channel === IPC_CHANNELS.TASK_DELETE) {
        return Promise.resolve({ taskId: payload?.taskId ?? 'task-signin-1' });
      }
      return Promise.resolve(null);
    });
  });

  it('renders a pro table, opens drawer for create/edit, supports delete, and updates the fixed result card', async () => {
    render(<SigninApp />);

    expect(await screen.findByText('阿里云盘签到')).toBeDefined();
    expect(screen.getByText('阿里云盘签到-失败')).toBeDefined();
    expect(screen.getByText('请选择任务查看上一次结果。')).toBeDefined();
    expect(screen.getByText('成功')).toBeDefined();
    expect(screen.getByText('失败')).toBeDefined();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '新建签到任务' }));
    });
    expect(screen.getByText('SigninTaskPanel:阿里云盘签到')).toBeDefined();

    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: '编辑' })[0]);
    });
    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(IPC_CHANNELS.SIGNIN_TASK_GET, {
        taskId: 'task-signin-1',
      });
    });

    await act(async () => {
      fireEvent.click(screen.getByText('阿里云盘签到-失败'));
    });
    await waitFor(() => {
      expect(screen.getByText('SigninResultCard:task-signin-2')).toBeDefined();
      expect(screen.getByText('SigninStatus:needs_intervention')).toBeDefined();
    });

    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: '立即执行' }).at(-1)!);
    });
    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(IPC_CHANNELS.SIGNIN_TASK_RUN_NOW, {
        taskId: 'task-signin-2',
      });
    });

    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: '删除' })[1]);
    });
    expect(confirmOptionsRef.current).not.toBeNull();
    await act(async () => {
      await confirmOptionsRef.current?.onOk?.();
    });

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(IPC_CHANNELS.TASK_DELETE, {
        taskId: 'task-signin-2',
      });
    });
  });
});
