/**
 * 全局背景配置工具
 * - 仅作用于亮色主题（不区分暗色，目标场景是用户全局换背景）
 * - 通过覆写 CSS 变量 `--yclaw-body-gradient`、`--yclaw-page-bg` 实现切换
 * - 保留默认渐变作为兜底
 */
import type { BackgroundConfig } from '@shared/types';

export interface BackgroundPreset {
  id: string;
  label: string;
  /** 用作 CSS background 简写 */
  background: string;
  /** 用作 colorBgLayout 兜底（纯色或主色） */
  pageColor: string;
}

/** 默认渐变（与 globals.css 中 :root 保持一致） */
export const DEFAULT_PRESET_ID = 'aurora';

export const BACKGROUND_PRESETS: BackgroundPreset[] = [
  {
    id: 'aurora',
    label: '极光（默认）',
    pageColor: '#eef4fb',
    background:
      'radial-gradient(circle at top left, rgba(22, 119, 255, 0.08), transparent 30%),' +
      'radial-gradient(circle at top right, rgba(14, 165, 233, 0.12), transparent 22%),' +
      'linear-gradient(180deg, #f8fbff 0%, #eef4fb 100%)',
  },
  {
    id: 'mint',
    label: '薄荷',
    pageColor: '#ecfdf5',
    background:
      'radial-gradient(circle at top left, rgba(16, 185, 129, 0.12), transparent 30%),' +
      'radial-gradient(circle at bottom right, rgba(45, 212, 191, 0.16), transparent 28%),' +
      'linear-gradient(180deg, #f0fdf4 0%, #ecfdf5 100%)',
  },
  {
    id: 'sunrise',
    label: '日出',
    pageColor: '#fff7ed',
    background:
      'radial-gradient(circle at top left, rgba(251, 146, 60, 0.16), transparent 30%),' +
      'radial-gradient(circle at top right, rgba(244, 114, 182, 0.14), transparent 24%),' +
      'linear-gradient(180deg, #fff7ed 0%, #fee2e2 100%)',
  },
  {
    id: 'lavender',
    label: '薰衣草',
    pageColor: '#f5f3ff',
    background:
      'radial-gradient(circle at top left, rgba(139, 92, 246, 0.16), transparent 30%),' +
      'radial-gradient(circle at bottom right, rgba(99, 102, 241, 0.14), transparent 26%),' +
      'linear-gradient(180deg, #faf5ff 0%, #f5f3ff 100%)',
  },
  {
    id: 'graphite',
    label: '石墨',
    pageColor: '#f1f5f9',
    background:
      'radial-gradient(circle at top right, rgba(100, 116, 139, 0.14), transparent 28%),' +
      'linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%)',
  },
];

export const DEFAULT_BACKGROUND: BackgroundConfig = {
  type: 'preset',
  value: DEFAULT_PRESET_ID,
  overlayOpacity: 0.35,
  fit: 'cover',
};

const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/;
/** 仅允许 http(s)/data:image 协议，避免 javascript: 注入 */
const SAFE_URL_PATTERN = /^(https?:\/\/|data:image\/)/i;

/** 把任意输入归一化为合法的 BackgroundConfig，不合法时回退到默认值 */
export function normalizeBackground(input: unknown): BackgroundConfig {
  if (!input || typeof input !== 'object') {
    return { ...DEFAULT_BACKGROUND };
  }
  const raw = input as Partial<BackgroundConfig>;

  if (raw.type === 'solid') {
    const color =
      typeof raw.value === 'string' && HEX_PATTERN.test(raw.value) ? raw.value : '#eef4fb';
    return { type: 'solid', value: color };
  }

  if (raw.type === 'image') {
    const url = typeof raw.value === 'string' && SAFE_URL_PATTERN.test(raw.value) ? raw.value : '';
    if (!url) {
      return { ...DEFAULT_BACKGROUND };
    }
    const overlayOpacity = clampOpacity(raw.overlayOpacity);
    const fit: BackgroundConfig['fit'] =
      raw.fit === 'contain' || raw.fit === 'tile' ? raw.fit : 'cover';
    return { type: 'image', value: url, overlayOpacity, fit };
  }

  // preset 或未知类型 → 校验预设 id
  const presetId =
    typeof raw.value === 'string' && BACKGROUND_PRESETS.some((p) => p.id === raw.value)
      ? raw.value
      : DEFAULT_PRESET_ID;
  return { type: 'preset', value: presetId };
}

function clampOpacity(value: unknown): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return DEFAULT_BACKGROUND.overlayOpacity ?? 0.35;
  }
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

export interface AppliedBackground {
  /** CSS background 简写值，写入 --yclaw-body-gradient */
  cssBackground: string;
  /** 兜底页面色，写入 --yclaw-page-bg */
  pageColor: string;
}

/** 根据配置计算 CSS 值（纯函数，便于测试） */
export function resolveBackground(config: BackgroundConfig): AppliedBackground {
  if (config.type === 'solid') {
    return { cssBackground: config.value, pageColor: config.value };
  }

  if (config.type === 'image') {
    const opacity = clampOpacity(config.overlayOpacity);
    const overlay = `linear-gradient(rgba(255,255,255,${opacity}), rgba(255,255,255,${opacity}))`;
    const safeUrl = config.value.replace(/"/g, '');
    if (config.fit === 'tile') {
      return {
        cssBackground: `${overlay}, url("${safeUrl}") repeat`,
        pageColor: '#eef4fb',
      };
    }
    const size = config.fit === 'contain' ? 'contain' : 'cover';
    return {
      cssBackground: `${overlay}, url("${safeUrl}") center/${size} no-repeat fixed`,
      pageColor: '#eef4fb',
    };
  }

  const preset = BACKGROUND_PRESETS.find((p) => p.id === config.value) ?? BACKGROUND_PRESETS[0];
  return { cssBackground: preset.background, pageColor: preset.pageColor };
}

/** 把背景配置写入 CSS 变量；返回应用结果便于断言 */
export function applyBackground(
  config: BackgroundConfig,
  doc: Document = document,
): AppliedBackground {
  const applied = resolveBackground(config);
  const root = doc.documentElement;
  root.style.setProperty('--yclaw-body-gradient', applied.cssBackground);
  root.style.setProperty('--yclaw-page-bg', applied.pageColor);
  return applied;
}

export const BACKGROUND_STORAGE_KEY = 'yclaw.appearance.background';
export const BACKGROUND_CHANNEL_NAME = 'yclaw-background';
