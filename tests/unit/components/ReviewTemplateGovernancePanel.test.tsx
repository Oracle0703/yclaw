import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ExtractionTemplate, TaskReviewRecord } from '@shared/types';

const { messageErrorMock, messageSuccessMock } = vi.hoisted(() => ({
  messageErrorMock: vi.fn(),
  messageSuccessMock: vi.fn(),
}));

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
  Select: ({
    'aria-label': ariaLabel,
    disabled,
    onChange,
    options,
    value,
  }: {
    'aria-label'?: string;
    disabled?: boolean;
    onChange?: (value: string) => void;
    options?: Array<{ label: React.ReactNode; value: string }>;
    value?: string;
  }) => (
    <select
      aria-label={ariaLabel}
      disabled={disabled}
      value={value ?? ''}
      onChange={(event) => onChange?.(event.target.value)}
    >
      <option value="">选择回流模板</option>
      {options?.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
  Space: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Tag: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  message: {
    error: messageErrorMock,
    success: messageSuccessMock,
  },
}));

import { ReviewTemplateGovernancePanel } from '@renderer/entries/hot-monitor/components/ReviewTemplateGovernancePanel';

const taskOperations = {
  linkReviewTemplate: vi.fn(),
  suggestTemplateBackflow: vi.fn(),
  createTemplateBackflowDraft: vi.fn(),
  applyTemplateBackflowDraft: vi.fn(),
};

function makeReview(overrides: Partial<TaskReviewRecord> = {}): TaskReviewRecord {
  return {
    id: 'review-1',
    taskId: 'task-1',
    batchId: 'batch-1',
    reviewType: 'failure',
    reasonCategory: 'selector_changed',
    conclusion: '价格字段选择器需要改为 .price-current',
    owner: '当前值班员',
    followUpActions: ['update-selector', 'template-governance'],
    linkedTemplateIds: [],
    createdAt: '2026-05-19T02:00:00.000Z',
    ...overrides,
  };
}

const templates: ExtractionTemplate[] = [
  {
    id: 'template-1',
    name: '价格采集模板',
    fields: [{ name: 'price', selector: '.price-old', attribute: 'textContent' }],
    version: 'v1',
    description: '电商价格采集',
    deprecated: false,
    pluginDependencies: [],
    createdAt: '2026-05-18T00:00:00.000Z',
    updatedAt: '2026-05-19T00:00:00.000Z',
  },
];

describe('ReviewTemplateGovernancePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    taskOperations.linkReviewTemplate.mockResolvedValue({
      reviewId: 'review-1',
      templateId: 'template-1',
    });
    taskOperations.suggestTemplateBackflow.mockResolvedValue({
      reviewId: 'review-1',
      templateId: 'template-1',
      recommended: true,
      reason: '复盘后续动作包含 template-governance，建议将结论回流到模板。',
      followUpActions: ['update-selector', 'template-governance'],
    });
    taskOperations.createTemplateBackflowDraft.mockResolvedValue({
      reviewId: 'review-1',
      templateId: 'template-1',
      title: '回流复盘结论到模板',
      status: 'draft',
      riskLevel: 'medium',
      proposedChanges: [
        { type: 'selector-update', description: '价格字段选择器需要改为 .price-current' },
      ],
      executionSteps: ['更新模板字段或选择器', '关联复盘记录并记录变更原因'],
      acceptanceCriteria: ['模板更新后通过一次任务试运行'],
      sourceConclusion: '价格字段选择器需要改为 .price-current',
      owner: '当前值班员',
    });
    taskOperations.applyTemplateBackflowDraft.mockResolvedValue({
      reviewId: 'review-1',
      templateId: 'template-1',
      appliedBy: '当前值班员',
      appliedAt: '2026-05-19T03:00:00.000Z',
      appliedChanges: ['价格字段选择器需要改为 .price-current'],
    });
  });

  it('links a review to the selected template', async () => {
    const onReviewUpdated = vi.fn();
    render(
      <ReviewTemplateGovernancePanel
        review={makeReview()}
        templates={templates}
        taskOperations={taskOperations}
        onReviewUpdated={onReviewUpdated}
      />,
    );

    fireEvent.change(screen.getByLabelText('选择回流模板'), {
      target: { value: 'template-1' },
    });
    fireEvent.click(screen.getByRole('button', { name: '关联模板' }));

    await waitFor(() => {
      expect(taskOperations.linkReviewTemplate).toHaveBeenCalledWith({
        reviewId: 'review-1',
        templateId: 'template-1',
      });
    });
    expect(onReviewUpdated).toHaveBeenCalledWith(
      expect.objectContaining({ linkedTemplateIds: ['template-1'] }),
    );
  });

  it('shows template backflow suggestion', async () => {
    render(
      <ReviewTemplateGovernancePanel
        review={makeReview()}
        templates={templates}
        taskOperations={taskOperations}
        onReviewUpdated={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText('选择回流模板'), {
      target: { value: 'template-1' },
    });
    fireEvent.click(screen.getByRole('button', { name: '生成回流建议' }));

    expect(await screen.findByText('建议将结论回流到模板。', { exact: false })).toBeDefined();
    expect(taskOperations.suggestTemplateBackflow).toHaveBeenCalledWith({
      reviewId: 'review-1',
      templateId: 'template-1',
    });
  });

  it('creates and applies template backflow draft', async () => {
    const onReviewUpdated = vi.fn();
    render(
      <ReviewTemplateGovernancePanel
        review={makeReview()}
        templates={templates}
        taskOperations={taskOperations}
        onReviewUpdated={onReviewUpdated}
      />,
    );

    fireEvent.change(screen.getByLabelText('选择回流模板'), {
      target: { value: 'template-1' },
    });
    fireEvent.click(screen.getByRole('button', { name: '生成回流草稿' }));

    expect(await screen.findByText('风险等级：medium')).toBeDefined();
    expect(await screen.findByText('价格字段选择器需要改为 .price-current')).toBeDefined();
    expect(await screen.findByText('更新模板字段或选择器')).toBeDefined();
    expect(await screen.findByText('模板更新后通过一次任务试运行')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: '应用回流草稿' }));

    await waitFor(() => {
      expect(taskOperations.applyTemplateBackflowDraft).toHaveBeenCalledWith({
        draft: expect.objectContaining({
          reviewId: 'review-1',
          templateId: 'template-1',
        }),
        appliedBy: '当前值班员',
      });
    });
    expect(await screen.findByText('回流草稿已应用到模板')).toBeDefined();
    expect(onReviewUpdated).toHaveBeenCalledWith(
      expect.objectContaining({ linkedTemplateIds: ['template-1'] }),
    );
  });

  it('disables governance actions when no template exists', () => {
    render(
      <ReviewTemplateGovernancePanel
        review={makeReview()}
        templates={[]}
        taskOperations={taskOperations}
        onReviewUpdated={vi.fn()}
      />,
    );

    expect(screen.getByText('暂无模板，请先在 Automation 中创建提取模板')).toBeDefined();
    expect((screen.getByRole('button', { name: '关联模板' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it('selects the first template when templates load after the panel rendered', async () => {
    const { rerender } = render(
      <ReviewTemplateGovernancePanel
        review={makeReview()}
        templates={[]}
        taskOperations={taskOperations}
        onReviewUpdated={vi.fn()}
      />,
    );

    rerender(
      <ReviewTemplateGovernancePanel
        review={makeReview()}
        templates={templates}
        taskOperations={taskOperations}
        onReviewUpdated={vi.fn()}
      />,
    );

    expect((screen.getByLabelText('选择回流模板') as HTMLSelectElement).value).toBe('template-1');
    fireEvent.click(screen.getByRole('button', { name: '生成回流建议' }));

    await waitFor(() => {
      expect(taskOperations.suggestTemplateBackflow).toHaveBeenCalledWith({
        reviewId: 'review-1',
        templateId: 'template-1',
      });
    });
  });
});
