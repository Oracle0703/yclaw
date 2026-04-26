import { useCallback, useEffect, useState } from 'react';
import { Button, Input, Space, Table, message } from 'antd';
import { ProCard } from '@ant-design/pro-components';
import type { DataWebhookTarget } from '@shared/types';
import { useIpc } from '@renderer/shared/hooks';

export function WebhookTargetPanel() {
  const { dataCenter } = useIpc();
  const [targets, setTargets] = useState<DataWebhookTarget[]>([]);
  const [name, setName] = useState('默认回调');
  const [url, setUrl] = useState('http://127.0.0.1:3000/hook');
  const [secret, setSecret] = useState('');

  const loadTargets = useCallback(async () => {
    const value = await dataCenter.listWebhookTargets();
    setTargets((value as DataWebhookTarget[]) ?? []);
  }, [dataCenter]);

  useEffect(() => {
    void loadTargets();
  }, [loadTargets]);

  const saveTarget = async () => {
    try {
      await dataCenter.saveWebhookTarget({
        id: createWebhookTargetId(),
        name,
        url,
        headers: { 'x-source': 'yclaw' },
        secret,
        enabled: true,
        timeoutMs: 10000,
        maxRetries: 3,
      });
      message.success('Webhook 目标已保存');
      await loadTargets();
    } catch (error) {
      message.error(error instanceof Error ? error.message : '保存 Webhook 失败');
    }
  };

  const testTarget = async (target: Pick<DataWebhookTarget, 'id' | 'name' | 'url' | 'headers' | 'timeoutMs' | 'maxRetries'>) => {
    try {
      await dataCenter.testWebhookTarget({
        ...target,
        secret,
        enabled: true,
      });
      message.success('Webhook 连通性测试成功');
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Webhook 测试失败');
    }
  };

  const editTarget = (target: DataWebhookTarget) => {
    setName(target.name);
    setUrl(target.url);
    setSecret('');
  };

  const deleteTarget = async (targetId: string) => {
    try {
      await dataCenter.deleteWebhookTarget(targetId);
      message.success('Webhook 目标已删除');
      await loadTargets();
    } catch (error) {
      message.error(error instanceof Error ? error.message : '删除 Webhook 失败');
    }
  };

  return (
    <ProCard
      title="Webhook 目标"
      className="yclaw-panel-card"
      extra={
        <Space wrap>
          <Input placeholder="Webhook 名称" value={name} onChange={(event) => setName(event.target.value)} />
          <Input placeholder="Webhook URL" value={url} onChange={(event) => setUrl(event.target.value)} />
          <Input placeholder="签名密钥" value={secret} onChange={(event) => setSecret(event.target.value)} />
          <Button type="primary" onClick={() => void saveTarget()} disabled={!name.trim() || !url.trim()}>
            保存 Webhook
          </Button>
        </Space>
      }
    >
      <Table
        rowKey="id"
        pagination={false}
        dataSource={targets}
        columns={[
          { title: '名称', dataIndex: 'name' },
          { title: 'URL', dataIndex: 'url' },
          { title: '状态', render: (_, record: DataWebhookTarget) => (record.enabled ? '启用' : '停用') },
          {
            title: '操作',
            render: (_, record: DataWebhookTarget) => (
              <Space>
                <Button type="link" onClick={() => editTarget(record)}>
                  编辑 Webhook
                </Button>
                <Button type="link" onClick={() => void testTarget(record)}>
                  测试连通性
                </Button>
                <Button type="link" onClick={() => void deleteTarget(record.id)}>
                  删除 Webhook
                </Button>
              </Space>
            ),
          },
        ]}
      />
    </ProCard>
  );
}

function createWebhookTargetId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `webhook-${Date.now()}`;
}
