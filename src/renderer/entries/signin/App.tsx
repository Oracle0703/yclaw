import { useCallback, useEffect, useRef, useState } from 'react';
import { App as AntdApp, Button, Drawer, Modal, Space, Tag } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { ProTable } from '@ant-design/pro-components';
import { IPC_CHANNELS } from '@shared/constants';
import { PageShell } from '../../shared/components/PageShell';
import { useIpc } from '../../shared/hooks';
import type { BrowserSession, SigninLoginSnapshot, SigninRunSummary, TaskFlow } from '@shared/types';
import { SigninRunStatusCard } from '../automation/components/SigninRunStatusCard';
import { SigninTaskPanel } from '../automation/components/SigninTaskPanel';
import { WorkspaceSwitcher } from '../automation/components/WorkspaceSwitcher';
import { formatBeijingDateTime } from '@renderer/shared/utils/format';
import type { ProColumns } from '@ant-design/pro-components';

interface SigninTaskSummary {
  id: string;
  name: string;
  kind?: TaskFlow['kind'];
  entryUrl?: string;
  enabled?: boolean;
  updatedAt: string;
  signin?: TaskFlow['signin'] | null;
  latestRunSummary?: SigninRunSummary | null;
}

function createDefaultSigninFlow(): {
  taskName: string;
  flow: Pick<TaskFlow, 'entryUrl' | 'sessionId' | 'enabled' | 'signin'>;
} {
  return {
    taskName: '京东签到',
    flow: {
      entryUrl: 'https://interact.jd.com/',
      sessionId: null,
      enabled: true,
      signin: {
        site: 'jd',
        mode: 'api-first-browser-fallback',
        fallbackApiEnabled: true,
        maxRetryPerDay: 1,
        manualInterventionEnabled: true,
      },
    },
  };
}

