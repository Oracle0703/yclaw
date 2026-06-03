import type { ReactNode } from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { App as AntdApp, ConfigProvider, notification, theme as antdTheme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { IPC_CHANNELS } from '@shared/constants/channels';
import type { AppConfig, BackgroundConfig, GeneralConfig } from '@shared/types';
import { useIpc } from '../hooks';
import {
  BACKGROUND_CHANNEL_NAME,
  BACKGROUND_STORAGE_KEY,
  DEFAULT_BACKGROUND,
  applyBackground,
  normalizeBackground,
} from '../utils/background';
import { LoadingProvider } from './GlobalLoading';

interface AppProvidersProps {
  children: ReactNode;
}

type ResolvedTheme = 'light' | 'dark';

function buildThemeConfig(resolvedTheme: ResolvedTheme) {
  const isDark = resolvedTheme === 'dark';
  return {
    algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    token: {
      colorPrimary: '#1677ff',
      colorInfo: '#1677ff',
      colorSuccess: '#16a34a',
      colorWarning: '#d97706',
      colorError: '#dc2626',
      colorLink: '#1456cc',
      borderRadius: 14,
      borderRadiusLG: 18,
      wireframe: false,
      fontFamily: "'Avenir Next', 'PingFang SC', 'Microsoft YaHei', sans-serif",
      colorBgLayout: isDark ? '#0b1220' : 'transparent',
      colorBgContainer: isDark ? 'rgba(15, 23, 42, 0.94)' : 'rgba(255, 255, 255, 0.62)',
      colorText: isDark ? '#f8fafc' : '#14213d',
      colorTextSecondary: isDark ? '#94a3b8' : '#526071',
      boxShadowSecondary: isDark
        ? '0 18px 42px rgba(2, 6, 23, 0.35)'
        : '0 18px 42px rgba(15, 23, 42, 0.08)',
    },
    components: {
      Layout: {
        siderBg: isDark ? '#081525' : 'transparent',
        headerBg: isDark ? 'rgba(8, 21, 37, 0.9)' : 'rgba(255, 255, 255, 0.55)',
        bodyBg: isDark ? '#0b1220' : 'transparent',
      },
      Menu: {
        darkItemBg: 'transparent',
        darkItemColor: 'rgba(255, 255, 255, 0.72)',
        darkSubMenuItemBg: 'transparent',
        darkItemSelectedBg: 'rgba(22, 119, 255, 0.2)',
        darkItemSelectedColor: '#ffffff',
        darkItemHoverColor: '#ffffff',
      },
      Card: {
        boxShadowTertiary: isDark
          ? '0 20px 40px rgba(2, 6, 23, 0.3)'
          : '0 20px 40px rgba(15, 23, 42, 0.08)',
      },
      Table: {
        headerBg: isDark ? 'rgba(148, 163, 184, 0.08)' : 'rgba(15, 23, 42, 0.02)',
        headerColor: isDark ? '#e2e8f0' : '#1e293b',
      },
      Descriptions: {
        itemPaddingBottom: 12,
      },
      Statistic: {
        contentFontSize: 28,
      },
    },
  } as const;
}

interface ThemeContextValue {
  themePreference: GeneralConfig['theme'];
  resolvedTheme: ResolvedTheme;
  setThemePreference: (
    theme: GeneralConfig['theme'],
    options?: {
      persist?: boolean;
      broadcast?: boolean;
    },
  ) => Promise<void>;
  toggleTheme: () => Promise<void>;
}

const THEME_STORAGE_KEY = 'yclaw.theme.preference';
const THEME_CHANNEL_NAME = 'yclaw-theme';

const ThemeContext = createContext<ThemeContextValue | null>(null);

interface BackgroundContextValue {
  background: BackgroundConfig;
  setBackground: (
    next: BackgroundConfig,
    options?: { persist?: boolean; broadcast?: boolean },
  ) => Promise<void>;
  resetBackground: (options?: { persist?: boolean; broadcast?: boolean }) => Promise<void>;
}

const BackgroundContext = createContext<BackgroundContextValue | null>(null);

function getStoredBackground(): BackgroundConfig {
  if (typeof window === 'undefined') {
    return { ...DEFAULT_BACKGROUND };
  }
  try {
    const raw = window.localStorage.getItem(BACKGROUND_STORAGE_KEY);
    return raw ? normalizeBackground(JSON.parse(raw)) : { ...DEFAULT_BACKGROUND };
  } catch {
    return { ...DEFAULT_BACKGROUND };
  }
}

function normalizeThemePreference(value: unknown): GeneralConfig['theme'] {
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'system';
}

function getStoredThemePreference(): GeneralConfig['theme'] {
  // 当前产品要求：全应用以亮色实现，不再跟随系统/暗色，
  // 避免 dark 主题变量盖住用户在「桌面背景」里选择的颜色。
  // 因此始终返回 light，忽略历史持久化的 system/dark。
  return 'light';
}

function reportThemePreferenceFailure(title: string, fallbackMessage: string, error: unknown) {
  const description = error instanceof Error ? error.message : fallbackMessage;

  notification.warning({
    key: 'theme-preference-sync',
    message: title,
    description,
    placement: 'bottomRight',
  });

  if (import.meta.env.DEV) {
    console.error(`[AppProviders] ${title}`, error);
  }
}

export function useThemeMode() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useThemeMode must be used within AppProviders');
  }

  return context;
}

