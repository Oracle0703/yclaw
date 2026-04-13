import { describe, it, expect, beforeEach } from 'vitest';
import {
  CommandRegistry,
  resetCommandRegistry,
  getCommandRegistry,
} from '@renderer/shared/components/CommandPalette/CommandRegistry';
import type { Command } from '@renderer/shared/components/CommandPalette/CommandRegistry';

describe('CommandRegistry', () => {
  let registry: CommandRegistry;

  beforeEach(() => {
    resetCommandRegistry();
    registry = getCommandRegistry();
  });

  it('should register and retrieve commands', () => {
    const cmd: Command = {
      id: 'test:cmd',
      name: 'Test Command',
      category: 'action',
      execute: () => {},
    };
    registry.register(cmd);
    const all = registry.getAll();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe('test:cmd');
  });

  it('should unregister commands', () => {
    registry.register({
      id: 'a',
      name: 'A',
      category: 'action',
      execute: () => {},
    });
    registry.register({
      id: 'b',
      name: 'B',
      category: 'action',
      execute: () => {},
    });
    expect(registry.getAll()).toHaveLength(2);

    registry.unregister('a');
    expect(registry.getAll()).toHaveLength(1);
    expect(registry.getAll()[0].id).toBe('b');
  });

  it('should search commands by name', () => {
    registry.register({
      id: 'nav:stock',
      name: '跳转到股票分析',
      category: 'navigation',
      execute: () => {},
    });
    registry.register({
      id: 'nav:auto',
      name: '跳转到自动化',
      category: 'navigation',
      execute: () => {},
    });
    registry.register({
      id: 'action:refresh',
      name: '刷新数据',
      category: 'action',
      execute: () => {},
    });

    const results = registry.search('股票');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('nav:stock');
  });

  it('should search commands by category', () => {
    registry.register({
      id: 'a',
      name: 'A',
      category: 'navigation',
      execute: () => {},
    });
    registry.register({
      id: 'b',
      name: 'B',
      category: 'action',
      execute: () => {},
    });

    const results = registry.search('action');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('b');
  });

  it('should return all commands when query is empty', () => {
    registry.register({
      id: 'a',
      name: 'A',
      category: 'action',
      execute: () => {},
    });
    registry.register({
      id: 'b',
      name: 'B',
      category: 'action',
      execute: () => {},
    });

    expect(registry.search('')).toHaveLength(2);
    expect(registry.search('   ')).toHaveLength(2);
  });

  it('should execute a command by id', () => {
    let called = false;
    registry.register({
      id: 'test',
      name: 'Test',
      category: 'action',
      execute: () => {
        called = true;
      },
    });

    expect(registry.execute('test')).toBe(true);
    expect(called).toBe(true);
  });

  it('should return false when executing non-existent command', () => {
    expect(registry.execute('no-exist')).toBe(false);
  });

  it('should notify listeners on change', () => {
    let notified = false;
    registry.onChange(() => {
      notified = true;
    });

    registry.register({
      id: 'a',
      name: 'A',
      category: 'action',
      execute: () => {},
    });

    expect(notified).toBe(true);
  });

  it('should be a singleton via getCommandRegistry', () => {
    const a = getCommandRegistry();
    const b = getCommandRegistry();
    expect(a).toBe(b);
  });

  it('should reset singleton', () => {
    const a = getCommandRegistry();
    a.register({ id: 'x', name: 'X', category: 'action', execute: () => {} });

    resetCommandRegistry();
    const b = getCommandRegistry();
    expect(b.getAll()).toHaveLength(0);
    expect(a).not.toBe(b);
  });
});
