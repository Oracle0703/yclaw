/**
 * Task-as-Code 主进程装配 — 把 service / handlers / IPC 注册和 dispose 串起来。
 *
 * 拆出来便于无 Electron 的单测；`App` 把仓库与 broadcast 传进来即可。
 */

import { TaskAsCodeService } from '@shared/serialization/service';
import {
  createTaskAsCodeHandlers,
  registerTaskAsCodeHandlers,
  type IpcLikeController,
  type TaskAsCodeHandlers,
  type WatchEventEnvelope,
  TAC_CHANNELS,
} from '@main/ipc/task-as-code-handlers';
import {
  createRepositoryPersistence,
  type TaskRepositoryLike,
  type TemplateRepositoryLike,
} from './RepositoryPersistence';

export interface BootstrapTaskAsCodeDeps {
  ipcController: IpcLikeController;
  taskRepository: TaskRepositoryLike;
  templateRepository: TemplateRepositoryLike;
  /** 把 watch 事件广播给所有渲染窗口；通常是 `windowManager.broadcast`。 */
  broadcast: (channel: typeof TAC_CHANNELS.watchEvent, payload: WatchEventEnvelope) => void;
}

export interface TaskAsCodeBootstrap {
  service: TaskAsCodeService;
  handlers: TaskAsCodeHandlers;
  /** 释放所有 watcher 并移除已注册的 IPC channel。幂等。 */
  dispose: () => Promise<void>;
}

/** 装配并立即注册到 IPC controller。 */
export function bootstrapTaskAsCode(deps: BootstrapTaskAsCodeDeps): TaskAsCodeBootstrap {
  const service = new TaskAsCodeService(
    createRepositoryPersistence({
      taskRepository: deps.taskRepository,
      templateRepository: deps.templateRepository,
    }),
  );
  const handlers = createTaskAsCodeHandlers({
    service,
    emit: (channel, payload) => deps.broadcast(channel, payload),
  });
  registerTaskAsCodeHandlers(deps.ipcController, handlers);

  let disposed = false;
  return {
    service,
    handlers,
    dispose: async () => {
      if (disposed) return;
      disposed = true;
      await handlers.disposeAll();
      const remove = deps.ipcController.removeHandler;
      if (!remove) return;
      // 注册的 channel = TAC_CHANNELS 中除 watchEvent（仅推送，不 handle）以外的全部
      for (const channel of Object.values(TAC_CHANNELS)) {
        if (channel === TAC_CHANNELS.watchEvent) continue;
        remove(channel);
      }
    },
  };
}