export function useBackground() {
  const context = useContext(BackgroundContext);

  if (!context) {
    throw new Error('useBackground must be used within AppProviders');
  }

  return context;
}

export function AppProviders({ children }: AppProvidersProps) {
  const { invoke } = useIpc();
  const channelRef = useRef<BroadcastChannel | null>(null);
  const backgroundChannelRef = useRef<BroadcastChannel | null>(null);
  const [themePreference, setThemePreferenceState] =
    useState<GeneralConfig['theme']>(getStoredThemePreference);
  const [background, setBackgroundState] = useState<BackgroundConfig>(getStoredBackground);
  // 全局锁定亮色主题：详见 getStoredThemePreference 注释。
  const resolvedTheme: ResolvedTheme = 'light';

  const setThemePreference = useCallback<ThemeContextValue['setThemePreference']>(
    async (theme, options) => {
      const nextTheme = normalizeThemePreference(theme);
      const shouldPersist = options?.persist ?? false;
      const shouldBroadcast = options?.broadcast ?? false;

      setThemePreferenceState(nextTheme);
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);

      if (shouldBroadcast) {
        channelRef.current?.postMessage({ theme: nextTheme });
      }

      if (!shouldPersist) {
        return;
      }

      try {
        const config = await invoke<AppConfig>(IPC_CHANNELS.CONFIG_GET_ALL);
        await invoke(IPC_CHANNELS.CONFIG_SET, {
          key: 'general',
          value: {
            ...config.general,
            theme: nextTheme,
          },
        });
      } catch (error) {
        reportThemePreferenceFailure('主题偏好未保存', '保存主题偏好失败', error);
      }
    },
    [invoke],
  );

  const toggleTheme = useCallback(async () => {
    const nextTheme: ResolvedTheme = 'light';
    await setThemePreference(nextTheme, { persist: true, broadcast: true });
  }, [setThemePreference]);

  const setBackground = useCallback<BackgroundContextValue['setBackground']>(
    async (next, options) => {
      const normalized = normalizeBackground(next);
      const shouldPersist = options?.persist ?? false;
      const shouldBroadcast = options?.broadcast ?? false;

      setBackgroundState(normalized);
      try {
        window.localStorage.setItem(BACKGROUND_STORAGE_KEY, JSON.stringify(normalized));
      } catch {
        // 忽略 localStorage 异常（如隐私模式）
      }

      if (shouldBroadcast) {
        backgroundChannelRef.current?.postMessage({ background: normalized });
      }

      if (!shouldPersist) {
        return;
      }

      try {
        const config = await invoke<AppConfig>(IPC_CHANNELS.CONFIG_GET_ALL);
        await invoke(IPC_CHANNELS.CONFIG_SET, {
          key: 'general',
          value: {
            ...config.general,
            appearance: { background: normalized },
          },
        });
      } catch (error) {
        reportThemePreferenceFailure('背景偏好未保存', '保存背景偏好失败', error);
      }
    },
    [invoke],
  );

  const resetBackground = useCallback<BackgroundContextValue['resetBackground']>(
    async (options) => {
      await setBackground({ ...DEFAULT_BACKGROUND }, options);
    },
    [setBackground],
  );

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const config = await invoke<AppConfig>(IPC_CHANNELS.CONFIG_GET_ALL);
        if (cancelled) {
          return;
        }

        const nextTheme = normalizeThemePreference(config.general.theme);
        setThemePreferenceState(nextTheme);
        window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);

        const nextBackground = normalizeBackground(config.general.appearance?.background);
        setBackgroundState(nextBackground);
        try {
          window.localStorage.setItem(BACKGROUND_STORAGE_KEY, JSON.stringify(nextBackground));
        } catch {
          // ignore
        }
      } catch (error) {
        reportThemePreferenceFailure('主题偏好未同步', '读取主题偏好失败', error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [invoke]);

  useEffect(() => {
    const channel =
      typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(THEME_CHANNEL_NAME) : null;
    channelRef.current = channel;

    if (channel) {
      channel.onmessage = (event: MessageEvent<{ theme?: GeneralConfig['theme'] }>) => {
        const nextTheme = normalizeThemePreference(event.data?.theme);
        setThemePreferenceState(nextTheme);
        window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
      };
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY) {
        return;
      }

      setThemePreferenceState(normalizeThemePreference(event.newValue));
    };

    window.addEventListener('storage', handleStorage);

    return () => {
      channel?.close();
      channelRef.current = null;
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.style.colorScheme = resolvedTheme;
    document.body.dataset.theme = resolvedTheme;
  }, [resolvedTheme]);

  useEffect(() => {
    applyBackground(background);
  }, [background]);

  useEffect(() => {
    const channel =
      typeof BroadcastChannel !== 'undefined'
        ? new BroadcastChannel(BACKGROUND_CHANNEL_NAME)
        : null;
    backgroundChannelRef.current = channel;

    if (channel) {
      channel.onmessage = (event: MessageEvent<{ background?: BackgroundConfig }>) => {
        setBackgroundState(normalizeBackground(event.data?.background));
      };
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== BACKGROUND_STORAGE_KEY) {
        return;
      }
      try {
        const parsed = event.newValue ? JSON.parse(event.newValue) : null;
        setBackgroundState(normalizeBackground(parsed));
      } catch {
        // 忽略解析异常
      }
    };

    window.addEventListener('storage', handleStorage);

    return () => {
      channel?.close();
      backgroundChannelRef.current = null;
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const themeContextValue = useMemo<ThemeContextValue>(
    () => ({
      themePreference,
      resolvedTheme,
      setThemePreference,
      toggleTheme,
    }),
    [resolvedTheme, setThemePreference, themePreference, toggleTheme],
  );

  const backgroundContextValue = useMemo<BackgroundContextValue>(
    () => ({
      background,
      setBackground,
      resetBackground,
    }),
    [background, setBackground, resetBackground],
  );

  return (
    <ThemeContext.Provider value={themeContextValue}>
      <BackgroundContext.Provider value={backgroundContextValue}>
        <ConfigProvider locale={zhCN} theme={buildThemeConfig(resolvedTheme)}>
          <AntdApp>
            <LoadingProvider>{children}</LoadingProvider>
          </AntdApp>
        </ConfigProvider>
      </BackgroundContext.Provider>
    </ThemeContext.Provider>
  );
}
