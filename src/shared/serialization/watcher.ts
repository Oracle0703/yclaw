/**
 * Task-as-Code v1 — 目录文件监听器（TAC-07）
 *
 * 监听一个目录下的 YAML 文件变化，按防抖窗口聚合，输出
 * `added` / `changed` / `removed` 三类事件给上层（task center / IPC）。
 *
 * 设计取舍：
 * - 使用 DI（注入 `watch` / `now` / `setTimeout`）便于测试，无需真正的 fs.watch。
 * - 内部维护「文件签名」（mtimeMs + size）快照来判定 added/changed/removed，
 *   即便 underlying watcher 给出的事件粒度粗糙也能正确分类。
 * - 仅负责「告知谁变了」，不负责重新解析；调用方按需调用 loader。
 */

import { promises as fsp, watch as nativeWatch, type FSWatcher } from 'node:fs';
import { extname, join, resolve as pathResolve } from 'node:path';

const SUPPORTED_EXT: ReadonlySet<string> = new Set(['.yaml', '.yml']);

export interface FileSignature {
  /** 修改时间（毫秒） */
  mtimeMs: number;
  /** 文件大小（字节） */
  size: number;
}

export type WatchChangeKind = 'added' | 'changed' | 'removed';

export interface WatchChange {
  kind: WatchChangeKind;
  /** 相对 rootDir 的路径，使用 POSIX 分隔符 */
  relativePath: string;
  /** 绝对路径 */
  absolutePath: string;
}

export interface WatchEvent {
  /** 触发时刻（来自 now()） */
  at: number;
  changes: WatchChange[];
}

export interface WatcherDeps {
  /** 注入式底层监听器，默认使用 node:fs.watch（recursive: true） */
  watch?: (rootDir: string, onTick: () => void) => { close: () => void };
  /** 当前时间戳（毫秒），用于事件标记与测试控制 */
  now?: () => number;
  /** 计时器，便于测试中使用 fake timers */
  setTimeout?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clearTimeout?: (handle: ReturnType<typeof setTimeout>) => void;
  /** 列出目录下所有 YAML 的相对路径（POSIX 分隔符）；默认实现递归扫描 */
  listFiles?: (rootDir: string) => Promise<string[]>;
  /** 读取文件 stat（mtimeMs + size），文件不存在返回 null */
  statFile?: (absPath: string) => Promise<FileSignature | null>;
}

export interface WatcherOptions extends WatcherDeps {
  /** 防抖窗口（毫秒），默认 1000ms */
  debounceMs?: number;
  /** 单目录最大文件数，超过则拒绝启动（与 LOADER_SAFETY 对齐） */
  maxFiles?: number;
  /** 递归最大深度 */
  maxDepth?: number;
}

export const WATCHER_DEFAULTS = {
  debounceMs: 1000,
  maxFiles: 5000,
  maxDepth: 32,
} as const;

export interface Watcher {
  /** 启动监听；返回首次扫描完成的快照大小 */
  start(): Promise<{ initialFileCount: number }>;
  /** 停止监听 */
  stop(): Promise<void>;
  /** 订阅聚合事件 */
  onChange(listener: (event: WatchEvent) => void): () => void;
  /** 强制立即触发一次扫描（测试或 UI 手动刷新用） */
  flush(): Promise<void>;
}

