import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppstoreOutlined,
  FundOutlined,
  GlobalOutlined,
  PlusOutlined,
  ReloadOutlined,
  RobotOutlined,
  SearchOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { Input, List, Modal, Space, Tag, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { CommandRegistry, getCommandRegistry, type Command } from './CommandRegistry';

const RECENT_KEY = 'yclaw-command-palette-recent';
const MAX_RECENT = 10;

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveRecent(ids: string[]): void {
  localStorage.setItem(RECENT_KEY, JSON.stringify(ids.slice(0, MAX_RECENT)));
}

const CATEGORY_LABEL: Record<string, string> = {
  navigation: '导航',
  action: '操作',
  system: '系统',
};

const ICON_MAP: Record<string, React.ReactNode> = {
  stock: <FundOutlined />,
  automation: <RobotOutlined />,
  browser: <GlobalOutlined />,
  'plugin-center': <AppstoreOutlined />,
  settings: <SettingOutlined />,
  newTask: <PlusOutlined />,
  refresh: <ReloadOutlined />,
};

export default function CommandPalette() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Command[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recent, setRecent] = useState<string[]>(loadRecent);
  const inputRef = useRef<ReturnType<typeof Input.Search> | null>(null);
  const registryRef = useRef<CommandRegistry>(getCommandRegistry());

  // Register default commands
  useEffect(() => {
    const registry = registryRef.current;
    const commands: Command[] = [
      {
        id: 'nav:stock',
        name: '跳转到股票分析',
        icon: 'stock',
        shortcut: 'Ctrl+2',
        category: 'navigation',
        execute: () => navigate('/stock'),
      },
      {
        id: 'nav:automation',
        name: '跳转到自动化采集',
        icon: 'automation',
        shortcut: 'Ctrl+3',
        category: 'navigation',
        execute: () => navigate('/automation'),
      },
      {
        id: 'nav:browser',
        name: '跳转到内嵌浏览器',
        icon: 'browser',
        shortcut: 'Ctrl+4',
        category: 'navigation',
        execute: () => navigate('/browser'),
      },
      {
        id: 'nav:plugin-center',
        name: '跳转到插件中心',
        icon: 'plugin-center',
        shortcut: 'Ctrl+5',
        category: 'navigation',
        execute: () => navigate('/plugin-center'),
      },
      {
        id: 'nav:settings',
        name: '打开设置',
        icon: 'settings',
        shortcut: 'Ctrl+,',
        category: 'navigation',
        execute: () => navigate('/settings'),
      },
      {
        id: 'nav:home',
        name: '返回首页',
        icon: 'stock',
        category: 'navigation',
        execute: () => navigate('/'),
      },
      {
        id: 'action:newTask',
        name: '新建自动化任务',
        icon: 'newTask',
        shortcut: 'Ctrl+N',
        category: 'action',
        execute: () => navigate('/automation'),
      },
      {
        id: 'action:refresh',
        name: '刷新数据',
        icon: 'refresh',
        shortcut: 'Ctrl+R',
        category: 'action',
        execute: () => window.location.reload(),
      },
      {
        id: 'system:about',
        name: '关于 YClaw',
        category: 'system',
        execute: () => {
          /* no-op, can be extended */
        },
      },
    ];
    commands.forEach((cmd) => registry.register(cmd));

    return () => {
      commands.forEach((cmd) => registry.unregister(cmd.id));
    };
  }, [navigate]);

  // Sort results: recent first
  const sortedResults = useCallback(
    (items: Command[]) => {
      return [...items].sort((a, b) => {
        const aIdx = recent.indexOf(a.id);
        const bIdx = recent.indexOf(b.id);
        if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
        if (aIdx !== -1) return -1;
        if (bIdx !== -1) return 1;
        return 0;
      });
    },
    [recent],
  );

  // Update search results when query changes
  useEffect(() => {
    const registry = registryRef.current;
    setResults(sortedResults(registry.search(query)));
    setSelectedIndex(0);
  }, [query, sortedResults]);

  const executeCommand = useCallback(
    (command: Command) => {
      command.execute();
      const updated = [command.id, ...recent.filter((id) => id !== command.id)].slice(
        0,
        MAX_RECENT,
      );
      setRecent(updated);
      saveRecent(updated);
      setOpen(false);
      setQuery('');
    },
    [recent],
  );

  // Global keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Keyboard navigation inside palette
  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (results[selectedIndex]) {
          executeCommand(results[selectedIndex]);
        }
        break;
      case 'Escape':
        setOpen(false);
        setQuery('');
        break;
    }
  };

  return (
    <Modal
      open={open}
      onCancel={() => {
        setOpen(false);
        setQuery('');
      }}
      footer={null}
      closable={false}
      maskClosable
      className="yclaw-command-palette"
      width={520}
      styles={{ body: { padding: 0 } }}
    >
      <div onKeyDown={handleKeyDown} data-testid="command-palette">
        <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <Input
            ref={inputRef as never}
            prefix={<SearchOutlined />}
            placeholder="输入命令或搜索..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            variant="borderless"
            size="large"
            autoFocus
          />
        </div>
        <div
          style={{
            maxHeight: 360,
            overflow: 'auto',
            padding: '4px 0',
          }}
        >
          {results.length > 0 ? (
            <List
              dataSource={results}
              renderItem={(item, index) => (
                <List.Item
                  data-testid={`command-item-${item.id}`}
                  onClick={() => executeCommand(item)}
                  style={{
                    padding: '8px 16px',
                    cursor: 'pointer',
                    backgroundColor:
                      index === selectedIndex ? 'rgba(22, 119, 255, 0.08)' : 'transparent',
                  }}
                >
                  <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                    <Space>
                      {item.icon && ICON_MAP[item.icon]}
                      <div>
                        <Typography.Text>{item.name}</Typography.Text>
                        <Tag style={{ marginLeft: 8 }} color="default">
                          {CATEGORY_LABEL[item.category] ?? item.category}
                        </Tag>
                      </div>
                    </Space>
                    {item.shortcut && (
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        {item.shortcut}
                      </Typography.Text>
                    )}
                  </Space>
                </List.Item>
              )}
            />
          ) : (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <Typography.Text type="secondary">没有匹配的命令</Typography.Text>
            </div>
          )}
        </div>
        <div
          style={{
            padding: '8px 16px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            ↑↓ 导航 · Enter 选择 · Esc 关闭
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Ctrl+K
          </Typography.Text>
        </div>
      </div>
    </Modal>
  );
}
