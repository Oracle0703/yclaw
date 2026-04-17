import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock global fetch
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

// Mock WebSocket
class MockWebSocket {
  static instances: MockWebSocket[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  readyState = 1;

  constructor(public url: string) {
    MockWebSocket.instances.push(this);
    // Simulate async open
    setTimeout(() => this.onopen?.(), 0);
  }

  send = vi.fn();
  close = vi.fn().mockImplementation(() => {
    this.readyState = 3;
    this.onclose?.();
  });

  simulateMessage(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }

  simulateClose() {
    this.onclose?.();
  }
}

(globalThis as typeof globalThis & { WebSocket: typeof MockWebSocket }).WebSocket = MockWebSocket;

import { DataSourceManager } from '@engines/analytics/DataSourceManager';
import type { DataSourceConfig } from '@shared/types';
import { EVENTS } from '@shared/constants';

describe('DataSourceManager', () => {
  let manager: DataSourceManager;
  const mockEventBus = {
    emit: vi.fn(),
  };

  const restConfig: DataSourceConfig = {
    id: 'rest-1',
    name: 'Test REST',
    type: 'rest',
    url: 'https://api.example.com/data',
  };

  const wsConfig: DataSourceConfig = {
    id: 'ws-1',
    name: 'Test WS',
    type: 'websocket',
    url: 'wss://ws.example.com/stream',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    MockWebSocket.instances = [];
    manager = new DataSourceManager({ eventBus: mockEventBus });
  });

  afterEach(() => {
    manager.closeAll();
  });

  describe('fetchHistory', () => {
    it('requires event bus injection', () => {
      expect(() => new DataSourceManager()).toThrowError('eventBus is required');
    });

    it('should fetch and normalize OHLCV data', async () => {
      const mockData = [
        { time: 1000, open: 10, high: 15, low: 8, close: 12, volume: 100 },
        { time: 2000, open: 12, high: 18, low: 11, close: 16, volume: 150 },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockData),
      });

      const result = await manager.fetchHistory(restConfig, 'AAPL');
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        time: 1000, open: 10, high: 15, low: 8, close: 12, volume: 100,
      });
    });

    it('should include symbol and additional params in URL', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) });
      await manager.fetchHistory(restConfig, 'MSFT', { interval: '1D' });
      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('symbol=MSFT');
      expect(calledUrl).toContain('interval=1D');
    });

    it('should add API key header', async () => {
      const authConfig: DataSourceConfig = {
        ...restConfig,
        auth: { type: 'apikey', value: 'my-key' },
      };
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) });
      await manager.fetchHistory(authConfig, 'GOOG');
      const headers = mockFetch.mock.calls[0][1]?.headers;
      expect(headers['X-API-Key']).toBe('my-key');
    });

    it('should add Bearer auth header', async () => {
      const authConfig: DataSourceConfig = {
        ...restConfig,
        auth: { type: 'bearer', value: 'token123' },
      };
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) });
      await manager.fetchHistory(authConfig, 'GOOG');
      const headers = mockFetch.mock.calls[0][1]?.headers;
      expect(headers['Authorization']).toBe('Bearer token123');
    });

    it('should throw on HTTP error', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Server Error' });
      await expect(manager.fetchHistory(restConfig, 'ERR')).rejects.toThrow('HTTP 500');
    });

    it('should normalize alternative field names', async () => {
      const altData = [{ t: 1000, o: 10, h: 15, l: 8, c: 12, v: 100 }];
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(altData) });
      const result = await manager.fetchHistory(restConfig, 'ALT');
      expect(result[0]).toEqual({
        time: 1000, open: 10, high: 15, low: 8, close: 12, volume: 100,
      });
    });

    it('should return empty array for non-array response', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ data: 'invalid' }) });
      const result = await manager.fetchHistory(restConfig, 'BAD');
      expect(result).toEqual([]);
    });
  });

  describe('connectRealtime', () => {
    it('should create WebSocket connection', () => {
      manager.connectRealtime(wsConfig, ['AAPL']);
      expect(MockWebSocket.instances).toHaveLength(1);
      expect(MockWebSocket.instances[0].url).toBe('wss://ws.example.com/stream');
    });

    it('should throw if config type is not websocket', () => {
      expect(() => manager.connectRealtime(restConfig, ['AAPL'])).toThrow('Config type must be "websocket"');
    });

    it('should track connection state', () => {
      manager.connectRealtime(wsConfig, ['AAPL']);
      const conn = manager.getConnection('ws-1');
      expect(conn).toBeDefined();
      expect(conn!.type).toBe('websocket');
    });

    it('emits realtime ticks through injected event bus', () => {
      manager.connectRealtime(wsConfig, ['AAPL']);
      MockWebSocket.instances[0].simulateMessage({ symbol: 'AAPL', price: 200 });

      expect(mockEventBus.emit).toHaveBeenCalledWith(EVENTS.STOCK_REALTIME_TICK, {
        sourceId: 'ws-1',
        data: { symbol: 'AAPL', price: 200 },
      });
    });
  });

  describe('disconnect', () => {
    it('should close WebSocket and remove connection', () => {
      manager.connectRealtime(wsConfig, ['AAPL']);
      manager.disconnect('ws-1');
      expect(MockWebSocket.instances[0].close).toHaveBeenCalled();
      expect(manager.getConnection('ws-1')).toBeUndefined();
    });

    it('should handle disconnecting non-existent connection', () => {
      expect(() => manager.disconnect('nonexistent')).not.toThrow();
    });
  });

  describe('getAllConnections', () => {
    it('should return all tracked connections', () => {
      manager.connectRealtime(wsConfig, ['AAPL']);
      const conns = manager.getAllConnections();
      expect(conns).toHaveLength(1);
    });
  });

  describe('closeAll', () => {
    it('should close all connections', () => {
      manager.connectRealtime(wsConfig, ['AAPL']);
      manager.closeAll();
      expect(manager.getAllConnections()).toHaveLength(0);
    });
  });
});
