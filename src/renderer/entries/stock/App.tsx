import { Suspense, lazy, useEffect, useState } from 'react';
import { Checkbox, Col, Input, Row, Segmented, Skeleton, Space, Tag, Typography } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { ProCard, StatisticCard } from '@ant-design/pro-components';
import { IPC_CHANNELS } from '@shared/constants/channels';
import type { OHLCVData, IndicatorType, IndicatorResult } from '@shared/types';
import { AdminPageLayout } from '../../shared/components/AdminPageLayout';
import { useIpc, useIpcEvent } from '../../shared/hooks';

const KLineChart = lazy(async () => {
  const module = await import('./components/KLineChart');
  return { default: module.KLineChart };
});

const TIMEFRAMES = ['1m', '5m', '15m', '1h', '1D', '1W'] as const;
const INDICATORS: { type: IndicatorType; label: string }[] = [
  { type: 'MA', label: 'MA(20)' },
  { type: 'MACD', label: 'MACD' },
  { type: 'RSI', label: 'RSI(14)' },
  { type: 'BOLL', label: 'BOLL(20)' },
];

export default function App() {
  const { invoke } = useIpc();
  const [symbol, setSymbol] = useState('AAPL');
  const [timeframe, setTimeframe] = useState('1D');
  const [data, setData] = useState<OHLCVData[]>([]);
  const [indicators, setIndicators] = useState<IndicatorResult[]>([]);
  const [activeIndicators, setActiveIndicators] = useState<IndicatorType[]>(['MA']);

  const calculateIndicators = async (series: OHLCVData[], nextIndicators: IndicatorType[]) => {
    const results: IndicatorResult[] = [];
    for (const type of nextIndicators) {
      try {
        const result = await invoke<IndicatorResult>(IPC_CHANNELS.STOCK_INDICATOR_CALC, {
          type,
          data: series,
        });
        if (result) {
          results.push(result);
        }
      } catch {
        // ignore indicator calculation errors for the demo dashboard
      }
    }
    setIndicators(results);
  };

  const fetchData = async () => {
    try {
      const result = await invoke<OHLCVData[]>(IPC_CHANNELS.STOCK_DATA, { symbol, timeframe });
      if (result) {
        setData(result);
        await calculateIndicators(result, activeIndicators);
      }
    } catch {
      // ignore fetch errors for the demo dashboard
    }
  };

  useEffect(() => {
    void fetchData();
  }, [symbol, timeframe]);

  useIpcEvent('stock:data:update', (payload: unknown) => {
    const p = payload as { data: OHLCVData[] };
    if (p.data) {
      setData(p.data);
      void calculateIndicators(p.data, activeIndicators);
    }
  });

  const changeIndicators = async (nextValues: IndicatorType[]) => {
    setActiveIndicators(nextValues);
    await calculateIndicators(data, nextValues);
  };

  const latest = data[data.length - 1];
  const previous = data[data.length - 2];
  const priceChange = latest && previous ? latest.close - previous.close : 0;
  const changeRate = latest && previous ? (priceChange / previous.close) * 100 : 0;

  return (
    <AdminPageLayout
      currentPath="/stock"
      title="股票分析"
      subTitle="聚合行情、指标和策略观察位"
      content="以投研中台的方式组织数据筛选、指标开关和图表工作区，适合作为后续量化策略面板的基础壳层。"
      extra={
        <Space>
          <Tag color="processing">Market Desk</Tag>
          <Input
            prefix={<SearchOutlined />}
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            onPressEnter={() => void fetchData()}
            placeholder="股票代码"
            style={{ width: 180 }}
          />
        </Space>
      }
    >
      <Space direction="vertical" size={20} style={{ width: '100%' }}>
        <StatisticCard.Group direction="row">
          <StatisticCard
            className="yclaw-panel-card"
            statistic={{
              title: '最新收盘价',
              value: latest?.close ?? '--',
              precision: typeof latest?.close === 'number' ? 2 : undefined,
              suffix: 'USD',
            }}
          />
          <StatisticCard
            className="yclaw-panel-card"
            statistic={{
              title: '涨跌额',
              value: priceChange,
              precision: 2,
              valueStyle: { color: priceChange >= 0 ? '#16a34a' : '#dc2626' },
            }}
          />
          <StatisticCard
            className="yclaw-panel-card"
            statistic={{
              title: '涨跌幅',
              value: changeRate,
              precision: 2,
              suffix: '%',
              valueStyle: { color: changeRate >= 0 ? '#16a34a' : '#dc2626' },
            }}
          />
        </StatisticCard.Group>

        <ProCard className="yclaw-panel-card" title="行情工作区">
          <Space direction="vertical" size={20} style={{ width: '100%' }}>
            <Row gutter={[16, 16]}>
              <Col xs={24} lg={12}>
                <Typography.Text type="secondary">时间粒度</Typography.Text>
                <div style={{ marginTop: 8 }}>
                  <Segmented
                    block
                    options={TIMEFRAMES.map((item) => ({ label: item, value: item }))}
                    value={timeframe}
                    onChange={(value) => setTimeframe(String(value))}
                  />
                </div>
              </Col>
              <Col xs={24} lg={12}>
                <Typography.Text type="secondary">技术指标</Typography.Text>
                <div style={{ marginTop: 8 }}>
                  <Checkbox.Group
                    options={INDICATORS.map((item) => ({ label: item.label, value: item.type }))}
                    value={activeIndicators}
                    onChange={(values) => {
                      void changeIndicators(values as IndicatorType[]);
                    }}
                  />
                </div>
              </Col>
            </Row>
            <Suspense
              fallback={
                <div className="kline-chart">
                  <Skeleton active paragraph={{ rows: 10 }} title={false} />
                </div>
              }
            >
              <KLineChart data={data} indicators={indicators} width={1100} height={520} />
            </Suspense>
          </Space>
        </ProCard>
      </Space>
    </AdminPageLayout>
  );
}
