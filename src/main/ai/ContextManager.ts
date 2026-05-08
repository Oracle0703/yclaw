/**
 * ContextManager — 上下文收集与 Prompt 构建
 */

import type { AIServiceContext } from '@shared/types';
import os from 'os';
import type { PluginRepository, TaskRepository } from '../services/repositories';

export interface TaskOpsContextProvider {
  collect(): AIServiceContext['taskOperations'];
}

export interface ContextManagerOptions {
  taskRepository?: Pick<TaskRepository, 'getTasks'>;
  pluginRepository?: Pick<PluginRepository, 'getInstalledPlugins'>;
  taskOpsContextProvider?: TaskOpsContextProvider;
}

export class ContextManager {
  private currentModule = 'workbench';
  private taskRepository: Pick<TaskRepository, 'getTasks'>;
  private pluginRepository: Pick<PluginRepository, 'getInstalledPlugins'>;
  private taskOpsContextProvider?: TaskOpsContextProvider;

  constructor(options: ContextManagerOptions = {}) {
    if (!options.taskRepository) {
      throw new Error('taskRepository is required');
    }

    if (!options.pluginRepository) {
      throw new Error('pluginRepository is required');
    }

    this.taskRepository = options.taskRepository;
    this.pluginRepository = options.pluginRepository;
    this.taskOpsContextProvider = options.taskOpsContextProvider;
  }

  setCurrentModule(module: string): void {
    this.currentModule = module;
  }

  async collectContext(): Promise<AIServiceContext> {
    const cpus = os.cpus();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const recentTasks = this.taskRepository
      .getTasks()
      .slice(0, 5)
      .map((task) => ({
        name: task.name,
        status: task.status,
        updatedAt: task.updatedAt,
      }));
    const installedPlugins = this.pluginRepository.getInstalledPlugins().slice(0, 5);
    const taskOperations = this.taskOpsContextProvider?.collect();

    return {
      currentModule: this.currentModule,
      systemMetrics: {
        // 注意：此为累计时间比（近似值），非瞬时使用率，仅取 core 0
        cpu:
          cpus.length > 0
            ? Math.round((cpus[0].times.user / (cpus[0].times.user + cpus[0].times.idle)) * 100)
            : 0,
        memory: Math.round(((totalMemory - freeMemory) / totalMemory) * 100),
        disk: 0, // Placeholder; real implementation would use disk usage APIs
        uptime: Math.round(os.uptime()),
      },
      recentTasks,
      installedPlugins,
      ...(taskOperations ? { taskOperations } : {}),
    };
  }

  contextToPrompt(ctx: AIServiceContext): string {
    const lines: string[] = [
      '你是 YClaw 运营助手，一个深度嵌入桌面工作台的智能副驾驶。',
      '你理解用户的自动化任务、股票策略、浏览器操作和插件状态。',
      '',
      '## 当前上下文',
      `- 当前模块: ${ctx.currentModule}`,
      `- CPU 使用率: ${ctx.systemMetrics.cpu}%`,
      `- 内存使用率: ${ctx.systemMetrics.memory}%`,
      `- 系统运行时间: ${Math.round(ctx.systemMetrics.uptime / 3600)}h`,
    ];

    if (ctx.recentTasks.length > 0) {
      lines.push('', '## 近期任务');
      for (const task of ctx.recentTasks) {
        lines.push(`- ${task.name}: ${task.status} (${task.updatedAt})`);
      }
    }

    if (ctx.installedPlugins.length > 0) {
      lines.push('', '## 已安装插件');
      for (const plugin of ctx.installedPlugins) {
        lines.push(`- ${plugin.name} v${plugin.version} (${plugin.enabled ? '启用' : '禁用'})`);
      }
    }

    if (ctx.taskOperations) {
      const pendingAlerts = ctx.taskOperations.alerts.filter((alert) => !alert.read).length;
      const criticalAlerts = ctx.taskOperations.alerts.filter((alert) => alert.level === 'critical').length;
      const onlineRunners = ctx.taskOperations.runners.filter((runner) => runner.status === 'online').length;

      lines.push('', '## 任务运营中台');
      lines.push(`- 工作区数量: ${ctx.taskOperations.workspaces.length}`);
      lines.push(`- 待处理告警: ${pendingAlerts}`);
      lines.push(`- Critical 告警: ${criticalAlerts}`);
      lines.push(`- 复盘记录: ${ctx.taskOperations.reviews.length}`);
      lines.push(`- Runner 在线数: ${onlineRunners}/${ctx.taskOperations.runners.length}`);
    }

    lines.push(
      '',
      '## 回复规则',
      '- 用简洁友好的中文回复',
      '- 涉及操作时，说明操作内容并询问确认',
      '- 给出具体的建议而非笼统的说法',
      '- 适当使用表格和列表让信息更清晰',
    );

    return lines.join('\n');
  }
}
