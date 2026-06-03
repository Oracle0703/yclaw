import type { HotRunDetail } from '@shared/types';
import { ensureTemplateGovernanceAction } from './templateGovernance';

export type HotFailureReasonCategory =
  | 'selector_changed'
  | 'login_required'
  | 'network_or_rate_limit'
  | 'parser_changed'
  | 'quality_issue'
  | 'unknown';

export interface HotFailureEvidenceSummary {
  failedStepCount: number;
  totalStepCount: number;
  linkedResultCount: number;
  breakpointLabel: string;
  primaryError: string;
}

export interface HotFailureReviewDraft {
  reasonCategory: HotFailureReasonCategory;
  conclusion: string;
  owner: string;
  followUpActions: string[];
}

export function summarizeFailureEvidence(detail: HotRunDetail): HotFailureEvidenceSummary {
  const stepResults = detail.stepResults ?? [];
  const failedStepCount = stepResults.filter((step) => !step.success).length;
  const primaryError = detail.breakpoint?.error ?? detail.error ?? '未知错误';

  return {
    failedStepCount,
    totalStepCount: stepResults.length,
    linkedResultCount: (detail.linkedResultIds ?? []).length,
    breakpointLabel: detail.breakpoint ? `第 ${detail.breakpoint.stepIndex + 1} 步` : '无',
    primaryError,
  };
}

export function buildFailureReviewDraft(detail: HotRunDetail): HotFailureReviewDraft {
  const evidence = summarizeFailureEvidence(detail);
  const reasonCategory = inferFailureReasonCategory(detail);

  return {
    reasonCategory,
    conclusion: buildConclusion(reasonCategory, evidence.primaryError),
    owner: '当前值班员',
    followUpActions: buildFollowUpActions(reasonCategory),
  };
}

export function inferFailureReasonCategory(detail: HotRunDetail): HotFailureReasonCategory {
  // 顶层 breakpoint/error 为主信号；stepResults 仅在主信号缺失时作为回退。
  const primaryText = [detail.breakpoint?.error, detail.error]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  const fallbackText = (detail.stepResults ?? [])
    .map((step) => step.error)
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const category = matchFailureCategory(primaryText) ?? matchFailureCategory(fallbackText);
  if (category) {
    return category;
  }

  if (detail.resultCount === 0 || (detail.linkedResultIds?.length ?? 0) === 0) {
    return 'quality_issue';
  }

  return 'unknown';
}

function matchFailureCategory(text: string): HotFailureReasonCategory | null {
  if (!text) {
    return null;
  }
  if (/login|登录|403|401|unauthorized/.test(text)) {
    return 'login_required';
  }
  // parser 关键字优先于 selector：当主信号包含"字段/结构/parse"时通常为解析失败。
  if (/parse|json|field|字段|结构/.test(text)) {
    return 'parser_changed';
  }
  if (/selector|选择器|未找到|定位/.test(text)) {
    return 'selector_changed';
  }
  if (/rate|429|network|网络|timeout|超时/.test(text)) {
    return 'network_or_rate_limit';
  }
  return null;
}

function buildConclusion(reasonCategory: HotFailureReasonCategory, primaryError: string): string {
  const suffixByReason: Record<HotFailureReasonCategory, string> = {
    selector_changed: '建议检查页面结构或选择器后重新运行。',
    login_required: '建议刷新登录态或会话后重新运行。',
    network_or_rate_limit: '建议确认网络、频控或稍后重试。',
    parser_changed: '建议更新解析规则并补充质量校验。',
    quality_issue: '建议检查结果数量和质量规则。',
    unknown: '建议补充人工判断后再决定后续动作。',
  };

  return `热点采集失败：${primaryError}。${suffixByReason[reasonCategory]}`;
}

function buildFollowUpActions(reasonCategory: HotFailureReasonCategory): string[] {
  if (reasonCategory === 'selector_changed') {
    return ensureTemplateGovernanceAction(['update-selector', 'retry-source']);
  }

  if (reasonCategory === 'login_required') {
    return ['refresh-session', 'retry-source'];
  }

  if (reasonCategory === 'parser_changed') {
    return ensureTemplateGovernanceAction(['update-parser', 'add-quality-check']);
  }

  if (reasonCategory === 'quality_issue') {
    return ensureTemplateGovernanceAction(['add-quality-check', 'monitor-next-run']);
  }

  if (reasonCategory === 'network_or_rate_limit') {
    return ['retry-source', 'monitor-next-run'];
  }

  return ['monitor-next-run'];
}
