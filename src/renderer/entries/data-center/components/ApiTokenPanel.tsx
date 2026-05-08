import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Input, Space, Table, Typography, message } from 'antd';
import { ProCard } from '@ant-design/pro-components';
import type { DataApiToken } from '@shared/types';
import type { DataCenterApiTokenIssueResponse } from '@shared/types/ipc';
import { useIpc } from '@renderer/shared/hooks';

export function ApiTokenPanel() {
  const { dataCenter } = useIpc();
  const [tokens, setTokens] = useState<DataApiToken[]>([]);
  const [name, setName] = useState('只读 Token');
  const [scopesText, setScopesText] = useState('results:read,datasets:read,exports:read');
  const [issuedToken, setIssuedToken] = useState<string | null>(null);

  const loadTokens = useCallback(async () => {
    const value = await dataCenter.listApiTokens();
    setTokens((value as DataApiToken[]) ?? []);
  }, [dataCenter]);

  useEffect(() => {
    void loadTokens();
  }, [loadTokens]);

  const createToken = async () => {
    try {
      const issued = (await dataCenter.createApiToken({
        name,
        scopes: scopesText
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
      })) as DataCenterApiTokenIssueResponse;
      setIssuedToken(issued.plainTextToken);
      message.success('API Token 已生成');
      await loadTokens();
    } catch (error) {
      message.error(error instanceof Error ? error.message : '生成 API Token 失败');
    }
  };

  const useReadonlyTemplate = () => {
    setScopesText('results:read,datasets:read,exports:read');
  };

  const useOpsTemplate = () => {
    setScopesText('results:read,datasets:read,exports:read,webhooks:write');
  };

  const revokeToken = async (tokenId: string) => {
    try {
      await dataCenter.revokeApiToken(tokenId);
      message.success('API Token 已吊销');
      await loadTokens();
    } catch (error) {
      message.error(error instanceof Error ? error.message : '吊销 API Token 失败');
    }
  };

  return (
    <ProCard
      title="API Token"
      className="yclaw-panel-card"
      extra={
        <Space wrap>
          <Input placeholder="Token 名称" value={name} onChange={(event) => setName(event.target.value)} />
          <Input
            placeholder="Scopes，逗号分隔"
            value={scopesText}
            onChange={(event) => setScopesText(event.target.value)}
          />
          <Button onClick={useReadonlyTemplate}>只读模板</Button>
          <Button onClick={useOpsTemplate}>运营模板</Button>
          <Button type="primary" onClick={() => void createToken()} disabled={!name.trim()}>
            生成 Token
          </Button>
        </Space>
      }
    >
      {issuedToken ? (
        <Alert
          type="success"
          message="Token 已生成，请立即保存"
          description={<Typography.Text>{issuedToken}</Typography.Text>}
        />
      ) : null}
      <Table
        rowKey="id"
        pagination={false}
        dataSource={tokens}
        columns={[
          { title: '名称', dataIndex: 'name' },
          { title: 'Scopes', render: (_, record: DataApiToken) => record.scopes.join(', ') },
          { title: '最后使用', render: (_, record: DataApiToken) => record.lastUsedAt ?? '-' },
          {
            title: '操作',
            render: (_, record: DataApiToken) =>
              record.enabled ? (
                <Button type="link" onClick={() => void revokeToken(record.id)}>
                  吊销 Token
                </Button>
              ) : (
                '已吊销'
              ),
          },
        ]}
      />
    </ProCard>
  );
}
