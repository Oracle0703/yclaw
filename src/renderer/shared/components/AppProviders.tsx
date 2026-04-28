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
import type { AppConfig, GeneralConfig } from '@shared/types';
import { useIpc } from '../hooks';
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
      colorBgLayout: isDark ? '#0b1220' : '#eef4fb',
      colorBgContainer: isDark ? 'rgba(15, 23, 42, 0.94)' : 'rgba(255, 255, 255, 0.96)',
      colorText: isDark ? '#f8fafc' : '#14213d',
      colorTextSecondary: isDark ? '#94a3b8' : '#526071',
      boxShadowSecondary: isDark
        ? '0 18px 42px rgba(2, 6, 23, 0.35)'
        : '0 18px 42px rgba(15, 23, 42, 0.08)',
    },
    components: {
      Layout: {
        siderBg: isDark ? '#081525' : '#0b1f33',
        headerBg: isDark ? 'rgba(8, 21, 37, 0.9)' : 'rgba(255, 255, 255, 0.92)',
        bodyBg: isDark ? '#0b1220' : '#eef4fb',
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

function normalizeThemePreference(value: unknown): GeneralConfig['theme'] {
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'system';
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light';
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getStoredThemePreference(): GeneralConfig['theme'] {
  if (typeof window === 'undefined') {
    return 'system';
  }

  return normalizeThemePreference(window.localStorage.getItem(THEME_STORAGE_KEY));
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

export function AppProviders({ children }: AppProvidersProps) {
  const { invoke } = useIpc();
  const channelRef = useRef<BroadcastChannel | null>(null);
  const [themePreference, setThemePreferenceState] =
    useState<GeneralConfig['theme']>(getStoredThemePreference);
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(getSystemTheme);
  const resolvedTheme = themePreference === 'system' ? systemTheme : themePreference;

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
    const nextTheme: ResolvedTheme = resolvedTheme === 'dark' ? 'light' : 'dark';
    await setThemePreference(nextTheme, { persist: true, broadcast: true });
  }, [resolvedTheme, setThemePreference]);

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
      } catch (error) {
        reportThemePreferenceFailure('主题偏好未同步', '读取主题偏好失败', error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [invoke]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (event: MediaQueryListEvent) => {
      setSystemTheme(event.matches ? 'dark' : 'light');
    };

    setSystemTheme(mediaQuery.matches ? 'dark' : 'light');
    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

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

  const themeContextValue = useMemo<ThemeContextValue>(
    () => ({
      themePreference,
      resolvedTheme,
      setThemePreference,
      toggleTheme,
    }),
    [resolvedTheme, setThemePreference, themePreference, toggleTheme],
  );

  return (
    <ThemeContext.Provider value={themeContextValue}>
      <ConfigProvider locale={zhCN} theme={buildThemeConfig(resolvedTheme)}>
        <AntdApp>
          <LoadingProvider>{children}</LoadingProvider>
          {/* <Tooltip title={`切换为${resolvedTheme === 'dark' ? '亮色' : '暗色'}主题`}>
            <FloatButton
              icon={resolvedTheme === 'dark' ? <SunOutlined /> : <MoonOutlined />}
              type="primary"
              onClick={() => {
                void toggleTheme();
              }}
              className="yclaw-theme-toggle"
              description={themePreference === 'system' ? <BulbOutlined /> : undefined}
            />
          </Tooltip> */}
        </AntdApp>
      </ConfigProvider>
    </ThemeContext.Provider>
  );
}
