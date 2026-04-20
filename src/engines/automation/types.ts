/**
 * 自动化引擎 — Action 类型定义
 */
import type { ActionType, StepResult } from '@shared/types';

export interface AutomationPageImage {
  toDataURL(): string;
}

export interface AutomationPage {
  executeJavaScript<T = unknown>(code: string): Promise<T>;
  capturePage(): Promise<AutomationPageImage>;
}

export interface ActionContext {
  /** 页面 ID */
  webContentsId: number;
}

export interface ActionDefinition {
  type: ActionType;
  selector: string;
  params?: Record<string, unknown>;
  timeout?: number;
}

export interface ActionResult extends StepResult {
  actionType: ActionType;
}
