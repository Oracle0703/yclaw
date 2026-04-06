import { EventEmitter } from 'events';
import type { EventName } from '@shared/constants';

/**
 * 全局事件总线 — 跨模块事件发布/订阅
 * 运行在主进程中，各模块通过 IPC 订阅/发布事件
 */
export class EventBus {
  private static instance: EventBus;
  private emitter: EventEmitter;

  private constructor() {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(50);
  }

  static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  on(event: EventName | string, listener: (...args: unknown[]) => void): void {
    this.emitter.on(event, listener);
  }

  once(event: EventName | string, listener: (...args: unknown[]) => void): void {
    this.emitter.once(event, listener);
  }

  off(event: EventName | string, listener: (...args: unknown[]) => void): void {
    this.emitter.off(event, listener);
  }

  emit(event: EventName | string, ...args: unknown[]): boolean {
    return this.emitter.emit(event, ...args);
  }

  removeAllListeners(event?: EventName | string): void {
    this.emitter.removeAllListeners(event);
  }

  listenerCount(event: EventName | string): number {
    return this.emitter.listenerCount(event);
  }
}
