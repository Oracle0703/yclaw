/**
 * 内置 AI 工具 — 导航
 */

import type { AITool } from '../types';
import { EventBus } from '../../ipc/EventBus';
import { EVENTS } from '@shared/constants';

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

    EventBus.getInstance().emit(EVENTS.MODULE_OPENED, { module });

    return {
      success: true,
      data: { navigatedTo: module },
    };
  },
};
