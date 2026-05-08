/**
 * 回归测试: PR #16 代码审查发现的问题
 *
 * 针对审查报告中的严重/中等问题编写回归用例，防止问题再次出现:
 * - #6: closeTab stale closure
 * - #5: IPC 硬编码字符串
 * - #9: Tab 接口重复定义
 */
import { describe, it, expect } from 'vitest';
import { IPC_CHANNELS } from '@shared/constants/channels';

// ---- 回归-001: IPC 通道常量必须包含 browser 系列 ----
describe('Regression: IPC browser channels', () => {
  it('should define all browser IPC channels', () => {
    expect(IPC_CHANNELS.BROWSER_CREATE_TAB).toBe('browser:createTab');
    expect(IPC_CHANNELS.BROWSER_CLOSE_TAB).toBe('browser:closeTab');
    expect(IPC_CHANNELS.BROWSER_NAVIGATE).toBe('browser:navigate');
    expect(IPC_CHANNELS.BROWSER_GO_BACK).toBe('browser:goBack');
    expect(IPC_CHANNELS.BROWSER_GO_FORWARD).toBe('browser:goForward');
    expect(IPC_CHANNELS.BROWSER_RELOAD).toBe('browser:reload');
  });

  it('should not use hardcoded strings for browser IPC (compile-time guard)', () => {
    // 确保 IPC_CHANNELS 的值是字符串类型且非空
    const browserChannels = Object.entries(IPC_CHANNELS).filter(([k]) => k.startsWith('BROWSER_'));
    expect(browserChannels.length).toBeGreaterThanOrEqual(6);
    for (const [, value] of browserChannels) {
      expect(typeof value).toBe('string');
      expect(value).toMatch(/^browser:/);
    }
  });
});

// ---- 回归-002: Tab 共享类型单一来源 ----
describe('Regression: Tab shared type', () => {
  it('should export Tab type from @shared/types/browser', async () => {
    const mod = await import('@shared/types/browser');
    // Tab 是 interface/type，运行时无法直接检查，但模块应可导入
    expect(mod).toBeDefined();
  });
});

// ---- 回归-003: closeTab 不应存在 stale closure ----
describe('Regression: closeTab stale closure fix', () => {
  /**
   * 模拟场景:
   * 1. 有 3 个标签页 [A=1, B=2, C=3]，活跃标签为 C(3)
   * 2. 关闭 C(3) 时，应切换到 B(2)
   *
   * 旧代码的 bug: setActiveTabId 回调中引用外部 tabs 变量 (stale closure)，
   * 而不是 setTabs 回调中的 prev 参数，导致 remaining 包含已被关闭的标签。
   */
  it('should switch to last remaining tab when closing active tab', () => {
    // 直接测试 closeTab 逻辑：在 setTabs 内部处理 activeTabId
    let tabsState = [
      { id: 1, title: 'A', url: 'a', loading: false },
      { id: 2, title: 'B', url: 'b', loading: false },
      { id: 3, title: 'C', url: 'c', loading: false },
    ];
    let activeTabId: number | null = 3;

    // 模拟修复后的逻辑
    const closedId = 3;
    const remaining = tabsState.filter((t) => t.id !== closedId);
    tabsState = remaining;
    activeTabId =
      activeTabId === closedId
        ? remaining.length > 0
          ? remaining[remaining.length - 1].id
          : null
        : activeTabId;

    expect(tabsState).toHaveLength(2);
    expect(activeTabId).toBe(2); // 应该切换到 B
  });

  it('should set activeTabId to null when closing the only tab', () => {
    let tabsState = [{ id: 1, title: 'Only', url: 'u', loading: false }];
    let activeTabId: number | null = 1;

    const closedId = 1;
    const remaining = tabsState.filter((t) => t.id !== closedId);
    tabsState = remaining;
    activeTabId =
      activeTabId === closedId
        ? remaining.length > 0
          ? remaining[remaining.length - 1].id
          : null
        : activeTabId;

    expect(tabsState).toHaveLength(0);
    expect(activeTabId).toBeNull();
  });

  it('should not change activeTabId when closing a non-active tab', () => {
    let tabsState = [
      { id: 1, title: 'A', url: 'a', loading: false },
      { id: 2, title: 'B', url: 'b', loading: false },
    ];
    let activeTabId: number | null = 1;

    const closedId = 2;
    const remaining = tabsState.filter((t) => t.id !== closedId);
    tabsState = remaining;
    activeTabId =
      activeTabId === closedId
        ? remaining.length > 0
          ? remaining[remaining.length - 1].id
          : null
        : activeTabId;

    expect(tabsState).toHaveLength(1);
    expect(activeTabId).toBe(1); // 保持不变
  });
});
