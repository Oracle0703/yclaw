import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import { KLineChart } from '@renderer/entries/stock/components/KLineChart';
import type { OHLCVData, IndicatorResult } from '@shared/types';

// Mock canvas context
const mockContext = {
  clearRect: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  fill: vi.fn(),
  fillRect: vi.fn(),
  fillText: vi.fn(),
  strokeRect: vi.fn(),
  setLineDash: vi.fn(),
  closePath: vi.fn(),
  arc: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  canvas: { width: 960, height: 480 },
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 1,
  font: '',
  textAlign: 'left',
  globalAlpha: 1,
};

// Mock HTMLCanvasElement.getContext
HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(mockContext) as any;

const sampleData: OHLCVData[] = [
  { time: 1000, open: 10, high: 15, low: 8, close: 12, volume: 100 },
  { time: 2000, open: 12, high: 18, low: 11, close: 16, volume: 150 },
  { time: 3000, open: 16, high: 20, low: 14, close: 15, volume: 120 },
  { time: 4000, open: 15, high: 17, low: 13, close: 14, volume: 90 },
  { time: 5000, open: 14, high: 19, low: 13, close: 18, volume: 200 },
];

describe('KLineChart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render canvas element', () => {
    const { container } = render(
      <KLineChart data={sampleData} indicators={[]} width={960} height={480} />,
    );
    const canvas = container.querySelector('canvas');
    expect(canvas).toBeDefined();
    expect(canvas).not.toBeNull();
  });

  it('should set canvas dimensions', () => {
    const { container } = render(
      <KLineChart data={sampleData} indicators={[]} width={800} height={400} />,
    );
    const canvas = container.querySelector('canvas');
    expect(canvas?.width).toBe(800);
    expect(canvas?.height).toBe(400);
  });

  it('should call getContext with 2d', () => {
    render(
      <KLineChart data={sampleData} indicators={[]} width={960} height={480} />,
    );
    expect(HTMLCanvasElement.prototype.getContext).toHaveBeenCalledWith('2d');
  });

  it('should render with empty data', () => {
    const { container } = render(
      <KLineChart data={[]} indicators={[]} width={960} height={480} />,
    );
    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();
  });

  it('should render with indicators', () => {
    const indicators: IndicatorResult[] = [
      { type: 'MA', values: [NaN, NaN, 12, 14.3, 15.6] },
    ];
    const { container } = render(
      <KLineChart data={sampleData} indicators={indicators} width={960} height={480} />,
    );
    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();
  });

  it('should handle single data point', () => {
    const singleData: OHLCVData[] = [
      { time: 1000, open: 10, high: 15, low: 8, close: 12, volume: 100 },
    ];
    const { container } = render(
      <KLineChart data={singleData} indicators={[]} width={960} height={480} />,
    );
    expect(container.querySelector('canvas')).not.toBeNull();
  });
});
