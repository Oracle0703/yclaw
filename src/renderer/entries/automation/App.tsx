import { useEffect, useState } from 'react';
import { App as AntdApp, Button, Input, Space, Tag } from 'antd';
import { PlusOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { ProCard } from '@ant-design/pro-components';
import { EVENTS, IPC_CHANNELS } from '@shared/constants';
import { PageShell } from '../../shared/components/PageShell';
import { useIpc, useIpcEvent } from '../../shared/hooks';
import type {
  BrowserSession,
  OperationsAcceptanceMetric,
  SigninLoginSnapshot,
  SigninRunSummary,
  TaskFlow,
  TaskStep,
} from '@shared/types';
import { BatchList } from './components/BatchList';
import { ExecutionPanel } from './components/ExecutionPanel';
import { OpsSummary } from './components/OpsSummary';
import { AlertInbox } from './components/AlertInbox';
import { DutySchedulePanel } from './components/DutySchedulePanel';
import { ResultTable } from './components/ResultTable';
import { RemoteRunnerPanel } from './components/RemoteRunnerPanel';
import { ReviewPanel } from './components/ReviewPanel';
import { RunnerSchedulerPanel } from './components/RunnerSchedulerPanel';
import { SigninRunStatusCard } from './components/SigninRunStatusCard';
import { SigninTaskPanel } from './components/SigninTaskPanel';
import { StepEditor } from './components/StepEditor';
import { TaskList } from './components/TaskList';
import { TaskRevisionDrawer } from './components/TaskRevisionDrawer';
import { TemplateManager } from './components/TemplateManager';
import { WorkspaceSwitcher } from './components/WorkspaceSwitcher';

interface SelectedTaskSummary {
  id: string;
  stepsCount?: number;
}

export default function App() {
  const { invoke, taskOperations } = useIpc();
  const { message } = AntdApp.useApp();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedTaskSummary, setSelectedTaskSummary] = useState<SelectedTaskSummary | null>(null);
  const [selectedTaskKind, setSelectedTaskKind] = useState<TaskFlow['kind']>('generic');
  const [taskName, setTaskName] = useState('');
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [acceptanceMetrics, setAcceptanceMetrics] = useState<OperationsAcceptanceMetric[]>([]);
  const [steps, setSteps] = useState<TaskStep[]>([]);
  const [sessions, setSessions] = useState<BrowserSession[]>([]);
  const [signinFlow, setSigninFlow] = useState<Pick<
    TaskFlow,
    'entryUrl' | 'sessionId' | 'enabled' | 'signin'
  > | null>(null);
  const [signinStatus, setSigninStatus] = useState<SigninRunSummary | null>(null);
  const [signinHistory, setSigninHistory] = useState<SigninRunSummary[]>([]);
  const [execStatus, setExecStatus] = useState('idle');
  const [execStep, setExecStep] = useState(0);
  const [execLogs, setExecLogs] = useState<string[]>([]);
  const [hasBreakpoint, setHasBreakpoint] = useState(false);
  const [showExecution, setShowExecution] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [revisionDrawerOpen, setRevisionDrawerOpen] = useState(false);

  const templateDraftFields = steps
    .filter((step) => step.action.type === 'extract' && step.action.selector)
    .map((step) => ({
      name: step.name,
      selector: step.action.selector,
      attribute: String(step.action.params?.attribute ?? 'textContent'),
    }));

  const isSigninTask = typeof selectedTaskKind === 'string' && selectedTaskKind.endsWith('-signin');

  useEffect(() => {
    if (!isSigninTask && !signinFlow) {
      return;
    }

    void invoke<BrowserSession[]>(IPC_CHANNELS.SESSION_LIST)
      .then((data) => setSessions(Array.isArray(data) ? data : []))
      .catch(() => setSessions([]));
  }, [invoke, isSigninTask, signinFlow]);

  const handleSelectTask = async (task: SelectedTaskSummary | 'new') => {
    if (task === 'new') {
      setSelectedTaskId(null);
      setSelectedTaskSummary(null);
      setSelectedTaskKind('generic');
      setTaskName('');
      setSelectedBatchId(null);
      setSigninFlow(null);
      setSigninStatus(null);
      setSigninHistory([]);
      setSteps([]);
      return;
    }

    setSelectedTaskId(task.id);
    setSelectedTaskSummary(task);
    setSelectedBatchId(null);

    try {
      const flow = await invoke<TaskFlow>(IPC_CHANNELS.TASK_GET, { taskId: task.id });
      const nextKind = flow.kind ?? 'generic';
      setTaskName(flow.name);
      setSelectedTaskId(flow.id);
      setSelectedTaskKind(nextKind);
      if (typeof nextKind === 'string' && nextKind.endsWith('-signin')) {
        setSigninFlow({
          entryUrl: flow.entryUrl,
          sessionId: flow.sessionId,
          enabled: flow.enabled,
          signin: flow.signin ?? null,
        });
        setSteps([]);
        await refreshSigninRunData(flow.id);
        return;
      }

      setSigninFlow(null);
      setSigninStatus(null);
      setSigninHistory([]);
      setSteps(flow.steps);
    } catch {
      setSelectedTaskKind('generic');
      setSigninFlow(null);
      setSigninStatus(null);
      setSigninHistory([]);
      setTaskName('');
      setSteps([]);
    }
  };

  const handleSaveTask = async () => {
    if (typeof selectedTaskKind === 'string' && selectedTaskKind.endsWith('-signin')) {
      return;
    }
    try {
      const saved = await invoke<TaskFlow>(IPC_CHANNELS.TASK_SAVE, {
        taskId: selectedTaskId,
        name: taskName,
        steps,
      });

      setSelectedTaskId(saved.id);
      setSelectedTaskSummary({
        id: saved.id,
        stepsCount: saved.steps.length,
      });
      setTaskName(saved.name);
      setSteps(saved.steps);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '保存任务失败');
    }
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
  ) => {
    const normalizedPayload = {
      ...payload,
      name: payload.name.trim() || '京东签到',
    };
    const saved = await invoke<TaskFlow>(IPC_CHANNELS.SIGNIN_TASK_SAVE, normalizedPayload);
    setSelectedTaskId(saved.id);
    setSelectedTaskKind('jd-signin');
    setTaskName(saved.name);
    setSelectedTaskSummary({
      id: saved.id,
      stepsCount: saved.steps.length,
    });
    setSigninFlow({
      entryUrl: saved.entryUrl,
      sessionId: saved.sessionId,
      enabled: saved.enabled,
      signin: saved.signin ?? null,
    });
    await refreshSigninRunData(saved.id);
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
      await persistSigninTask(payload);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '保存签到任务失败');
    }
  };

  const handleRunSigninTask = async (taskId: string) => {
    try {
      await invoke<SigninRunSummary>(IPC_CHANNELS.SIGNIN_TASK_RUN_NOW, { taskId });
      await refreshSigninRunData(taskId);
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
    } catch (err) {
      message.error(err instanceof Error ? err.message : '重试签到任务失败');
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
      const saved = await persistSigninTask(payload);
      const captured = await invoke<SigninLoginSnapshot & {
        refreshToken: string | null;
        captureDiagnostics?: Record<string, unknown> | null;
        timedOut: boolean;
      }>(IPC_CHANNELS.SIGNIN_TASK_LOGIN_CAPTURE, { taskId: saved.id });

      if (captured && !captured.timedOut) {
        message.success(buildSigninCaptureSuccessMessage(captured));
        // 同步到本地表单状态：localStorage 已写入服务端任务，刷新本地视图
        setSigninFlow((prev) =>
          prev?.signin
            ? {
                ...prev,
                signin: {
                  ...prev.signin,
                  refreshToken: captured.refreshToken ?? null,
                  accessToken: captured.accessToken ?? null,
                  userName: captured.userName ?? null,
                  userId: captured.userId ?? null,
                  defaultDriveId: captured.defaultDriveId ?? null,
                  expiresAt: captured.expiresAt ?? null,
                  tokenType: captured.tokenType ?? null,
                  tokenPayload: captured.tokenPayload ?? null,
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
            ? '未采集到 refresh_token，已记录诊断信息到日志'
            : '未采集到 refresh_token',
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

  const refreshSigninRunData = async (taskId: string) => {
    const [latestStatus, history] = await Promise.all([
      invoke<SigninRunSummary | null>(IPC_CHANNELS.SIGNIN_TASK_STATUS, { taskId }),
      invoke<SigninRunSummary[]>(IPC_CHANNELS.SIGNIN_TASK_HISTORY, { taskId }),
    ]);
    setSigninStatus(latestStatus);
    setSigninHistory(Array.isArray(history) ? history : []);
  };

  const totalSteps = steps.length > 0 ? steps.length : (selectedTaskSummary?.stepsCount ?? 0);

  useEffect(() => {
    if (!selectedTaskId || !taskOperations?.getAcceptanceMetrics) {
      setAcceptanceMetrics([]);
      return;
    }

    void taskOperations
      .getAcceptanceMetrics({ taskId: selectedTaskId })
      .then((metrics) => {
        setAcceptanceMetrics(
          Array.isArray(metrics) ? (metrics as OperationsAcceptanceMetric[]) : [],
        );
      })
      .catch(() => setAcceptanceMetrics([]));
  }, [selectedTaskId, taskOperations]);

  useIpcEvent(EVENTS.TASK_STARTED, (_data: unknown) => {
    const data = _data as { flowId?: string };
    if (data.flowId && selectedTaskId && data.flowId !== selectedTaskId) {
      return;
    }
    setExecStatus('running');
    setHasBreakpoint(false);
    setExecStep(0);
    setShowExecution(true);
    setExecLogs((prev) => [...prev, '任务开始执行']);
  });

  useIpcEvent(EVENTS.TASK_STEP_COMPLETED, (_data: unknown) => {
    const data = _data as { stepIndex: number };
    setExecStep(data.stepIndex + 1);
    setExecLogs((prev) => [...prev, `步骤 ${data.stepIndex + 1} 完成`]);
  });

  useIpcEvent(EVENTS.TASK_COMPLETED, () => {
    setExecStatus('completed');
    setHasBreakpoint(false);
    setExecLogs((prev) => [...prev, '任务执行完成']);
  });

  useIpcEvent(EVENTS.TASK_PAUSED, () => {
    setExecStatus('paused');
    setExecLogs((prev) => [...prev, '任务已暂停']);
  });

  useIpcEvent(EVENTS.TASK_FAILED, (_data: unknown) => {
    const data = _data as { error: string };
    setExecStatus('failed');
    setHasBreakpoint(true);
    setExecLogs((prev) => [...prev, `❌ 失败: ${data.error}`]);
  });

  return (
    <PageShell
      title="自动化采集"
      subTitle="统一编排任务流、步骤配置和执行状态"
      content="将 RPA 任务资产、编辑器和执行日志集中在一个中台页面内，便于团队协作和巡检。"
      extra={
        <Space wrap className="yclaw-page-actions">
          <Tag color="processing">Automation</Tag>
          <WorkspaceSwitcher />
          {!isSigninTask ? (
            <Input
              aria-label="任务名称"
              placeholder="请输入任务名称"
              value={taskName}
              onChange={(event) => setTaskName(event.target.value)}
              style={{ width: 220 }}
            />
          ) : null}
          <Button
            icon={<PlusOutlined />}
            onClick={() => {
              setSelectedTaskId(null);
              setSelectedTaskSummary(null);
              setSelectedTaskKind('generic');
              setTaskName('');
              setSigninFlow(null);
              setSigninStatus(null);
              setSteps([]);
            }}
          >
            新建任务
          </Button>
          <Button
            onClick={() => {
              setSelectedTaskId(null);
              setSelectedTaskSummary(null);
              setSelectedTaskKind('jd-signin');
              setTaskName('京东签到');
              setSelectedBatchId(null);
              setSigninFlow({
                entryUrl: 'https://interact.jd.com/',
                sessionId: null,
                enabled: true,
                signin: {
                  site: 'jd',
                  mode: 'browser-first-api-fallback',
                  fallbackApiEnabled: false,
                  refreshToken: null,
                  maxRetryPerDay: 1,
                  manualInterventionEnabled: true,
                },
              });
              setSigninStatus(null);
              setSteps([]);
            }}
          >
            新建签到任务
          </Button>
          {!isSigninTask ? (
            <Button onClick={() => void handleSaveTask()} disabled={steps.length === 0}>
              保存任务
            </Button>
          ) : null}
          <Button onClick={() => setRevisionDrawerOpen(true)} disabled={!selectedTaskId}>
            任务版本
          </Button>
          <Button
            type="primary"
            icon={<ThunderboltOutlined />}
            onClick={() => setShowExecution((v) => !v)}
          >
            {showExecution ? '隐藏执行面板' : '打开执行面板'}
          </Button>
        </Space>
      }
    >
      <div className="yclaw-automation-split">
        {/* 左栏：任务列表 */}
        <div className="yclaw-automation-sidebar">
          <TaskList onSelect={handleSelectTask} />
        </div>

        {/* 右栏：编辑器 + 执行面板 */}
        <div className="yclaw-automation-main">
          <OpsSummary
            summary={{
              queued: selectedTaskId ? 1 : 0,
              running: execStatus === 'running' ? 1 : 0,
              failed: execStatus === 'failed' ? 1 : 0,
              waitingIntervention: hasBreakpoint ? 1 : 0,
            }}
            acceptanceMetrics={acceptanceMetrics}
          />
          <AlertInbox />
          <DutySchedulePanel />
          <RemoteRunnerPanel />
          <RunnerSchedulerPanel />

          {isSigninTask ? (
            <>
              <SigninTaskPanel
                taskId={selectedTaskId}
                initialTaskName={taskName}
                initialValue={signinFlow}
                sessions={sessions}
                onSubmit={handleSaveSigninTask}
                onCaptureLogin={handleCaptureSigninLogin}
              />
              <SigninRunStatusCard
                taskId={selectedTaskId}
                summary={signinStatus}
                history={signinHistory}
                onRunNow={handleRunSigninTask}
                onRetryIntervention={handleRetrySigninIntervention}
              />
            </>
          ) : (
            <>
              <TemplateManager
                draftFields={templateDraftFields}
                onSelectTemplate={(templateId) => setSelectedTemplateId(templateId)}
              />

              <ProCard className="yclaw-panel-card" title="步骤编辑器" style={{ flex: 1 }}>
                <StepEditor steps={steps} onChange={setSteps} />
              </ProCard>

              {selectedTemplateId && (
                <Tag color="processing">当前已选择模板：{selectedTemplateId}</Tag>
              )}

              <BatchList taskId={selectedTaskId} onSelectBatch={setSelectedBatchId} />

              <ResultTable taskId={selectedTaskId} batchId={selectedBatchId} />
              <ReviewPanel taskId={selectedTaskId} selectedTemplateId={selectedTemplateId} />
            </>
          )}

          {showExecution && (
            <ProCard className="yclaw-panel-card" title="执行面板" style={{ flex: 'none' }}>
              <ExecutionPanel
                taskId={selectedTaskId}
                status={execStatus}
                currentStep={execStep}
                totalSteps={totalSteps}
                logs={execLogs}
                hasBreakpoint={hasBreakpoint}
                onStatusChange={setExecStatus}
                onError={(message) => {
                  setExecStatus('failed');
                  setExecLogs((prev) => [...prev, `❌ ${message}`]);
                }}
                onStopped={() => {
                  setHasBreakpoint(false);
                  setExecStep(0);
                  setExecStatus('idle');
                  setExecLogs((prev) => [...prev, '任务已停止']);
                }}
              />
            </ProCard>
          )}

          <TaskRevisionDrawer
            taskId={selectedTaskId}
            open={revisionDrawerOpen}
            onClose={() => setRevisionDrawerOpen(false)}
          />
        </div>
      </div>
    </PageShell>
  );
}

function buildSigninCaptureSuccessMessage(captured: SigninLoginSnapshot & {
  refreshToken: string | null;
  timedOut: boolean;
}): string {
  const accountLabel = captured.userName ? `（${captured.userName}）` : '';
  const savedFieldCount = countCapturedFields(captured);
  const localStorageCount = Object.keys(captured.localStorageSnapshot ?? {}).length;
  const localStorageSummary =
    localStorageCount > 0 ? `，localStorage ${localStorageCount} 项` : '';
  return `已获取登录态${accountLabel}，已自动关闭窗口并保存 ${savedFieldCount} 项字段${localStorageSummary}`;
}

function countCapturedFields(captured: SigninLoginSnapshot): number {
  let count = 0;
  const scalarFields = [
    captured.refreshToken,
    captured.accessToken,
    captured.userName,
    captured.userId,
    captured.defaultDriveId,
    captured.expiresAt,
    captured.tokenType,
  ];
  for (const field of scalarFields) {
    if (typeof field === 'string' && field.trim().length > 0) {
      count += 1;
    }
  }
  if (captured.tokenPayload && Object.keys(captured.tokenPayload).length > 0) {
    count += 1;
  }
  if (captured.localStorageSnapshot && Object.keys(captured.localStorageSnapshot).length > 0) {
    count += 1;
  }
  return count;
}
