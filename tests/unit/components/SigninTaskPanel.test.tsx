import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import type { BrowserSession } from '@shared/types';
import { SigninTaskPanel } from '@renderer/entries/automation/components/SigninTaskPanel';

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
}));

vi.mock('@ant-design/pro-components', () => ({
  ProCard: ({ children, title }: { children?: React.ReactNode; title?: React.ReactNode }) => (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  ),
}));

describe('SigninTaskPanel', () => {
  it('submits a browser-first aliyundrive sign-in task with optional refresh token fallback', () => {
    const sessions: BrowserSession[] = [
      {
        id: 'session-1',
        name: '阿里云盘主账号',
        domain: 'aliyundrive.com',
        partition: 'persist:session_1',
        createdAt: '2026-04-28T00:00:00.000Z',
        updatedAt: '2026-04-28T00:00:00.000Z',
      },
    ];
    const onSubmit = vi.fn();

    render(<SigninTaskPanel sessions={sessions} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText('任务名称'), { target: { value: '阿里云盘签到' } });
    fireEvent.change(screen.getByLabelText('入口地址'), { target: { value: 'https://www.aliyundrive.com/' } });
    fireEvent.change(screen.getByLabelText('浏览器会话'), { target: { value: 'session-1' } });
    fireEvent.change(screen.getByLabelText('Refresh Token'), { target: { value: 'rt-demo' } });
    fireEvent.change(screen.getByLabelText('失败重试次数'), { target: { value: '2' } });
    fireEvent.click(screen.getByLabelText('启用 API 兜底'));
    fireEvent.click(screen.getByRole('button', { name: '保存签到任务' }));

    expect(onSubmit).toHaveBeenCalledWith({
      taskId: null,
      name: '阿里云盘签到',
      entryUrl: 'https://www.aliyundrive.com/',
      sessionId: 'session-1',
      enabled: true,
      signin: {
        site: 'aliyundrive',
        mode: 'browser-first-api-fallback',
        fallbackApiEnabled: true,
        refreshToken: 'rt-demo',
        maxRetryPerDay: 2,
        manualInterventionEnabled: true,
      },
    });
  });
});
