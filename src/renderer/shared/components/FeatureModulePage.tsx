import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Result, Space, Tag, Typography } from 'antd';
import { AppstoreAddOutlined, CloudDownloadOutlined, LinkOutlined } from '@ant-design/icons';
import type { FeaturePackageCatalogItem } from '@shared/types';
import { IPC_CHANNELS } from '@shared/constants';
import { useIpc } from '../hooks/useIpc';

interface FeatureModulePageProps {
  moduleId: string;
  title: string;
  description: string;
}

function isDevelopmentRenderer(): boolean {
  const meta = import.meta as ImportMeta & { env?: { DEV?: boolean } };
  return Boolean(meta.env?.DEV);
}

export function FeatureModulePage({ moduleId, title, description }: FeatureModulePageProps) {
  const { invoke, featurePackages } = useIpc();
  const [catalogItem, setCatalogItem] = useState<FeaturePackageCatalogItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestSeqRef = useRef(0);

  const isDevelopment = isDevelopmentRenderer();
  const canOpen = useMemo(
    () => isDevelopment || Boolean(catalogItem?.installed),
    [catalogItem?.installed, isDevelopment],
  );

  const refresh = useCallback(async () => {
    const requestSeq = requestSeqRef.current + 1;
    requestSeqRef.current = requestSeq;
    setLoading(true);
    setError(null);

    try {
      const packages = await featurePackages.listPackages();
      if (requestSeqRef.current === requestSeq) {
        setCatalogItem(packages.find((item) => item.module === moduleId) ?? null);
      }
    } catch (err) {
      if (requestSeqRef.current === requestSeq) {
        setError(err instanceof Error ? err.message : '读取功能包状态失败');
      }
    } finally {
      if (requestSeqRef.current === requestSeq) {
        setLoading(false);
      }
    }
  }, [featurePackages, moduleId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const openModuleWindow = async () => {
    try {
      setError(null);
      await invoke(IPC_CHANNELS.WINDOW_OPEN, { module: moduleId });
    } catch (err) {
      setError(err instanceof Error ? err.message : '打开模块失败');
    }
  };

  const handleInstall = async () => {
    setInstalling(true);
    setError(null);

    try {
      await featurePackages.installPackage(catalogItem?.id ?? moduleId);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '安装功能包失败');
    } finally {
      setInstalling(false);
    }
  };

  if (loading) {
    return (
      <Result
        status="info"
        title={`正在检查 ${title} 功能包`}
        subTitle="读取本地安装状态和可用清单。"
      />
    );
  }

  return (
    <Result
      icon={<AppstoreAddOutlined />}
      title={title}
      subTitle={description}
      extra={
        <Space direction="vertical" size={16} style={{ width: '100%', maxWidth: 560 }}>
          <Space wrap>
            <Tag color={canOpen ? 'success' : 'warning'}>
              {canOpen ? '可启动' : '需先安装功能包'}
            </Tag>
            {catalogItem?.version ? <Tag>版本 {catalogItem.version}</Tag> : null}
            {isDevelopment ? <Tag color="processing">开发模式</Tag> : null}
          </Space>

          {error ? <Alert type="error" message={error} showIcon /> : null}

          {!canOpen ? (
            <Alert
              type="info"
              showIcon
              message="当前核心包未内置该模块"
              description="安装后会以独立窗口方式打开模块，避免把重型图表、自动化编辑器和插件管理界面打进首包。"
            />
          ) : null}

          <Typography.Paragraph style={{ marginBottom: 0 }}>
            {canOpen
              ? '模块内容会在独立窗口中启动，工作台只保留安装、状态检查和跳转入口。'
              : '如果你使用的是精简核心包，请先安装功能包；如果是完整包，确认资源目录是否已经同步。'}
          </Typography.Paragraph>

          <Space wrap>
            <Button
              type="primary"
              icon={<LinkOutlined />}
              onClick={() => void openModuleWindow()}
              disabled={!canOpen}
            >
              打开模块窗口
            </Button>
            <Button
              icon={<CloudDownloadOutlined />}
              loading={installing}
              onClick={() => void handleInstall()}
              disabled={canOpen && !catalogItem}
            >
              安装功能包
            </Button>
            <Button onClick={() => void refresh()}>刷新状态</Button>
          </Space>
        </Space>
      }
    />
  );
}
