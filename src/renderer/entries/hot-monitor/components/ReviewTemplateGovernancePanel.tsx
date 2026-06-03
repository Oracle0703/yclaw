import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Select, Space, Tag, message } from 'antd';
import type { ExtractionTemplate, TaskReviewRecord, TemplateBackflowDraft } from '@shared/types';
import { hasTemplateGovernanceIntent, mergeLinkedTemplateIds } from '../templateGovernance';

interface TaskOperationsLike {
  linkReviewTemplate(payload: unknown): Promise<unknown>;
  suggestTemplateBackflow(payload: unknown): Promise<unknown>;
  createTemplateBackflowDraft(payload: unknown): Promise<unknown>;
  applyTemplateBackflowDraft(payload: unknown): Promise<unknown>;
}

interface TemplateBackflowSuggestionView {
  recommended?: boolean;
  reason?: string;
  followUpActions?: string[];
}

export function ReviewTemplateGovernancePanel({
  review,
  templates,
  taskOperations,
  onReviewUpdated,
}: {
  review: TaskReviewRecord;
  templates: ExtractionTemplate[];
  taskOperations: TaskOperationsLike;
  onReviewUpdated: (review: TaskReviewRecord) => void;
}) {
  const [selectedTemplateId, setSelectedTemplateId] = useState(
    review.linkedTemplateIds?.[0] ?? templates[0]?.id ?? '',
  );
  const [suggestion, setSuggestion] = useState<TemplateBackflowSuggestionView | null>(null);
  const [draft, setDraft] = useState<TemplateBackflowDraft | null>(null);
  const [applyMessage, setApplyMessage] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const hasTemplates = templates.length > 0;
  const canOperate = Boolean(review.id && selectedTemplateId && hasTemplates);
  const templateOptions = useMemo(
    () => templates.map((template) => ({ label: template.name, value: template.id })),
    [templates],
  );

  // 仅在 templates 变化且当前未选中任何模板时，用首项回填；避免依赖 selectedTemplateId 造成闭环。
  useEffect(() => {
    setSelectedTemplateId((current) => current || templates[0]?.id || '');
  }, [templates]);

  const handleError = (error: unknown, fallback: string) => {
    message.error(error instanceof Error ? error.message : fallback);
  };

  const updateLinkedReview = (templateId: string) => {
    onReviewUpdated(mergeLinkedTemplateIds(review, templateId));
  };

  const linkTemplate = async () => {
    if (!canOperate) {
      return;
    }

    setLoadingAction('link');
    try {
      await taskOperations.linkReviewTemplate({
        reviewId: review.id,
        templateId: selectedTemplateId,
      });
      updateLinkedReview(selectedTemplateId);
      message.success('复盘已关联模板');
    } catch (error) {
      handleError(error, '关联模板失败');
    } finally {
      setLoadingAction(null);
    }
  };

  const suggestBackflow = async () => {
    if (!canOperate) {
      return;
    }

    setLoadingAction('suggest');
    try {
      const result = await taskOperations.suggestTemplateBackflow({
        reviewId: review.id,
        templateId: selectedTemplateId,
      });
      setSuggestion(result as TemplateBackflowSuggestionView);
    } catch (error) {
      handleError(error, '生成回流建议失败');
    } finally {
      setLoadingAction(null);
    }
  };

  const createDraft = async () => {
    if (!canOperate) {
      return;
    }

    setLoadingAction('draft');
    try {
      const result = await taskOperations.createTemplateBackflowDraft({
        reviewId: review.id,
        templateId: selectedTemplateId,
      });
      setDraft(result as TemplateBackflowDraft);
      setApplyMessage(null);
    } catch (error) {
      handleError(error, '生成回流草稿失败');
    } finally {
      setLoadingAction(null);
    }
  };

  const applyDraft = async () => {
    if (!draft) {
      return;
    }

    setLoadingAction('apply');
    try {
      await taskOperations.applyTemplateBackflowDraft({
        draft,
        appliedBy: review.owner ?? '当前值班员',
      });
      updateLinkedReview(draft.templateId);
      setApplyMessage('回流草稿已应用到模板');
      message.success('回流草稿已应用到模板');
    } catch (error) {
      handleError(error, '应用回流草稿失败');
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="hot-monitor-template-governance">
      <div className="browser-workspace-section-title">模板治理</div>
      {hasTemplateGovernanceIntent(review) ? (
        <Tag color="processing">建议回流模板</Tag>
      ) : (
        <Tag>可人工评估</Tag>
      )}
      {review.linkedTemplateIds?.length ? (
        <div className="browser-workspace-action-description">
          已关联模板：{review.linkedTemplateIds.join('、')}
        </div>
      ) : null}
      {!hasTemplates ? (
        <Alert type="info" showIcon message="暂无模板，请先在 Automation 中创建提取模板" />
      ) : null}
      <Space wrap>
        <Select
          aria-label="选择回流模板"
          style={{ minWidth: 220 }}
          value={selectedTemplateId || undefined}
          options={templateOptions}
          disabled={!hasTemplates}
          placeholder="选择回流模板"
          onChange={setSelectedTemplateId}
        />
        <Button
          onClick={() => void linkTemplate()}
          disabled={!canOperate}
          loading={loadingAction === 'link'}
        >
          关联模板
        </Button>
        <Button
          onClick={() => void suggestBackflow()}
          disabled={!canOperate}
          loading={loadingAction === 'suggest'}
        >
          生成回流建议
        </Button>
        <Button
          onClick={() => void createDraft()}
          disabled={!canOperate}
          loading={loadingAction === 'draft'}
        >
          生成回流草稿
        </Button>
      </Space>
      {suggestion ? (
        <div className="browser-workspace-action-card">
          <div className="browser-workspace-action-title">
            {suggestion.recommended ? '建议回流' : '谨慎回流'}
          </div>
          <div className="browser-workspace-action-description">
            {suggestion.reason ?? '已生成模板回流建议'}
          </div>
          <div className="browser-workspace-action-description">
            后续动作：{suggestion.followUpActions?.join('、') || '无'}
          </div>
        </div>
      ) : null}
      {draft ? (
        <div className="browser-workspace-action-card">
          <div className="browser-workspace-action-title">{draft.title}</div>
          <div className="browser-workspace-action-description">风险等级：{draft.riskLevel}</div>
          {draft.proposedChanges.map((change) => (
            <div
              key={`${change.type}-${change.description}`}
              className="browser-workspace-action-description"
            >
              {change.description}
            </div>
          ))}
          {draft.executionSteps.map((step) => (
            <div key={step} className="browser-workspace-action-description">
              {step}
            </div>
          ))}
          {draft.acceptanceCriteria.map((item) => (
            <div key={item} className="browser-workspace-action-description">
              {item}
            </div>
          ))}
          <Button
            type="primary"
            onClick={() => void applyDraft()}
            loading={loadingAction === 'apply'}
          >
            应用回流草稿
          </Button>
        </div>
      ) : null}
      {applyMessage ? (
        <div className="browser-workspace-action-description">{applyMessage}</div>
      ) : null}
    </div>
  );
}
