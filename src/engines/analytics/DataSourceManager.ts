import type { OHLCVData, DataSourceConfig } from '@shared/types';
import type { DataSourceConnection } from './types';
import { EventBus } from '@main/ipc/EventBus';
import { EVENTS } from '@shared/constants';

/**
 * 数据源管理器 — REST / WebSocket 行情数据接入
 */
export class DataSourceManager {
  private connections = new Map<string, DataSourceConnection>();
  private wsInstances = new Map<string, WebSocket>();
  private reconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private eventBus: EventBus;
  private readonly maxReconnectAttempts = 5;

  constructor() {
    this.eventBus = EventBus.getInstance();
  }

  /**
   * 通过 REST 获取历史 K 线数据
   */
  async fetchHistory(
    config: DataSourceConfig,
    symbol: string,
    params?: Record<string, string>,
  ): Promise<OHLCVData[]> {
    const url = new URL(config.url);
    url.searchParams.set('symbol', symbol);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
      }
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (config.auth) {
      if (config.auth.type === 'apikey') {
        headers['X-API-Key'] = config.auth.value;
      } else if (config.auth.type === 'bearer') {
        headers['Authorization'] = `Bearer ${config.auth.value}`;
      }
    }

    const response = await fetch(url.toString(), { headers });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return this.normalizeOHLCV(data, config);
  }

  /**
   * 订阅实时行情（WebSocket）
   */
  connectRealtime(config: DataSourceConfig, symbols: string[]): void {
    if (config.type !== 'websocket') {
      throw new Error('Config type must be "websocket" for realtime connection');
    }

    const conn: DataSourceConnection = {
      id: config.id,
      type: 'websocket',
      url: config.url,
      connected: false,
    };
    this.connections.set(config.id, conn);
    this.createWebSocket(config, symbols, 0);
  }

  /**
   * 断开实时连接
   */
  disconnect(configId: string): void {
    const ws = this.wsInstances.get(configId);
    if (ws) {
      ws.close();
      this.wsInstances.delete(configId);
    }
    const timer = this.reconnectTimers.get(configId);
    if (timer) clearTimeout(timer);
    this.reconnectTimers.delete(configId);
    this.connections.delete(configId);
  }

  /**
   * 获取某个连接状态
   */
  getConnection(configId: string): DataSourceConnection | undefined {
    return this.connections.get(configId);
  }

  /**
   * 获取所有活跃连接
   */
  getAllConnections(): DataSourceConnection[] {
    return Array.from(this.connections.values());
  }

  /**
   * 关闭所有连接
   */
  closeAll(): void {
    for (const id of this.connections.keys()) {
      this.disconnect(id);
    }
  }

  private createWebSocket(
    config: DataSourceConfig,
    symbols: string[],
    attempt: number,
  ): void {
    const ws = new WebSocket(config.url);

    ws.onopen = () => {
      const conn = this.connections.get(config.id);
      if (conn) conn.connected = true;

      // 发送订阅消息
      const subscribeMsg = JSON.stringify({
        action: 'subscribe',
        symbols,
        ...(config.requestFormat ?? {}),
      });
      ws.send(subscribeMsg);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string);
        this.eventBus.emit(EVENTS.STOCK_REALTIME_TICK, {
          sourceId: config.id,
          data,
        });
      } catch {
        // 忽略无法解析的消息
      }
    };

    ws.onclose = () => {
      const conn = this.connections.get(config.id);
      if (conn) conn.connected = false;

      // 自动重连
      if (attempt < this.maxReconnectAttempts && this.connections.has(config.id)) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
        const timer = setTimeout(() => {
          this.createWebSocket(config, symbols, attempt + 1);
        }, delay);
        this.reconnectTimers.set(config.id, timer);
      }
    };

    ws.onerror = () => {
      // onclose 会紧接着触发，重连逻辑在 onclose 中处理
    };

    this.wsInstances.set(config.id, ws);
  }

  /**
   * 将不同数据源数据标准化为 OHLCV
   */
  private normalizeOHLCV(data: unknown, _config: DataSourceConfig): OHLCVData[] {
    // 默认期望数组格式
    if (!Array.isArray(data)) return [];
    return data.map((item: Record<string, unknown>) => ({
      time: Number(item.time ?? item.timestamp ?? item.t ?? 0),
      open: Number(item.open ?? item.o ?? 0),
      high: Number(item.high ?? item.h ?? 0),
      low: Number(item.low ?? item.l ?? 0),
      close: Number(item.close ?? item.c ?? 0),
      volume: Number(item.volume ?? item.v ?? 0),
    }));
  }
}
