import type { WebContents } from 'electron';
import type { TaskFlow, TaskStep, TaskExecutionResult, StepResult } from '@shared/types';
import { TaskStatus } from '@shared/types';
import type { ActionDefinition } from './types';
import { AutomationEngine } from './AutomationEngine';
import { withRetry, createBreakpoint, type Breakpoint } from './RetryPolicy';
import { EventBus } from '@main/ipc/EventBus';
import { EVENTS } from '@shared/constants';
import type { ExecutionLogService } from '@main/services/ExecutionLogService';

export interface FlowRunnerOptions {
  /** 默认每步重试次数 */
  defaultRetryCount?: number;
  /** 默认重试延迟 (ms) */
  defaultRetryDelay?: number;
  executionLogService?: Pick<ExecutionLogService, 'append'>;
}

/**
 * 任务流执行器 — 按顺序执行 Step → Action
 * 支持错误重试 & 断点继续
 */
export class FlowRunner {
  private engine: AutomationEngine;
  private eventBus: EventBus;
  private status: TaskStatus = TaskStatus.IDLE;
  private currentStepIndex = 0;
  private breakpoint: Breakpoint | null = null;
  private aborted = false;
  private paused = false;
  private pauseResolve: (() => void) | null = null;
  private readonly defaultRetryCount: number;
  private readonly defaultRetryDelay: number;
  private readonly executionLogService?: Pick<ExecutionLogService, 'append'>;
  private flowId = '';
  private batchId = '';

  constructor(options: FlowRunnerOptions = {}) {
    this.engine = new AutomationEngine();
    this.eventBus = EventBus.getInstance();
    this.defaultRetryCount = options.defaultRetryCount ?? 3;
    this.defaultRetryDelay = options.defaultRetryDelay ?? 1000;
    this.executionLogService = options.executionLogService;
  }

  /**
   * 执行整个任务流
   */
  async run(
    flow: TaskFlow,
    webContents: WebContents,
    fromStep = 0,
    batchId?: string,
  ): Promise<TaskExecutionResult> {
    this.status = TaskStatus.RUNNING;
    this.aborted = false;
    this.paused = false;
    this.currentStepIndex = fromStep;
    this.breakpoint = null;
    this.flowId = flow.id;
    this.batchId = batchId ?? `batch:${flow.id}`;

    const stepResults: StepResult[] = [];
    this.eventBus.emit(EVENTS.TASK_STARTED, { flowId: flow.id });

    for (let i = fromStep; i < flow.steps.length; i++) {
      if (this.aborted) {
        this.status = TaskStatus.IDLE;
        return { success: false, stepResults, error: 'Task aborted' };
      }

      if (this.paused) {
        await new Promise<void>((resolve) => {
          this.pauseResolve = resolve;
        });
      }

      this.currentStepIndex = i;
      const step = flow.steps[i];

      try {
        const result = await this.executeStep(step, webContents);
        stepResults.push(result);

        this.eventBus.emit(EVENTS.TASK_STEP_COMPLETED, {
          flowId: flow.id,
          stepIndex: i,
          result,
        });

        if (!result.success) {
          // 步骤失败，保存断点
          this.breakpoint = createBreakpoint(flow.id, i, result.error);
          this.status = TaskStatus.FAILED;
          this.eventBus.emit(EVENTS.TASK_FAILED, {
            flowId: flow.id,
            stepIndex: i,
            error: result.error,
          });
          return {
            success: false,
            stepResults,
            error: result.error,
            breakpointStepId: step.id,
          };
        }
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        this.breakpoint = createBreakpoint(flow.id, i, error);
        this.status = TaskStatus.FAILED;
        this.eventBus.emit(EVENTS.TASK_FAILED, {
          flowId: flow.id,
          stepIndex: i,
          error,
        });
        return {
          success: false,
          stepResults,
          error,
          breakpointStepId: step.id,
        };
      }
    }

    this.status = TaskStatus.COMPLETED;
    this.eventBus.emit(EVENTS.TASK_COMPLETED, { flowId: flow.id });
    return { success: true, stepResults };
  }

  /**
   * 从断点恢复执行
   */
  async resume(
    flow: TaskFlow,
    webContents: WebContents,
    batchId?: string,
  ): Promise<TaskExecutionResult> {
    const fromStep = this.breakpoint ? this.breakpoint.stepIndex : this.currentStepIndex;
    this.breakpoint = null;
    return this.run(flow, webContents, fromStep, batchId);
  }

  /**
   * 暂停
   */
  pause(): void {
    this.paused = true;
    this.status = TaskStatus.PAUSED;
  }

  /**
   * 继续（从暂停）
   */
  unpause(): void {
    this.paused = false;
    this.status = TaskStatus.RUNNING;
    if (this.pauseResolve) {
      this.pauseResolve();
      this.pauseResolve = null;
    }
  }

  /**
   * 中止
   */
  abort(): void {
    this.aborted = true;
    this.unpause(); // 如果暂停中，也要释放
  }

  getStatus(): TaskStatus {
    return this.status;
  }

  getCurrentStepIndex(): number {
    return this.currentStepIndex;
  }

  getBreakpoint(): Breakpoint | null {
    return this.breakpoint;
  }

  /**
   * 执行单步（带重试）
   */
  private async executeStep(step: TaskStep, webContents: WebContents): Promise<StepResult> {
    const retryCount = step.retryCount ?? this.defaultRetryCount;
    const retryDelay = step.retryDelay ?? this.defaultRetryDelay;

    const action: ActionDefinition = {
      type: step.action.type,
      selector: step.action.selector,
      params: step.action.params,
      timeout: step.action.timeout,
    };

    const startTime = Date.now();

    try {
      this.executionLogService?.append({
        taskId: this.flowId,
        batchId: this.batchId,
        stepIndex: this.currentStepIndex,
        level: 'info',
        message: `Starting step ${step.id}`,
      });

      const result = await withRetry(
        async () => {
          const r = await this.engine.execute(webContents, action);
          if (!r.success) throw new Error(r.error ?? 'Action failed');
          return r;
        },
        { maxRetries: retryCount, baseDelay: retryDelay },
      );

      return {
        stepId: step.id,
        success: true,
        data: result.data,
        duration: Date.now() - startTime,
      };
    } catch (err) {
      this.executionLogService?.append({
        taskId: this.flowId,
        batchId: this.batchId,
        stepIndex: this.currentStepIndex,
        level: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
      return {
        stepId: step.id,
        success: false,
        error: err instanceof Error ? err.message : String(err),
        duration: Date.now() - startTime,
      };
    }
  }
}
