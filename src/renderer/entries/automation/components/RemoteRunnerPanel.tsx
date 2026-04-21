import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Input, List, Select, Space, Tag } from 'antd';
import type { RemoteExecution, RemoteExecutionLog, RunnerConnection } from '@shared/types';
import { useIpc } from '@renderer/shared/hooks';
import { createRemoteRunnerApi } from '@renderer/shared/api/remoteRunner';
import { RemoteExecutionDrawer } from './RemoteExecutionDrawer';

export function RemoteRunnerPanel() {
  const { invoke } = useIpc();
  const api = useMemo(() => createRemoteRunnerApi({ invoke }), [invoke]);
  const [connections, setConnections] = useState<RunnerConnection[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [token, setToken] = useState('');
  const [workspaceId, setWorkspaceId] = useState('default');
  const [tlsMode, setTlsMode] = useState<RunnerConnection['tlsMode']>('insecure-dev');
  const [activeRunnerConnectionId, setActiveRunnerConnectionId] = useState<string | null>(null);
  const [activeExecution, setActiveExecution] = useState<RemoteExecution | null>(null);
  const [executionLogs, setExecutionLogs] = useState<RemoteExecutionLog[]>([]);

  const refresh = useCallback(async () => {
    setConnections(await api.listConnections());
  }, [api]);

  useEffect(() => {
    void refresh().catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, [refresh]);

  const save = async () => {
    setError(null);
    try {
      await api.saveConnection({
        name,
        baseUrl,
        token,
        workspaceId,
        tlsMode,
        proxyUrl: null,
      });
      setName('');
      setBaseUrl('');
      setToken('');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const testConnection = async (id: string) => {
    setError(null);
    try {
      await api.testConnection(id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const createAndStartSampleTask = async (runnerConnectionId: string) => {
    setError(null);
    try {
      const now = new Date().toISOString();
      const saved = await api.saveRemoteTask({
        runnerConnectionId,
        data: {
          name: '远程示例任务',
          tags: ['sample'],
          flow: {
            id: `remote-sample-${Date.now()}`,
            name: '远程示例任务',
            steps: [],
            createdAt: now,
            updatedAt: now,
          },
        },
      }) as {
        task: { id: string };
        revision: { revisionId: string };
      };
      const execution = await api.startExecution({
        runnerConnectionId,
        taskId: saved.task.id,
        revisionId: saved.revision.revisionId,
      }) as RemoteExecution;
      const logs = await api.getExecutionLogs({
        runnerConnectionId,
        executionId: execution.id,
      }) as RemoteExecutionLog[];

      setActiveRunnerConnectionId(runnerConnectionId);
      setActiveExecution(execution);
      setExecutionLogs(logs);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const refreshExecution = async () => {
    if (!activeRunnerConnectionId || !activeExecution) {
      return;
    }

    const [execution, logs] = await Promise.all([
      api.getExecution({
        runnerConnectionId: activeRunnerConnectionId,
        executionId: activeExecution.id,
      }) as Promise<RemoteExecution>,
      api.getExecutionLogs({
        runnerConnectionId: activeRunnerConnectionId,
        executionId: activeExecution.id,
      }) as Promise<RemoteExecutionLog[]>,
    ]);
    setActiveExecution(execution);
    setExecutionLogs(logs);
  };

  const cancelExecution = async (executionId: string, runnerConnectionId: string) => {
    const execution = await api.cancelExecution({
      runnerConnectionId,
      executionId,
    }) as RemoteExecution;
    const logs = await api.getExecutionLogs({
      runnerConnectionId,
      executionId,
    }) as RemoteExecutionLog[];
    setActiveExecution(execution);
    setExecutionLogs(logs);
  };

  return (
    <Card title="Remote Runner">
      {error ? <Alert type="error" message={error} showIcon /> : null}
      <Space>
        <Input placeholder="名称" value={name} onChange={(event) => setName(event.target.value)} />
        <Input
          placeholder="http://127.0.0.1:7421"
          value={baseUrl}
          onChange={(event) => setBaseUrl(event.target.value)}
        />
        <Input
          placeholder="Token"
          type="password"
          value={token}
          onChange={(event) => setToken(event.target.value)}
        />
        <Input
          placeholder="workspace"
          value={workspaceId}
          onChange={(event) => setWorkspaceId(event.target.value)}
        />
        <Select
          value={tlsMode}
          onChange={(value) => setTlsMode(value)}
          options={[
            { label: '严格 TLS', value: 'strict' },
            { label: '开发模式', value: 'insecure-dev' },
          ]}
        />
        <Button onClick={() => void save()}>保存连接</Button>
      </Space>
      <List
        dataSource={connections}
        renderItem={(connection) => (
          <div>
            <Space>
              <strong>{connection.name}</strong>
              <span>{connection.baseUrl}</span>
              <Tag>{connection.status}</Tag>
              <Button onClick={() => void testConnection(connection.id)}>测试</Button>
              <Button onClick={() => void createAndStartSampleTask(connection.id)}>
                创建并启动示例任务
              </Button>
            </Space>
          </div>
        )}
      />
      <RemoteExecutionDrawer
        open={activeExecution !== null}
        runnerConnectionId={activeRunnerConnectionId ?? ''}
        execution={activeExecution}
        logs={executionLogs}
        onRefresh={refreshExecution}
        onCancel={cancelExecution}
        onClose={() => setActiveExecution(null)}
      />
    </Card>
  );
}
