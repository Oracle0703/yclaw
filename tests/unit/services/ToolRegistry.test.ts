import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ToolRegistry } from '@main/ai/ToolRegistry';
import type { AITool } from '@main/ai/types';
import type { AIServiceContext } from '@shared/types/ai';

const mockContext: AIServiceContext = {
  currentModule: 'workbench',
  systemMetrics: { cpu: 40, memory: 65, disk: 50, uptime: 3600 },
  recentTasks: [],
  installedPlugins: [],
};

describe('ToolRegistry', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  it('should register and list tools', () => {
    const tool: AITool = {
      name: 'test_tool',
      description: 'A test tool',
      parameters: {},
      confirmationLevel: 0,
      execute: vi.fn().mockResolvedValue({ success: true }),
    };

    registry.register(tool);
    const list = registry.list();
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('test_tool');
    expect(list[0].description).toBe('A test tool');
    // execute should not be in listed result
    expect('execute' in list[0]).toBe(false);
  });

  it('should get a tool by name', () => {
    const tool: AITool = {
      name: 'my_tool',
      description: 'desc',
      parameters: {},
      confirmationLevel: 1,
      execute: vi.fn(),
    };
    registry.register(tool);
    expect(registry.get('my_tool')).toBe(tool);
    expect(registry.get('non_existent')).toBeUndefined();
  });

  it('should unregister tools', () => {
    registry.register({
      name: 'a',
      description: '',
      parameters: {},
      confirmationLevel: 0,
      execute: vi.fn(),
    });
    registry.register({
      name: 'b',
      description: '',
      parameters: {},
      confirmationLevel: 0,
      execute: vi.fn(),
    });

    registry.unregister('a');
    expect(registry.list()).toHaveLength(1);
    expect(registry.list()[0].name).toBe('b');
  });

  it('should execute tool and return result', async () => {
    const tool: AITool = {
      name: 'exec_test',
      description: '',
      parameters: {},
      confirmationLevel: 0,
      execute: vi.fn().mockResolvedValue({ success: true, data: { count: 42 } }),
    };
    registry.register(tool);

    const result = await registry.execute('exec_test', { arg: 'val' }, mockContext);
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ count: 42 });
    expect(tool.execute).toHaveBeenCalledWith({ arg: 'val' }, mockContext);
  });

  it('should return error for non-existent tool execution', async () => {
    const result = await registry.execute('missing', {}, mockContext);
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });
});