export default function App() {
  const { invoke } = useIpc();
  const { message } = AntdApp.useApp();
  const defaultState = createDefaultSigninFlow();
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [tasks, setTasks] = useState<SigninTaskSummary[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [draftTaskId, setDraftTaskId] = useState<string | null>(null);
  const [draftTaskName, setDraftTaskName] = useState(defaultState.taskName);
  const [draftSigninFlow, setDraftSigninFlow] = useState(defaultState.flow);
  const [signinStatus, setSigninStatus] = useState<SigninRunSummary | null>(null);
  const [signinHistory, setSigninHistory] = useState<SigninRunSummary[]>([]);
  const [sessions, setSessions] = useState<BrowserSession[]>([]);
  const selectedTaskIdRef = useRef<string | null>(null);
  const messageRef = useRef(message);

  useEffect(() => {
    void invoke<BrowserSession[]>(IPC_CHANNELS.SESSION_LIST)
      .then((data) => setSessions(Array.isArray(data) ? data : []))
      .catch(() => setSessions([]));
  }, [invoke]);

  useEffect(() => {
    selectedTaskIdRef.current = selectedTaskId;
  }, [selectedTaskId]);

  useEffect(() => {
    messageRef.current = message;
  }, [message]);

  const resetDraft = () => {
    const next = createDefaultSigninFlow();
    setDraftTaskId(null);
    setDraftTaskName(next.taskName);
    setDraftSigninFlow(next.flow);
  };

  const fetchTasks = useCallback(async (keepSelectedTaskId?: string | null) => {
    setLoading(true);
    try {
      const taskList = await invoke<SigninTaskSummary[]>(IPC_CHANNELS.TASK_LIST);
      const signinTasks = (Array.isArray(taskList) ? taskList : []).filter(isJdSigninTask);
      const summaryEntries = await Promise.all(
        signinTasks.map(async (task) => {
          try {
            const summary = await invoke<SigninRunSummary | null>(IPC_CHANNELS.SIGNIN_TASK_STATUS, {
              taskId: task.id,
            });
            return [task.id, summary] as const;
          } catch {
            return [task.id, null] as const;
          }
        }),
      );
      const summaryMap = new Map(summaryEntries);
      const nextTasks = signinTasks.map((task) => ({
        ...task,
        latestRunSummary: summaryMap.get(task.id) ?? null,
      }));
      setTasks(nextTasks);

      const nextSelectedId = keepSelectedTaskId ?? selectedTaskIdRef.current;
      if (nextSelectedId && !nextTasks.some((task) => task.id === nextSelectedId)) {
        setSelectedTaskId(null);
        setSigninStatus(null);
        setSigninHistory([]);
      }
    } catch (err) {
      messageRef.current.error(err instanceof Error ? err.message : '加载签到任务失败');
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [invoke]);

  const refreshSigninRunData = async (taskId: string) => {
    const [latestStatus, history] = await Promise.all([
      invoke<SigninRunSummary | null>(IPC_CHANNELS.SIGNIN_TASK_STATUS, { taskId }),
      invoke<SigninRunSummary[]>(IPC_CHANNELS.SIGNIN_TASK_HISTORY, { taskId }),
    ]);
    setSigninStatus(latestStatus);
    setSigninHistory(Array.isArray(history) ? history : []);
  };

  useEffect(() => {
    void fetchTasks();
  }, [fetchTasks]);

  const handleSelectTask = async (taskId: string) => {
    setSelectedTaskId(taskId);
    await refreshSigninRunData(taskId);
  };

  const handleEditTask = async (taskId: string) => {
    try {
      const flow = await invoke<TaskFlow>(IPC_CHANNELS.SIGNIN_TASK_GET, { taskId });
      setDraftTaskId(flow.id);
      setDraftTaskName(flow.name);
      setDraftSigninFlow({
        entryUrl: flow.entryUrl,
        sessionId: flow.sessionId,
        enabled: flow.enabled,
        signin: flow.signin ?? null,
      });
      setDrawerOpen(true);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '加载签到任务失败');
    }
  };

  const handleCreateTask = () => {
    resetDraft();
    setDrawerOpen(true);
  };

  const persistSigninTask = async (
    payload: {
      taskId: string | null;
      name: string;
      entryUrl: string;
      sessionId: string | null;
      enabled: boolean;
      signin: NonNullable<TaskFlow['signin']>;
    },
    options?: {
      closeDrawer?: boolean;
      refreshList?: boolean;
    },
  ) => {
    const normalizedPayload = {
      ...payload,
      name: payload.name.trim() || '京东签到',
    };
    const saved = await invoke<TaskFlow>(IPC_CHANNELS.SIGNIN_TASK_SAVE, normalizedPayload);
    setSelectedTaskId(saved.id);
    setDraftTaskId(saved.id);
    setDraftTaskName(saved.name);
    setDraftSigninFlow({
      entryUrl: saved.entryUrl,
      sessionId: saved.sessionId,
      enabled: saved.enabled,
      signin: saved.signin ?? null,
    });
    await refreshSigninRunData(saved.id);
    if (options?.refreshList !== false) {
      await fetchTasks(saved.id);
    }
    if (options?.closeDrawer) {
      setDrawerOpen(false);
    }
    return saved;
  };

  const handleSaveSigninTask = async (payload: {
    taskId: string | null;
    name: string;
    entryUrl: string;
    sessionId: string | null;
    enabled: boolean;
    signin: NonNullable<TaskFlow['signin']>;
  }) => {
    try {
      await persistSigninTask(payload, {
        closeDrawer: true,
        refreshList: true,
      });
    } catch (err) {
      message.error(err instanceof Error ? err.message : '保存签到任务失败');
    }
  };

  const handleCaptureSigninLogin = async (payload: {
    taskId: string | null;
    name: string;
    entryUrl: string;
    sessionId: string | null;
    enabled: boolean;
    signin: NonNullable<TaskFlow['signin']>;
  }) => {
    try {
      const saved =
        payload.taskId != null
          ? await persistSigninTask(payload, {
              closeDrawer: false,
              refreshList: true,
            })
          : await persistSigninTask(payload, {
              closeDrawer: false,
              refreshList: true,
            });
      const captured = await invoke<SigninLoginSnapshot & {
        captureDiagnostics?: Record<string, unknown> | null;
        timedOut: boolean;
      }>(IPC_CHANNELS.SIGNIN_TASK_LOGIN_CAPTURE, { taskId: saved.id });

      if (captured && !captured.timedOut) {
        message.success(buildSigninCaptureSuccessMessage(captured));
        setDraftSigninFlow((prev) =>
          prev?.signin
            ? {
                ...prev,
                signin: {
                  ...prev.signin,
                  userName: captured.userName ?? null,
                  userId: captured.userId ?? null,
                  localStorageSnapshot: captured.localStorageSnapshot ?? null,
                },
              }
            : prev,
        );
      } else if (captured?.timedOut) {
        message.warning(
          captured.captureDiagnostics
            ? '5 分钟内未检测到登录态，已记录诊断信息到日志'
            : '5 分钟内未检测到登录态，已取消采集',
        );
      } else {
        message.warning(
          captured?.captureDiagnostics
            ? '未采集到京东登录态，已记录诊断信息到日志'
            : '未采集到京东登录态',
        );
      }
      return captured
        ? {
            taskId: saved.id,
            ...captured,
          }
        : null;
    } catch (err) {
      message.error(err instanceof Error ? err.message : '打开登录页采集失败');
      return null;
    }
  };

  const handleRunSigninTask = async (taskId: string) => {
    try {
      await invoke<SigninRunSummary>(IPC_CHANNELS.SIGNIN_TASK_RUN_NOW, { taskId });
      await refreshSigninRunData(taskId);
      await fetchTasks(taskId);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '执行签到任务失败');
    }
  };

  const handleRetrySigninIntervention = async (taskId: string) => {
    try {
      await invoke<SigninRunSummary>(IPC_CHANNELS.SIGNIN_TASK_INTERVENTION_RETRY, {
        taskId,
      });
      await refreshSigninRunData(taskId);
      await fetchTasks(taskId);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '重试签到任务失败');
    }
  };

  const handleDeleteTask = (task: SigninTaskSummary) => {
    Modal.confirm({
      title: '确认删除签到任务？',
      content: `删除 ${task.name} 后不可直接恢复。`,
      okText: '删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await invoke(IPC_CHANNELS.TASK_DELETE, { taskId: task.id });
          if (selectedTaskId === task.id) {
            setSelectedTaskId(null);
            setSigninStatus(null);
            setSigninHistory([]);
          }
          if (draftTaskId === task.id) {
            resetDraft();
            setDrawerOpen(false);
          }
          await fetchTasks(selectedTaskId === task.id ? null : selectedTaskId);
        } catch (err) {
          message.error(err instanceof Error ? err.message : '删除签到任务失败');
        }
      },
    });
  };

  const columns: ProColumns<SigninTaskSummary>[] = [
    {
      title: '任务名',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '站点',
      dataIndex: ['signin', 'site'],
      key: 'site',
      render: (_: unknown, record: SigninTaskSummary) => resolveSiteLabel(record),
    },
    {
      title: '启用状态',
      dataIndex: 'enabled',
      key: 'enabled',
      render: (_dom, record) => (
        <Tag color={record.enabled === false ? 'default' : 'success'}>
          {record.enabled === false ? '停用' : '启用'}
        </Tag>
      ),
    },
    {
      title: '最近执行时间',
      key: 'lastRunAt',
      render: (_: unknown, record: SigninTaskSummary) =>
        record.latestRunSummary?.runAt ? formatBeijingDateTime(record.latestRunSummary.runAt) : '-',
    },
    {
      title: '上一次结果',
      key: 'lastResult',
      render: (_: unknown, record: SigninTaskSummary) => renderLatestResultTag(record.latestRunSummary),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: unknown, record: SigninTaskSummary) => (
        <Space>
          <Button
            type="link"
            onClick={(event) => {
              event?.stopPropagation?.();
              void handleEditTask(record.id);
            }}
          >
            编辑
          </Button>
          <Button
            type="link"
            onClick={(event) => {
              event?.stopPropagation?.();
              handleDeleteTask(record);
            }}
          >
            删除
          </Button>
          <Button
            type="link"
            onClick={(event) => {
              event?.stopPropagation?.();
              void handleRunSigninTask(record.id);
            }}
          >
            立即执行
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <PageShell
      title="自动签到"
      subTitle="将签到任务独立收口到可扩展的签到中心"
      content="当前承接京东签到领京豆，执行时优先用会话 API 查询余额和明细，必要时再打开页面补领。"
      extra={
        <Space wrap className="yclaw-page-actions">
          <Tag color="processing">Signin Center</Tag>
          <WorkspaceSwitcher />
          <Button icon={<ReloadOutlined />} onClick={() => void fetchTasks(selectedTaskId)}>
            刷新
          </Button>
          <Button icon={<PlusOutlined />} onClick={handleCreateTask}>
            新建签到任务
          </Button>
        </Space>
      }
    >
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <div className="yclaw-panel-card">
          <ProTable<SigninTaskSummary>
            rowKey="id"
            search={false}
            options={false}
            pagination={false}
            loading={loading}
            columns={columns}
            dataSource={tasks}
            scroll={{ x: 'max-content' }}
            onRow={(record) => ({
              onClick: () => {
                void handleSelectTask(record.id);
              },
            })}
          />
        </div>

        <div className="yclaw-panel-card" style={{ padding: 16 }}>
          {selectedTaskId ? (
            <SigninRunStatusCard
              taskId={selectedTaskId}
              summary={signinStatus}
              history={signinHistory}
              onRunNow={handleRunSigninTask}
              onRetryIntervention={handleRetrySigninIntervention}
            />
          ) : (
            '请选择任务查看上一次结果。'
          )}
        </div>
      </Space>

      <Drawer
        title={draftTaskId ? '编辑签到任务' : '新建签到任务'}
        open={drawerOpen}
        width={520}
        onClose={() => setDrawerOpen(false)}
        destroyOnClose
      >
        <SigninTaskPanel
          taskId={draftTaskId}
          initialTaskName={draftTaskName}
          initialValue={draftSigninFlow}
          sessions={sessions}
          onSubmit={handleSaveSigninTask}
          onCaptureLogin={handleCaptureSigninLogin}
        />
      </Drawer>
    </PageShell>
  );
}

