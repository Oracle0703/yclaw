import { describe, it, expect } from 'vitest';
import { formatBeijingDateTime, formatDate, formatFileSize, truncate } from '@renderer/shared/utils/format';

describe('formatDate', () => {
  it('should format a Date object', () => {
    const result = formatDate(new Date('2026-04-06T12:00:00Z'));
    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
  });

  it('should format a timestamp number', () => {
    const result = formatDate(1712400000000);
    expect(typeof result).toBe('string');
  });

  it('should format an ISO string', () => {
    const result = formatDate('2026-04-06T12:00:00Z');
    expect(typeof result).toBe('string');
  });
});

describe('formatFileSize', () => {
  it('should format bytes', () => {
    expect(formatFileSize(500)).toBe('500 B');
  });

  it('should format kilobytes', () => {
    expect(formatFileSize(2048)).toBe('2.0 KB');
  });

  it('should format megabytes', () => {
    expect(formatFileSize(5 * 1024 * 1024)).toBe('5.0 MB');
  });

  it('should format gigabytes', () => {
    expect(formatFileSize(2 * 1024 * 1024 * 1024)).toBe('2.0 GB');
  });

  it('should handle zero', () => {
    expect(formatFileSize(0)).toBe('0 B');
  });

  it('should handle boundary values', () => {
    expect(formatFileSize(1023)).toBe('1023 B');
    expect(formatFileSize(1024)).toBe('1.0 KB');
  });
});

describe('formatBeijingDateTime', () => {
  it('should format utc iso string into Asia/Shanghai time', () => {
    expect(formatBeijingDateTime('2026-04-28T08:30:00.000Z')).toBe('2026-04-28 16:30:00');
  });
});

describe('truncate', () => {
  it('should not truncate short strings', () => {
    expect(truncate('hello', 10)).toBe('hello');
  });

  it('should truncate long strings with ellipsis', () => {
    expect(truncate('hello world this is long', 10)).toBe('hello w...');
  });

  it('should handle exact length', () => {
    expect(truncate('hello', 5)).toBe('hello');
  });

  it('should handle empty string', () => {
    expect(truncate('', 5)).toBe('');
  });
});
