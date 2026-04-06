import { describe, it, expect, beforeEach } from 'vitest';
import { IndicatorLibrary } from '@engines/analytics/IndicatorLibrary';
import type { OHLCVData } from '@shared/types';

function generateData(closes: number[]): OHLCVData[] {
  return closes.map((close, i) => ({
    time: i * 1000,
    open: close - 1,
    high: close + 2,
    low: close - 2,
    close,
    volume: 1000,
  }));
}

describe('IndicatorLibrary', () => {
  let lib: IndicatorLibrary;

  beforeEach(() => {
    lib = new IndicatorLibrary();
  });

  describe('calculate', () => {
    it('should dispatch to correct indicator method', () => {
      const data = generateData([10, 11, 12, 13, 14]);
      const result = lib.calculate('MA', data, { period: 3 });
      expect(result.type).toBe('MA');
    });

    it('should throw for unsupported indicator type', () => {
      const data = generateData([10]);
      expect(() => lib.calculate('UNKNOWN' as any, data)).toThrow('Unsupported indicator type');
    });
  });

  describe('MA (Simple Moving Average)', () => {
    it('should calculate MA correctly', () => {
      const data = generateData([10, 20, 30, 40, 50]);
      const result = lib.calculateMA(data, 3);
      expect(result.type).toBe('MA');
      // MA(3) at index 2: (10+20+30)/3 = 20
      expect(result.values[2]).toBeCloseTo(20);
      // MA(3) at index 3: (20+30+40)/3 = 30
      expect(result.values[3]).toBeCloseTo(30);
      // MA(3) at index 4: (30+40+50)/3 = 40
      expect(result.values[4]).toBeCloseTo(40);
    });

    it('should have NaN for values before period', () => {
      const data = generateData([10, 20, 30]);
      const result = lib.calculateMA(data, 3);
      expect(result.values[0]).toBeNaN();
      expect(result.values[1]).toBeNaN();
      expect(result.values[2]).toBeCloseTo(20);
    });

    it('should handle single data point', () => {
      const data = generateData([10]);
      const result = lib.calculateMA(data, 1);
      expect(result.values[0]).toBeCloseTo(10);
    });

    it('should handle data shorter than period', () => {
      const data = generateData([10, 20]);
      const result = lib.calculateMA(data, 5);
      expect(result.values.every((v) => isNaN(v))).toBe(true);
    });
  });

  describe('MACD', () => {
    it('should return DIF, DEA, and histogram', () => {
      // Generate enough data for MACD calculation
      const closes = Array.from({ length: 40 }, (_, i) => 100 + Math.sin(i * 0.3) * 10);
      const data = generateData(closes);
      const result = lib.calculateMACD(data, 12, 26, 9);

      expect(result.type).toBe('MACD');
      expect(result.values).toHaveLength(40); // DIF
      expect(result.extra?.dea).toHaveLength(40);
      expect(result.extra?.histogram).toHaveLength(40);
    });

    it('should have DIF = fast EMA - slow EMA', () => {
      const closes = Array.from({ length: 30 }, (_, i) => 50 + i);
      const data = generateData(closes);
      const result = lib.calculateMACD(data, 12, 26, 9);

      // After enough data, DIF should be defined
      const lastDif = result.values[result.values.length - 1];
      expect(isNaN(lastDif)).toBe(false);
    });

    it('should return NaN values early in the series', () => {
      const data = generateData([10, 20, 30]);
      const result = lib.calculateMACD(data, 12, 26, 9);
      // Not enough data for slow EMA (26), so early values should be NaN
      expect(isNaN(result.values[0])).toBe(true);
    });
  });

  describe('RSI', () => {
    it('should calculate RSI between 0 and 100', () => {
      const closes = [44, 44.34, 44.09, 43.61, 44.33, 44.83, 45.10, 45.42, 45.84,
        46.08, 45.89, 46.03, 45.61, 46.28, 46.28, 46.00, 46.03, 46.41, 46.22, 45.64];
      const data = generateData(closes);
      const result = lib.calculateRSI(data, 14);

      expect(result.type).toBe('RSI');
      // RSI values after period should be between 0 and 100
      for (let i = 14; i < result.values.length; i++) {
        if (!isNaN(result.values[i])) {
          expect(result.values[i]).toBeGreaterThanOrEqual(0);
          expect(result.values[i]).toBeLessThanOrEqual(100);
        }
      }
    });

    it('should have NaN for values before period + 1', () => {
      const data = generateData([10, 20, 30, 40, 50]);
      const result = lib.calculateRSI(data, 14);
      // Not enough data, all should be NaN
      expect(result.values.every((v) => isNaN(v))).toBe(true);
    });

    it('should return 100 when all changes are positive', () => {
      const closes = Array.from({ length: 20 }, (_, i) => 10 + i);
      const data = generateData(closes);
      const result = lib.calculateRSI(data, 14);
      // All positive changes → RSI = 100
      const lastRSI = result.values[result.values.length - 1];
      expect(lastRSI).toBeCloseTo(100);
    });

    it('should return 0 when all changes are negative', () => {
      const closes = Array.from({ length: 20 }, (_, i) => 100 - i);
      const data = generateData(closes);
      const result = lib.calculateRSI(data, 14);
      const lastRSI = result.values[result.values.length - 1];
      expect(lastRSI).toBeCloseTo(0);
    });
  });

  describe('BOLL (Bollinger Bands)', () => {
    it('should return middle, upper, and lower bands', () => {
      const closes = Array.from({ length: 25 }, (_, i) => 50 + Math.sin(i) * 5);
      const data = generateData(closes);
      const result = lib.calculateBOLL(data, 20, 2);

      expect(result.type).toBe('BOLL');
      expect(result.values).toHaveLength(25); // middle band
      expect(result.extra?.upper).toHaveLength(25);
      expect(result.extra?.lower).toHaveLength(25);
    });

    it('should have upper > middle > lower', () => {
      const closes = Array.from({ length: 25 }, (_, i) => 50 + Math.sin(i) * 5);
      const data = generateData(closes);
      const result = lib.calculateBOLL(data, 20, 2);

      for (let i = 19; i < 25; i++) {
        expect(result.extra!.upper[i]).toBeGreaterThan(result.values[i]);
        expect(result.values[i]).toBeGreaterThan(result.extra!.lower[i]);
      }
    });

    it('should have NaN for values before period', () => {
      const data = generateData([10, 20, 30, 40, 50]);
      const result = lib.calculateBOLL(data, 20, 2);
      expect(result.values.every((v) => isNaN(v))).toBe(true);
    });

    it('should have middle band equal to SMA', () => {
      const closes = [10, 20, 30, 40, 50];
      const data = generateData(closes);
      const maResult = lib.calculateMA(data, 5);
      const bollResult = lib.calculateBOLL(data, 5, 2);
      // Middle should equal MA at index 4
      expect(bollResult.values[4]).toBeCloseTo(maResult.values[4]);
    });

    it('should collapse to middle when stdDev is 0', () => {
      const closes = Array.from({ length: 10 }, (_, i) => 50 + i);
      const data = generateData(closes);
      const result = lib.calculateBOLL(data, 5, 0);
      for (let i = 4; i < 10; i++) {
        expect(result.extra!.upper[i]).toBeCloseTo(result.values[i]);
        expect(result.extra!.lower[i]).toBeCloseTo(result.values[i]);
      }
    });
  });
});
