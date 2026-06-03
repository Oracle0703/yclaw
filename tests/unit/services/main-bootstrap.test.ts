import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bootstrapMainProcess } from '@main/bootstrap';

async function settleAsyncWork(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('bootstrapMainProcess', () => {
  const originalPlatform = process.platform;
  const handlers = new Map<string, (...args: unknown[]) => void>();
  const app = {
    requestSingleInstanceLock: vi.fn(),
    quit: vi.fn(),
    whenReady: vi.fn(() => Promise.resolve()),
    on: vi.fn((event: string, listener: (...args: unknown[]) => void) => {
      handlers.set(event, listener);
    }),
  };

  const application = {
    start: vi.fn(() => Promise.resolve()),
    showWorkbench: vi.fn(),
    shutdown: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    handlers.clear();
    Object.defineProperty(process, 'platform', {
      configurable: true,
      value: originalPlatform,
    });
  });

  it('在拿不到单实例锁时立即退出且不初始化应用', () => {
    app.requestSingleInstanceLock.mockReturnValue(false);
    const createApplication = vi.fn(() => application);

    bootstrapMainProcess(app, createApplication);

    expect(app.quit).toHaveBeenCalledTimes(1);
    expect(app.whenReady).not.toHaveBeenCalled();
    expect(createApplication).not.toHaveBeenCalled();
  });

  it('在首实例中启动应用，并在二次启动时恢复主窗口', async () => {
    app.requestSingleInstanceLock.mockReturnValue(true);
    const createApplication = vi.fn(() => application);

    bootstrapMainProcess(app, createApplication);
    await settleAsyncWork();

    expect(createApplication).toHaveBeenCalledTimes(1);
    expect(application.start).toHaveBeenCalledTimes(1);
    expect(app.on).toHaveBeenCalledWith('second-instance', expect.any(Function));
    expect(app.on).toHaveBeenCalledWith('activate', expect.any(Function));
    expect(app.on).toHaveBeenCalledWith('before-quit', expect.any(Function));
    expect(app.on).toHaveBeenCalledWith('window-all-closed', expect.any(Function));

    handlers.get('second-instance')?.();
    await settleAsyncWork();

    expect(application.showWorkbench).toHaveBeenCalledTimes(1);
    expect(application.start).toHaveBeenCalledTimes(1);

    handlers.get('activate')?.();
    await settleAsyncWork();

    expect(application.showWorkbench).toHaveBeenCalledTimes(2);
    expect(application.start).toHaveBeenCalledTimes(1);

    handlers.get('before-quit')?.();
    expect(application.shutdown).toHaveBeenCalledTimes(1);

    Object.defineProperty(process, 'platform', {
      configurable: true,
      value: 'linux',
    });
    handlers.get('window-all-closed')?.();
    expect(app.quit).toHaveBeenCalledTimes(1);
  });
});
