import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import type { SigninRunSummary } from '@shared/types';
import { SigninRunStatusCard } from '@renderer/entries/automation/components/SigninRunStatusCard';

vi.mock('antd', () => ({
  Button: ({
    children,
    onClick,
    disabled,
  }: {
    children?: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button type="button" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
  Space: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Tag: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  Typography: {
    Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  },
  Alert: ({
    message,
    description,
  }: {
    message?: React.ReactNode;
    description?: React.ReactNode;
  }) => (
    <div>
      <div>{message}</div>
      <div>{description}</div>
    </div>
  ),
}));

vi.mock('@ant-design/pro-components', () => ({
  ProCard: ({ children, title }: { children?: React.ReactNode; title?: React.ReactNode }) => (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  ),
}));

describe('SigninRunStatusCard', () => {
  it('renders latest sign-in summary and supports run-now execution', () => {
    const summary: SigninRunSummary = {
      taskId: 'task-signin-1',
      status: 'success',
      strategyUsed: 'api-fallback',
      detail: '本月累计签到 5 天 - 云朵 x1',
      runAt: '2026-04-28T08:30:00.000Z',
      retryCount: 1,
    };
    const onRunNow = vi.fn();

    render(
      <SigninRunStatusCard
        taskId="task-signin-1"
        summary={summary}
        history={[
          {
            taskId: 'task-signin-1',
            status: 'success',
            strategyUsed: 'browser',
            runAt: '2026-04-28T08:00:00.000Z',
            retryCount: 0,
          },
        ]}
        onRunNow={onRunNow}
        onRetryIntervention={vi.fn()}
      />,
    );

    expect(screen.getByText('success')).toBeDefined();
    expect(screen.getByText(/本月累计签到 5 天/)).toBeDefined();
    expect(screen.getByText('最近执行：2026-04-28 16:30:00')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: '立即执行' }));
    expect(onRunNow).toHaveBeenCalledWith('task-signin-1');
  });

  it('shows intervention retry action when the latest run needs manual handling', () => {
    const summary: SigninRunSummary = {
      taskId: 'task-signin-1',
      status: 'needs_intervention',
      failureReason: 'session_expired',
      detail: '请重新登录后重试',
      runAt: '2026-04-28T08:30:00.000Z',
      retryCount: 1,
    };
    const onRetryIntervention = vi.fn();

    render(
      <SigninRunStatusCard
        taskId="task-signin-1"
        summary={summary}
        history={[]}
        onRunNow={vi.fn()}
        onRetryIntervention={onRetryIntervention}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '处理完成，重试' }));
    expect(onRetryIntervention).toHaveBeenCalledWith('task-signin-1');
  });

  it('renders JD bean reward summary when present', () => {
    const summary: SigninRunSummary = {
      taskId: 'task-jd-1',
      status: 'success',
      strategyUsed: 'browser',
      detail: '京东签到成功，本次获得 2 京豆，当前余额 2 京豆',
      reward: {
        earnedBeans: 2,
        balance: 2,
        balanceStr: '0.02',
        detailText: '活动奖励京豆',
      },
      runAt: '2026-04-29T09:30:00.000Z',
      retryCount: 0,
    };

    render(
      <SigninRunStatusCard
        taskId="task-jd-1"
        summary={summary}
        history={[]}
        onRunNow={vi.fn()}
        onRetryIntervention={vi.fn()}
      />,
    );

    expect(screen.getByText('本次获得：2 京豆')).toBeDefined();
    expect(screen.getByText('当前余额：2 京豆')).toBeDefined();
    expect(screen.getByText('余额显示：0.02')).toBeDefined();
    expect(screen.getByText('最近明细：活动奖励京豆')).toBeDefined();
  });

  it('renders debug snapshot details when present', () => {
    const summary: SigninRunSummary = {
      taskId: 'task-signin-1',
      status: 'needs_intervention',
      failureReason: 'reward_button_not_found',
      detail: '页面未找到领取按钮',
      debug: {
        pageUrl: 'https://www.aliyundrive.com/drive',
        pageTitle: '阿里云盘',
        domSummary: '精选活动 4月28日',
        readyState: 'complete',
        visibilityState: 'hidden',
        viewport: '0x0',
        activityAnchorFound: false,
        signBarCount: 0,
        dateCardCandidateCount: 0,
        screenshotDataUrl: 'data:image/png;base64,ui-debug',
      },
      runAt: '2026-04-28T08:30:00.000Z',
      retryCount: 1,
    };

    render(
      <SigninRunStatusCard
        taskId="task-signin-1"
        summary={summary}
        history={[
          {
            taskId: 'task-signin-1',
            status: 'success',
            strategyUsed: 'browser',
            runAt: '2026-04-28T08:00:00.000Z',
            retryCount: 0,
          },
          {
            taskId: 'task-signin-1',
            status: 'needs_intervention',
            failureReason: 'reward_button_not_found',
            strategyUsed: 'api-fallback',
            runAt: '2026-04-28T08:30:00.000Z',
            retryCount: 1,
          },
        ]}
        onRunNow={vi.fn()}
        onRetryIntervention={vi.fn()}
      />,
    );

    expect(screen.getByText(/页面标题：阿里云盘/)).toBeDefined();
    expect(screen.getByText(/页面地址：https:\/\/www\.aliyundrive\.com\/drive/)).toBeDefined();
    expect(screen.getByText(/DOM 摘要：精选活动 4月28日/)).toBeDefined();
    expect(screen.getByText(/文档状态：complete/)).toBeDefined();
    expect(screen.getByText(/页面可见性：hidden/)).toBeDefined();
    expect(screen.getByText(/视口尺寸：0x0/)).toBeDefined();
    expect(screen.getByText(/活动锚点：未找到/)).toBeDefined();
    expect(screen.getByText(/签到卡数量：0/)).toBeDefined();
    expect(screen.getByText(/日期卡候选数：0/)).toBeDefined();
    expect(screen.getByRole('img', { name: '失败截图预览' }).getAttribute('src')).toBe(
      'data:image/png;base64,ui-debug',
    );
    expect(screen.getByText('最近运行记录')).toBeDefined();
    expect(screen.getByText(/2026-04-28 16:00:00 · success · browser · 重试 0/)).toBeDefined();
    expect(
      screen.getByText(/2026-04-28 16:30:00 · needs_intervention · api-fallback · reward_button_not_found · 重试 1/),
    ).toBeDefined();
  });
});
