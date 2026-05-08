import { useEffect, useMemo, useState } from 'react';
import { Select, Space, Typography } from 'antd';
import type { WorkspaceDutyPolicy, WorkspaceRecord } from '@shared/types';
import { useIpc } from '../../../shared/hooks';

export function WorkspaceSwitcher() {
  const { taskOperations } = useIpc();
  const [workspaces, setWorkspaces] = useState<WorkspaceRecord[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>();
  const [dutyPolicy, setDutyPolicy] = useState<WorkspaceDutyPolicy | null>(null);

  useEffect(() => {
    let disposed = false;

    void taskOperations.listWorkspaces().then((items) => {
      if (disposed) {
        return;
      }
      const next = (items ?? []) as WorkspaceRecord[];
      setWorkspaces(next);
      if (!selectedWorkspaceId && next.length > 0) {
        setSelectedWorkspaceId(next[0].id);
      }
    });

    return () => {
      disposed = true;
    };
  }, [selectedWorkspaceId, taskOperations]);

  useEffect(() => {
    if (!selectedWorkspaceId || !taskOperations.getWorkspaceDuty) {
      return;
    }

    let disposed = false;

    void taskOperations.getWorkspaceDuty(selectedWorkspaceId).then((policy) => {
      if (!disposed) {
        setDutyPolicy((policy ?? null) as WorkspaceDutyPolicy | null);
      }
    });

    return () => {
      disposed = true;
    };
  }, [selectedWorkspaceId, taskOperations]);

  const options = useMemo(
    () => workspaces.map((workspace) => ({ label: workspace.name, value: workspace.id })),
    [workspaces],
  );

  return (
    <Space>
      <Typography.Text strong>工作区</Typography.Text>
      <Select
        value={selectedWorkspaceId}
        onChange={(value) => setSelectedWorkspaceId(value)}
        options={options}
        placeholder="请选择工作区"
      />
      {dutyPolicy?.currentOperator?.name && (
        <Typography.Text>{`当前值班：${dutyPolicy.currentOperator.name}`}</Typography.Text>
      )}
      {dutyPolicy?.nextOperator?.name && (
        <Typography.Text>{`下一班：${dutyPolicy.nextOperator.name}`}</Typography.Text>
      )}
      {dutyPolicy?.escalationOwner?.name && (
        <Typography.Text>{`升级负责人：${dutyPolicy.escalationOwner.name}`}</Typography.Text>
      )}
    </Space>
  );
}
