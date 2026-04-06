/**
 * Vitest 全局 setup
 * - Mock Electron APIs
 * - 设置全局 DOM 环境
 */
import { vi } from 'vitest';

// Mock window.electronAPI for renderer tests
const mockElectronAPI = {
  invoke: vi.fn().mockResolvedValue({ success: true, data: null }),
  on: vi.fn().mockReturnValue(() => {}),
  off: vi.fn(),
};

// Attach electronAPI to the existing window (don't replace window itself)
Object.defineProperty(globalThis.window ?? globalThis, 'electronAPI', {
  value: mockElectronAPI,
  writable: true,
  configurable: true,
});
