/**
 * 数据分析引擎 — 类型定义
 */
import type { OHLCVData, IndicatorType, IndicatorResult } from '@shared/types';

export interface DataSourceConnection {
  id: string;
  type: 'rest' | 'websocket';
  url: string;
  connected: boolean;
}

export interface IndicatorCalculation {
  type: IndicatorType;
  input: OHLCVData[];
  params: Record<string, number>;
  result: IndicatorResult;
}
