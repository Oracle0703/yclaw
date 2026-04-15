/**
 * ContextManager — 上下文收集与 Prompt 构建
 */

import type { AIServiceContext } from '@shared/types';
import os from 'os';
import { DatabaseService } from '../services/DatabaseService';

export class ContextManager {
  private currentModule = 'workbench';
  private databaseService = DatabaseService.getInstance();

  setCurrentModule(module: string): void {
    this.currentModule = module;
  }

  async collectContext(): Promise<AIServiceContext> {
    const cpus = os.cpus();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const recentTasks = this.databaseService.getTasks().slice(0, 5).map((task) => ({
      name: task.name,
      status: task.status,
      updatedAt: task.updatedAt,
    }));
    const installedPlugins = this.databaseService.getInstalledPlugins().slice(0, 5);

    return {
      currentModule: this.currentModule,
      systemMetrics: {
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
