/**
 * 内置 AI 工具 — 导航
 */

import type { AITool } from '../types';

/** 创建导航工具，注入 openWindow 回调以实际打开窗口 */
export function createNavigateTool(openWindow: (module: string) => void): AITool {
  return {
    name: 'navigate',
    description: '跳转到指定模块页面 (workbench/stock/automation/browser/plugin-center)',
    parameters: {
      module: { type: 'string', description: '目标模块名称' },
    },
    confirmationLevel: 1,
    async execute(params) {
      const module = params.module as string;
      const validModules = ['workbench', 'stock', 'automation', 'browser', 'plugin-center'];

      if (!validModules.includes(module)) {
        return {
          success: false,
          error: `无效模块: ${module}。可用模块: ${validModules.join(', ')}`,
        };
      }

      openWindow(module);

      return {
        success: true,
        data: { navigatedTo: module },
      };
    },
  };
}

/**
 * @deprecated 使用 createNavigateTool(openWindow) 代替
 */
export const navigateTool: AITool = {
  name: 'navigate',
  description: '跳转到指定模块页面 (workbench/stock/automation/browser/plugin-center)',
  parameters: {
    module: { type: 'string', description: '目标模块名称' },
  },
  confirmationLevel: 1,
  async execute(params) {
    const module = params.module as string;
    const validModules = ['workbench', 'stock', 'automation', 'browser', 'plugin-center'];

    if (!validModules.includes(module)) {
      return {
        success: false,
        error: `无效模块: ${module}。可用模块: ${validModules.join(', ')}`,
      };
    }

    return {
      success: false,
      error: 'navigateTool requires openWindow injection via createNavigateTool()',
    };
  },
};
