import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { PluginLoader } from '@main/plugin-loader/PluginLoader';
import { WindowManager } from '@main/windows/WindowManager';
import { ConfigService } from '@main/services/ConfigService';
import { FeaturePackageService } from '@main/services/FeaturePackageService';
import { TabManager } from '@main/browser/TabManager';
import { SchedulerService } from '@main/services/SchedulerService';
import { TaskService } from '@main/services/TaskService';
import { RemoteRunnerService } from '@main/services/RemoteRunnerService';
import { TrayService } from '@main/services/TrayService';
import { UpdateService } from '@main/services/UpdateService';
import { DataSourceManager } from '@engines/analytics/DataSourceManager';
import { AIService } from '@main/ai/AIService';
import { DatabaseService } from '@main/services/DatabaseService';
import { registerRemoteRunnerHandlers } from '@main/ipc/remote-runner-handlers';
import {
  DispatchQueueService,
  ExecutionLeaseService,
  LeaseReconciler,
  LocalRunnerAdapter,
  RemoteRunnerAdapter,
  RunnerDispatchService,
  RunnerRegistryService,
} from '@main/services/runner-scheduler';
import { registerRunnerSchedulerHandlers } from '@main/ipc/runner-scheduler-handlers';

const runnerRegistryInstance = {
  listSchedulable: vi.fn(() => []),
  heartbeat: vi.fn(),
  drain: vi.fn(),
  resume: vi.fn(),
};
const dispatchQueueInstance = {
  enqueue: vi.fn(),
  peekNext: vi.fn(() => null),
  markDispatching: vi.fn(),
  markQueued: vi.fn(),
  markTerminal: vi.fn(),
  advanceCursor: vi.fn(),
};
const leaseServiceInstance = {
  createLease: vi.fn(),
};
const leaseReconcilerInstance = {
  reconcile: vi.fn(),
};
const runnerDispatchInstance = {
  tick: vi.fn(),
};
const resultServiceInstance = {
  saveResult: vi.fn(),
  listResults: vi.fn(() => []),
};

vi.mock('electron', () => ({
  app: {
    getVersion: vi.fn(() => '1.0.0'),
    getName: vi.fn(() => 'YClaw'),
  },
  BrowserWindow: {
    getFocusedWindow: vi.fn(() => null),
  },
  dialog: {
    showOpenDialog: vi.fn(),
  },
  ipcMain: {
    handle: vi.fn(),
    removeHandler: vi.fn(),
  },
}));

vi.mock('@main/windows/WindowManager', () => ({
  WindowManager: vi.fn().mockImplementation(() => ({
    openWindow: vi.fn(),
    getWindow: vi.fn(),
    getOpenModules: vi.fn(() => ['workbench']),
    closeWindow: vi.fn(),
    closeAll: vi.fn(),
  })),
}));

vi.mock('@main/ipc/EventBus', () => ({
  EventBus: {
    getInstance: vi.fn(() => ({
      emit: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
    })),
  },
}));

vi.mock('@main/services/DatabaseService', () => ({
  DatabaseService: vi.fn().mockImplementation(() => ({
    open: vi.fn(),
    close: vi.fn(),
    all: vi.fn(() => []),
    get: vi.fn(() => undefined),
    run: vi.fn(() => ({ changes: 0 })),
    getTasks: vi.fn(() => []),
    getTaskFlow: vi.fn(),
    saveTaskFlow: vi.fn(),
    updateTaskStatus: vi.fn(),
  })),
}));

vi.mock('@main/services/ConfigService', () => ({
  ConfigService: vi.fn().mockImplementation(() => ({
    get: vi.fn((key: string) => (key === 'ai' ? { provider: 'openai', model: 'gpt-3.5-turbo' } : {})),
    getGeneral: vi.fn(() => ({ closeToTray: false })),
  })),
}));

vi.mock('@main/services/LogService', () => ({
  LogService: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@main/services/TrayService', () => ({
  TrayService: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@main/services/UpdateService', () => ({
  UpdateService: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@main/services/FeaturePackageService', () => ({
  FeaturePackageService: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@main/browser/TabManager', () => ({
  TabManager: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@main/ai/AIService', () => ({
  AIService: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@main/plugin-loader/PluginLoader', () => ({
  PluginLoader: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@main/plugin-loader/PermissionChecker', () => ({
  PermissionChecker: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@main/services/TaskService', () => ({
  TaskService: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@main/services/RemoteRunnerService', () => ({
  RemoteRunnerService: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@main/services/SchedulerService', () => ({
  SchedulerService: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@main/services/SessionRegistry', () => ({
  SessionRegistry: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@main/services/TemplateService', () => ({
  TemplateService: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@main/services/ExecutionLogService', () => ({
  ExecutionLogService: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@main/services/AlertService', () => ({
  AlertService: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@main/services/ResultService', () => ({
  ResultService: vi.fn().mockImplementation(() => resultServiceInstance),
}));

