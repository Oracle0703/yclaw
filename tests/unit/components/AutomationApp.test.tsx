import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { IPC_CHANNELS } from '@shared/constants';

const { invokeMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
}));

const { messageErrorMock, messageSuccessMock, messageWarningMock } = vi.hoisted(() => ({
  messageErrorMock: vi.fn(),
  messageSuccessMock: vi.fn(),
  messageWarningMock: vi.fn(),
}));

const { opsSummaryPropsMock } = vi.hoisted(() => ({
  opsSummaryPropsMock: vi.fn(),
}));

vi.mock('antd', () => ({
  App: {
    useApp: () => ({
      message: {
        error: messageErrorMock,
        success: messageSuccessMock,
        warning: messageWarningMock,
      },
    }),
  },
  Button: ({
    children,
    onClick,
    disabled,
  }: {
    children?: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button type="button" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
  Input: ({
    value,
    onChange,
    placeholder,
  }: {
    value?: string;
    onChange?: (event: { target: { value: string } }) => void;
    placeholder?: string;
  }) => (
    <input
      aria-label="任务名称"
      value={value ?? ''}
      placeholder={placeholder}
      onChange={(event) => onChange?.({ target: { value: event.target.value } })}
    />
  ),
  Space: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Tag: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  message: {
    error: messageErrorMock,
    success: messageSuccessMock,
    warning: messageWarningMock,
  },
}));

vi.mock('@ant-design/icons', () => ({
  PlusOutlined: () => <span>plus</span>,
  ThunderboltOutlined: () => <span>thunder</span>,
}));

vi.mock('@renderer/entries/automation/components/TaskList', () => ({
  TaskList: ({
    onSelect,
  }: {
    onSelect: (task: { id: string; stepsCount?: number } | 'new') => void;
  }) => (
    <button type="button" onClick={() => onSelect({ id: 'task-1', stepsCount: 3 })}>
      选择任务
    </button>
  ),
}));

vi.mock('@renderer/entries/automation/components/StepEditor', () => ({
  StepEditor: ({
    steps,
    onChange,
  }: {
    steps: Array<{ id: string }>;
    onChange: (steps: Array<{
      id: string;
      name: string;
      action: { type: string; selector: string };
    }>) => void;
  }) => (
    <div>
      <div>编辑器步骤数:{steps.length}</div>
      <button
        type="button"
        onClick={() =>
          onChange([
            {
              id: 'step-1',
              name: '打开页面',
              action: { type: 'click', selector: '#open' },
            },
            {
              id: 'step-2',
              name: '采集价格',
              action: { type: 'extract', selector: '.price' },
            },
            {
              id: 'step-3',
              name: '截图存档',
              action: { type: 'screenshot', selector: 'body' },
            },
          ])
        }
      >
        模拟编辑步骤
      </button>
    </div>
  ),
}));

vi.mock('@renderer/entries/automation/components/ExecutionPanel', () => ({
  ExecutionPanel: ({ totalSteps }: { totalSteps: number }) => <div>总步骤:{totalSteps}</div>,
}));

vi.mock('@renderer/entries/automation/components/BatchList', () => ({
  BatchList: () => <div>BatchList</div>,
}));

vi.mock('@renderer/entries/automation/components/ResultTable', () => ({
  ResultTable: () => <div>ResultTable</div>,
}));

vi.mock('@renderer/entries/automation/components/TemplateManager', () => ({
  TemplateManager: () => <div>TemplateManager</div>,
}));

vi.mock('@renderer/entries/automation/components/RemoteRunnerPanel', () => ({
  RemoteRunnerPanel: () => <div>RemoteRunnerPanel</div>,
}));

vi.mock('@renderer/entries/automation/components/RunnerSchedulerPanel', () => ({
  RunnerSchedulerPanel: () => <div>RunnerSchedulerPanel</div>,
}));

vi.mock('@renderer/entries/automation/components/WorkspaceSwitcher', () => ({
  WorkspaceSwitcher: () => <div>WorkspaceSwitcher</div>,
}));

vi.mock('@renderer/entries/automation/components/DutySchedulePanel', () => ({
  DutySchedulePanel: () => <div>DutySchedulePanel</div>,
}));

vi.mock('@renderer/entries/automation/components/OpsSummary', () => ({
  OpsSummary: ({
    acceptanceMetrics,
  }: {
    acceptanceMetrics?: Array<{ key: string; label: string; value: number }>;
  }) => {
    opsSummaryPropsMock({ acceptanceMetrics });
    return (
      <div>
        OpsSummary
        {acceptanceMetrics?.map((metric) => (
          <span key={metric.key}>{metric.label}</span>
        ))}
      </div>
    );
  },
}));

vi.mock('@renderer/entries/automation/components/TaskRevisionDrawer', () => ({
  TaskRevisionDrawer: ({ open }: { open?: boolean }) =>
    open ? <div>TaskRevisionDrawer</div> : null,
}));

vi.mock('@renderer/entries/automation/components/SigninTaskPanel', () => ({
  SigninTaskPanel: ({
    onSubmit,
    onCaptureLogin,
    taskId,
    initialTaskName,
    initialValue,
  }: {
    taskId?: string | null;
    initialTaskName?: string;
    initialValue?: {
      entryUrl?: string;
      sessionId?: string | null;
      enabled?: boolean;
      signin?: {
        site: 'aliyundrive';
        mode: 'browser-first-api-fallback' | 'api-first-browser-fallback';
        fallbackApiEnabled: boolean;
        refreshToken?: string | null;
        maxRetryPerDay: number;
        manualInterventionEnabled: true;
      } | null;
    } | null;
    onSubmit: (payload: { taskId?: string | null; name: string; entryUrl: string }) => void;
    onCaptureLogin?: (payload: {
      taskId: string | null;
      name: string;
      entryUrl: string;
      sessionId: string | null;
      enabled: boolean;
      signin: {
        site: 'aliyundrive';
        mode: 'browser-first-api-fallback' | 'api-first-browser-fallback';
        fallbackApiEnabled: boolean;
        refreshToken: string | null;
        maxRetryPerDay: number;
        manualInterventionEnabled: true;
      };
    }) => Promise<unknown>;
  }) => (
    <div>
      <span>SigninTaskPanel</span>
      {typeof onCaptureLogin === 'function' ? (
        <button
          type="button"
          onClick={() =>
            void onCaptureLogin({
              taskId: taskId ?? null,
              name: initialTaskName ?? '阿里云盘签到',
              entryUrl: initialValue?.entryUrl ?? 'https://www.aliyundrive.com/',
              sessionId: initialValue?.sessionId ?? null,
              enabled: initialValue?.enabled ?? true,
              signin: {
                site: 'aliyundrive',
                mode: initialValue?.signin?.mode ?? 'api-first-browser-fallback',
                fallbackApiEnabled: initialValue?.signin?.fallbackApiEnabled ?? true,
                refreshToken: initialValue?.signin?.refreshToken ?? null,
                maxRetryPerDay: initialValue?.signin?.maxRetryPerDay ?? 1,
                manualInterventionEnabled: true,
              },
            })
          }
        >
          采集登录态
        </button>
      ) : null}
      <button
        type="button"
        onClick={() =>
          onSubmit({
            taskId: taskId ?? null,
            name: '阿里云盘签到',
            entryUrl: 'https://www.aliyundrive.com/',
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
    onRunNow,
    history,
  }: {
    onRunNow: (taskId: string) => void;
    history?: Array<unknown>;
  }) => (
    <div>
      <span>SigninRunStatusCard</span>
      <span>SigninHistoryCount:{history?.length ?? 0}</span>
      <button type="button" onClick={() => onRunNow('task-signin-1')}>
        立即执行签到
      </button>
    </div>
  ),
}));

vi.mock('@renderer/shared/components/PageShell', () => ({
  PageShell: ({ children, extra }: { children: React.ReactNode; extra: React.ReactNode }) => (
    <div>
      <div>{extra}</div>
      <div>{children}</div>
    </div>
  ),
}));

vi.mock('@renderer/shared/hooks', () => {
  const taskOperations = {
      getAcceptanceMetrics: (payload?: unknown) =>
        invokeMock(IPC_CHANNELS.OPS_ACCEPTANCE_METRICS, payload ?? {}),
  };

  return {
    useIpc: () => ({
      invoke: invokeMock,
      taskOperations,
    }),
    useIpcEvent: vi.fn(),
  };
});

import AutomationApp from '@renderer/entries/automation/App';

describe('Automation App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    messageErrorMock.mockReset();
    messageSuccessMock.mockReset();
    messageWarningMock.mockReset();
    invokeMock.mockImplementation((channel: string, payload?: { taskId?: string; name?: string; steps?: unknown[] }) => {
      if (channel === IPC_CHANNELS.TASK_GET) {
        return Promise.resolve({
          id: 'task-1',
          name: '采集任务',
          kind: 'generic',
          steps: [
            {
              id: 'step-1',
              name: '打开页面',
              action: { type: 'click', selector: '#open' },
            },
            {
              id: 'step-2',
              name: '采集数据',
              action: { type: 'extract', selector: '.price' },
            },
          ],
          createdAt: '2026-04-16T00:00:00.000Z',
          updatedAt: '2026-04-16T00:00:00.000Z',
        });
      }

      if (channel === IPC_CHANNELS.TASK_SAVE) {
        return Promise.resolve({
          id: payload?.taskId ?? 'task-new-1',
          name: payload?.name ?? '采集任务',
          steps: payload?.steps ?? [],
          createdAt: '2026-04-16T00:00:00.000Z',
          updatedAt: '2026-04-16T00:00:00.000Z',
        });
      }

      if (channel === IPC_CHANNELS.OPS_ACCEPTANCE_METRICS) {
        return Promise.resolve([
          {
            key: 'taskSuccessRate',
            label: payload?.taskId ? '任务执行成功率' : '全局任务执行成功率',
            value: payload?.taskId ? 1 : 0.92,
            target: 0.9,
            unit: 'ratio',
            passed: true,
          },
        ]);
      }

      if (channel === IPC_CHANNELS.SESSION_LIST) {
        return Promise.resolve([]);
      }

      if (channel === IPC_CHANNELS.SIGNIN_TASK_STATUS) {
        return Promise.resolve(null);
      }

      if (channel === IPC_CHANNELS.SIGNIN_TASK_HISTORY) {
        return Promise.resolve([]);
      }

      return Promise.resolve(null);
    });
  });

  it('uses selected task summary stepsCount as execution total when persisted steps fail to load', async () => {
    invokeMock.mockRejectedValueOnce(new Error('load task failed'));

    render(<AutomationApp />);

    fireEvent.click(screen.getByRole('button', { name: '选择任务' }));
    fireEvent.click(screen.getByRole('button', { name: /打开执行面板/ }));

    expect(await screen.findByText('总步骤:3')).toBeDefined();
    expect(invokeMock).toHaveBeenCalledWith('task:get', { taskId: 'task-1' });
  });

  it('renders runner scheduler panel in automation page', () => {
    render(<AutomationApp />);

    expect(screen.getByText('RunnerSchedulerPanel')).toBeDefined();
  });

  it('renders workspace switcher and ops summary in automation page', () => {
    render(<AutomationApp />);

    expect(screen.getByText('WorkspaceSwitcher')).toBeDefined();
    expect(screen.getByText('OpsSummary')).toBeDefined();
    expect(screen.getByText('DutySchedulePanel')).toBeDefined();
  });

  it('loads acceptance metrics for selected task and passes them to OpsSummary', async () => {
    render(<AutomationApp />);

    fireEvent.click(screen.getByRole('button', { name: '选择任务' }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(IPC_CHANNELS.OPS_ACCEPTANCE_METRICS, {
        taskId: 'task-1',
      });
      expect(opsSummaryPropsMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          acceptanceMetrics: [
            expect.objectContaining({
              key: 'taskSuccessRate',
              label: '任务执行成功率',
            }),
          ],
        }),
      );
    });
  });

  it('loads persisted task steps into editor when selecting an existing task', async () => {
    render(<AutomationApp />);

    fireEvent.click(screen.getByRole('button', { name: '选择任务' }));

    expect(await screen.findByText('编辑器步骤数:2')).toBeDefined();
    expect(invokeMock).toHaveBeenCalledWith('task:get', { taskId: 'task-1' });
  });

  it('loads selected task name into the task name input', async () => {
    render(<AutomationApp />);

    fireEvent.click(screen.getByRole('button', { name: '选择任务' }));

    expect(await screen.findByDisplayValue('采集任务')).toBeDefined();
  });

  it('saves edited steps for the selected task', async () => {
    render(<AutomationApp />);

    fireEvent.click(screen.getByRole('button', { name: '选择任务' }));
    await screen.findByText('编辑器步骤数:2');

    fireEvent.click(screen.getByRole('button', { name: '模拟编辑步骤' }));
    fireEvent.click(screen.getByRole('button', { name: '保存任务' }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(
        'task:save',
        expect.objectContaining({
          taskId: 'task-1',
          steps: expect.arrayContaining([
            expect.objectContaining({ id: 'step-3' }),
          ]),
        }),
      );
    });
  });

  it('saves edited task name with selected task steps', async () => {
    render(<AutomationApp />);

    fireEvent.click(screen.getByRole('button', { name: '选择任务' }));
    const nameInput = await screen.findByPlaceholderText('请输入任务名称');

    fireEvent.change(nameInput, { target: { value: '价格采集任务' } });
    fireEvent.click(screen.getByRole('button', { name: '模拟编辑步骤' }));
    fireEvent.click(screen.getByRole('button', { name: '保存任务' }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(
        'task:save',
        expect.objectContaining({
          taskId: 'task-1',
          name: '价格采集任务',
          steps: expect.arrayContaining([
            expect.objectContaining({ id: 'step-3' }),
          ]),
        }),
      );
    });
  });

  it('creates a new task when saving after clicking 新建任务', async () => {
    invokeMock.mockResolvedValueOnce({
      id: 'task-new-1',
      name: '未命名任务',
      steps: [
        {
          id: 'step-new-1',
          name: '打开首页',
          action: { type: 'click', selector: '#home' },
        },
      ],
      createdAt: '2026-04-16T00:00:00.000Z',
      updatedAt: '2026-04-16T00:00:00.000Z',
    });

    render(<AutomationApp />);

    fireEvent.click(screen.getByRole('button', { name: /新建任务/ }));
    fireEvent.click(screen.getByRole('button', { name: '模拟编辑步骤' }));
    fireEvent.click(screen.getByRole('button', { name: '保存任务' }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(
        'task:save',
        expect.objectContaining({
          taskId: null,
          steps: expect.arrayContaining([
            expect.objectContaining({ id: 'step-3' }),
          ]),
        }),
      );
    });
  });

  it('passes task name when creating a new task', async () => {
    render(<AutomationApp />);

    fireEvent.click(screen.getByRole('button', { name: /新建任务/ }));
    fireEvent.change(screen.getByPlaceholderText('请输入任务名称'), {
      target: { value: '新任务名称' },
    });
    fireEvent.click(screen.getByRole('button', { name: '模拟编辑步骤' }));
    fireEvent.click(screen.getByRole('button', { name: '保存任务' }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(
        'task:save',
        expect.objectContaining({
          taskId: null,
          name: '新任务名称',
        }),
      );
    });
  });

  it('shows an error when saving a task fails', async () => {
    invokeMock.mockImplementation((channel: string) => {
      if (channel === IPC_CHANNELS.TASK_GET) {
        return Promise.resolve({
          id: 'task-1',
          name: '采集任务',
          kind: 'generic',
          steps: [
            {
              id: 'step-1',
              name: '打开页面',
              action: { type: 'click', selector: '#open' },
            },
          ],
          createdAt: '2026-04-16T00:00:00.000Z',
          updatedAt: '2026-04-16T00:00:00.000Z',
        });
      }

      if (channel === IPC_CHANNELS.TASK_SAVE) {
        return Promise.reject(new Error('save task failed'));
      }

      if (channel === IPC_CHANNELS.OPS_ACCEPTANCE_METRICS) {
        return Promise.resolve([]);
      }

      return Promise.resolve(null);
    });

    render(<AutomationApp />);

    fireEvent.click(screen.getByRole('button', { name: '选择任务' }));
    await screen.findByText('编辑器步骤数:1');

    fireEvent.click(screen.getByRole('button', { name: '保存任务' }));

    await waitFor(() => {
      expect(messageErrorMock).toHaveBeenCalledWith('save task failed');
    });
  });

  it('renders sign-in panels for aliyundrive tasks and routes actions through sign-in IPC channels', async () => {
    invokeMock.mockImplementation((channel: string, payload?: { taskId?: string; name?: string; entryUrl?: string }) => {
      if (channel === IPC_CHANNELS.TASK_GET) {
        return Promise.resolve({
          id: 'task-signin-1',
          name: '阿里云盘签到',
          kind: 'aliyundrive-signin',
          steps: [],
          entryUrl: 'https://www.aliyundrive.com/',
          signin: {
            site: 'aliyundrive',
            mode: 'browser-first-api-fallback',
            fallbackApiEnabled: true,
            maxRetryPerDay: 2,
            manualInterventionEnabled: true,
          },
          createdAt: '2026-04-28T00:00:00.000Z',
          updatedAt: '2026-04-28T00:00:00.000Z',
        });
      }
      if (channel === IPC_CHANNELS.SIGNIN_TASK_STATUS) {
        return Promise.resolve({
          taskId: 'task-signin-1',
          status: 'success',
          runAt: '2026-04-28T08:30:00.000Z',
          retryCount: 0,
        });
      }
      if (channel === IPC_CHANNELS.SIGNIN_TASK_HISTORY) {
        return Promise.resolve([
          {
            taskId: 'task-signin-1',
            status: 'success',
            strategyUsed: 'browser',
            runAt: '2026-04-28T08:00:00.000Z',
            retryCount: 0,
          },
        ]);
      }
      if (channel === IPC_CHANNELS.SIGNIN_TASK_SAVE) {
        return Promise.resolve({
          id: payload?.taskId ?? 'task-signin-1',
          name: payload?.name ?? '阿里云盘签到',
          kind: 'aliyundrive-signin',
          steps: [],
          entryUrl: payload?.entryUrl ?? 'https://www.aliyundrive.com/',
          signin: {
            site: 'aliyundrive',
            mode: 'browser-first-api-fallback',
            fallbackApiEnabled: true,
            maxRetryPerDay: 2,
            manualInterventionEnabled: true,
          },
          createdAt: '2026-04-28T00:00:00.000Z',
          updatedAt: '2026-04-28T00:00:00.000Z',
        });
      }
      if (channel === IPC_CHANNELS.SIGNIN_TASK_RUN_NOW) {
        return Promise.resolve({
          taskId: 'task-signin-1',
          status: 'success',
          runAt: '2026-04-28T08:35:00.000Z',
          retryCount: 0,
        });
      }
      if (channel === IPC_CHANNELS.SIGNIN_TASK_LOGIN_CAPTURE) {
        return Promise.resolve({
          refreshToken: 'rt-captured',
          timedOut: false,
        });
      }
      if (channel === IPC_CHANNELS.SESSION_LIST) {
        return Promise.resolve([]);
      }
      if (channel === IPC_CHANNELS.OPS_ACCEPTANCE_METRICS) {
        return Promise.resolve([]);
      }
      return Promise.resolve(null);
    });

    render(<AutomationApp />);

    fireEvent.click(screen.getByRole('button', { name: '选择任务' }));

    expect(await screen.findByText('SigninTaskPanel')).toBeDefined();
    expect(await screen.findByText('SigninRunStatusCard')).toBeDefined();
    expect(
      await screen.findByText((_, node) => node?.textContent === 'SigninHistoryCount:1'),
    ).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: '保存签到任务' }));
    fireEvent.click(screen.getByRole('button', { name: '立即执行签到' }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(
        IPC_CHANNELS.SIGNIN_TASK_SAVE,
        expect.objectContaining({
          taskId: 'task-signin-1',
          name: '阿里云盘签到',
          entryUrl: 'https://www.aliyundrive.com/',
        }),
      );
      expect(invokeMock).toHaveBeenCalledWith(IPC_CHANNELS.SIGNIN_TASK_RUN_NOW, {
        taskId: 'task-signin-1',
      });
      expect(invokeMock).toHaveBeenCalledWith(IPC_CHANNELS.SIGNIN_TASK_HISTORY, {
        taskId: 'task-signin-1',
      });
    });
  });

  it('auto-saves a new sign-in task before capturing login', async () => {
    invokeMock.mockImplementation((channel: string, payload?: { taskId?: string; name?: string; entryUrl?: string }) => {
      if (channel === IPC_CHANNELS.SESSION_LIST) {
        return Promise.resolve([]);
      }
      if (channel === IPC_CHANNELS.SIGNIN_TASK_SAVE) {
        return Promise.resolve({
          id: payload?.taskId ?? 'task-signin-new',
          name: payload?.name ?? '阿里云盘签到',
          kind: 'aliyundrive-signin',
          steps: [],
          entryUrl: payload?.entryUrl ?? 'https://www.aliyundrive.com/',
          signin: {
            site: 'aliyundrive',
            mode: 'api-first-browser-fallback',
            fallbackApiEnabled: true,
            maxRetryPerDay: 1,
            manualInterventionEnabled: true,
          },
          createdAt: '2026-04-28T00:00:00.000Z',
          updatedAt: '2026-04-28T00:00:00.000Z',
        });
      }
      if (channel === IPC_CHANNELS.SIGNIN_TASK_LOGIN_CAPTURE) {
        return Promise.resolve({
          refreshToken: 'rt-captured',
          timedOut: false,
        });
      }
      if (channel === IPC_CHANNELS.SIGNIN_TASK_STATUS) {
        return Promise.resolve(null);
      }
      if (channel === IPC_CHANNELS.SIGNIN_TASK_HISTORY) {
        return Promise.resolve([]);
      }
      if (channel === IPC_CHANNELS.OPS_ACCEPTANCE_METRICS) {
        return Promise.resolve([]);
      }
      return Promise.resolve(null);
    });

    render(<AutomationApp />);

    fireEvent.click(screen.getByRole('button', { name: '新建签到任务' }));
    expect(await screen.findByText('SigninTaskPanel')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: '采集登录态' }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(IPC_CHANNELS.SIGNIN_TASK_SAVE, expect.objectContaining({
        taskId: null,
        name: '阿里云盘签到',
      }));
      expect(invokeMock).toHaveBeenCalledWith(IPC_CHANNELS.SIGNIN_TASK_LOGIN_CAPTURE, {
        taskId: 'task-signin-new',
      });
    });
    await waitFor(() => {
      expect(messageSuccessMock).toHaveBeenCalledWith(expect.stringContaining('已获取登录态'));
      expect(messageSuccessMock).toHaveBeenCalledWith(expect.stringContaining('已自动关闭窗口'));
    });
  });
});
