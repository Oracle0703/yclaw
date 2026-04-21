import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { getDatabasePath } from '../utils/paths';

interface DatabaseServiceOptions {
  dbName?: string;
  database?: Database.Database;
}

/**
 * SQLite 数据库服务
 * - WAL 模式
 * - 基础迁移机制
 */
export class DatabaseService {
  private static instance: DatabaseService;
  private db: Database.Database | null = null;
  private migrationsApplied = false;
  private dbDir: string;
  private dbPath: string;

  constructor(options: string | DatabaseServiceOptions = 'yclaw.sqlite') {
    const normalized = typeof options === 'string' ? { dbName: options } : options;
    this.dbDir = getDatabasePath();
    this.dbPath = path.join(this.dbDir, normalized.dbName ?? 'yclaw.sqlite');
    this.db = normalized.database ?? null;
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
    if (!this.db) {
      fs.mkdirSync(this.dbDir, { recursive: true });
      this.db = new Database(this.dbPath);
    }

    if (this.migrationsApplied) {
      return;
    }

    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.runMigrations();
    this.migrationsApplied = true;
  }

  migrate(): void {
    this.open();
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
      this.migrationsApplied = false;
    }
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
        BEGIN TRANSACTION;

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

        COMMIT;
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

    if (currentDbVersion < 5) {
      this.db!.exec(`
        CREATE TABLE IF NOT EXISTS remote_runner_connections (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          base_url TEXT NOT NULL,
          auth_type TEXT NOT NULL DEFAULT 'token',
          token_ref TEXT NOT NULL,
          workspace_id TEXT NOT NULL,
          tls_mode TEXT NOT NULL DEFAULT 'strict',
          proxy_url TEXT,
          status TEXT NOT NULL DEFAULT 'unknown',
          last_seen_at TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_remote_runner_connections_updated
          ON remote_runner_connections(updated_at DESC);
        CREATE INDEX IF NOT EXISTS idx_remote_runner_connections_status
          ON remote_runner_connections(status, updated_at DESC);

        INSERT INTO migrations (version) VALUES (5);
      `);
    }

    if (currentDbVersion < 6) {
      this.db!.exec(`
        CREATE TABLE IF NOT EXISTS runner_nodes (
          id TEXT PRIMARY KEY,
          kind TEXT NOT NULL,
          name TEXT NOT NULL,
          workspace_id TEXT NOT NULL,
          status TEXT NOT NULL,
          capabilities_json TEXT NOT NULL,
          max_concurrency INTEGER NOT NULL,
          running_count INTEGER NOT NULL,
          cpu_usage REAL NOT NULL,
          memory_usage REAL NOT NULL,
          heartbeat_latency_ms INTEGER NOT NULL,
          recent_failure_rate REAL NOT NULL,
          last_heartbeat_at TEXT,
          last_seen_at TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS runner_queue_items (
          id TEXT PRIMARY KEY,
          task_id TEXT NOT NULL,
          task_type TEXT NOT NULL,
          idempotency TEXT NOT NULL,
          workspace_id TEXT NOT NULL,
          status TEXT NOT NULL,
          priority INTEGER NOT NULL,
          reassign_attempts INTEGER NOT NULL,
          last_error TEXT,
          remote_dispatch_json TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS execution_leases (
          id TEXT PRIMARY KEY,
          execution_id TEXT NOT NULL,
          queue_item_id TEXT NOT NULL,
          runner_id TEXT NOT NULL,
          task_id TEXT NOT NULL,
          lease_token TEXT NOT NULL,
          status TEXT NOT NULL,
          expires_at TEXT NOT NULL,
          last_renewed_at TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS runner_health_samples (
          id TEXT PRIMARY KEY,
          runner_id TEXT NOT NULL,
          cpu_usage REAL NOT NULL,
          memory_usage REAL NOT NULL,
          running_count INTEGER NOT NULL,
          max_concurrency INTEGER NOT NULL,
          heartbeat_latency_ms INTEGER NOT NULL,
          recent_failure_rate REAL NOT NULL,
          sampled_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS runner_dispatch_events (
          id TEXT PRIMARY KEY,
          event_type TEXT NOT NULL,
          runner_id TEXT,
          queue_item_id TEXT,
          execution_id TEXT,
          message TEXT NOT NULL,
          metadata_json TEXT NOT NULL,
          created_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_runner_nodes_workspace_status
          ON runner_nodes(workspace_id, status);
        CREATE INDEX IF NOT EXISTS idx_runner_queue_items_type_status
          ON runner_queue_items(task_type, status, created_at);
        CREATE INDEX IF NOT EXISTS idx_execution_leases_status_expires
          ON execution_leases(status, expires_at);
        CREATE INDEX IF NOT EXISTS idx_runner_dispatch_events_created
          ON runner_dispatch_events(created_at);

        INSERT INTO migrations (version) VALUES (6);
      `);
    }

