import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setupSingleInstanceGuard } from '@main/single-instance';

describe('setupSingleInstanceGuard', () => {
  const requestSingleInstanceLock = vi.fn();
  const quit = vi.fn();
  const on = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('在无法获取单实例锁时退出当前实例', () => {
    requestSingleInstanceLock.mockReturnValue(false);

    const acquired = setupSingleInstanceGuard(
      {
        requestSingleInstanceLock,
        quit,
        on,
      },
      vi.fn(),
    );

    expect(acquired).toBe(false);
    expect(quit).toHaveBeenCalledTimes(1);
    expect(on).not.toHaveBeenCalled();
  });

  it('在获取锁成功后注册 second-instance 处理器', () => {
    requestSingleInstanceLock.mockReturnValue(true);
    const handleSecondInstance = vi.fn();

    const acquired = setupSingleInstanceGuard(
      {
        requestSingleInstanceLock,
        quit,
        on,
      },
      handleSecondInstance,
    );

    expect(acquired).toBe(true);
    expect(on).toHaveBeenCalledWith('second-instance', expect.any(Function));

    const listener = on.mock.calls[0]?.[1] as (() => void) | undefined;
    listener?.();

    expect(handleSecondInstance).toHaveBeenCalledTimes(1);
    expect(quit).not.toHaveBeenCalled();
  });
});
