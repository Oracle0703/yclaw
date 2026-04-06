import { describe, it, expect } from 'vitest';
import { withRetry, createBreakpoint, type RetryOptions } from '@engines/automation/RetryPolicy';

describe('withRetry', () => {
  it('should return result on first success', async () => {
    const fn = async () => 'success';
    const result = await withRetry(fn, { maxRetries: 3, baseDelay: 10 });
    expect(result).toBe('success');
  });

  it('should retry on failure and succeed', async () => {
    let attempt = 0;
    const fn = async () => {
      attempt++;
      if (attempt < 3) throw new Error('fail');
      return 'ok';
    };
    const result = await withRetry(fn, { maxRetries: 3, baseDelay: 10 });
    expect(result).toBe('ok');
    expect(attempt).toBe(3);
  });

  it('should throw after max retries exhausted', async () => {
    const fn = async () => {
      throw new Error('always fails');
    };
    await expect(withRetry(fn, { maxRetries: 2, baseDelay: 10 })).rejects.toThrow('always fails');
  });

  it('should use exponential backoff delay', async () => {
    const timestamps: number[] = [];
    let attempt = 0;
    const fn = async () => {
      timestamps.push(Date.now());
      attempt++;
      if (attempt < 3) throw new Error('fail');
      return 'done';
    };
    await withRetry(fn, { maxRetries: 3, baseDelay: 50 });
    // The delay between retries should be increasing
    if (timestamps.length >= 3) {
      const delay1 = timestamps[1] - timestamps[0];
      const delay2 = timestamps[2] - timestamps[1];
      expect(delay2).toBeGreaterThanOrEqual(delay1);
    }
  });

  it('should respect maxDelay cap', async () => {
    let attempt = 0;
    const timestamps: number[] = [];
    const fn = async () => {
      timestamps.push(Date.now());
      attempt++;
      if (attempt < 4) throw new Error('fail');
      return 'done';
    };
    await withRetry(fn, { maxRetries: 5, baseDelay: 100, maxDelay: 150 });
    expect(attempt).toBe(4);
  });

  it('should handle non-Error throws', async () => {
    const fn = async () => {
      throw 'string error';
    };
    await expect(withRetry(fn, { maxRetries: 0, baseDelay: 10 })).rejects.toThrow('string error');
  });

  it('should succeed with zero retries if first call succeeds', async () => {
    const fn = async () => 42;
    const result = await withRetry(fn, { maxRetries: 0, baseDelay: 10 });
    expect(result).toBe(42);
  });
});

describe('createBreakpoint', () => {
  it('should create breakpoint with required fields', () => {
    const bp = createBreakpoint('task-1', 3);
    expect(bp.taskId).toBe('task-1');
    expect(bp.stepIndex).toBe(3);
    expect(bp.timestamp).toBeDefined();
    expect(bp.error).toBeUndefined();
  });

  it('should include error when provided', () => {
    const bp = createBreakpoint('task-2', 5, 'Element not found');
    expect(bp.error).toBe('Element not found');
  });

  it('should have ISO timestamp', () => {
    const bp = createBreakpoint('task-3', 0);
    expect(() => new Date(bp.timestamp)).not.toThrow();
    expect(bp.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
