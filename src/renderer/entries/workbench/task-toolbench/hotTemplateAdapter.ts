import type { HotReportFormat, HotSourceDraft, HotSourceKind } from '@shared/types';

export const HOT_REPORT_FORMATS = ['md', 'html'] as const satisfies HotReportFormat[];

export interface HotTemplateFormValues {
  name: string;
  sourceKind: HotSourceKind;
  siteKey: string;
  entryUrl: string;
  parserKey: string;
  platformIds?: string[] | string;
  sessionId?: string | null;
  enabled?: boolean;
}

export function validateHotTemplateValues(values: Partial<HotTemplateFormValues>): string[] {
  const errors: string[] = [];
  if (!values.name?.trim()) errors.push('任务名称不能为空');
  if (!values.siteKey?.trim()) errors.push('站点标识不能为空');
  if (!values.entryUrl?.trim()) errors.push('入口 URL 不能为空');
  if (!values.parserKey?.trim()) errors.push('解析器不能为空');
  return errors;
}

export function buildHotSourceDraft(values: HotTemplateFormValues): HotSourceDraft {
  const errors = validateHotTemplateValues(values);
  if (errors.length > 0) {
    throw new Error(errors.join('；'));
  }

  return {
    name: values.name.trim(),
    sourceKind: values.sourceKind,
    siteKey: values.siteKey.trim(),
    entryUrl: values.entryUrl.trim(),
    parserKey: values.parserKey.trim(),
    platformIds: normalizePlatformIds(values.platformIds),
    sessionId: values.sessionId?.trim() || null,
    schedule: { type: 'manual' },
    filter: null,
    timeline: null,
    enabled: values.enabled ?? true,
    tags: ['hot-monitor'],
  };
}

function normalizePlatformIds(value: string[] | string | undefined): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => item.trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}
