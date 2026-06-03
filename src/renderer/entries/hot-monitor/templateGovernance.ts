import type { TaskReviewRecord } from '@shared/types';

const TEMPLATE_GOVERNANCE_ACTIONS = new Set([
  'update-template',
  'link-template',
  'template-governance',
  'update-selector',
  'update-parser',
  'add-quality-check',
]);

const ACTIONS_THAT_SHOULD_ADD_TEMPLATE_GOVERNANCE = new Set([
  'update-selector',
  'update-parser',
  'add-quality-check',
]);

export function hasTemplateGovernanceIntent(
  review: Pick<TaskReviewRecord, 'reasonCategory' | 'conclusion' | 'followUpActions'>,
): boolean {
  if (review.followUpActions.some((action) => TEMPLATE_GOVERNANCE_ACTIONS.has(action))) {
    return true;
  }

  const text = [review.reasonCategory, review.conclusion].filter(Boolean).join(' ');

  return /selector|选择器|parser|解析|quality|质量|校验|template|模板/i.test(text);
}

export function ensureTemplateGovernanceAction(actions: string[]): string[] {
  const shouldAppend = actions.some((action) =>
    ACTIONS_THAT_SHOULD_ADD_TEMPLATE_GOVERNANCE.has(action),
  );

  if (!shouldAppend || actions.includes('template-governance')) {
    return actions;
  }

  return [...actions, 'template-governance'];
}

export function mergeLinkedTemplateIds(
  review: TaskReviewRecord,
  templateId: string,
): TaskReviewRecord {
  return {
    ...review,
    linkedTemplateIds: Array.from(new Set([...(review.linkedTemplateIds ?? []), templateId])),
  };
}
