import React, { useState, useEffect, useCallback } from 'react';
import { KLineChart } from './components/KLineChart';
import { useIpc, useIpcEvent } from '../../shared/hooks';
import { IPC_CHANNELS } from '@shared/constants/channels';
import type { OHLCVData, IndicatorType, IndicatorResult } from '@shared/types';
import '../../shared/styles/globals.css';

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

  const fetchData = useCallback(async () => {
    try {
      const result = await invoke<OHLCVData[]>(IPC_CHANNELS.STOCK_DATA, { symbol, timeframe });
      if (result) setData(result);
    } catch { /* ignore */ }
  }, [invoke, symbol, timeframe]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useIpcEvent('stock:data:update', (payload: unknown) => {
    const p = payload as { data: OHLCVData[] };
    if (p.data) setData(p.data);
  });

  const toggleIndicator = async (type: IndicatorType) => {
    const next = activeIndicators.includes(type)
      ? activeIndicators.filter((t) => t !== type)
      : [...activeIndicators, type];
    setActiveIndicators(next);

    const results: IndicatorResult[] = [];
    for (const t of next) {
      try {
        const res = await invoke<IndicatorResult>(IPC_CHANNELS.STOCK_INDICATOR_CALC, { type: t, data });
        if (res) results.push(res);
      } catch { /* ignore */ }
    }
    setIndicators(results);
  };

  return (
    <div className="app stock-app">
      <header className="stock-header">
        <h1>📈 股票分析</h1>
        <div className="stock-controls">
          <input
            className="symbol-input"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && fetchData()}
            placeholder="股票代码"
          />
          <div className="timeframe-group">
            {TIMEFRAMES.map((tf) => (
              <button key={tf} className={timeframe === tf ? 'active' : ''} onClick={() => setTimeframe(tf)}>
                {tf}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="indicator-bar">
        {INDICATORS.map(({ type, label }) => (
          <button
            key={type}
            className={activeIndicators.includes(type) ? 'active' : ''}
            onClick={() => toggleIndicator(type)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="chart-container">
        <KLineChart data={data} indicators={indicators} width={960} height={480} />
      </div>
    </div>
  );
}