function buildSigninCaptureSuccessMessage(captured: SigninLoginSnapshot & { timedOut: boolean }): string {
  const accountLabel = captured.userName ? `（${captured.userName}）` : '';
  const savedFieldCount = countCapturedFields(captured);
  const localStorageCount = Object.keys(captured.localStorageSnapshot ?? {}).length;
  const localStorageSummary =
    localStorageCount > 0 ? `，localStorage ${localStorageCount} 项` : '';
  return `已获取登录态${accountLabel}，已自动关闭窗口并保存 ${savedFieldCount} 项字段${localStorageSummary}`;
}

function countCapturedFields(captured: SigninLoginSnapshot): number {
  let count = 0;
  const scalarFields = [captured.userName, captured.userId];
  for (const field of scalarFields) {
    if (typeof field === 'string' && field.trim().length > 0) {
      count += 1;
    }
  }
  if (captured.localStorageSnapshot && Object.keys(captured.localStorageSnapshot).length > 0) {
    count += 1;
  }
  return count;
}

function resolveSiteLabel(task: SigninTaskSummary): string {
  if (task.signin?.site === 'jd') {
    return '京东';
  }
  return '京东';
}

function isJdSigninTask(task: SigninTaskSummary): boolean {
  return task.kind === 'jd-signin' && task.signin?.site === 'jd';
}

function renderLatestResultTag(summary?: SigninRunSummary | null) {
  if (!summary) {
    return <Tag>未执行</Tag>;
  }
  return summary.status === 'success' ? <Tag color="success">成功</Tag> : <Tag color="error">失败</Tag>;
}