vi.mock('@engines/automation/AutomationEngine', () => ({
  AutomationEngine: vi.fn().mockImplementation((options) => ({
    options,
    execute: vi.fn(),
  })),
}));

vi.mock('@engines/automation/FlowRunner', () => ({
  FlowRunner: vi.fn().mockImplementation((options) => ({
    options,
  })),
}));

vi.mock('@engines/analytics/DataSourceManager', () => ({
  DataSourceManager: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@engines/analytics/IndicatorLibrary', () => ({
  IndicatorLibrary: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@mcp/server/createDesktopMcpServer', () => ({
  createDesktopMcpServer: vi.fn(() => ({})),
}));

vi.mock('@mcp/server/startEmbeddedHttpServer', () => ({
  startEmbeddedMcpHttpServer: vi.fn(),
}));

vi.mock('@mcp/client/McpClientManager', () => ({
  McpClientManager: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@main/ipc/remote-runner-handlers', () => ({
  registerRemoteRunnerHandlers: vi.fn(),
}));

vi.mock('@main/ipc/runner-scheduler-handlers', () => ({
  registerRunnerSchedulerHandlers: vi.fn(),
}));

vi.mock('@main/services/runner-scheduler', () => ({
  RunnerRegistryService: vi.fn().mockImplementation(() => runnerRegistryInstance),
  DispatchQueueService: vi.fn().mockImplementation(() => dispatchQueueInstance),
  ExecutionLeaseService: vi.fn().mockImplementation(() => leaseServiceInstance),
  LeaseReconciler: vi.fn().mockImplementation(() => leaseReconcilerInstance),
  RunnerDispatchService: vi.fn().mockImplementation(() => runnerDispatchInstance),
  LocalRunnerAdapter: vi.fn().mockImplementation(() => ({})),
  RemoteRunnerAdapter: vi.fn().mockImplementation(() => ({})),
}));

import { App } from '@main/app';
import { AutomationEngine } from '@engines/automation/AutomationEngine';
import { FlowRunner } from '@engines/automation/FlowRunner';

