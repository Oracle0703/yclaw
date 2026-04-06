/**
 * IPC 通道定义 — 主进程侧类型安全通道注册
 */
export type IpcHandler = (...args: unknown[]) => Promise<unknown> | unknown;

export interface IpcChannelDefinition {
  channel: string;
  handler: IpcHandler;
}
