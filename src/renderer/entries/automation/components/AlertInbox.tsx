import { useEffect, useState } from 'react';
import { Button, Space, Tag } from 'antd';
import type { AlertActionRecord, AlertRecord } from '@shared/types';
import { useIpc } from '../../../shared/hooks';

export function AlertInbox() {
  const ipc = useIpc();
  const taskOperations = ipc.taskOperations;
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [actionsByAlertId, setActionsByAlertId] = useState<Record<string, AlertActionRecord[]>>({});

  useEffect(() => {
    if (!taskOperations?.listAlerts) {
      return;
    }

    let disposed = false;
    void taskOperations.listAlerts().then((items) => {
      if (!disposed) {
        const loadedAlerts = (items ?? []) as AlertRecord[];
        setAlerts(loadedAlerts);
        void Promise.all(
          loadedAlerts.map(async (alert) => {
            if (!taskOperations.listAlertActions) {
              return [alert.id, []] as const;
            }
            const actions = await taskOperations.listAlertActions(alert.id);
            return [alert.id, (actions ?? []) as AlertActionRecord[]] as const;
          }),
        ).then((entries) => {
          if (!disposed) {
            setActionsByAlertId(Object.fromEntries(entries));
          }
        });
      }
    });

    return () => {
      disposed = true;
    };
  }, [taskOperations]);

  const handleClaim = (alertId: string) => {
    if (!taskOperations?.claimAlert) {
      return;
    }

    void taskOperations.claimAlert(alertId).then((updated) => {
      setAlerts((current) =>
        current.map((item) => (item.id === alertId
          ? { ...item, ...(updated as Partial<AlertRecord>) }
          : item)),
      );
      void refreshActions(alertId);
    });
  };

  const refreshActions = (alertId: string) => {
    if (!taskOperations?.listAlertActions) {
      return Promise.resolve();
    }

    return taskOperations.listAlertActions(alertId).then((actions) => {
      setActionsByAlertId((current) => ({
        ...current,
        [alertId]: (actions ?? []) as AlertActionRecord[],
      }));
    });
  };

  const patchAlert = (alertId: string, updated: Partial<AlertRecord>) => {
    setAlerts((current) =>
      current.map((item) => (item.id === alertId ? { ...item, ...updated } : item)),
    );
  };

  const handleEscalate = (alertId: string) => {
    if (!taskOperations?.escalateAlert) {
      return;
    }

    void taskOperations.escalateAlert(alertId).then((updated) => {
      patchAlert(alertId, (updated ?? {}) as Partial<AlertRecord>);
      void refreshActions(alertId);
    });
  };

  const handleClose = (alertId: string) => {
    if (!taskOperations?.closeAlert) {
      return;
    }

    void taskOperations.closeAlert(alertId).then((updated) => {
      patchAlert(alertId, (updated ?? {}) as Partial<AlertRecord>);
      void refreshActions(alertId);
    });
  };

  const handleAssign = (alertId: string) => {
    if (!taskOperations?.assignAlert) {
      return;
    }

    void taskOperations.assignAlert(alertId).then((updated) => {
      patchAlert(alertId, (updated ?? {}) as Partial<AlertRecord>);
      void refreshActions(alertId);
    });
  };

  const handleNote = (alertId: string) => {
    if (!taskOperations?.addAlertNote) {
      return;
    }

    void taskOperations.addAlertNote(alertId).then(() => refreshActions(alertId));
  };

  return (
    <div className="yclaw-panel-card">
      <h3>告警值班</h3>
      <Space direction="vertical">
        {alerts.map((alert) => (
          <div key={alert.id}>
            <Space>
              <span>{alert.message}</span>
              {alert.level && <Tag>{alert.level}</Tag>}
              {alert.status && <Tag>{alert.status}</Tag>}
              <Button onClick={() => handleClaim(alert.id)}>认领</Button>
              <Button onClick={() => handleAssign(alert.id)}>转交</Button>
              <Button onClick={() => handleNote(alert.id)}>备注</Button>
              <Button onClick={() => handleEscalate(alert.id)}>升级</Button>
              <Button onClick={() => handleClose(alert.id)}>关闭</Button>
            </Space>
            {(actionsByAlertId[alert.id] ?? []).length > 0 && (
              <div>
                {(actionsByAlertId[alert.id] ?? []).map((action) => (
                  <div key={action.id}>
                    <span>{formatAction(action.action)}</span>
                    {action.operator && (
                      <>
                        <span> · </span>
                        <span>{action.operator}</span>
                      </>
                    )}
                    {action.note && (
                      <>
                        <span> · </span>
                        <span>{action.note}</span>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </Space>
    </div>
  );
}

function formatAction(action: AlertActionRecord['action']): string {
  const labels: Record<AlertActionRecord['action'], string> = {
    claim: '认领',
    assign: '转交',
    note: '备注',
    escalate: '升级',
    close: '关闭',
  };

  return labels[action] ?? action;
}
