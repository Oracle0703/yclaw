import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const {
  listReviewsMock,
  createReviewMock,
  linkReviewTemplateMock,
  suggestTemplateBackflowMock,
  createTemplateBackflowDraftMock,
  applyTemplateBackflowDraftMock,
} = vi.hoisted(() => ({
  listReviewsMock: vi.fn(),
  createReviewMock: vi.fn(),
  linkReviewTemplateMock: vi.fn(),
  suggestTemplateBackflowMock: vi.fn(),
  createTemplateBackflowDraftMock: vi.fn(),
  applyTemplateBackflowDraftMock: vi.fn(),
}));

vi.mock('antd', () => ({
  Button: ({
    children,
    onClick,
  }: {
    children?: React.ReactNode;
    onClick?: () => void;
  }) => <button type="button" onClick={onClick}>{children}</button>,
  List: ({
    dataSource,
    renderItem,
  }: {
    dataSource?: Array<unknown>;
    renderItem: (item: unknown) => React.ReactNode;
  }) => <div>{(dataSource ?? []).map((item, index) => <div key={index}>{renderItem(item)}</div>)}</div>,
  Space: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@renderer/shared/hooks', () => ({
  useIpc: () => ({
    taskOperations: {
      listReviews: listReviewsMock,
      createReview: createReviewMock,
      linkReviewTemplate: linkReviewTemplateMock,
      suggestTemplateBackflow: suggestTemplateBackflowMock,
      createTemplateBackflowDraft: createTemplateBackflowDraftMock,
      applyTemplateBackflowDraft: applyTemplateBackflowDraftMock,
    },
  }),
}));

import { ReviewPanel } from '@renderer/entries/automation/components/ReviewPanel';

describe('ReviewPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listReviewsMock.mockResolvedValue([
      { id: 'review-1', conclusion: '更新模板选择器', reviewType: 'failure' },
    ]);
    createReviewMock.mockResolvedValue({ id: 'review-2' });
    linkReviewTemplateMock.mockResolvedValue({ reviewId: 'review-1', templateId: 'template-1' });
    suggestTemplateBackflowMock.mockResolvedValue({
      reviewId: 'review-1',
      templateId: 'template-1',
      recommended: true,
      reason: '建议回流模板',
    });
    createTemplateBackflowDraftMock.mockResolvedValue({
      reviewId: 'review-1',
      templateId: 'template-1',
      title: '回流复盘结论到模板',
      status: 'draft',
      riskLevel: 'medium',
      proposedChanges: [
        { type: 'selector-update', description: '价格字段选择器需要改为 .price-current' },
      ],
      executionSteps: ['更新模板字段或选择器'],
      acceptanceCriteria: ['模板更新后通过一次任务试运行'],
    });
    applyTemplateBackflowDraftMock.mockResolvedValue({
      reviewId: 'review-1',
      templateId: 'template-1',
      appliedBy: '当前值班员',
      appliedChanges: ['价格字段选择器需要改为 .price-current'],
    });
  });

  it('loads reviews and creates a new one', async () => {
    render(<ReviewPanel taskId="task-1" />);

    expect(await screen.findByText('更新模板选择器')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: '创建复盘' }));

    await waitFor(() => {
      expect(createReviewMock).toHaveBeenCalledWith(
        expect.objectContaining({ taskId: 'task-1' }),
      );
    });
  });

  it('links selected template to review record', async () => {
    render(<ReviewPanel taskId="task-1" selectedTemplateId="template-1" />);

    expect(await screen.findByText('更新模板选择器')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: '关联当前模板' }));

    await waitFor(() => {
      expect(linkReviewTemplateMock).toHaveBeenCalledWith({
        reviewId: 'review-1',
        templateId: 'template-1',
      });
    });
  });

  it('shows template backflow suggestion for selected template', async () => {
    render(<ReviewPanel taskId="task-1" selectedTemplateId="template-1" />);

    expect(await screen.findByText('更新模板选择器')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: '生成回流建议' }));

    expect(await screen.findByText('建议回流模板')).toBeDefined();
    expect(suggestTemplateBackflowMock).toHaveBeenCalledWith({
      reviewId: 'review-1',
      templateId: 'template-1',
    });
  });

  it('shows executable template backflow draft for selected template', async () => {
    render(<ReviewPanel taskId="task-1" selectedTemplateId="template-1" />);

    expect(await screen.findByText('更新模板选择器')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: '生成回流草稿' }));

    expect(await screen.findByText('价格字段选择器需要改为 .price-current')).toBeDefined();
    expect(await screen.findByText('更新模板字段或选择器')).toBeDefined();
    expect(await screen.findByText('模板更新后通过一次任务试运行')).toBeDefined();
    expect(createTemplateBackflowDraftMock).toHaveBeenCalledWith({
      reviewId: 'review-1',
      templateId: 'template-1',
    });
  });

  it('applies generated template backflow draft', async () => {
    render(<ReviewPanel taskId="task-1" selectedTemplateId="template-1" />);

    expect(await screen.findByText('更新模板选择器')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: '生成回流草稿' }));
    expect(await screen.findByText('价格字段选择器需要改为 .price-current')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: '应用回流草稿' }));

    expect(await screen.findByText('回流草稿已应用到模板')).toBeDefined();
    expect(applyTemplateBackflowDraftMock).toHaveBeenCalledWith({
      draft: expect.objectContaining({
        reviewId: 'review-1',
        templateId: 'template-1',
      }),
      appliedBy: '当前值班员',
    });
  });
});
