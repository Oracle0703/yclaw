import { useCallback, useEffect, useState } from 'react';
import { Button, Input, Modal, Select, Space, Table, Tag, message } from 'antd';
import { ProCard } from '@ant-design/pro-components';
import type { DataExportJob, DataPage } from '@shared/types';
import { useIpc } from '@renderer/shared/hooks';

export function ExportJobTable() {
  const { dataCenter } = useIpc();
  const [jobs, setJobs] = useState<DataExportJob[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('手动导出任务');
  const [targetType, setTargetType] = useState<'file' | 'webhook' | 'local-api'>('file');
  const [format, setFormat] = useState<'csv' | 'json' | 'jsonl'>('jsonl');
  const [status, setStatus] = useState<DataExportJob['status'] | undefined>(undefined);

  const loadJobs = useCallback(async () => {
    const value = await dataCenter.listExports({ page: 1, pageSize: 20, status });
    setJobs(((value as DataPage<DataExportJob>)?.items ?? []) as DataExportJob[]);
  }, [dataCenter, status]);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  const retryJob = async (jobId: string) => {
    try {
      await dataCenter.retryExport(jobId);
      message.success('已重新下发导出任务');
      await loadJobs();
    } catch (error) {
      message.error(error instanceof Error ? error.message : '重试导出失败');
    }
  };

  const createExport = async () => {
    try {
      await dataCenter.createExport({
        name,
        query: { page: 1, pageSize: 200 },
        targetType,
        targetConfig:
          targetType === 'webhook'
            ? { url: 'http://127.0.0.1:3000/hook' }
            : {},
        format,
      });
      message.success('导出任务已创建');
      setCreateOpen(false);
      await loadJobs();
    } catch (error) {
      message.error(error instanceof Error ? error.message : '创建导出任务失败');
    }
  };

  const cancelJob = async (jobId: string) => {
    try {
      await dataCenter.cancelExport(jobId);
      message.success('导出任务已取消');
      await loadJobs();
    } catch (error) {
      message.error(error instanceof Error ? error.message : '取消导出任务失败');
    }
  };

  return (
    <ProCard
      title="导出任务"
      className="yclaw-panel-card"
      extra={
        <Space wrap>
          <Button onClick={() => setStatus(undefined)}>全部状态</Button>
          <Button onClick={() => setStatus('failed')}>失败状态</Button>
          <Button type="primary" onClick={() => setCreateOpen(true)}>
            新建导出
          </Button>
        </Space>
      }
    >
      <Table
        rowKey="id"
        pagination={false}
        dataSource={jobs}
        columns={[
          { title: '任务名', dataIndex: 'name' },
          { title: '格式', dataIndex: 'format' },
          { title: '状态', render: (_, record: DataExportJob) => <Tag>{record.status}</Tag> },
          {
            title: '操作',
            render: (_, record: DataExportJob) => {
              if (record.status === 'failed') {
                return (
                  <Button type="link" onClick={() => void retryJob(record.id)}>
                    重试
                  </Button>
                );
              }

              if (record.status === 'pending' || record.status === 'running' || record.status === 'retrying') {
                return (
                  <Button type="link" onClick={() => void cancelJob(record.id)}>
                    取消任务
                  </Button>
                );
              }

              return '-';
            },
          },
        ]}
      />
      <Modal
        title="新建导出"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={() => void createExport()}
      >
        <Space direction="vertical">
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="导出任务名称" />
          <Select
            value={targetType}
            onChange={(value) => setTargetType(value)}
            options={[
              { label: '文件', value: 'file' },
              { label: 'Webhook', value: 'webhook' },
              { label: '本地 API', value: 'local-api' },
            ]}
          />
          <Select
            value={format}
            onChange={(value) => setFormat(value)}
            options={[
              { label: 'CSV', value: 'csv' },
              { label: 'JSON', value: 'json' },
              { label: 'JSONL', value: 'jsonl' },
            ]}
          />
        </Space>
      </Modal>
    </ProCard>
  );
}
