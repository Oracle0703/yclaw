/**
 * 自动化任务类型定义
 */

export type ActionType = 'click' | 'input' | 'scroll' | 'extract' | 'screenshot';

export interface TaskAction {
  type: ActionType;
  selector: string;
  params?: Record<string, unknown>;
  timeout?: number;
}

export interface TaskStep {
  id: string;
  name: string;
  action: TaskAction;
  retryCount?: number;
  retryDelay?: number;
}

export interface TaskFlow {
  id: string;
  name: string;
  description?: string;
  steps: TaskStep[];
  createdAt: string;
  updatedAt: string;
}

export enum TaskStatus {
  IDLE = 'idle',
  RUNNING = 'running',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export interface TaskExecutionResult {
  success: boolean;
  stepResults: StepResult[];
  error?: string;
  breakpointStepId?: string;
}

export interface StepResult {
  stepId: string;
  success: boolean;
  data?: unknown;
  error?: string;
  duration: number;
}