    if (currentDbVersion < 7) {
      if (!this.hasColumn('runner_queue_items', 'remote_dispatch_json')) {
        this.db!.exec(`
          ALTER TABLE runner_queue_items
          ADD COLUMN remote_dispatch_json TEXT
        `);
      }

      this.db!.exec(`
        INSERT INTO migrations (version) VALUES (7);
      `);
    }

    if (currentDbVersion < 8) {
      this.db!.exec(`
        CREATE TABLE IF NOT EXISTS workspaces (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          default_runner_policy TEXT,
          notification_policy TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS workspace_members (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL,
          name TEXT NOT NULL,
          role TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'active',
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace
          ON workspace_members(workspace_id, role);

        INSERT INTO migrations (version) VALUES (8);
      `);
    }

    if (currentDbVersion < 9) {
      if (!this.hasColumn('tasks', 'current_revision_id')) {
        this.db!.exec(`
          ALTER TABLE tasks
          ADD COLUMN current_revision_id TEXT
        `);
      }

      this.db!.exec(`
        CREATE TABLE IF NOT EXISTS task_revisions (
          id TEXT PRIMARY KEY,
          task_id TEXT NOT NULL,
          version TEXT NOT NULL,
          snapshot TEXT NOT NULL,
          change_summary TEXT,
          review_status TEXT NOT NULL DEFAULT 'pending',
          reviewer TEXT,
          created_by TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_task_revisions_task_created
          ON task_revisions(task_id, created_at DESC);

        INSERT INTO migrations (version) VALUES (9);
      `);
    }

    if (currentDbVersion < 10) {
      if (!this.hasColumn('alerts', 'status')) {
        this.db!.exec(`
          ALTER TABLE alerts
          ADD COLUMN status TEXT NOT NULL DEFAULT 'new'
        `);
      }
      if (!this.hasColumn('alerts', 'assignee')) {
        this.db!.exec(`
          ALTER TABLE alerts
          ADD COLUMN assignee TEXT
        `);
      }
      if (!this.hasColumn('alerts', 'level')) {
        this.db!.exec(`
          ALTER TABLE alerts
          ADD COLUMN level TEXT NOT NULL DEFAULT 'warning'
        `);
      }
      if (!this.hasColumn('alerts', 'resolution')) {
        this.db!.exec(`
          ALTER TABLE alerts
          ADD COLUMN resolution TEXT
        `);
      }
      if (!this.hasColumn('alerts', 'updated_at')) {
        this.db!.exec(`
          ALTER TABLE alerts
          ADD COLUMN updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        `);
      }

      this.db!.exec(`
        CREATE TABLE IF NOT EXISTS alert_actions (
          id TEXT PRIMARY KEY,
          alert_id TEXT NOT NULL,
          action TEXT NOT NULL,
          operator TEXT,
          note TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (alert_id) REFERENCES alerts(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS task_reviews (
          id TEXT PRIMARY KEY,
          task_id TEXT NOT NULL,
          batch_id TEXT,
          review_type TEXT NOT NULL,
          reason_category TEXT,
          conclusion TEXT,
          owner TEXT,
          follow_up_actions TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_task_reviews_task_created
          ON task_reviews(task_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_alert_actions_alert_created
          ON alert_actions(alert_id, created_at DESC);
      `);

      if (!this.hasColumn('extraction_results', 'quality_status')) {
        this.db!.exec(`
          ALTER TABLE extraction_results
          ADD COLUMN quality_status TEXT
        `);
      }
      if (!this.hasColumn('extraction_results', 'evidence_refs')) {
        this.db!.exec(`
          ALTER TABLE extraction_results
          ADD COLUMN evidence_refs TEXT
        `);
      }
      if (!this.hasColumn('extraction_results', 'revision_id')) {
        this.db!.exec(`
          ALTER TABLE extraction_results
          ADD COLUMN revision_id TEXT
        `);
      }

      this.db!.exec(`
        INSERT INTO migrations (version) VALUES (10);
      `);
    }

