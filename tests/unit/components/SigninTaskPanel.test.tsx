import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
  it('submits a JD sign-in task by default', () => {
    const sessions: BrowserSession[] = [
      {
        id: 'session-1',
        name: '京东主账号',
        domain: 'jd.com',
        partition: 'persist:session_1',
        createdAt: '2026-04-28T00:00:00.000Z',
        updatedAt: '2026-04-28T00:00:00.000Z',
      },
    ];
    const onSubmit = vi.fn();

    render(<SigninTaskPanel sessions={sessions} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText('任务名称'), { target: { value: '京东签到' } });
    fireEvent.change(screen.getByLabelText('入口地址'), { target: { value: 'https://interact.jd.com/' } });
    fireEvent.change(screen.getByLabelText('浏览器会话'), { target: { value: 'session-1' } });
    fireEvent.change(screen.getByLabelText('失败重试次数'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: '保存签到任务' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: null,
        name: '京东签到',
        entryUrl: 'https://interact.jd.com/',
        sessionId: 'session-1',
        enabled: true,
        signin: expect.objectContaining({
          site: 'jd',
          mode: 'browser-first-api-fallback',
          fallbackApiEnabled: false,
          refreshToken: null,
          maxRetryPerDay: 2,
          manualInterventionEnabled: true,
        }),
      }),
    );
  });

  it('does not render capture-login action when onCaptureLogin is not a function at runtime', () => {
    render(
      <SigninTaskPanel
        taskId="task-signin-1"
        sessions={[]}
        onSubmit={vi.fn()}
        {...({ onCaptureLogin: 'invalid-runtime-prop' } as unknown as React.ComponentProps<
          typeof SigninTaskPanel
        >)}
      />,
    );

    expect(screen.queryByRole('button', { name: '打开浏览器采集登录态' })).toBeNull();
  });

  it('submits a JD sign-in task using browser session login state', () => {
    const onSubmit = vi.fn();

    render(<SigninTaskPanel sessions={[]} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText('任务名称'), { target: { value: '京东签到' } });
    fireEvent.click(screen.getByRole('button', { name: '保存签到任务' }));

    expect(screen.queryByLabelText('签到站点')).toBeNull();
    expect(screen.queryByLabelText('Refresh Token')).toBeNull();
    expect(screen.getByText('复用京东浏览器会话 Cookie/localStorage')).toBeDefined();
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: '京东签到',
        entryUrl: 'https://interact.jd.com/',
        signin: expect.objectContaining({
          site: 'jd',
          mode: 'browser-first-api-fallback',
          fallbackApiEnabled: false,
          refreshToken: null,
          manualInterventionEnabled: true,
        }),
      }),
    );
  });

  it('shows login-state capture for JD tasks', async () => {
    const onCaptureLogin = vi.fn().mockResolvedValue({
      taskId: 'task-jd',
      refreshToken: null,
      userName: '京东账号',
      localStorageSnapshot: {
        area: '22_1930',
      },
      captureDiagnostics: {
        pageUrl: 'https://www.jd.com/',
        pageTitle: '京东',
        cookieDomains: ['.jd.com'],
      },
      timedOut: false,
    });

    render(
      <SigninTaskPanel
        sessions={[]}
        onSubmit={vi.fn()}
        onCaptureLogin={onCaptureLogin}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '打开浏览器采集登录态' }));
    });

    expect(onCaptureLogin).toHaveBeenCalledWith(
      expect.objectContaining({
        name: '京东签到',
        entryUrl: 'https://interact.jd.com/',
        signin: expect.objectContaining({
          site: 'jd',
        }),
      }),
    );
    expect(screen.getByText('已采集')).toBeDefined();
  });

  it('captures login for an unsaved draft by passing the current draft payload', async () => {
    const onCaptureLogin = vi.fn().mockResolvedValue({
      taskId: 'task-signin-new',
      refreshToken: 'rt-captured',
    });

    render(
      <SigninTaskPanel
        sessions={[]}
        onSubmit={vi.fn()}
        onCaptureLogin={onCaptureLogin}
        initialTaskName="京东签到"
        initialValue={{
          entryUrl: 'https://interact.jd.com/',
          sessionId: null,
          enabled: true,
          signin: {
            site: 'jd',
            mode: 'browser-first-api-fallback',
            fallbackApiEnabled: false,
            refreshToken: null,
            maxRetryPerDay: 1,
            manualInterventionEnabled: true,
          },
        }}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '打开浏览器采集登录态' }));
    });

    expect(onCaptureLogin).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: null,
        name: '京东签到',
        entryUrl: 'https://interact.jd.com/',
        sessionId: null,
        enabled: true,
        signin: expect.objectContaining({
          site: 'jd',
          mode: 'browser-first-api-fallback',
          fallbackApiEnabled: false,
          refreshToken: null,
          maxRetryPerDay: 1,
          manualInterventionEnabled: true,
        }),
      }),
    );

    expect(screen.getByText('检测到京东 Cookie/localStorage 后会自动保存并关闭窗口')).toBeDefined();
  });

  it('preserves captured login metadata when saving after token capture', async () => {
    const onSubmit = vi.fn();
    const onCaptureLogin = vi.fn().mockResolvedValue({
      taskId: 'task-signin-1',
      refreshToken: 'rt-captured',
      accessToken: 'at-captured',
      userName: '测试账号',
      userId: 'uid-1',
      defaultDriveId: 'drive-1',
      expiresAt: '2026-05-01T00:00:00.000Z',
      tokenType: 'Bearer',
      tokenPayload: {
        refresh_token: 'rt-captured',
        access_token: 'at-captured',
        user_name: '测试账号',
      },
      localStorageSnapshot: {
        token: '{"refresh_token":"rt-captured"}',
        shareToken: 'share-demo',
      },
    });

    render(
      <SigninTaskPanel
        taskId="task-signin-1"
        sessions={[]}
        onSubmit={onSubmit}
        onCaptureLogin={onCaptureLogin}
        initialTaskName="京东签到"
        initialValue={{
          entryUrl: 'https://interact.jd.com/',
          sessionId: null,
          enabled: true,
          signin: {
            site: 'jd',
            mode: 'browser-first-api-fallback',
            fallbackApiEnabled: false,
            refreshToken: null,
            maxRetryPerDay: 1,
            manualInterventionEnabled: true,
          },
        }}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '打开浏览器采集登录态' }));
    });
    await waitFor(() => {
      expect(onCaptureLogin).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: 'task-signin-1',
          name: '京东签到',
        }),
      );
    });
    await waitFor(() => {
      expect(screen.getByText('已采集')).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: '保存签到任务' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: 'task-signin-1',
        name: '京东签到',
        entryUrl: 'https://interact.jd.com/',
        sessionId: null,
        enabled: true,
        signin: expect.objectContaining({
          site: 'jd',
          mode: 'browser-first-api-fallback',
          fallbackApiEnabled: false,
          refreshToken: null,
          accessToken: 'at-captured',
          userName: '测试账号',
          userId: 'uid-1',
          defaultDriveId: 'drive-1',
          expiresAt: '2026-05-01T00:00:00.000Z',
          tokenType: 'Bearer',
          tokenPayload: {
            refresh_token: 'rt-captured',
            access_token: 'at-captured',
            user_name: '测试账号',
          },
          localStorageSnapshot: {
            token: '{"refresh_token":"rt-captured"}',
            shareToken: 'share-demo',
          },
          maxRetryPerDay: 1,
          manualInterventionEnabled: true,
        }),
      }),
    );
  });

  it('renders captured login fields and localStorage key summary', () => {
    render(
      <SigninTaskPanel
        taskId="task-signin-1"
        sessions={[]}
        onSubmit={vi.fn()}
        initialTaskName="京东签到"
        initialValue={{
          entryUrl: 'https://interact.jd.com/',
          sessionId: null,
          enabled: true,
          signin: {
            site: 'jd',
            mode: 'browser-first-api-fallback',
            fallbackApiEnabled: false,
            refreshToken: 'rt-captured',
            accessToken: 'at-captured',
            userName: '测试账号',
            userId: 'uid-1',
            defaultDriveId: 'drive-1',
            expiresAt: '2026-05-01T00:00:00.000Z',
            tokenType: 'Bearer',
            tokenPayload: {
              refresh_token: 'rt-captured',
            },
            localStorageSnapshot: {
              token: '{"refresh_token":"rt-captured"}',
              shareToken: 'share-demo',
            },
            maxRetryPerDay: 1,
            manualInterventionEnabled: true,
          },
        }}
      />,
    );

    expect(screen.getByText('已采集')).toBeDefined();
    expect(screen.getByText('登录态已获取，预览窗口会自动关闭')).toBeDefined();
    expect(screen.getByText('账号昵称：测试账号')).toBeDefined();
    expect(screen.getByText('用户 ID：uid-1')).toBeDefined();
    expect(screen.getByText('Token 类型：Bearer')).toBeDefined();
    expect(screen.getByText('localStorage 已采集 2 项')).toBeDefined();
    expect(screen.getByText('token, shareToken')).toBeDefined();
  });

  it('renders capture diagnostics when login capture fails without a token', async () => {
    const onCaptureLogin = vi.fn().mockResolvedValue({
      taskId: 'task-signin-1',
      refreshToken: null,
      captureDiagnostics: {
        pageUrl: 'https://interact.jd.com/',
        pageTitle: '我的京东-互动中心',
        localStorageKeys: ['theme', 'lang'],
        sessionStorageKeys: ['traceId'],
        cookieDomains: ['.jd.com', '.jd.hk'],
        networkResponseCount: 3,
        tokenHintResponseUrls: ['https://passport.jd.com/new/login.aspx'],
      },
    });

    render(
      <SigninTaskPanel
        taskId="task-signin-1"
        sessions={[]}
        onSubmit={vi.fn()}
        onCaptureLogin={onCaptureLogin}
        initialTaskName="京东签到"
        initialValue={{
          entryUrl: 'https://interact.jd.com/',
          sessionId: null,
          enabled: true,
          signin: {
            site: 'jd',
            mode: 'browser-first-api-fallback',
            fallbackApiEnabled: false,
            refreshToken: null,
            maxRetryPerDay: 1,
            manualInterventionEnabled: true,
          },
        }}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '打开浏览器采集登录态' }));
    });

    await waitFor(() => {
      expect(screen.getByText('最近一次采集诊断')).toBeDefined();
    });
    expect(screen.getByText('页面地址：https://interact.jd.com/')).toBeDefined();
    expect(screen.getByText('页面标题：我的京东-互动中心')).toBeDefined();
    expect(screen.getByText('LocalStorage Keys：theme, lang')).toBeDefined();
    expect(screen.getByText('SessionStorage Keys：traceId')).toBeDefined();
    expect(screen.getByText('Cookie 域：.jd.com, .jd.hk')).toBeDefined();
    expect(screen.getByText('网络响应数：3')).toBeDefined();
    expect(
      screen.getByText(
        '含 Token 线索的响应：https://passport.jd.com/new/login.aspx',
      ),
    ).toBeDefined();
  });
});
