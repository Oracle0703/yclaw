/**
 * Task-as-Code IPC channel 常量与事件 envelope 类型 — 主/渲染进程共享。
 *
 * 历史上 `TAC_CHANNELS` / `WatchEventEnvelope` 定义在 `@main/ipc/task-as-code-handlers.ts`，
 * 渲染端引用会拉入 main 侧依赖。这里抽出可被两侧引用的 source-of-truth；
 * handler 文件继续 re-export 以保持向后兼容。
 */

import type { AffectedEvent } from '../serialization/service';

export const TAC_CHANNELS = {
  importYaml: 'task:importYaml',
  exportYaml: 'task:exportYaml',
  watchStart: 'task:watch:start',
  watchStop: 'task:watch:stop',
  watchEvent: 'task:watch:event',
} as const;

export type TacChannel = (typeof TAC_CHANNELS)[keyof typeof TAC_CHANNELS];

export interface WatchEventEnvelope {
  watchId: string;
  event: AffectedEvent;
}
