import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import type { HotRunSummary, TaskReviewRecord } from '@shared/types';
import {
  ReviewVerificationPanel,
  type ReviewVerificationState,
} from '@renderer/entries/hot-monitor/components/ReviewVerificationPanel';

vi.mock('antd', () => ({
  Alert: ({ message }: { message?: React.ReactNode }) => <div role="alert">{message}</div>,
  Button: ({
    children,
    disabled,
    loading,
    onClick,
    type,
  }: {
    children?: React.ReactNode;
    disabled?: boolean;
    loading?: boolean;
    onClick?: () => void;
    type?: string;
  }) => (
    <button
      type="button"
      data-loading={loading ? 'true' : undefined}
      data-type={type}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  ),
  Space: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Statistic: ({ title, value }: { title?: React.ReactNode; value?: React.ReactNode }) => (
    <div>
      <span>{title}</span>
      <strong>{value}</strong>
    </div>
  ),
  Tag: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}));

function makeReview(overrides: Partial<TaskReviewRecord> = {}): TaskReviewRecord {
  return {
    id: 'review-1',
    taskId: 'task-1',
    batchId: 'batch-old',
    reviewType: 'failure',
    reasonCategory: 'selector_changed',
    conclusion: '已更新选择器',
    owner: '当前值班员',
    followUpActions: ['update-selector', 'template-governance'],
    createdAt: '2026-05-19T02:00:00.000Z',
    ...overrides,
  };
}

const completedRun: HotRunSummary = {
  batchId: 'batch-new',
  sourceId: 'source-1',
  sourceName: 'AI 热榜',
  status: 'success',
  resultCount: 12,
  reportStatus: 'generated',
  startedAt: '2026-05-19T04:00:00.000Z',
  finishedAt: '2026-05-19T04:01:00.000Z',
};

describe('ReviewVerificationPanel', () => {
  it('starts verification for a review', () => {
    const review = makeReview();
    const onVerify = vi.fn();
    render(
      <ReviewVerificationPanel
        review={review}
        state={{ status: 'idle' }}
        canVerify
        onVerify={onVerify}
        onOpenBatchResults={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '验证重跑并扫描新批次' }));

    expect(onVerify).toHaveBeenCalledWith(review);
  });

  it('disables the action while verification is running', () => {
    render(
      <ReviewVerificationPanel
        review={makeReview()}
        state={{ status: 'running', message: '等待新批次完成' }}
        canVerify
        onVerify={vi.fn()}
        onOpenBatchResults={vi.fn()}
      />,
    );

    const button = screen.getByRole('button', { name: '验证重跑并扫描新批次' });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getAllByText('等待新批次完成').length).toBeGreaterThan(0);
  });

  it('renders a successful verification summary and opens Data Center', () => {
    const onOpenBatchResults = vi.fn();
    const state: ReviewVerificationState = {
      status: 'succeeded',
      run: completedRun,
      quality: {
        scoreLabel: '86',
        gradeLabel: '良好',
        issueCount: 3,
        affectedResults: 2,
        totalResults: 12,
        topRules: [
          { ruleId: 'empty-data', count: 2 },
          { ruleId: 'failed-result', count: 1 },
        ],
        summary: '批次质量良好，但仍有空数据问题。',
      },
    };

    render(
      <ReviewVerificationPanel
        review={makeReview()}
        state={state}
        canVerify
        onVerify={vi.fn()}
        onOpenBatchResults={onOpenBatchResults}
      />,
    );

    expect(screen.getByText('新批次：batch-new')).toBeDefined();
    expect(screen.getByText('质量问题')).toBeDefined();
    expect(screen.getByText('成功')).toBeDefined();
    expect(screen.getByText('已生成')).toBeDefined();
    expect(screen.queryByText('generated')).toBeNull();
    expect(screen.getByText('empty-data：2')).toBeDefined();
    expect(screen.getByText('批次质量良好，但仍有空数据问题。')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: '查看新批次结果中心' }));

    expect(onOpenBatchResults).toHaveBeenCalledWith('batch-new');
  });

  it('renders a failed verification message', () => {
    render(
      <ReviewVerificationPanel
        review={makeReview()}
        state={{ status: 'failed', message: '新批次运行失败，未执行质量扫描' }}
        canVerify
        onVerify={vi.fn()}
        onOpenBatchResults={vi.fn()}
      />,
    );

    expect(screen.getByRole('alert').textContent).toContain('新批次运行失败，未执行质量扫描');
    expect(screen.getAllByText('新批次运行失败，未执行质量扫描')).toHaveLength(1);
  });
});
