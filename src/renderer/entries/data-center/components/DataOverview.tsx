import { useEffect, useState } from 'react';
import { Space, Statistic } from 'antd';
import { ProCard } from '@ant-design/pro-components';
import type { DataCenterOverview } from '@shared/types';
import { useIpc } from '@renderer/shared/hooks';

export function DataOverview() {
  const { dataCenter } = useIpc();
  const [overview, setOverview] = useState<DataCenterOverview>({
    totalResults: 0,
    suspiciousResults: 0,
    failedExports: 0,
    recentExports: [],
  });

  useEffect(() => {
    void dataCenter.getOverview().then((value) => {
      setOverview((value as DataCenterOverview) ?? overview);
    });
  }, [dataCenter]);

  return (
    <ProCard title="数据总览" className="yclaw-panel-card">
      <Space size="large">
        <Statistic title="结果总数" value={overview.totalResults} />
        <Statistic title="可疑数据" value={overview.suspiciousResults} />
        <Statistic title="失败导出" value={overview.failedExports} />
      </Space>
    </ProCard>
  );
}
