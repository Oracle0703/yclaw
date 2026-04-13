import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { OHLCVData, IndicatorResult } from '@shared/types';

interface KLineChartProps {
  data: OHLCVData[];
  indicators?: IndicatorResult[];
  width?: number;
  height?: number;
}

const CANDLE_WIDTH = 8;
const CANDLE_GAP = 2;
const PADDING = { top: 20, right: 60, bottom: 30, left: 10 };

/**
 * K 线图表组件
 * 使用 Canvas 渲染，支持缩放 / 拖拽 / 十字光标 / 自适应宽度 / 全屏
 */
export function KLineChart({
  data,
  indicators = [],
  width: propWidth,
  height: propHeight = 520,
}: KLineChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [offset, setOffset] = useState(0);
  const [crosshair, setCrosshair] = useState<{ x: number; y: number } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [containerSize, setContainerSize] = useState({
    width: propWidth ?? 800,
    height: propHeight,
  });

  // 自适应容器宽度
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const w = Math.floor(entry.contentRect.width);
        if (w > 0) {
          setContainerSize((prev) => ({
            width: propWidth ?? w,
            height: isFullscreen ? window.innerHeight - 48 : propHeight,
          }));
        }
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [propWidth, propHeight, isFullscreen]);

  // 全屏切换时更新高度
  useEffect(() => {
    setContainerSize((prev) => ({
      ...prev,
      height: isFullscreen ? window.innerHeight - 48 : propHeight,
    }));
  }, [isFullscreen, propHeight]);

  const width = containerSize.width;
  const height = containerSize.height;

  const visibleCount = Math.floor(
    (width - PADDING.left - PADDING.right) / (CANDLE_WIDTH + CANDLE_GAP),
  );
  const startIndex = Math.max(0, data.length - visibleCount - offset);
  const endIndex = Math.min(data.length, startIndex + visibleCount);
  const visibleData = data.slice(startIndex, endIndex);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || visibleData.length === 0) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, width, height);

    const highs = visibleData.map((d) => d.high);
    const lows = visibleData.map((d) => d.low);
    const maxPrice = Math.max(...highs);
    const minPrice = Math.min(...lows);
    const priceRange = maxPrice - minPrice || 1;

    const chartHeight = height - PADDING.top - PADDING.bottom;
    const toY = (price: number) =>
      PADDING.top + (1 - (price - minPrice) / priceRange) * chartHeight;

    // 绘制 K 线
    visibleData.forEach((d, i) => {
      const x = PADDING.left + i * (CANDLE_WIDTH + CANDLE_GAP);
      const isUp = d.close >= d.open;
      const color = isUp ? '#ef5350' : '#26a69a';

      // 影线
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.moveTo(x + CANDLE_WIDTH / 2, toY(d.high));
      ctx.lineTo(x + CANDLE_WIDTH / 2, toY(d.low));
      ctx.stroke();

      // 实体
      ctx.fillStyle = color;
      const top = toY(Math.max(d.open, d.close));
      const bodyHeight = Math.max(1, Math.abs(toY(d.open) - toY(d.close)));
      ctx.fillRect(x, top, CANDLE_WIDTH, bodyHeight);
    });

    // 绘制指标线
    const colors = ['#2196f3', '#ff9800', '#9c27b0', '#4caf50'];
    indicators.forEach((ind, idx) => {
      ctx.strokeStyle = colors[idx % colors.length];
      ctx.lineWidth = 1;
      ctx.beginPath();
      let started = false;
      for (let i = 0; i < visibleData.length; i++) {
        const dataIndex = startIndex + i;
        const val = ind.values[dataIndex];
        if (isNaN(val)) continue;
        const x = PADDING.left + i * (CANDLE_WIDTH + CANDLE_GAP) + CANDLE_WIDTH / 2;
        const y = toY(val);
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else ctx.lineTo(x, y);
      }
      ctx.stroke();
    });

    // 十字光标
    if (crosshair) {
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(crosshair.x, PADDING.top);
      ctx.lineTo(crosshair.x, height - PADDING.bottom);
      ctx.moveTo(PADDING.left, crosshair.y);
      ctx.lineTo(width - PADDING.right, crosshair.y);
      ctx.stroke();
      ctx.setLineDash([]);

      // 价格标签
      const price = minPrice + (1 - (crosshair.y - PADDING.top) / chartHeight) * priceRange;
      ctx.fillStyle = '#333';
      ctx.fillRect(width - PADDING.right, crosshair.y - 10, 55, 20);
      ctx.fillStyle = '#fff';
      ctx.font = '11px monospace';
      ctx.fillText(price.toFixed(2), width - PADDING.right + 4, crosshair.y + 4);
    }

    // Y 轴刻度
    ctx.fillStyle = 'var(--color-text-secondary, #888)';
    ctx.font = '10px monospace';
    for (let i = 0; i <= 4; i++) {
      const price = minPrice + (priceRange * i) / 4;
      const y = toY(price);
      ctx.fillText(price.toFixed(2), width - PADDING.right + 4, y + 3);
    }
  }, [visibleData, width, height, crosshair, indicators, startIndex]);

  useEffect(() => {
    draw();
  }, [draw]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setOffset((prev) =>
      Math.max(0, Math.min(data.length - visibleCount, prev + Math.sign(e.deltaY) * 3)),
    );
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    setCrosshair({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  return (
    <div
      ref={containerRef}
      className={`kline-chart${isFullscreen ? ' kline-chart-fullscreen' : ''}`}
    >
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        onWheel={handleWheel}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setCrosshair(null)}
      />
      <button
        className="kline-fullscreen-btn"
        onClick={() => setIsFullscreen((v) => !v)}
        title={isFullscreen ? '退出全屏' : '全屏'}
      >
        {isFullscreen ? '✕ 退出全屏' : '⛶ 全屏'}
      </button>
    </div>
  );
}
