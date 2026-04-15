import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { getDatabasePath } from '../utils/paths';
import type { Conversation, ChatMessage, TaskFlow, TaskStep } from '@shared/types';

/**
 * SQLite 数据库服务
 * - WAL 模式
 * - 基础迁移机制
 */
export class DatabaseService {
  private static instance: DatabaseService;
  private db: Database.Database | null = null;
  private dbDir: string;
  private dbPath: string;
  private readonly currentVersion = 4;

  constructor(dbName = 'yclaw.sqlite') {
    this.dbDir = getDatabasePath();
    this.dbPath = path.join(this.dbDir, dbName);
  }

  static getInstance(dbName?: string): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService(dbName);
    }
    return DatabaseService.instance;
  }

  /**
   * 打开数据库连接
   */
  open(): void {
    if (this.db) {
      return;
    }

    fs.mkdirSync(this.dbDir, { recursive: true });
    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.runMigrations();
  }

  /**
   * 执行查询（返回所有行）
   */
  all<T = Record<string, unknown>>(sql: string, params?: unknown[]): T[] {
    this.ensureOpen();
    const stmt = this.db!.prepare(sql);
    return (params ? stmt.all(...params) : stmt.all()) as T[];
  }

  /**
   * 执行查询（返回单行）
   */
  get<T = Record<string, unknown>>(sql: string, params?: unknown[]): T | undefined {
    this.ensureOpen();
    const stmt = this.db!.prepare(sql);
    return (params ? stmt.get(...params) : stmt.get()) as T | undefined;
  }

  /**
   * 执行写操作
   */
  run(sql: string, params?: unknown[]): Database.RunResult {
    this.ensureOpen();
    const stmt = this.db!.prepare(sql);
    return params ? stmt.run(...params) : stmt.run();
  }

  /**
   * 在事务中执行多个操作
   */
  transaction<T>(fn: () => T): T {
    this.ensureOpen();
    const transaction = this.db!.transaction(fn);
    return transaction();
  }

  /**
   * 关闭数据库
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  getTasks(): Array<{
    id: string;
    name: string;
    status: string;
    updatedAt: string;
    schedule?: {
      type: 'manual' | 'once' | 'cron';
      cron?: string;
      runAt?: string;
      timeoutMs?: number;
      maxConcurrency?: number;
    } | null;
    nextRunAt?: string | null;
    lastRunAt?: string | null;
    latestBatch?: {
      id: string;
      taskId: string;
      status: string;
      createdAt: string;
      stepResults: unknown[];
    } | null;
  }> {
    this.ensureOpen();
    const rows = this.db!.prepare(`
      SELECT
        t.id,
        t.name,
        t.status,
        t.schedule_json as scheduleJson,
        t.next_run_at as nextRunAt,
        t.last_run_at as lastRunAt,
        t.updated_at as updatedAt,
        (
          SELECT json_object(
            'id', tb.id,
            'taskId', tb.task_id,
            'status', tb.status,
            'createdAt', tb.created_at,
            'stepResults', COALESCE(json(tb.step_results), json('[]'))
          )
          FROM task_batches tb
          WHERE tb.task_id = t.id
          ORDER BY tb.created_at DESC
          LIMIT 1
        ) as latestBatchJson
      FROM tasks
      ORDER BY t.updated_at DESC
    `).all() as Array<{
      id: string;
      name: string;
      status: string;
      scheduleJson?: string | null;
      nextRunAt?: string | null;
      lastRunAt?: string | null;
      updatedAt: string;
      latestBatchJson?: string | null;
    }>;

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      status: row.status,
      updatedAt: row.updatedAt,
      schedule: row.scheduleJson ? JSON.parse(row.scheduleJson) : null,
      nextRunAt: row.nextRunAt ?? null,
      lastRunAt: row.lastRunAt ?? null,
      latestBatch: row.latestBatchJson ? JSON.parse(row.latestBatchJson) : null,
    }));
  }

  getTaskFlow(taskId: string): TaskFlow | null {
    this.ensureOpen();
    const row = this.db!.prepare(`
      SELECT id, name, description, flow_json as flowJson, created_at as createdAt, updated_at as updatedAt
      FROM tasks
      WHERE id = ?
    `).get(taskId) as
      | {
        id: string;
        name: string;
        description?: string;
        flowJson: string;
        createdAt: string;
        updatedAt: string;
      }
      | undefined;

    if (!row) {
      return null;
    }

    const parsed = JSON.parse(row.flowJson) as Partial<TaskFlow> | { steps?: TaskStep[] } | TaskStep[];
    const flowSteps = Array.isArray(parsed)
      ? parsed
      : parsed.steps;
    const steps = flowSteps && flowSteps.length > 0
      ? flowSteps
      : this.getTaskSteps(taskId);

    return {
      id: row.id,
      name: row.name,
      description: row.description,
      steps,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  updateTaskStatus(taskId: string, status: string): void {
    this.ensureOpen();
    this.db!.prepare(`
      UPDATE tasks
      SET status = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(status, taskId);
  }

  getInstalledPlugins(): Array<{
    name: string;
    version: string;
    enabled: boolean;
  }> {
    this.ensureOpen();
    return this.db!.prepare(`
      SELECT name, version, status
      FROM plugins
      ORDER BY installed_at DESC
    `).all().map((row) => {
      const plugin = row as { name: string; version: string; status: string };
      return {
        name: plugin.name,
        version: plugin.version,
        enabled: plugin.status === 'active',
      };
    });
  }

  saveAIConversation(conversation: Conversation): void {
    this.ensureOpen();
    this.db!.prepare(`
      INSERT INTO ai_conversations (id, title, created_at, updated_at)
      VALUES (@id, @title, @createdAt, @updatedAt)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        updated_at = excluded.updated_at
    `).run({
      id: conversation.id,
      title: conversation.title,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    });
  }

  saveAIMessage(conversationId: string, message: ChatMessage): void {
    this.ensureOpen();
    this.db!.prepare(`
      INSERT INTO ai_messages (id, conversation_id, role, content, timestamp)
      VALUES (@id, @conversationId, @role, @content, @timestamp)
    `).run({
      id: message.id,
      conversationId,
      role: message.role,
      content: message.content,
      timestamp: message.timestamp,
    });
  }

  deleteAIConversation(conversationId: string): boolean {
    this.ensureOpen();
    const result = this.db!.prepare(`
      DELETE FROM ai_conversations
      WHERE id = ?
    `).run(conversationId);
    return result.changes > 0;
  }

  private getTaskSteps(taskId: string): TaskStep[] {
    return this.db!.prepare(`
      SELECT id, name, action_json as actionJson, retry_count as retryCount, retry_delay as retryDelay
      FROM task_steps
      WHERE task_id = ?
      ORDER BY step_index ASC
    `).all(taskId).map((row) => {
      const step = row as {
        id: string;
        name: string;
        actionJson: string;
        retryCount: number | null;
        retryDelay: number | null;
      };
      return {
        id: step.id,
        name: step.name,
        action: JSON.parse(step.actionJson),
        retryCount: step.retryCount ?? undefined,
        retryDelay: step.retryDelay ?? undefined,
      };
    });
  }

  private ensureOpen(): void {
    if (!this.db) {
      throw new Error('Database is not open. Call open() first.');
    }
  }

  /**
   * 数据库迁移
   */
  private runMigrations(): void {
    this.db!.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    const lastMigration = this.db!.prepare(
      'SELECT MAX(version) as version FROM migrations',
    ).get() as { version: number | null };

    const currentDbVersion = lastMigration?.version ?? 0;

    if (currentDbVersion < 1) {
      this.db!.exec(`
        CREATE TABLE IF NOT EXISTS tasks (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          flow_json TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'idle',
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS task_steps (
          id TEXT PRIMARY KEY,
          task_id TEXT NOT NULL,
          step_index INTEGER NOT NULL,
          name TEXT NOT NULL,
          action_json TEXT NOT NULL,
          retry_count INTEGER DEFAULT 3,
          retry_delay INTEGER DEFAULT 1000,
          FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS stock_data (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          symbol TEXT NOT NULL,
          time INTEGER NOT NULL,
          open REAL NOT NULL,
          high REAL NOT NULL,
          low REAL NOT NULL,
          close REAL NOT NULL,
          volume REAL NOT NULL,
          UNIQUE(symbol, time)
        );

        CREATE TABLE IF NOT EXISTS plugins (
          name TEXT PRIMARY KEY,
          version TEXT NOT NULL,
          display_name TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'installed',
          permission_level INTEGER NOT NULL DEFAULT 1,
          manifest_json TEXT NOT NULL,
          installed_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS configs (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp TEXT NOT NULL,
          level TEXT NOT NULL,
          source TEXT NOT NULL,
          message TEXT NOT NULL,
          data TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_stock_data_symbol ON stock_data(symbol);
        CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp);
        CREATE INDEX IF NOT EXISTS idx_logs_level ON logs(level);

        INSERT INTO migrations (version) VALUES (1);
      `);
    }

    if (currentDbVersion < 2) {
      this.db!.exec(`
        CREATE TABLE IF NOT EXISTS ai_conversations (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS ai_messages (
          id TEXT PRIMARY KEY,
          conversation_id TEXT NOT NULL,
          role TEXT NOT NULL,
          content TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          FOREIGN KEY (conversation_id) REFERENCES ai_conversations(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation
          ON ai_messages(conversation_id, timestamp);

        INSERT INTO migrations (version) VALUES (2);
      `);
    }

    if (currentDbVersion < 3) {
      this.db!.exec(`
        ALTER TABLE tasks ADD COLUMN schedule_json TEXT;
        ALTER TABLE tasks ADD COLUMN session_id TEXT;
        ALTER TABLE tasks ADD COLUMN template_id TEXT;
        ALTER TABLE tasks ADD COLUMN enabled INTEGER NOT NULL DEFAULT 1;
        ALTER TABLE tasks ADD COLUMN tags_json TEXT;
        ALTER TABLE tasks ADD COLUMN last_run_at TEXT;
        ALTER TABLE tasks ADD COLUMN next_run_at TEXT;

        CREATE TABLE IF NOT EXISTS task_batches (
          id TEXT PRIMARY KEY,
          task_id TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          started_at TEXT,
          finished_at TEXT,
          step_results TEXT NOT NULL DEFAULT '[]',
          error TEXT,
          breakpoint_json TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS extraction_templates (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          fields TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS extraction_results (
          id TEXT PRIMARY KEY,
          task_id TEXT NOT NULL,
          batch_id TEXT NOT NULL,
          template_id TEXT,
          data TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'normal',
          source_url TEXT,
          screenshot TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
          FOREIGN KEY (batch_id) REFERENCES task_batches(id) ON DELETE CASCADE,
          FOREIGN KEY (template_id) REFERENCES extraction_templates(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          domain TEXT NOT NULL,
          partition TEXT NOT NULL UNIQUE,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS execution_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          task_id TEXT NOT NULL,
          batch_id TEXT NOT NULL,
          step_index INTEGER,
          level TEXT NOT NULL DEFAULT 'info',
          message TEXT NOT NULL,
          metadata TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_task_batches_task_id ON task_batches(task_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_results_task ON extraction_results(task_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_results_batch ON extraction_results(batch_id);
        CREATE INDEX IF NOT EXISTS idx_sessions_partition ON sessions(partition);
        CREATE INDEX IF NOT EXISTS idx_execution_logs_task_batch ON execution_logs(task_id, batch_id, created_at DESC);

        INSERT INTO migrations (version) VALUES (3);
      `);
    }

    if (currentDbVersion < 4) {
      this.db!.exec(`
        CREATE TABLE IF NOT EXISTS alerts (
          id TEXT PRIMARY KEY,
          task_id TEXT NOT NULL,
          batch_id TEXT,
          message TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          read INTEGER NOT NULL DEFAULT 0,
          FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
          FOREIGN KEY (batch_id) REFERENCES task_batches(id) ON DELETE SET NULL
        );

        CREATE INDEX IF NOT EXISTS idx_alerts_task_created ON alerts(task_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_alerts_unread ON alerts(read, created_at DESC);

        INSERT INTO migrations (version) VALUES (4);
      `);
    }
  }
}
