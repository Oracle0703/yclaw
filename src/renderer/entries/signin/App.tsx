import { useEffect, useState } from 'react';
import { Button, Drawer, Modal, Space, Tag, message } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { ProTable } from '@ant-design/pro-components';
import { IPC_CHANNELS } from '@shared/constants';
import { PageShell } from '../../shared/components/PageShell';
import { useIpc } from '../../shared/hooks';
import type { BrowserSession, SigninRunSummary, TaskFlow } from '@shared/types';
import { SigninRunStatusCard } from '../automation/components/SigninRunStatusCard';
import { SigninTaskPanel } from '../automation/components/SigninTaskPanel';
import { WorkspaceSwitcher } from '../automation/components/WorkspaceSwitcher';
import { formatBeijingDateTime } from '@renderer/shared/utils/format';
import type { ProColumns } from '@ant-design/pro-components';

interface SigninTaskSummary {
  id: string;
  name: string;
  kind?: TaskFlow['kind'];
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
    taskName: '阿里云盘签到',
    flow: {
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
    },
  };
}

export default function App() {
  const { invoke } = useIpc();
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

  useEffect(() => {
    void invoke<BrowserSession[]>(IPC_CHANNELS.SESSION_LIST)
      .then((data) => setSessions(Array.isArray(data) ? data : []))
      .catch(() => setSessions([]));
  }, [invoke]);

  const resetDraft = () => {
    const next = createDefaultSigninFlow();
    setDraftTaskId(null);
    setDraftTaskName(next.taskName);
    setDraftSigninFlow(next.flow);
  };

  const fetchTasks = async (keepSelectedTaskId?: string | null) => {
    setLoading(true);
    try {
      const taskList = await invoke<SigninTaskSummary[]>(IPC_CHANNELS.TASK_LIST);
      const signinTasks = (Array.isArray(taskList) ? taskList : []).filter(
        (task) => typeof task.kind === 'string' && task.kind.endsWith('-signin'),
      );
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

      const nextSelectedId = keepSelectedTaskId ?? selectedTaskId;
      if (nextSelectedId && !nextTasks.some((task) => task.id === nextSelectedId)) {
        setSelectedTaskId(null);
        setSigninStatus(null);
        setSigninHistory([]);
      }
    } catch (err) {
      message.error(err instanceof Error ? err.message : '加载签到任务失败');
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

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
  }, [invoke]);

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

  const handleSaveSigninTask = async (payload: {
    taskId: string | null;
    name: string;
    entryUrl: string;
    sessionId: string | null;
    enabled: boolean;
    signin: NonNullable<TaskFlow['signin']>;
  }) => {
    try {
      const saved = await invoke<TaskFlow>(IPC_CHANNELS.SIGNIN_TASK_SAVE, payload);
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
      await fetchTasks(saved.id);
      setDrawerOpen(false);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '保存签到任务失败');
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
      content="当前优先承接阿里云盘签到，后续可继续扩展京东、淘宝等站点，不再和普通采集任务混放。"
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
        />
      </Drawer>
    </PageShell>
  );
}

function resolveSiteLabel(task: SigninTaskSummary): string {
  if (task.signin?.site === 'aliyundrive') {
    return '阿里云盘';
  }
  return task.signin?.site ?? '未知站点';
}

function renderLatestResultTag(summary?: SigninRunSummary | null) {
  if (!summary) {
    return <Tag>未执行</Tag>;
  }
  return summary.status === 'success' ? <Tag color="success">成功</Tag> : <Tag color="error">失败</Tag>;
}
