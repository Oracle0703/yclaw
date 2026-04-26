import { useCallback, useEffect, useState } from 'react';
import { Button, Input, Space, Switch, Table, message } from 'antd';
import { ProCard } from '@ant-design/pro-components';
import type { DataDataset } from '@shared/types';
import { useIpc } from '@renderer/shared/hooks';

export function DatasetPanel() {
  const { dataCenter } = useIpc();
  const [datasets, setDatasets] = useState<DataDataset[]>([]);
  const [name, setName] = useState('默认结果数据集');
  const [apiEnabled, setApiEnabled] = useState(false);

  const loadDatasets = useCallback(async () => {
    const value = await dataCenter.listDatasets();
    setDatasets((value as DataDataset[]) ?? []);
  }, [dataCenter]);

  useEffect(() => {
    void loadDatasets();
  }, [loadDatasets]);

  const saveDataset = async () => {
    try {
      await dataCenter.saveDataset({
        id: createDatasetId(),
        name,
        query: { page: 1, pageSize: 50 },
        defaultFormat: 'jsonl',
        apiEnabled,
      });
      message.success('数据集已保存');
      await loadDatasets();
    } catch (error) {
      message.error(error instanceof Error ? error.message : '保存数据集失败');
    }
  };

  return (
    <ProCard
      title="数据集"
      className="yclaw-panel-card"
      extra={
        <Space wrap>
          <Input
            placeholder="数据集名称"
            value={name}
            onChange={(event) => setName(event.target.value)}
            style={{ width: 180 }}
          />
          <Switch
            checked={apiEnabled}
            checkedChildren="API"
            unCheckedChildren="私有"
            onChange={setApiEnabled}
          />
          <Button type="primary" onClick={() => void saveDataset()} disabled={!name.trim()}>
            保存数据集
          </Button>
        </Space>
      }
    >
      <Table
        rowKey="id"
        pagination={false}
        dataSource={datasets}
        columns={[
          { title: '名称', dataIndex: 'name' },
          { title: '默认格式', dataIndex: 'defaultFormat' },
          {
            title: 'API',
            render: (_, record: DataDataset) => (record.apiEnabled ? '已开放' : '未开放'),
          },
        ]}
      />
    </ProCard>
  );
}

function createDatasetId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `dataset-${Date.now()}`;
}
