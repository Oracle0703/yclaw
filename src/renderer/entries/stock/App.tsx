import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Checkbox, Col, Input, Row, Segmented, Skeleton, Space, Tag, Typography } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { ProCard } from '@ant-design/pro-components';
import { EVENTS, IPC_CHANNELS } from '@shared/constants';
import type { OHLCVData, IndicatorType, IndicatorResult } from '@shared/types';
import { PageShell } from '../../shared/components/PageShell';
import { useIpc, useIpcEvent } from '../../shared/hooks';
import './styles.css';

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

interface StockKpi {
  title: string;
  value: string;
  tone?: string;
}

export default function App() {
  const { invoke } = useIpc();
  const [symbol, setSymbol] = useState('AAPL');
  const [timeframe, setTimeframe] = useState('1D');
  const [data, setData] = useState<OHLCVData[]>([]);
  const [indicators, setIndicators] = useState<IndicatorResult[]>([]);
  const [activeIndicators, setActiveIndicators] = useState<IndicatorType[]>(['MA']);
  const [loading, setLoading] = useState(false);
  const [dataMode, setDataMode] = useState<'demo' | 'live'>('demo');
  const [error, setError] = useState<string | null>(null);
  const [indicatorWarning, setIndicatorWarning] = useState<string | null>(null);
  const activeIndicatorsRef = useRef<IndicatorType[]>(activeIndicators);
  const dataRequestSeqRef = useRef(0);
  const indicatorRequestSeqRef = useRef(0);

  const calculateIndicators = useCallback(
    async (
      series: OHLCVData[],
      nextIndicators: IndicatorType[],
      dataRequestSeq?: number,
    ) => {
      const indicatorRequestSeq = indicatorRequestSeqRef.current + 1;
      indicatorRequestSeqRef.current = indicatorRequestSeq;
      const settled = await Promise.allSettled(
        nextIndicators.map((type) =>
          invoke<IndicatorResult>(IPC_CHANNELS.STOCK_INDICATOR_CALC, {
            type,
            data: series,
          }),
        ),
      );

      const results: IndicatorResult[] = [];
      const failedTypes: IndicatorType[] = [];
      settled.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          results.push(result.value);
          return;
        }
        failedTypes.push(nextIndicators[index]);
      });

      if (indicatorRequestSeqRef.current !== indicatorRequestSeq) {
        return;
      }

      if (dataRequestSeq !== undefined && dataRequestSeqRef.current !== dataRequestSeq) {
        return;
      }

      setIndicators(results);
      setIndicatorWarning(
        failedTypes.length > 0
          ? `以下指标计算失败：${failedTypes.join('、')}`
          : null,
      );
    },
    [invoke],
  );

  useEffect(() => {
    activeIndicatorsRef.current = activeIndicators;
  }, [activeIndicators]);

  const fetchData = useCallback(async () => {
    const dataRequestSeq = dataRequestSeqRef.current + 1;
    dataRequestSeqRef.current = dataRequestSeq;
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<OHLCVData[]>(IPC_CHANNELS.STOCK_DATA, { symbol, timeframe });
      if (dataRequestSeqRef.current !== dataRequestSeq) {
        return;
      }
      setDataMode('demo');
      setData(result ?? []);
      await calculateIndicators(result ?? [], activeIndicatorsRef.current, dataRequestSeq);
    } catch (fetchError) {
      if (dataRequestSeqRef.current === dataRequestSeq) {
        setData([]);
        setIndicators([]);
        setError(fetchError instanceof Error ? fetchError.message : '获取股票数据失败');
      }
    } finally {
      if (dataRequestSeqRef.current === dataRequestSeq) {
        setLoading(false);
      }
    }
  }, [calculateIndicators, invoke, symbol, timeframe]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useIpcEvent(EVENTS.STOCK_DATA_UPDATE, (payload: unknown) => {
    const p = payload as { data: OHLCVData[]; source?: 'demo' | 'live' };
    if (p.data) {
      const dataRequestSeq = dataRequestSeqRef.current + 1;
      dataRequestSeqRef.current = dataRequestSeq;
      setData(p.data);
      setDataMode(p.source ?? 'live');
      setError(null);
      setLoading(false);
      void calculateIndicators(p.data, activeIndicators, dataRequestSeq);
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
  const stockKpis: StockKpi[] = [
    {
      title: '最新收盘价',
      value: typeof latest?.close === 'number' ? `${latest.close.toFixed(2)} USD` : '--',
    },
    {
      title: '涨跌额',
      value: priceChange.toFixed(2),
      tone: priceChange >= 0 ? '#16a34a' : '#dc2626',
    },
    {
      title: '涨跌幅',
      value: `${changeRate.toFixed(2)}%`,
      tone: changeRate >= 0 ? '#16a34a' : '#dc2626',
    },
  ] as const;

  return (
    <PageShell
      title="股票分析"
      subTitle="聚合行情、指标和策略观察位"
      content="以投研中台的方式组织数据筛选、指标开关和图表工作区，适合作为后续量化策略面板的基础壳层。"
      extra={
        <Space wrap className="yclaw-page-actions">
          <Tag color="processing">Market</Tag>
          <Tag color={dataMode === 'demo' ? 'warning' : 'success'}>
            {dataMode === 'demo' ? 'Demo Data' : 'Live Data'}
          </Tag>
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
        {dataMode === 'demo' && !error && (
          <Alert
            showIcon
            type="info"
            message="当前未配置真实数据源，正在展示内置演示 K 线数据。"
          />
        )}
        {error && (
          <Alert
            showIcon
            type="error"
            message="股票数据获取失败"
            description={error}
          />
        )}
        {indicatorWarning && !error && (
          <Alert
            showIcon
            type="warning"
            message={indicatorWarning}
          />
        )}
        <Row gutter={[16, 16]}>
          {stockKpis.map((item) => (
            <Col xs={24} md={8} key={item.title}>
              <ProCard className="yclaw-panel-card yclaw-kpi-card" bordered={false}>
                <div className="yclaw-kpi-card-head">
                  <Typography.Text type="secondary">{item.title}</Typography.Text>
                </div>
                <Typography.Title
                  level={3}
                  className="yclaw-kpi-card-value"
                  style={item.tone ? { color: item.tone } : undefined}
                >
                  {item.value}
                </Typography.Title>
              </ProCard>
            </Col>
          ))}
        </Row>

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
              {loading ? (
                <div className="kline-chart">
                  <Skeleton active paragraph={{ rows: 10 }} title={false} />
                </div>
              ) : (
                <KLineChart data={data} indicators={indicators} height={520} />
              )}
            </Suspense>
          </Space>
        </ProCard>
      </Space>
    </PageShell>
  );
}