    if (currentDbVersion < 11) {
      this.db!.exec(`
        CREATE TABLE IF NOT EXISTS template_review_links (
          review_id TEXT NOT NULL,
          template_id TEXT NOT NULL,
          linked_at TEXT NOT NULL DEFAULT (datetime('now')),
          PRIMARY KEY (review_id, template_id)
        );

        CREATE INDEX IF NOT EXISTS idx_template_review_links_review
          ON template_review_links(review_id, linked_at DESC);
        CREATE INDEX IF NOT EXISTS idx_template_review_links_template
          ON template_review_links(template_id, linked_at DESC);

        INSERT INTO migrations (version) VALUES (11);
      `);
    }

    if (currentDbVersion < 12) {
      if (!this.hasColumn('alerts', 'workspace_id')) {
        this.db!.exec(`
          ALTER TABLE alerts
          ADD COLUMN workspace_id TEXT
        `);
      }

      this.db!.exec(`
        CREATE INDEX IF NOT EXISTS idx_alerts_workspace_created
          ON alerts(workspace_id, created_at DESC);

        INSERT INTO migrations (version) VALUES (12);
      `);
    }

    if (currentDbVersion < 13) {
      this.db!.exec(`
        CREATE TABLE IF NOT EXISTS workspace_duty_shifts (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL,
          member_id TEXT NOT NULL,
          starts_at TEXT NOT NULL,
          ends_at TEXT NOT NULL,
          notes TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
          FOREIGN KEY (member_id) REFERENCES workspace_members(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_workspace_duty_shifts_workspace_time
          ON workspace_duty_shifts(workspace_id, starts_at, ends_at);

        INSERT INTO migrations (version) VALUES (13);
      `);
    }

    if (currentDbVersion < 14) {
      if (!this.hasColumn('extraction_templates', 'version')) {
        this.db!.exec(`
          ALTER TABLE extraction_templates
          ADD COLUMN version TEXT NOT NULL DEFAULT 'v1'
        `);
      }
      if (!this.hasColumn('extraction_templates', 'description')) {
        this.db!.exec(`
          ALTER TABLE extraction_templates
          ADD COLUMN description TEXT
        `);
      }
      if (!this.hasColumn('extraction_templates', 'deprecated')) {
        this.db!.exec(`
          ALTER TABLE extraction_templates
          ADD COLUMN deprecated INTEGER NOT NULL DEFAULT 0
        `);
      }
      if (!this.hasColumn('extraction_templates', 'plugin_dependencies')) {
        this.db!.exec(`
          ALTER TABLE extraction_templates
          ADD COLUMN plugin_dependencies TEXT NOT NULL DEFAULT '[]'
        `);
      }

      this.db!.exec(`
        INSERT INTO migrations (version) VALUES (14);
      `);
    }
  }

  private hasColumn(tableName: string, columnName: string): boolean {
    const columns = this.db!.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{
      name: string;
    }>;
    return columns.some((column) => column.name === columnName);
  }
}
