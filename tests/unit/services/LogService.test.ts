import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

const testLogDir = path.join(os.tmpdir(), 'yclaw-test-logs-' + Date.now());

// Mock paths
vi.mock('@main/utils/paths', () => ({
  getLogPath: () => testLogDir,
}));

import { LogService } from '@main/services/LogService';

describe('LogService', () => {
  let service: LogService;

  beforeEach(() => {
    fs.mkdirSync(testLogDir, { recursive: true });
    service = new LogService();
  });

  afterEach(() => {
    service.close();
    fs.rmSync(testLogDir, { recursive: true, force: true });
  });

  it('should create log directory', () => {
    expect(fs.existsSync(testLogDir)).toBe(true);
  });

  it('should create a log file for today', () => {
    service.info('main', 'test message');
    const today = new Date().toISOString().slice(0, 10);
    const logFile = path.join(testLogDir, `${today}.log`);
    // Wait briefly for stream flush
    service.close();
    expect(fs.existsSync(logFile)).toBe(true);
  });

  it('should write log entry with correct format', () => {
    service.info('main', 'hello world');
    service.close();
    const today = new Date().toISOString().slice(0, 10);
    const content = fs.readFileSync(path.join(testLogDir, `${today}.log`), 'utf-8');
    expect(content).toContain('[INFO]');
    expect(content).toContain('[main]');
    expect(content).toContain('hello world');
  });

  it('should support all log levels', () => {
    service.debug('main', 'debug msg');
    service.info('main', 'info msg');
    service.warn('main', 'warn msg');
    service.error('main', 'error msg');
    service.close();
    const today = new Date().toISOString().slice(0, 10);
    const content = fs.readFileSync(path.join(testLogDir, `${today}.log`), 'utf-8');
    expect(content).toContain('[DEBUG]');
    expect(content).toContain('[INFO]');
    expect(content).toContain('[WARN]');
    expect(content).toContain('[ERROR]');
  });

  it('should support different sources', () => {
    service.info('main', 'from main');
    service.info('renderer', 'from renderer');
    service.info('plugin', 'from plugin');
    service.info('engine', 'from engine');
    service.close();
    const today = new Date().toISOString().slice(0, 10);
    const content = fs.readFileSync(path.join(testLogDir, `${today}.log`), 'utf-8');
    expect(content).toContain('[main]');
    expect(content).toContain('[renderer]');
    expect(content).toContain('[plugin]');
    expect(content).toContain('[engine]');
  });

  it('should include data in log when provided', () => {
    service.info('main', 'with data', { key: 'value' });
    service.close();
    const today = new Date().toISOString().slice(0, 10);
    const content = fs.readFileSync(path.join(testLogDir, `${today}.log`), 'utf-8');
    expect(content).toContain('"key":"value"');
  });

  it('should export debug package with system info', () => {
    service.info('main', 'test for export');
    service.close();
    const pkg = service.exportDebugPackage();
    expect(pkg).toContain('YClaw Debug Package');
    expect(pkg).toContain('Platform:');
    expect(pkg).toContain('Node:');
    expect(pkg).toContain('test for export');
  });

  it('should close stream gracefully', () => {
    service.info('main', 'before close');
    service.close();
    // No error should occur on double close
    service.close();
  });
});
