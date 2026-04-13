/**
 * 内置 AI 工具 — 系统状态
 */

import type { AITool } from '../types';

export const systemStatusTool: AITool = {
  name: 'system_status',
  description: '查看系统资源使用状态 (CPU/内存/磁盘/运行时间)',
  parameters: {},
  confirmationLevel: 0,
  async execute(_params, context) {
    return {
      success: true,
      data: {
        cpu: `${context.systemMetrics.cpu}%`,
        memory: `${context.systemMetrics.memory}%`,
        uptime: `${Math.round(context.systemMetrics.uptime / 3600)}h`,
        plugins: context.installedPlugins.length,
        recentTasks: context.recentTasks.length,
      },
    };
  },
};