export function createWatcher(rootDir: string, options: WatcherOptions = {}): Watcher {
  const root = pathResolve(rootDir);
  const debounceMs = options.debounceMs ?? WATCHER_DEFAULTS.debounceMs;
  const maxFiles = options.maxFiles ?? WATCHER_DEFAULTS.maxFiles;
  const maxDepth = options.maxDepth ?? WATCHER_DEFAULTS.maxDepth;
  const now = options.now ?? Date.now;
  const setT = options.setTimeout ?? ((fn, ms) => setTimeout(fn, ms));
  const clearT = options.clearTimeout ?? ((h) => clearTimeout(h));
  const listFiles = options.listFiles ?? ((dir) => defaultListFiles(dir, maxDepth, maxFiles));
  const statFile = options.statFile ?? defaultStatFile;
  const watchImpl = options.watch ?? defaultNativeWatch;

  const snapshot = new Map<string, FileSignature>();
  const listeners = new Set<(event: WatchEvent) => void>();
  let underlying: { close: () => void } | null = null;
  let pending: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;
  let scanInFlight: Promise<void> | null = null;

  async function rescan(): Promise<void> {
    if (stopped) return;
    const next = await collectSnapshot();
    const changes = diffSnapshots(root, snapshot, next);
    replaceSnapshot(snapshot, next);
    if (changes.length > 0) emit({ at: now(), changes });
  }

  async function collectSnapshot(): Promise<Map<string, FileSignature>> {
    const rels = await listFiles(root);
    enforceMaxFiles(rels.length);
    const next = new Map<string, FileSignature>();
    for (const rel of rels) {
      const sig = await statFile(join(root, rel));
      if (sig) next.set(rel, sig);
    }
    return next;
  }

  function enforceMaxFiles(count: number): void {
    if (count > maxFiles) {
      throw new Error(`watcher: directory exceeds maxFiles (${count} > ${maxFiles})`);
    }
  }

  function emit(event: WatchEvent): void {
    for (const l of listeners) {
      try { l(event); } catch { /* listener errors must not break watcher */ }
    }
  }

  function scheduleRescan(): void {
    if (stopped) return;
    if (pending) clearT(pending);
    pending = setT(() => {
      pending = null;
      scanInFlight = rescan().catch(() => undefined);
    }, debounceMs);
  }

  return {
    async start() {
      if (underlying) throw new Error('watcher: already started');
      // initial scan establishes baseline; do not emit events
      const baseline = await collectSnapshot();
      replaceSnapshot(snapshot, baseline);
      underlying = watchImpl(root, scheduleRescan);
      return { initialFileCount: snapshot.size };
    },
    async stop() {
      stopped = true;
      if (pending) { clearT(pending); pending = null; }
      if (underlying) { try { underlying.close(); } catch { /* noop */ } underlying = null; }
      if (scanInFlight) await scanInFlight.catch(() => undefined);
      listeners.clear();
      snapshot.clear();
    },
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async flush() {
      if (pending) { clearT(pending); pending = null; }
      await rescan();
    },
  };
}

// ──────────────────────────── pure helpers ────────────────────────────

function diffSnapshots(
  rootDir: string,
  prev: ReadonlyMap<string, FileSignature>,
  next: ReadonlyMap<string, FileSignature>,
): WatchChange[] {
  const changes: WatchChange[] = [];
  for (const [rel, sig] of next) {
    const before = prev.get(rel);
    const abs = join(rootDir, rel);
    if (!before) {
      changes.push({ kind: 'added', relativePath: rel, absolutePath: abs });
    } else if (before.mtimeMs !== sig.mtimeMs || before.size !== sig.size) {
      changes.push({ kind: 'changed', relativePath: rel, absolutePath: abs });
    }
  }
  for (const rel of prev.keys()) {
    if (!next.has(rel)) {
      changes.push({ kind: 'removed', relativePath: rel, absolutePath: join(rootDir, rel) });
    }
  }
  return changes;
}

function replaceSnapshot(
  target: Map<string, FileSignature>,
  source: ReadonlyMap<string, FileSignature>,
): void {
  target.clear();
  for (const [k, v] of source) target.set(k, v);
}

// ──────────────────────────── defaults ────────────────────────────

function defaultNativeWatch(rootDir: string, onTick: () => void): { close: () => void } {
  let watcher: FSWatcher | null = null;
  try {
    watcher = nativeWatch(rootDir, { recursive: true }, () => onTick());
  } catch {
    // recursive option may not be supported on all platforms; fall back to non-recursive
    watcher = nativeWatch(rootDir, () => onTick());
  }
  return {
    close: () => { try { watcher?.close(); } catch { /* noop */ } },
  };
}

async function defaultStatFile(absPath: string): Promise<FileSignature | null> {
  try {
    const st = await fsp.lstat(absPath);
    if (!st.isFile()) return null;
    return { mtimeMs: st.mtimeMs, size: st.size };
  } catch {
    return null;
  }
}

async function defaultListFiles(
  rootDir: string,
  maxDepth: number,
  maxFiles: number,
): Promise<string[]> {
  const out: string[] = [];
  await walk(rootDir, '', 0);
  return out.sort();

  async function walk(dir: string, rel: string, depth: number): Promise<void> {
    if (depth > maxDepth || out.length > maxFiles) return;
    let entries: import('node:fs').Dirent[] = [];
    try {
      entries = (await fsp.readdir(dir, { withFileTypes: true })) as import('node:fs').Dirent[];
    } catch {
      return;
    }
    for (const entry of entries) {
      const name = String(entry.name);
      if (name.startsWith('.') || name === 'node_modules') continue;
      const childRel = rel ? `${rel}/${name}` : name;
      const childAbs = join(dir, name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        await walk(childAbs, childRel, depth + 1);
      } else if (entry.isFile() && SUPPORTED_EXT.has(extname(name).toLowerCase())) {
        out.push(childRel);
        if (out.length > maxFiles) return;
      }
    }
  }
}
