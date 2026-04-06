import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock electron ipcMain
const handlers = new Map<string, Function>();
vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((channel: string, handler: Function) => {
      handlers.set(channel, handler);
    }),
    removeHandler: vi.fn((channel: string) => {
      handlers.delete(channel);
    }),
  },
}));

// Must import after mock
import { IpcController } from '@main/ipc/IpcController';
import { EventBus } from '@main/ipc/EventBus';

describe('IpcController', () => {
  let controller: IpcController;

  beforeEach(() => {
    handlers.clear();
    (EventBus as unknown as { instance: undefined }).instance = undefined;
    controller = new IpcController();
  });

  it('should register a handler for a channel', () => {
    controller.handle('test:channel', async () => 'result');
    expect(controller.getRegisteredChannels()).toContain('test:channel');
  });

  it('should throw when registering duplicate channel', () => {
    controller.handle('test:dup', async () => 'result');
    expect(() => controller.handle('test:dup', async () => 'other')).toThrow('already registered');
  });

  it('should return success response on handler success', async () => {
    controller.handle('test:success', async (arg: unknown) => ({ result: arg }));
    const registeredHandler = handlers.get('test:success')!;
    const response = await registeredHandler({}, 'hello');
    expect(response).toEqual({ success: true, data: { result: 'hello' } });
  });

  it('should return error response on handler failure', async () => {
    controller.handle('test:fail', async () => {
      throw new Error('boom');
    });
    const registeredHandler = handlers.get('test:fail')!;
    const response = await registeredHandler({});
    expect(response.success).toBe(false);
    expect(response.error.code).toBe('HANDLER_ERROR');
    expect(response.error.message).toBe('boom');
  });

  it('should handle non-Error throws', async () => {
    controller.handle('test:nonError', async () => {
      throw 'string error';
    });
    const registeredHandler = handlers.get('test:nonError')!;
    const response = await registeredHandler({});
    expect(response.success).toBe(false);
    expect(response.error.message).toBe('string error');
  });

  it('should rate-limit channels', async () => {
    controller.handle('test:rate', async () => 'ok');
    const registeredHandler = handlers.get('test:rate')!;

    // Call rapidly — first 100 should succeed, the 101st should be rate limited
    const responses: any[] = [];
    for (let i = 0; i < 102; i++) {
      responses.push(await registeredHandler({}));
    }

    const rateLimited = responses.filter((r) => r.error?.code === 'RATE_LIMITED');
    expect(rateLimited.length).toBeGreaterThan(0);
  });

  it('should remove a handler', () => {
    controller.handle('test:remove', async () => 'val');
    controller.removeHandler('test:remove');
    expect(controller.getRegisteredChannels()).not.toContain('test:remove');
  });

  it('should dispose all handlers', () => {
    controller.handle('ch:a', async () => 1);
    controller.handle('ch:b', async () => 2);
    controller.dispose();
    expect(controller.getRegisteredChannels()).toHaveLength(0);
  });
});
