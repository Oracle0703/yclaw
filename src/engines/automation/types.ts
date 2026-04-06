/**
 * 自动化引擎 — Action 类型定义
 */
import type { ActionType, StepResult } from '@shared/types';

export interface ActionContext {
  /** WebContents ID */
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
