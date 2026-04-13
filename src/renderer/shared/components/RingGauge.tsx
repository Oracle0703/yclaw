import type { CSSProperties } from 'react';

export interface RingGaugeProps {
  /** 百分比 0-100 */
  percent: number;
  /** 尺寸 (默认 80px) */
  size?: number;
  /** 环宽度 (默认 6px) */
  strokeWidth?: number;
  /** 自定义颜色 (不设置则按阈值自动) */
  color?: string;
  /** 标签文字 */
  label?: string;
  /** 容器样式 */
  style?: CSSProperties;
}

function getThresholdColor(percent: number): string {
  if (percent < 60) return '#52c41a';
  if (percent < 80) return '#faad14';
  return '#ff4d4f';
}

/**
 * RingGauge — SVG 环形仪表盘
 */
export default function RingGauge({
  percent,
  size = 80,
  strokeWidth = 6,
  color,
  label,
  style,
}: RingGaugeProps) {
  const clampedPercent = Math.max(0, Math.min(100, percent));
  const effectiveColor = color ?? getThresholdColor(clampedPercent);

  const center = size / 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clampedPercent / 100) * circumference;

  return (
    <div
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        ...style,
      }}
      data-testid="ring-gauge"
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background ring */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={strokeWidth}
        />
        {/* Progress ring */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={effectiveColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${center} ${center})`}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
        {/* Center text */}
        <text
          x={center}
          y={center}
          textAnchor="middle"
          dominantBaseline="central"
          fill="currentColor"
          fontSize={size * 0.22}
          fontWeight={600}
        >
          {clampedPercent}%
        </text>
      </svg>
      {label && (
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>{label}</span>
      )}
    </div>
  );
}
