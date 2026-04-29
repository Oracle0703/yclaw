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
  it('submits an api-first aliyundrive sign-in task with optional browser fallback', () => {
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
    fireEvent.click(screen.getByLabelText('启用页面补充'));
    fireEvent.click(screen.getByRole('button', { name: '保存签到任务' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: null,
        name: '阿里云盘签到',
        entryUrl: 'https://www.aliyundrive.com/',
        sessionId: 'session-1',
        enabled: true,
        signin: expect.objectContaining({
          site: 'aliyundrive',
          mode: 'api-first-browser-fallback',
          fallbackApiEnabled: true,
          refreshToken: 'rt-demo',
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

    expect(screen.queryByRole('button', { name: '打开登录页采集 Token' })).toBeNull();
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
        initialTaskName="阿里云盘签到"
        initialValue={{
          entryUrl: 'https://www.aliyundrive.com/',
          sessionId: null,
          enabled: true,
          signin: {
            site: 'aliyundrive',
            mode: 'api-first-browser-fallback',
            fallbackApiEnabled: true,
            refreshToken: null,
            maxRetryPerDay: 1,
            manualInterventionEnabled: true,
          },
        }}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '打开登录页采集 Token' }));
    });

    expect(onCaptureLogin).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: null,
        name: '阿里云盘签到',
        entryUrl: 'https://www.aliyundrive.com/',
        sessionId: null,
        enabled: true,
        signin: expect.objectContaining({
          site: 'aliyundrive',
          mode: 'api-first-browser-fallback',
          fallbackApiEnabled: true,
          refreshToken: null,
          maxRetryPerDay: 1,
          manualInterventionEnabled: true,
        }),
      }),
    );

    expect(screen.getByText('检测到登录态后会自动保存并关闭预览窗口')).toBeDefined();
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
        initialTaskName="阿里云盘签到"
        initialValue={{
          entryUrl: 'https://www.aliyundrive.com/',
          sessionId: null,
          enabled: true,
          signin: {
            site: 'aliyundrive',
            mode: 'api-first-browser-fallback',
            fallbackApiEnabled: false,
            refreshToken: null,
            maxRetryPerDay: 1,
            manualInterventionEnabled: true,
          },
        }}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '打开登录页采集 Token' }));
    });
    await waitFor(() => {
      expect(onCaptureLogin).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: 'task-signin-1',
          name: '阿里云盘签到',
        }),
      );
    });
    await waitFor(() => {
      expect((screen.getByLabelText('Refresh Token') as HTMLTextAreaElement).value).toBe(
        'rt-captured',
      );
    });

    fireEvent.click(screen.getByRole('button', { name: '保存签到任务' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: 'task-signin-1',
        name: '阿里云盘签到',
        entryUrl: 'https://www.aliyundrive.com/',
        sessionId: null,
        enabled: true,
        signin: expect.objectContaining({
          site: 'aliyundrive',
          mode: 'api-first-browser-fallback',
          fallbackApiEnabled: true,
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
        initialTaskName="阿里云盘签到"
        initialValue={{
          entryUrl: 'https://www.aliyundrive.com/',
          sessionId: null,
          enabled: true,
          signin: {
            site: 'aliyundrive',
            mode: 'api-first-browser-fallback',
            fallbackApiEnabled: true,
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
    expect(screen.getByText('默认网盘 ID：drive-1')).toBeDefined();
    expect(screen.getByText('Token 类型：Bearer')).toBeDefined();
    expect(screen.getByText('localStorage 已采集 2 项')).toBeDefined();
    expect(screen.getByText('token, shareToken')).toBeDefined();
  });

  it('renders capture diagnostics when login capture fails without a token', async () => {
    const onCaptureLogin = vi.fn().mockResolvedValue({
      taskId: 'task-signin-1',
      refreshToken: null,
      captureDiagnostics: {
        pageUrl: 'https://www.aliyundrive.com/drive',
        pageTitle: '阿里云盘',
        localStorageKeys: ['theme', 'lang'],
        sessionStorageKeys: ['traceId'],
        cookieDomains: ['.aliyundrive.com', '.alipan.com'],
        networkResponseCount: 3,
        tokenHintResponseUrls: ['https://passport.aliyundrive.com/newlogin/login.do?appName=aliyun'],
      },
    });

    render(
      <SigninTaskPanel
        taskId="task-signin-1"
        sessions={[]}
        onSubmit={vi.fn()}
        onCaptureLogin={onCaptureLogin}
        initialTaskName="阿里云盘签到"
        initialValue={{
          entryUrl: 'https://www.aliyundrive.com/',
          sessionId: null,
          enabled: true,
          signin: {
            site: 'aliyundrive',
            mode: 'api-first-browser-fallback',
            fallbackApiEnabled: true,
            refreshToken: null,
            maxRetryPerDay: 1,
            manualInterventionEnabled: true,
          },
        }}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '打开登录页采集 Token' }));
    });

    await waitFor(() => {
      expect(screen.getByText('最近一次采集诊断')).toBeDefined();
    });
    expect(screen.getByText('页面地址：https://www.aliyundrive.com/drive')).toBeDefined();
    expect(screen.getByText('页面标题：阿里云盘')).toBeDefined();
    expect(screen.getByText('LocalStorage Keys：theme, lang')).toBeDefined();
    expect(screen.getByText('SessionStorage Keys：traceId')).toBeDefined();
    expect(screen.getByText('Cookie 域：.aliyundrive.com, .alipan.com')).toBeDefined();
    expect(screen.getByText('网络响应数：3')).toBeDefined();
    expect(
      screen.getByText(
        '含 Token 线索的响应：https://passport.aliyundrive.com/newlogin/login.do?appName=aliyun',
      ),
    ).toBeDefined();
  });
});
