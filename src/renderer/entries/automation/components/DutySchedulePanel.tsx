import { useEffect, useState } from 'react';
import { Button, Space, Tag } from 'antd';
import type { WorkspaceDutyShiftRecord, WorkspaceMember, WorkspaceRecord } from '@shared/types';
import { useIpc } from '../../../shared/hooks';

const SHIFT_HOURS = 8;

export function DutySchedulePanel() {
  const { taskOperations } = useIpc();
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [shifts, setShifts] = useState<WorkspaceDutyShiftRecord[]>([]);

  useEffect(() => {
    let disposed = false;

    void taskOperations.listWorkspaces().then((items) => {
      if (disposed) {
        return;
      }
      const workspaces = (items ?? []) as WorkspaceRecord[];
      setWorkspaceId(workspaces[0]?.id ?? null);
    });

    return () => {
      disposed = true;
    };
  }, [taskOperations]);

  useEffect(() => {
    if (!workspaceId) {
      setMembers([]);
      setShifts([]);
      return;
    }

    let disposed = false;

    void Promise.all([
      taskOperations.listMembers(workspaceId),
      taskOperations.listWorkspaceDutyShifts(workspaceId),
    ]).then(([nextMembers, nextShifts]) => {
      if (!disposed) {
        setMembers((nextMembers ?? []) as WorkspaceMember[]);
        setShifts((nextShifts ?? []) as WorkspaceDutyShiftRecord[]);
      }
    });

    return () => {
      disposed = true;
    };
  }, [workspaceId, taskOperations]);

  const handleCreateShift = () => {
    if (!workspaceId || !taskOperations.saveWorkspaceDutyShift) {
      return;
    }

    const nextMember = members.find((member) => member.role === 'operator' && member.status === 'active')
      ?? members.find((member) => member.status === 'active');

    if (!nextMember) {
      return;
    }

    const latestEnd = shifts.reduce((latest, shift) => (
      Math.max(latest, new Date(shift.endsAt).getTime())
    ), Date.now());
    const startsAt = new Date(Math.max(Date.now(), latestEnd)).toISOString();
    const endsAt = new Date(new Date(startsAt).getTime() + SHIFT_HOURS * 60 * 60 * 1000).toISOString();

    void taskOperations.saveWorkspaceDutyShift({
      workspaceId,
      memberId: nextMember.id,
      startsAt,
      endsAt,
      notes: '自动排班',
    }).then((created) => {
      setShifts((current) => [...current, created as WorkspaceDutyShiftRecord]);
    });
  };

  return (
    <div className="yclaw-panel-card">
      <h3>班次安排</h3>
      <Space direction="vertical">
        <Button onClick={handleCreateShift} disabled={!workspaceId || members.length === 0}>
          新增班次
        </Button>
        {shifts.map((shift) => (
          <div key={shift.id}>
            <Space>
              <span>{shift.memberName ?? shift.memberId}</span>
              {shift.notes && <Tag>{shift.notes}</Tag>}
              <span>{formatShiftRange(shift)}</span>
            </Space>
          </div>
        ))}
      </Space>
    </div>
  );
}

function formatShiftRange(shift: WorkspaceDutyShiftRecord): string {
  return `${formatTime(shift.startsAt)} - ${formatTime(shift.endsAt)}`;
}

function formatTime(value: string): string {
  return new Date(value).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
