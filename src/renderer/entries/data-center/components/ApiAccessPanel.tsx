import { useEffect, useState } from 'react';
import { Alert, Button, Space, message } from 'antd';
import { ProCard } from '@ant-design/pro-components';
import type { DataCenterApiStatusResponse } from '@shared/types/ipc';
import { useIpc } from '@renderer/shared/hooks';
import { ApiTokenPanel } from './ApiTokenPanel';

export function ApiAccessPanel() {
  const { dataCenter } = useIpc();
  const [status, setStatus] = useState<DataCenterApiStatusResponse>({ running: false });

  useEffect(() => {
    void dataCenter.getApiStatus().then((value) => {
      setStatus((value as DataCenterApiStatusResponse) ?? { running: false });
    });
  }, [dataCenter]);

  const startApi = async () => {
    try {
      const next = (await dataCenter.startApi({ host: '127.0.0.1', port: 3941 })) as DataCenterApiStatusResponse;
      setStatus(next);
      message.success('本地 API 已启动');
    } catch (error) {
      message.error(error instanceof Error ? error.message : '启动本地 API 失败');
    }
  };

  const stopApi = async () => {
    try {
      const next = (await dataCenter.stopApi()) as DataCenterApiStatusResponse;
      setStatus(next);
      message.success('本地 API 已停止');
    } catch (error) {
      message.error(error instanceof Error ? error.message : '停止本地 API 失败');
    }
  };

  return (
    <>
      <ProCard
        title="开放接口"
        className="yclaw-panel-card"
        extra={
          <Space>
            <Button type="primary" disabled={status.running} onClick={() => void startApi()}>
              启动 API
            </Button>
            <Button disabled={!status.running} onClick={() => void stopApi()}>
              停止 API
            </Button>
          </Space>
        }
      >
        <Alert
          type={status.running ? 'success' : 'info'}
          message={status.running ? '本地 API 已运行' : '本地 API 未启动'}
          description={
            status.running
              ? `http://${status.host}:${status.port}/results · /datasets · /exports`
              : '启动后提供本机只读 results / datasets / exports 接口'
          }
        />
      </ProCard>
      <ApiTokenPanel />
    </>
  );
}
