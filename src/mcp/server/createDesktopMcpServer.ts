import type { WebContents } from 'electron';
import type { BrowserSession } from '@shared/types';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import type { ExecutionLogService } from '@main/services/ExecutionLogService';
import type { LogService } from '@main/services/LogService';
import type { ResultService } from '@main/services/ResultService';
import type { SessionRegistry } from '@main/services/SessionRegistry';
import type { TaskService, TaskSummary } from '@main/services/TaskService';
import type { WindowManager } from '@main/windows/WindowManager';
import { createMcpServer } from './createMcpServer';

interface DesktopTaskService {
  listTasks(): TaskSummary[];
  getTaskDetail(taskId: string): ReturnType<TaskService['getTaskDetail']>;
  getBatch(batchId: string): ReturnType<TaskService['getBatch']>;
  startTask(taskId: string, webContents: WebContents): ReturnType<TaskService['startTask']>;
}

interface DesktopTabManager {
  getOrCreateTabBySession(
    sessionPartition: string,
    url?: string,
  ): {
    webContents: Pick<WebContents, 'id' | 'loadURL'>;
  };
}

export interface CreateDesktopMcpServerOptions {
  taskService: DesktopTaskService;
  resultService: Pick<ResultService, 'listResults'>;
  executionLogService: Pick<ExecutionLogService, 'query'>;
  sessionRegistry: Pick<SessionRegistry, 'listSessions'>;
  tabManager: DesktopTabManager;
  windowManager?: Pick<WindowManager, 'openWindow'>;
  logService?: Pick<LogService, 'info'>;
}

export function createDesktopMcpServer(options: CreateDesktopMcpServerOptions): McpServer {
  return createMcpServer({
    taskService: options.taskService,
    resultService: options.resultService,
    executionLogService: options.executionLogService,
    dangerousActions: {
      runTask: async (taskId: string) => {
        const task = options.taskService.getTaskDetail(taskId);
        if (!task) {
          throw new Error(`Task "${taskId}" not found`);
        }

        options.windowManager?.openWindow({ module: 'browser' });

        const sessionPartition = resolveSessionPartition(task.sessionId, options.sessionRegistry.listSessions());
        const targetUrl = normalizeUrl(task.entryUrl ?? 'about:blank');
        const view = options.tabManager.getOrCreateTabBySession(sessionPartition, targetUrl);
        await view.webContents.loadURL(targetUrl);

        const result = options.taskService.startTask(taskId, view.webContents as WebContents);
        options.logService?.info('main', 'MCP task.run invoked', {
          taskId,
          sessionPartition,
          webContentsId: view.webContents.id,
        });

        return {
          ...result,
          webContentsId: view.webContents.id,
          sessionPartition,
        };
      },
      refreshSession: async (sessionId: string) => {
        const session = options.sessionRegistry.listSessions().find((item) => item.id === sessionId);
        if (!session) {
          throw new Error(`Session "${sessionId}" not found`);
        }

        options.windowManager?.openWindow({ module: 'browser' });

        const targetUrl = normalizeUrl(session.domain);
        const view = options.tabManager.getOrCreateTabBySession(session.partition, targetUrl);
        await view.webContents.loadURL(targetUrl);

        const result = {
          sessionId,
          partition: session.partition,
          domain: targetUrl,
          webContentsId: view.webContents.id,
          refreshedAt: new Date().toISOString(),
        };

        options.logService?.info('main', 'MCP session.refresh invoked', result);
        return result;
      },
    },
    auditLogger: (record) => {
      options.logService?.info('main', 'MCP audit', record);
    },
  });
}

function resolveSessionPartition(
  sessionId: string | null | undefined,
  sessions: BrowserSession[],
): string {
  if (!sessionId) {
    return 'default';
  }

  return sessions.find((session) => session.id === sessionId)?.partition ?? 'default';
}

function normalizeUrl(value: string): string {
  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(value)) {
    return value;
  }

  return `https://${value.replace(/^\/+/, '')}`;
}
