import { describe, it, expect } from 'vitest';
import { formatLogEntry, logEntryToString, type LogEntry } from '@shared/utils/logger';

describe('formatLogEntry', () => {
  it('should create a log entry with correct fields', () => {
    const entry = formatLogEntry('info', 'main', 'Test message');
    expect(entry.level).toBe('info');
    expect(entry.source).toBe('main');
    expect(entry.message).toBe('Test message');
    expect(entry.timestamp).toBeDefined();
    expect(entry.data).toBeUndefined();
  });

  it('should include data when provided', () => {
    const data = { key: 'value' };
    const entry = formatLogEntry('error', 'renderer', 'Error occurred', data);
    expect(entry.data).toEqual(data);
  });

  it('should generate ISO timestamp', () => {
    const entry = formatLogEntry('debug', 'plugin', 'Debug msg');
    expect(() => new Date(entry.timestamp)).not.toThrow();
    expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('should handle all log levels', () => {
    const levels = ['debug', 'info', 'warn', 'error'] as const;
    for (const level of levels) {
      const entry = formatLogEntry(level, 'main', `${level} message`);
      expect(entry.level).toBe(level);
    }
  });

  it('should handle all log sources', () => {
    const sources = ['main', 'renderer', 'plugin', 'engine'] as const;
    for (const source of sources) {
      const entry = formatLogEntry('info', source, `from ${source}`);
      expect(entry.source).toBe(source);
    }
  });
});

describe('logEntryToString', () => {
  it('should format entry without data', () => {
    const entry: LogEntry = {
      timestamp: '2026-01-01T12:00:00.000Z',
      level: 'info',
      source: 'main',
      message: 'Hello world',
    };
    const str = logEntryToString(entry);
    expect(str).toBe('[2026-01-01T12:00:00.000Z] [INFO] [main] Hello world');
  });

  it('should format entry with data', () => {
    const entry: LogEntry = {
      timestamp: '2026-01-01T12:00:00.000Z',
      level: 'error',
      source: 'renderer',
      message: 'Error occurred',
      data: { code: 404 },
    };
    const str = logEntryToString(entry);
    expect(str).toContain('[ERROR]');
    expect(str).toContain('[renderer]');
    expect(str).toContain('Error occurred');
    expect(str).toContain('{"code":404}');
  });

  it('should uppercase level in output', () => {
    const entry: LogEntry = {
      timestamp: '2026-01-01T12:00:00.000Z',
      level: 'warn',
      source: 'plugin',
      message: 'Warning',
    };
    expect(logEntryToString(entry)).toContain('[WARN]');
  });
});