describe('App composition', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('injects explicit task repository when constructing TaskService', () => {
    new App();

    expect(TaskService).toHaveBeenCalledWith(
      expect.objectContaining({
        batchService: expect.any(Object),
        createRunner: expect.any(Function),
        eventBus: expect.any(Object),
        taskRepository: expect.any(Object),
      }),
    );
  });

  it('injects ResultService into AutomationEngine runners so hot extract results are persisted', () => {
    new App();

    const taskServiceOptions = (TaskService as unknown as Mock).mock.calls[0][0] as {
      createRunner: () => unknown;
    };
    taskServiceOptions.createRunner();

    expect(AutomationEngine).toHaveBeenCalledWith(expect.objectContaining({
      resultService: resultServiceInstance,
    }));
    expect(FlowRunner).toHaveBeenCalledWith(expect.objectContaining({
      engine: expect.any(Object),
    }));
  });

  it('injects explicit task service when constructing SchedulerService', () => {
    new App();

    expect(SchedulerService).toHaveBeenCalledWith(
      expect.objectContaining({
        taskService: expect.any(Object),
      }),
    );
  });

  it('injects explicit repository and actor when constructing RemoteRunnerService', () => {
    new App();

    expect(RemoteRunnerService).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'desktop',
        repository: expect.any(Object),
      }),
    );
  });

  it('injects explicit config service when constructing FeaturePackageService', () => {
    new App();

    expect(FeaturePackageService).toHaveBeenCalledWith(
      expect.objectContaining({
        configService: expect.any(Object),
      }),
    );
  });

  it('injects explicit event bus when constructing TabManager', () => {
    new App();

    expect(TabManager).toHaveBeenCalledWith(
      expect.objectContaining({
        eventBus: expect.any(Object),
      }),
    );
  });

  it('injects explicit event bus when constructing WindowManager', () => {
    new App();

    expect(WindowManager).toHaveBeenCalledWith(
      expect.objectContaining({
        eventBus: expect.any(Object),
      }),
    );
  });

  it('injects explicit event bus when constructing PluginLoader', () => {
    new App();

    expect(PluginLoader).toHaveBeenCalledWith(
      expect.objectContaining({
        eventBus: expect.any(Object),
        permissionChecker: expect.any(Object),
      }),
    );
  });

  it('injects explicit event bus when constructing ConfigService', () => {
    new App();

    expect(ConfigService).toHaveBeenCalledWith(
      expect.objectContaining({
        eventBus: expect.any(Object),
      }),
    );
  });

  it('injects explicit event bus when constructing TrayService', () => {
    new App();

    expect(TrayService).toHaveBeenCalledWith(
      expect.objectContaining({
        eventBus: expect.any(Object),
        windowManager: expect.any(Object),
      }),
    );
  });

  it('injects explicit event bus when constructing UpdateService', () => {
    new App();

    expect(UpdateService).toHaveBeenCalledWith(
      expect.objectContaining({
        eventBus: expect.any(Object),
        logService: expect.any(Object),
      }),
    );
  });

  it('injects explicit event bus when constructing DataSourceManager', () => {
    new App();

    expect(DataSourceManager).toHaveBeenCalledWith(
      expect.objectContaining({
        eventBus: expect.any(Object),
      }),
    );
  });

  it('writes hot html reports to the project output directory', () => {
    const app = new App();
    const hotReportService = (app as unknown as {
      hotReportService: { outputDir: string };
    }).hotReportService;

    expect(hotReportService.outputDir.replace(/\\/g, '/')).toBe(
      `${process.cwd().replace(/\\/g, '/')}/output`,
    );
  });

  it('registers remote runner ipc handlers', () => {
    const app = new App();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (app as any).registerIpcHandlers();

    expect(registerRemoteRunnerHandlers).toHaveBeenCalledWith(
      expect.objectContaining({
        ipcController: expect.any(Object),
        service: expect.any(Object),
      }),
    );
  });

  it('injects scheduler dependencies when constructing scheduler services', () => {
    new App();

    expect(RunnerRegistryService).toHaveBeenCalledWith(
      expect.objectContaining({
        repository: expect.any(Object),
      }),
    );
    expect(DispatchQueueService).toHaveBeenCalledWith(
      expect.objectContaining({
        repository: expect.any(Object),
      }),
    );
    expect(ExecutionLeaseService).toHaveBeenCalledWith(
      expect.objectContaining({
        repository: expect.any(Object),
      }),
    );
    expect(LeaseReconciler).toHaveBeenCalledWith(
      expect.objectContaining({
        repository: expect.any(Object),
      }),
    );
    expect(RemoteRunnerAdapter).toHaveBeenCalledWith(expect.any(Object));
    expect(LocalRunnerAdapter).toHaveBeenCalled();
    expect(RunnerDispatchService).toHaveBeenCalledWith(
      expect.objectContaining({
        queue: expect.any(Object),
        registry: expect.any(Object),
        leaseService: expect.any(Object),
        adapters: expect.objectContaining({
          local: expect.any(Object),
          remote: expect.any(Object),
        }),
        events: expect.any(Object),
      }),
    );
  });

  it('registers runner scheduler ipc handlers', () => {
    const app = new App();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (app as any).registerIpcHandlers();

    const call = (registerRunnerSchedulerHandlers as unknown as Mock).mock.calls.at(-1);
    expect(call).toBeDefined();
    expect(call?.[0]).toEqual(
      expect.objectContaining({
        ipcController: expect.any(Object),
        service: expect.any(Object),
      }),
    );
  });

  it('exposes scheduler facade wired to underlying dependencies', async () => {
    const app = new App();

    const db = (DatabaseService as unknown as Mock).mock.results.at(-1)?.value as {
      all: Mock;
      run: Mock;
    };
    db.all.mockImplementation((sql: string) => {
      if (sql.includes('FROM runner_nodes')) {
        return [
          {
            id: 'runner-1',
            kind: 'local',
            name: 'Runner 1',
            workspace_id: 'ws-1',
            status: 'online',
            capabilities_json: '[]',
            max_concurrency: 1,
            running_count: 0,
            cpu_usage: 0.1,
            memory_usage: 0.1,
            heartbeat_latency_ms: 5,
            recent_failure_rate: 0,
            last_heartbeat_at: null,
            last_seen_at: null,
            created_at: '2026-01-01T00:00:00.000Z',
            updated_at: '2026-01-01T00:00:00.000Z',
          },
        ];
      }
      if (sql.includes('FROM runner_queue_items')) {
        return [
          {
            id: 'queued-item',
            task_id: 'task-1',
            task_type: 'collect',
            idempotency: 'idempotent',
            workspace_id: 'ws-1',
            status: 'queued',
            priority: 0,
            reassign_attempts: 0,
            last_error: null,
            created_at: '2026-01-01T00:00:00.000Z',
            updated_at: '2026-01-01T00:00:00.000Z',
          },
          {
            id: 'dispatching-item',
            task_id: 'task-2',
            task_type: 'collect',
            idempotency: 'idempotent',
            workspace_id: 'ws-1',
            status: 'dispatching',
            priority: 0,
            reassign_attempts: 0,
            last_error: null,
            created_at: '2026-01-01T00:00:00.000Z',
            updated_at: '2026-01-01T00:00:00.000Z',
          },
        ];
      }
      if (sql.includes('FROM execution_leases')) {
        return [];
      }
      return [];
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (app as any).registerIpcHandlers();
    const call = (registerRunnerSchedulerHandlers as unknown as Mock).mock.calls.at(-1);
    const facade = call?.[0]?.service as {
      listRunners: () => unknown[];
      heartbeat: (payload: unknown) => unknown;
      drain: (payload: unknown) => unknown;
      resume: (payload: unknown) => unknown;
      enqueue: (payload: unknown) => unknown;
      dispatchTick: () => Promise<unknown>;
      reconcile: () => unknown;
      cancelQueueItem: (payload: unknown) => unknown;
    };

    expect(facade.listRunners()).toHaveLength(1);
    facade.heartbeat({ runnerId: 'runner-1', metrics: { cpuUsage: 0.3 } });
    expect(runnerRegistryInstance.heartbeat).toHaveBeenCalledWith('runner-1', { cpuUsage: 0.3 });
    facade.drain({ runnerId: 'runner-1' });
    expect(runnerRegistryInstance.drain).toHaveBeenCalledWith('runner-1');
    facade.resume({ runnerId: 'runner-1' });
    expect(runnerRegistryInstance.resume).toHaveBeenCalledWith('runner-1');
    facade.enqueue({
      taskId: 'task-local-3',
      taskType: 'collect',
      idempotency: 'idempotent',
      workspaceId: 'ws-1',
      priority: 10,
    });
    facade.enqueue({
      taskId: 'task-remote-4',
      taskType: 'collect',
      idempotency: 'idempotent',
      workspaceId: 'ws-1',
      remoteDispatch: {
        runnerConnectionId: 'conn-1',
        revisionId: 'rev-1',
        sessionId: 'session-1',
      },
    });
    expect(dispatchQueueInstance.enqueue).toHaveBeenNthCalledWith(1, {
      taskId: 'task-local-3',
      taskType: 'collect',
      idempotency: 'idempotent',
      workspaceId: 'ws-1',
      priority: 10,
    });
    expect(dispatchQueueInstance.enqueue).toHaveBeenNthCalledWith(2, {
      taskId: 'task-remote-4',
      taskType: 'collect',
      idempotency: 'idempotent',
      workspaceId: 'ws-1',
      remoteDispatch: {
        runnerConnectionId: 'conn-1',
        revisionId: 'rev-1',
        sessionId: 'session-1',
      },
    });
    await facade.dispatchTick();
    expect(runnerDispatchInstance.tick).toHaveBeenCalledTimes(1);
    facade.reconcile();
    expect(leaseReconcilerInstance.reconcile).toHaveBeenCalledTimes(1);

    facade.cancelQueueItem({ queueItemId: 'queued-item' });
    expect(db.run).toHaveBeenCalledTimes(1);
    expect(() => facade.cancelQueueItem({ queueItemId: 'dispatching-item' })).toThrow(
      'Only queued items can be cancelled',
    );
  });

  it('injects explicit tool registry when constructing AIService', () => {
    new App();

    expect(AIService).toHaveBeenCalledWith(
      expect.objectContaining({
        aiRepository: expect.any(Object),
        contextManager: expect.any(Object),
        taskRepository: expect.any(Object),
        toolRegistry: expect.any(Object),
      }),
    );
  });
});
