import type { CSSProperties } from 'react';

export interface SparklineProps {
  /** 数据点数组 */
  data: number[];
  /** 宽度 (默认 100%) */
  width?: number | string;
  /** 高度 (默认 32px) */
  height?: number;
  /** 线条颜色 */
  color?: string;
  /** 显示填充区域 */
  fill?: boolean;
  /** 容器样式 */
  style?: CSSProperties;
}

/**
 * Sparkline — SVG 迷你折线趋势图
 *
 * 纯 SVG 实现，无外部图表库依赖
 */
export default function Sparkline({
  data,
  width = '100%',
  height = 32,
  color = '#1677ff',
  fill = true,
  style,
}: SparklineProps) {
  if (!data || data.length < 2) return null;

  const padding = 2;
  const svgWidth = 100; // viewBox 内部坐标
  const svgHeight = height;
  const chartWidth = svgWidth - padding * 2;
  const chartHeight = svgHeight - padding * 2;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((value, index) => {
    const x = padding + (index / (data.length - 1)) * chartWidth;
    const y = padding + chartHeight - ((value - min) / range) * chartHeight;
    return `${x},${y}`;
  });

  const polylinePoints = points.join(' ');

  // Fill path: close the shape to the bottom
  const fillPath = `M${points[0]} ${points.join(' L')} L${padding + chartWidth},${svgHeight} L${padding},${svgHeight} Z`;

  // Determine trend color
  const isPositive = data[data.length - 1] >= data[0];
  const effectiveColor = color || (isPositive ? '#52c41a' : '#ff4d4f');

  return (
    <svg
      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
      width={width}
      height={height}
      style={{ display: 'block', ...style }}
      data-testid="sparkline"
      role="img"
      aria-label={`趋势图: ${data.join(', ')}`}
    >
      {fill && <path d={fillPath} fill={effectiveColor} fillOpacity={0.1} />}
      <polyline
        points={polylinePoints}
        fill="none"
        stroke={effectiveColor}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
