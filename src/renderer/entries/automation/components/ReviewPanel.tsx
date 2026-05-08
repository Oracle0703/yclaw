import { useEffect, useState } from 'react';
import { Button, Space } from 'antd';
import type { TaskReviewRecord, TemplateBackflowDraft } from '@shared/types';
import { useIpc } from '../../../shared/hooks';

export function ReviewPanel({
  taskId,
  selectedTemplateId,
}: {
  taskId: string | null;
  selectedTemplateId?: string | null;
}) {
  const ipc = useIpc();
  const taskOperations = ipc.taskOperations;
  const [reviews, setReviews] = useState<TaskReviewRecord[]>([]);
  const [backflowSuggestion, setBackflowSuggestion] = useState<string | null>(null);
  const [backflowDraft, setBackflowDraft] = useState<TemplateBackflowDraft | null>(null);
  const [backflowApplyMessage, setBackflowApplyMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!taskId || !taskOperations?.listReviews) {
      setReviews([]);
      return;
    }

    let disposed = false;
    void taskOperations.listReviews(taskId).then((items) => {
      if (!disposed) {
        setReviews((items ?? []) as TaskReviewRecord[]);
      }
    });

    return () => {
      disposed = true;
    };
  }, [taskId, taskOperations]);

  const handleCreate = () => {
    if (!taskId || !taskOperations?.createReview) {
      return;
    }

    void taskOperations.createReview({
      taskId,
      reviewType: 'failure',
      reasonCategory: 'selector_changed',
      conclusion: '更新模板选择器',
      owner: '当前值班员',
      followUpActions: ['update-template'],
    }).then((created) => {
      setReviews((current) => [created as TaskReviewRecord, ...current]);
    });
  };

  const handleLinkTemplate = (reviewId: string) => {
    if (!selectedTemplateId || !taskOperations?.linkReviewTemplate) {
      return;
    }

    void taskOperations.linkReviewTemplate({
      reviewId,
      templateId: selectedTemplateId,
    }).then(() => {
      setReviews((current) =>
        current.map((review) => (
          review.id === reviewId
            ? {
              ...review,
              linkedTemplateIds: Array.from(new Set([
                ...(review.linkedTemplateIds ?? []),
                selectedTemplateId,
              ])),
            }
            : review
        )),
      );
    });
  };

  const handleSuggestBackflow = (reviewId: string) => {
    if (!selectedTemplateId || !taskOperations?.suggestTemplateBackflow) {
      return;
    }

    void taskOperations.suggestTemplateBackflow({
      reviewId,
      templateId: selectedTemplateId,
    }).then((suggestion) => {
      const body = suggestion as { reason?: string } | null;
      setBackflowSuggestion(body?.reason ?? '已生成模板回流建议');
    });
  };

  const handleCreateBackflowDraft = (reviewId: string) => {
    if (!selectedTemplateId || !taskOperations?.createTemplateBackflowDraft) {
      return;
    }

    void taskOperations.createTemplateBackflowDraft({
      reviewId,
      templateId: selectedTemplateId,
    }).then((draft) => {
      setBackflowDraft(draft as TemplateBackflowDraft);
    });
  };

  const handleApplyBackflowDraft = () => {
    if (!backflowDraft || !taskOperations?.applyTemplateBackflowDraft) {
      return;
    }

    void taskOperations.applyTemplateBackflowDraft({
      draft: backflowDraft,
      appliedBy: '当前值班员',
    }).then(() => {
      setBackflowApplyMessage('回流草稿已应用到模板');
    });
  };

  return (
    <div className="yclaw-panel-card">
      <h3>复盘资产</h3>
      <Space direction="vertical">
        <Button onClick={handleCreate} disabled={!taskId}>
          创建复盘
        </Button>
        {backflowSuggestion && <div>{backflowSuggestion}</div>}
        {backflowDraft && (
          <div>
            <strong>{backflowDraft.title}</strong>
            <div>风险等级：{backflowDraft.riskLevel}</div>
            {backflowDraft.proposedChanges.map((change) => (
              <div key={`${change.type}-${change.description}`}>{change.description}</div>
            ))}
            {backflowDraft.executionSteps.map((step) => (
              <div key={step}>{step}</div>
            ))}
            {backflowDraft.acceptanceCriteria.map((item) => (
              <div key={item}>{item}</div>
            ))}
            <Button onClick={handleApplyBackflowDraft}>应用回流草稿</Button>
          </div>
        )}
        {backflowApplyMessage && <div>{backflowApplyMessage}</div>}
        {reviews.map((review) => (
          <div key={review.id}>
            <span>{review.conclusion}</span>
            {selectedTemplateId && (
              <>
                <Button onClick={() => handleLinkTemplate(review.id)}>关联当前模板</Button>
                <Button onClick={() => handleSuggestBackflow(review.id)}>生成回流建议</Button>
                <Button onClick={() => handleCreateBackflowDraft(review.id)}>生成回流草稿</Button>
              </>
            )}
          </div>
        ))}
      </Space>
    </div>
  );
}
