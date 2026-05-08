/**
 * BackgroundProvider 集成测试
 * - 通过 AppProviders 暴露的 useBackground 来验证：
 *   1) 初始 mount 时 IPC CONFIG_GET_ALL 中的 appearance.background 会被加载
 *   2) setBackground({ persist: true }) 会调用 IPC CONFIG_SET 并写入 localStorage
 *   3) DOM 上的 CSS 变量会随之更新
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { IPC_CHANNELS } from '@shared/constants/channels';
import { AppProviders, useBackground } from '@renderer/shared/components/AppProviders';
import { BACKGROUND_STORAGE_KEY, DEFAULT_BACKGROUND } from '@renderer/shared/utils/background';

const { invokeMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
}));

vi.mock('@renderer/shared/hooks', () => ({
  useIpc: () => ({ invoke: invokeMock }),
}));

vi.mock('antd', async () => {
  const actual = await vi.importActual<typeof import('antd')>('antd');
  return {
    ...actual,
    notification: { ...actual.notification, warning: vi.fn() },
  };
});

function Probe({ exposeRef }: { exposeRef: (api: ReturnType<typeof useBackground>) => void }) {
  const api = useBackground();
  React.useEffect(() => {
    exposeRef(api);
  }, [api, exposeRef]);
  return (
    <div>
      <span data-testid="bg-type">{api.background.type}</span>
      <span data-testid="bg-value">{api.background.value}</span>
    </div>
  );
}

beforeEach(() => {
  invokeMock.mockReset();
  window.localStorage.clear();
  document.documentElement.removeAttribute('style');
});

afterEach(() => {
  document.documentElement.removeAttribute('style');
});

describe('BackgroundProvider via AppProviders', () => {
  it('loads background from CONFIG_GET_ALL on mount and applies CSS variables', async () => {
    const stored = {
      type: 'solid' as const,
      value: '#abcdef',
    };
    invokeMock.mockImplementation(async (channel: string) => {
      if (channel === IPC_CHANNELS.CONFIG_GET_ALL) {
        return {
          general: {
            theme: 'light',
            language: 'zh-CN',
            startupBehavior: 'showWorkbench',
            closeToTray: false,
            appearance: { background: stored },
          },
          modules: {},
          plugins: {},
          ai: {},
          featurePackages: {},
        };
      }
      return undefined;
    });

    let captured: ReturnType<typeof useBackground> | null = null;
    render(
      <AppProviders>
        <Probe exposeRef={(api) => (captured = api)} />
      </AppProviders>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('bg-type').textContent).toBe('solid');
      expect(screen.getByTestId('bg-value').textContent).toBe('#abcdef');
    });

    expect(document.documentElement.style.getPropertyValue('--yclaw-page-bg')).toBe('#abcdef');
    expect(captured).not.toBeNull();
  });

  it('persists background change to localStorage and IPC', async () => {
    invokeMock.mockImplementation(async (channel: string) => {
      if (channel === IPC_CHANNELS.CONFIG_GET_ALL) {
        return {
          general: {
            theme: 'light',
            language: 'zh-CN',
            startupBehavior: 'showWorkbench',
            closeToTray: false,
          },
          modules: {},
          plugins: {},
          ai: {},
          featurePackages: {},
        };
      }
      return undefined;
    });

    let captured: ReturnType<typeof useBackground> | null = null;
    render(
      <AppProviders>
        <Probe exposeRef={(api) => (captured = api)} />
      </AppProviders>,
    );

    await waitFor(() => expect(captured).not.toBeNull());

    await act(async () => {
      await captured!.setBackground(
        { type: 'solid', value: '#123456' },
        { persist: true, broadcast: false },
      );
    });

    expect(window.localStorage.getItem(BACKGROUND_STORAGE_KEY)).toContain('#123456');

    const setCalls = invokeMock.mock.calls.filter(
      ([channel]) => channel === IPC_CHANNELS.CONFIG_SET,
    );
    expect(setCalls.length).toBeGreaterThan(0);
    const lastSet = setCalls[setCalls.length - 1][1] as {
      key: string;
      value: { appearance: { background: { value: string } } };
    };
    expect(lastSet.key).toBe('general');
    expect(lastSet.value.appearance.background.value).toBe('#123456');

    expect(document.documentElement.style.getPropertyValue('--yclaw-page-bg')).toBe('#123456');
  });

  it('resetBackground restores DEFAULT_BACKGROUND', async () => {
    invokeMock.mockResolvedValue({
      general: {
        theme: 'light',
        language: 'zh-CN',
        startupBehavior: 'showWorkbench',
        closeToTray: false,
        appearance: { background: { type: 'solid', value: '#000000' } },
      },
      modules: {},
      plugins: {},
      ai: {},
      featurePackages: {},
    });

    let captured: ReturnType<typeof useBackground> | null = null;
    render(
      <AppProviders>
        <Probe exposeRef={(api) => (captured = api)} />
      </AppProviders>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('bg-value').textContent).toBe('#000000');
    });

    await act(async () => {
      await captured!.resetBackground();
    });

    await waitFor(() => {
      expect(screen.getByTestId('bg-type').textContent).toBe(DEFAULT_BACKGROUND.type);
      expect(screen.getByTestId('bg-value').textContent).toBe(DEFAULT_BACKGROUND.value);
    });
  });
});
