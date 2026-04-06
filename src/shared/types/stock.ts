/**
 * 股票数据类型定义
 */

/** OHLCV K 线数据 */
export interface OHLCVData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/** 数据源配置 */
export interface DataSourceConfig {
  id: string;
  name: string;
  type: 'rest' | 'websocket';
  url: string;
  auth?: {
    type: 'apikey' | 'bearer';
    value: string;
  };
  requestFormat?: Record<string, unknown>;
}

/** 指标类型 */
export type IndicatorType = 'MA' | 'MACD' | 'RSI' | 'BOLL';

/** 指标计算参数 */
export interface IndicatorParams {
  type: IndicatorType;
  period?: number;
  params?: Record<string, number>;
}

/** 指标计算结果 */
export interface IndicatorResult {
  type: IndicatorType;
  values: number[];
  extra?: Record<string, number[]>;
}
