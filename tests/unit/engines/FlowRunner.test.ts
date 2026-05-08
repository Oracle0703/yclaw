import { describe, it, expect, vi, beforeEach } from 'vitest';

import { FlowRunner } from '@engines/automation/FlowRunner';
import type { TaskFlow, TaskStep } from '@shared/types';
import { EVENTS } from '@shared/constants';
import { ExecutionLogService } from '@main/services/ExecutionLogService';
import type { AutomationEngine } from '@engines/automation/AutomationEngine';

interface MockWebContents {
  executeJavaScript: ReturnType<typeof vi.fn>;
  capturePage: ReturnType<typeof vi.fn>;
}

function createMockWebContents(): MockWebContents {
  return {
    executeJavaScript: vi.fn().mockResolvedValue(undefined),
    capturePage: vi.fn().mockResolvedValue({
      toDataURL: () => 'data:image/png;base64,mock',
    }),
  };
}

function createFlow(steps: Partial<TaskStep>[] = []): TaskFlow {
  return {
    id: 'flow-1',
    name: 'Test Flow',
    steps: steps.map((s, i) => ({
      id: `step-${i}`,
      name: `Step ${i}`,
      action: { type: 'click' as const, selector: '#btn' },
      ...s,
    })),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe('FlowRunner', () => {
  let runner: FlowRunner;
  let wc: ReturnType<typeof createMockWebContents>;
  let appendLog: ReturnType<typeof vi.fn>;
  let mockEngine: Pick<AutomationEngine, 'execute'>;
  const mockEventBus = {
    emit: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    appendLog = vi.fn();
    mockEngine = {
      execute: vi.fn().mockResolvedValue({
        success: true,
        data: undefined,
      }),
    };
    runner = new FlowRunner({
      engine: mockEngine,
      eventBus: mockEventBus,
      defaultRetryCount: 0,
      defaultRetryDelay: 10,
      executionLogService: {
        append: appendLog,
      } as unknown as ExecutionLogService,
    });
    wc = createMockWebContents();
  });

  it('requires event bus injection', () => {
    expect(() => new FlowRunner({ engine: mockEngine })).toThrowError('eventBus is required');
  });

  it('requires automation engine injection', () => {
    expect(() => new FlowRunner({ eventBus: mockEventBus })).toThrowError('engine is required');
  });

  describe('run', () => {
    it('should execute all steps successfully', async () => {
      const flow = createFlow([{}, {}, {}]);
      const result = await runner.run(flow, wc);
      expect(result.success).toBe(true);
      expect(result.stepResults).toHaveLength(3);
      expect(result.stepResults.every((r) => r.success)).toBe(true);
    });

    it('should emit task started event', async () => {
      const flow = createFlow([{}]);
      await runner.run(flow, wc);
      expect(mockEventBus.emit).toHaveBeenCalledWith(EVENTS.TASK_STARTED, { flowId: 'flow-1' });
    });

    it('should emit step completed events', async () => {
      const flow = createFlow([{}, {}]);
      await runner.run(flow, wc);
      const stepCompletedCalls = mockEventBus.emit.mock.calls.filter(
        ([event]: [string]) => event === EVENTS.TASK_STEP_COMPLETED,
      );
      expect(stepCompletedCalls).toHaveLength(2);
    });

    it('should emit task completed event on success', async () => {
      const flow = createFlow([{}]);
      await runner.run(flow, wc);
      expect(mockEventBus.emit).toHaveBeenCalledWith(EVENTS.TASK_COMPLETED, { flowId: 'flow-1' });
    });

    it('should handle step failure and save breakpoint', async () => {
      vi.mocked(mockEngine.execute).mockResolvedValueOnce({
        success: false,
        error: 'Element not found',
      });
      const flow = createFlow([{}]);
      const result = await runner.run(flow, wc);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Element not found');
      expect(runner.getBreakpoint()).not.toBeNull();
      expect(runner.getBreakpoint()?.stepIndex).toBe(0);
    });

    it('should emit task failed event on failure', async () => {
      vi.mocked(mockEngine.execute).mockResolvedValueOnce({ success: false, error: 'fail' });
      const flow = createFlow([{}]);
      await runner.run(flow, wc);
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        EVENTS.TASK_FAILED,
        expect.objectContaining({ flowId: 'flow-1', error: expect.stringContaining('fail') }),
      );
    });

    it('writes structured logs for step start and failure', async () => {
      vi.mocked(mockEngine.execute).mockResolvedValueOnce({ success: false, error: 'fail' });
      const flow = createFlow([{}]);

      await runner.run(flow, wc);

      expect(appendLog).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: 'flow-1',
          batchId: 'batch:flow-1',
          level: 'info',
        }),
      );
      expect(appendLog).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: 'flow-1',
          batchId: 'batch:flow-1',
          level: 'error',
          message: expect.stringContaining('fail'),
        }),
      );
    });

    it('passes task and batch context to automation engine executions', async () => {
      const flow = createFlow([
        {
          action: {
            type: 'extract',
            selector: 'https://newsnow.busiyi.world/api/s?id=zhihu&latest',
            params: { mode: 'api', parserKey: 'newsnow.hot' },
          },
        },
      ]);
      flow.entryUrl = 'https://newsnow.busiyi.world/api/s?id=zhihu&latest';
      flow.templateId = 'template-1';

      await runner.run(flow, wc, 0, 'batch-1');

      expect(mockEngine.execute).toHaveBeenCalledWith(
        wc,
        expect.objectContaining({
          type: 'extract',
          selector: 'https://newsnow.busiyi.world/api/s?id=zhihu&latest',
        }),
        {
          taskId: 'flow-1',
          batchId: 'batch-1',
          templateId: 'template-1',
          sourceUrl: 'https://newsnow.busiyi.world/api/s?id=zhihu&latest',
        },
      );
    });

    it('should start from specified step index', async () => {
      const flow = createFlow([{}, {}, {}]);
      const result = await runner.run(flow, wc, 1);
      // Should only execute steps 1 and 2
      expect(result.stepResults).toHaveLength(2);
    });

    it('should return empty result for empty flow', async () => {
      const flow = createFlow([]);
      const result = await runner.run(flow, wc);
      expect(result.success).toBe(true);
      expect(result.stepResults).toHaveLength(0);
    });
  });

  describe('pause / unpause', () => {
    it('should pause and unpause execution', async () => {
      const flow = createFlow([{}, {}]);
      // Start run, then pause before second step
      const runPromise = runner.run(flow, wc);

      // After first step executes, pause
      // We can't easily test true pause with sequential execution,
      // so just verify state changes
      runner.pause();
      expect(runner.getStatus()).toBe('paused');

      runner.unpause();
      const result = await runPromise;
      expect(result.success).toBe(true);
    });
  });

  describe('abort', () => {
    it('should abort execution mid-flow', async () => {
      // First step succeeds, then we abort before second step executes
      let callCount = 0;
      vi.mocked(mockEngine.execute).mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          // After first step completes, trigger abort
          runner.abort();
        }
        return { success: true };
      });
      const flow = createFlow([{}, {}, {}]);
      const result = await runner.run(flow, wc);
      expect(result.success).toBe(false);
      expect(result.error).toContain('aborted');
    });
  });

  describe('resume', () => {
    it('should resume from breakpoint', async () => {
      // First run: fail at step 1
      vi.mocked(mockEngine.execute)
        .mockResolvedValueOnce({ success: true })
        .mockResolvedValueOnce({ success: false, error: 'fail' });
      const flow = createFlow([{}, {}, {}]);
      const result1 = await runner.run(flow, wc);
      expect(result1.success).toBe(false);
      expect(runner.getBreakpoint()?.stepIndex).toBe(1);

      // Reset mock to succeed
      vi.mocked(mockEngine.execute).mockResolvedValue({ success: true });
      const result2 = await runner.resume(flow, wc);
      // Should resume from step 1
      expect(result2.success).toBe(true);
      expect(result2.stepResults).toHaveLength(2); // steps 1, 2
    });
  });

  describe('status', () => {
    it('should track status through lifecycle', async () => {
      expect(runner.getStatus()).toBe('idle');
      const flow = createFlow([{}]);
      await runner.run(flow, wc);
      expect(runner.getStatus()).toBe('completed');
    });

    it('should be failed after step failure', async () => {
      vi.mocked(mockEngine.execute).mockResolvedValueOnce({ success: false, error: 'fail' });
      const flow = createFlow([{}]);
      await runner.run(flow, wc);
      expect(runner.getStatus()).toBe('failed');
    });
  });

  describe('getCurrentStepIndex', () => {
    it('should track current step index', async () => {
      expect(runner.getCurrentStepIndex()).toBe(0);
      const flow = createFlow([{}, {}, {}]);
      await runner.run(flow, wc);
      // After completion, should be at last step index
      expect(runner.getCurrentStepIndex()).toBe(2);
    });
  });
});
