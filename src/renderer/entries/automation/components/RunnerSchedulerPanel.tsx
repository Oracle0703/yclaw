import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Card, List, Space, Tag, message } from 'antd';
import type { ExecutionLease, RunnerNode, RunnerQueueItem } from '@shared/types';
import { useIpc } from '@renderer/shared/hooks';
import { createRunnerSchedulerApi } from '@renderer/shared/api/runnerScheduler';

export function RunnerSchedulerPanel() {
  const { invoke } = useIpc();
  const api = useMemo(() => createRunnerSchedulerApi({ invoke }), [invoke]);
  const [runners, setRunners] = useState<RunnerNode[]>([]);
  const [queue, setQueue] = useState<RunnerQueueItem[]>([]);
  const [leases, setLeases] = useState<ExecutionLease[]>([]);
  const requestSeq = useRef(0);

  const refresh = useCallback(async () => {
    const currentSeq = requestSeq.current + 1;
    requestSeq.current = currentSeq;
    try {
      const [nextRunners, nextQueue, nextLeases] = await Promise.all([
        api.listRunners(),
        api.listQueue(),
        api.listLeases(),
      ]);
      if (currentSeq !== requestSeq.current) {
        return;
      }
      setRunners(nextRunners);
      setQueue(nextQueue);
      setLeases(nextLeases);
    } catch (error) {
      if (currentSeq !== requestSeq.current) {
        return;
      }
      message.error(error instanceof Error ? error.message : '加载 Runner 调度池失败');
    }
  }, [api]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleDispatch = useCallback(async () => {
    try {
      await api.dispatchTick();
      await refresh();
    } catch (error) {
      message.error(error instanceof Error ? error.message : '执行调度失败');
    }
  }, [api, refresh]);

  const handleReconcile = useCallback(async () => {
    try {
      await api.reconcile();
      await refresh();
    } catch (error) {
      message.error(error instanceof Error ? error.message : '执行恢复检查失败');
    }
  }, [api, refresh]);

  const activeOrphanedLeaseCount = leases.filter(
    (lease) => lease.status === 'active' || lease.status === 'orphaned',
  ).length;

  return (
    <Card title="Runner 调度池">
      <Space>
        <Button onClick={() => void refresh()}>刷新</Button>
        <Button onClick={() => void handleDispatch()}>调度一次</Button>
        <Button onClick={() => void handleReconcile()}>恢复检查</Button>
      </Space>
      <h3>Runner</h3>
      <List
        dataSource={runners}
        renderItem={(runner) => (
          <div>
            <strong>{runner.name}</strong> <Tag>{runner.kind}</Tag> <Tag>{runner.status}</Tag>
            <span>
              {runner.runningCount}/{runner.maxConcurrency}
            </span>
            <span>失败率 {Math.round(runner.recentFailureRate * 100)}%</span>
          </div>
        )}
      />
      <h3>队列</h3>
      <div>collect: {queue.filter((item) => item.taskType === 'collect').length}</div>
      <div>inspect: {queue.filter((item) => item.taskType === 'inspect').length}</div>
      <div>replay: {queue.filter((item) => item.taskType === 'replay').length}</div>
      <h3>Lease</h3>
      <div>{activeOrphanedLeaseCount} active / orphaned leases</div>
    </Card>
  );
}
