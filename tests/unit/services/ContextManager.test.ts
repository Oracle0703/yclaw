import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock os module before importing ContextManager
vi.mock('os', () => ({
  default: {
    cpus: () => [{ times: { user: 4000, nice: 0, sys: 1000, idle: 5000, irq: 0 } }],
    totalmem: () => 8 * 1024 * 1024 * 1024, // 8GB
    freemem: () => 3 * 1024 * 1024 * 1024, // 3GB free
    uptime: () => 7200, // 2 hours
  },
  cpus: () => [{ times: { user: 4000, nice: 0, sys: 1000, idle: 5000, irq: 0 } }],
  totalmem: () => 8 * 1024 * 1024 * 1024,
  freemem: () => 3 * 1024 * 1024 * 1024,
  uptime: () => 7200,
}));

import { ContextManager } from '@main/ai/ContextManager';

describe('ContextManager', () => {
  let manager: ContextManager;

  beforeEach(() => {
    manager = new ContextManager();
  });

  it('should collect system context', async () => {
    const ctx = await manager.collectContext();

    expect(ctx.currentModule).toBe('workbench');
    expect(ctx.systemMetrics.memory).toBeGreaterThan(0);
    expect(ctx.systemMetrics.uptime).toBe(7200);
    expect(Array.isArray(ctx.recentTasks)).toBe(true);
    expect(Array.isArray(ctx.installedPlugins)).toBe(true);
  });

  it('should update current module', async () => {
    manager.setCurrentModule('stock');
    const ctx = await manager.collectContext();
    expect(ctx.currentModule).toBe('stock');
  });

  it('should convert context to prompt', async () => {
    manager.setCurrentModule('automation');
    const ctx = await manager.collectContext();
    const prompt = manager.contextToPrompt(ctx);

    expect(prompt).toContain('YClaw 运营助手');
    expect(prompt).toContain('automation');
    expect(prompt).toContain('CPU');
    expect(prompt).toContain('内存');
  });

  it('should include task info in prompt when tasks exist', async () => {
    const ctx = await manager.collectContext();
    ctx.recentTasks = [{ name: '测试任务', status: '成功', updatedAt: '09:00' }];
    const prompt = manager.contextToPrompt(ctx);

    expect(prompt).toContain('近期任务');
    expect(prompt).toContain('测试任务');
  });

  it('should include plugin info in prompt when plugins exist', async () => {
    const ctx = await manager.collectContext();
    ctx.installedPlugins = [{ name: 'OCR', version: '1.0', enabled: true }];
    const prompt = manager.contextToPrompt(ctx);

    expect(prompt).toContain('已安装插件');
    expect(prompt).toContain('OCR');
  });
});
