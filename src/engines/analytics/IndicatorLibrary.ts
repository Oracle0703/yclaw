import type { OHLCVData, IndicatorType, IndicatorResult } from '@shared/types';

/**
 * 技术指标计算库
 * V1.0 支持 MA / MACD / RSI
 */
export class IndicatorLibrary {
  /**
   * 统一计算接口
   */
  calculate(
    type: IndicatorType,
    data: OHLCVData[],
    params: Record<string, number> = {},
  ): IndicatorResult {
    switch (type) {
      case 'MA':
        return this.calculateMA(data, params.period ?? 20);
      case 'MACD':
        return this.calculateMACD(
          data,
          params.fast ?? 12,
          params.slow ?? 26,
          params.signal ?? 9,
        );
      case 'RSI':
        return this.calculateRSI(data, params.period ?? 14);
      case 'BOLL':
        return this.calculateBOLL(data, params.period ?? 20, params.stdDev ?? 2);
      default:
        throw new Error(`Unsupported indicator type: ${type}`);
    }
  }

  /**
   * 移动平均线 (MA)
   */
  calculateMA(data: OHLCVData[], period: number): IndicatorResult {
    const closes = data.map((d) => d.close);
    const values: number[] = new Array(closes.length).fill(NaN);

    for (let i = period - 1; i < closes.length; i++) {
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) {
        sum += closes[j];
      }
      values[i] = sum / period;
    }

    return { type: 'MA', values };
  }

  /**
   * MACD (12/26/9 默认)
   */
  calculateMACD(
    data: OHLCVData[],
    fastPeriod: number,
    slowPeriod: number,
    signalPeriod: number,
  ): IndicatorResult {
    const closes = data.map((d) => d.close);
    const fastEMA = this.ema(closes, fastPeriod);
    const slowEMA = this.ema(closes, slowPeriod);

    // DIF = fast EMA - slow EMA
    const dif: number[] = fastEMA.map((val, i) => val - slowEMA[i]);

    // DEA = EMA of DIF
    const dea = this.ema(dif, signalPeriod);

    // Histogram = 2 * (DIF - DEA)
    const histogram: number[] = dif.map((val, i) => 2 * (val - dea[i]));

    return {
      type: 'MACD',
      values: dif,
      extra: { dea, histogram },
    };
  }

  /**
   * RSI (Relative Strength Index)
   */
  calculateRSI(data: OHLCVData[], period: number): IndicatorResult {
    const closes = data.map((d) => d.close);
    const values: number[] = new Array(closes.length).fill(NaN);

    if (closes.length < period + 1) return { type: 'RSI', values };

    // 计算价格变动
    const changes: number[] = [];
    for (let i = 1; i < closes.length; i++) {
      changes.push(closes[i] - closes[i - 1]);
    }

    // 初始平均涨跌
    let avgGain = 0;
    let avgLoss = 0;
    for (let i = 0; i < period; i++) {
      if (changes[i] > 0) avgGain += changes[i];
      else avgLoss += Math.abs(changes[i]);
    }
    avgGain /= period;
    avgLoss /= period;

    values[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

    // 滚动计算
    for (let i = period; i < changes.length; i++) {
      const gain = changes[i] > 0 ? changes[i] : 0;
      const loss = changes[i] < 0 ? Math.abs(changes[i]) : 0;
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
      values[i + 1] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    }

    return { type: 'RSI', values };
  }

  /**
   * 布林带 (BOLL)
   */
  calculateBOLL(data: OHLCVData[], period: number, stdDev: number): IndicatorResult {
    const closes = data.map((d) => d.close);
    const middle: number[] = new Array(closes.length).fill(NaN);
    const upper: number[] = new Array(closes.length).fill(NaN);
    const lower: number[] = new Array(closes.length).fill(NaN);

    for (let i = period - 1; i < closes.length; i++) {
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) {
        sum += closes[j];
      }
      const mean = sum / period;

      let sqSum = 0;
      for (let j = i - period + 1; j <= i; j++) {
        sqSum += (closes[j] - mean) ** 2;
      }
      const std = Math.sqrt(sqSum / period);

      middle[i] = mean;
      upper[i] = mean + stdDev * std;
      lower[i] = mean - stdDev * std;
    }

    return {
      type: 'BOLL',
      values: middle,
      extra: { upper, lower },
    };
  }

  /**
   * 指数移动平均 (EMA) 辅助
   */
  private ema(data: number[], period: number): number[] {
    const result: number[] = new Array(data.length).fill(NaN);
    const k = 2 / (period + 1);

    // 第一个有效值用 SMA 初始化
    let sum = 0;
    for (let i = 0; i < period && i < data.length; i++) {
      sum += isNaN(data[i]) ? 0 : data[i];
    }
    if (period <= data.length) {
      result[period - 1] = sum / period;
    }

    for (let i = period; i < data.length; i++) {
      const prev = result[i - 1];
      const val = isNaN(data[i]) ? 0 : data[i];
      result[i] = isNaN(prev) ? val : val * k + prev * (1 - k);
    }

    return result;
  }
}
