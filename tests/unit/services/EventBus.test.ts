import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventBus } from '@main/ipc/EventBus';

describe('EventBus', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    // 重置单例
    (EventBus as unknown as { instance: undefined }).instance = undefined;
    eventBus = EventBus.getInstance();
  });

  it('should be a singleton', () => {
    const instance1 = EventBus.getInstance();
    const instance2 = EventBus.getInstance();
    expect(instance1).toBe(instance2);
  });

  it('should emit and receive events', () => {
    const callback = vi.fn();
    eventBus.on('test:event', callback);
    eventBus.emit('test:event', 'data1', 'data2');
    expect(callback).toHaveBeenCalledWith('data1', 'data2');
  });

  it('should support once listeners', () => {
    const callback = vi.fn();
    eventBus.once('test:once', callback);
    eventBus.emit('test:once', 'first');
    eventBus.emit('test:once', 'second');
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith('first');
  });

  it('should remove specific listener with off', () => {
    const callback = vi.fn();
    eventBus.on('test:off', callback);
    eventBus.off('test:off', callback);
    eventBus.emit('test:off');
    expect(callback).not.toHaveBeenCalled();
  });

  it('should support multiple listeners for same event', () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    eventBus.on('test:multi', cb1);
    eventBus.on('test:multi', cb2);
    eventBus.emit('test:multi', 'data');
    expect(cb1).toHaveBeenCalledWith('data');
    expect(cb2).toHaveBeenCalledWith('data');
  });

  it('should return correct listener count', () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    eventBus.on('test:count', cb1);
    eventBus.on('test:count', cb2);
    expect(eventBus.listenerCount('test:count')).toBe(2);
  });

  it('should remove all listeners for an event', () => {
    const cb = vi.fn();
    eventBus.on('test:removeAll', cb);
    eventBus.on('test:removeAll', cb);
    eventBus.removeAllListeners('test:removeAll');
    expect(eventBus.listenerCount('test:removeAll')).toBe(0);
  });

  it('should return false when emitting to no listeners', () => {
    const result = eventBus.emit('nonexistent:event');
    expect(result).toBe(false);
  });

  it('should return true when emitting to listeners', () => {
    eventBus.on('test:return', vi.fn());
    const result = eventBus.emit('test:return');
    expect(result).toBe(true);
  });
});
