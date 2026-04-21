import { useEffect, useState } from 'react';
import { Button, Drawer, List, Space, Tag } from 'antd';
import type { TaskRevisionComparison, TaskRevisionRecord } from '@shared/types';
import { useIpc } from '../../../shared/hooks';

export function TaskRevisionDrawer({
  taskId,
  open,
  onClose,
}: {
  taskId: string | null;
  open: boolean;
  onClose?: () => void;
}) {
  const { taskOperations } = useIpc();
  const [revisions, setRevisions] = useState<TaskRevisionRecord[]>([]);
  const [comparison, setComparison] = useState<TaskRevisionComparison | null>(null);

  useEffect(() => {
    if (!open || !taskId) {
      return;
    }

    let disposed = false;
    void taskOperations.listTaskRevisions(taskId).then((items) => {
      if (!disposed) {
        setRevisions((items ?? []) as TaskRevisionRecord[]);
      }
    });

    return () => {
      disposed = true;
    };
  }, [open, taskId, taskOperations]);

  const handlePublish = () => {
    if (!taskId) {
      return;
    }

    void taskOperations.publishTaskRevision({
      taskId,
      version: `v${revisions.length + 1}`,
      changeSummary: '由自动化页发布当前版本',
    });
  };

  const handleCompare = (targetIndex: number) => {
    const targetRevision = revisions[targetIndex];
    const baseRevision = revisions[targetIndex + 1];
    if (!targetRevision || !baseRevision || !taskOperations.compareTaskRevisions) {
      return;
    }

    void taskOperations.compareTaskRevisions({
      baseRevisionId: baseRevision.id,
      targetRevisionId: targetRevision.id,
    }).then((result) => {
      setComparison(result as TaskRevisionComparison);
    });
  };

  return (
    <Drawer title="任务版本" open={open} onClose={onClose}>
      <Space direction="vertical">
        <Button onClick={handlePublish}>发布当前版本</Button>
        <List
          dataSource={revisions}
          renderItem={(item) => {
            const revision = item as TaskRevisionRecord;
            const revisionIndex = revisions.findIndex((candidate) => candidate.id === revision.id);
            return (
              <Space>
                <span>{revision.version}</span>
                <Tag>{revision.reviewStatus}</Tag>
                {revisionIndex >= 0 && revisions[revisionIndex + 1] && (
                  <Button onClick={() => handleCompare(revisionIndex)}>对比前一版</Button>
                )}
              </Space>
            );
          }}
        />
        {comparison?.changes.map((change) => (
          <div key={`${change.path}-${String(change.before)}-${String(change.after)}`}>
            {`${change.path}：${String(change.before)} → ${String(change.after)}`}
          </div>
        ))}
      </Space>
    </Drawer>
  );
}
