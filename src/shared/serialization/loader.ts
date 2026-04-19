/**
 * Task-as-Code v1 — 目录加载与跨文件引用解析（TAC-05）
 *
 * 提供两层 API：
 * - `loadFile(path)`：单文件加载 + lint，返回 `AnyFile` 或抛错。
 * - `loadDirectory(rootDir, options?)`：递归扫描目录，构建 id → 文件的注册表。
 * - `resolveReferences(registry)`：检查 `spec.templateRef` 这类跨文件引用是否能解析。
 *
 * 设计取舍：
 * - 解析「引用」不做内联展开（避免修改用户文件结构），只做存在性检查并暴露 lookup。
 * - 注入式 `loader`/`reader`/`walker` 便于在测试中模拟文件系统。
 * - 与运行时无关；后续 importer 在此基础上再做 DB upsert。
 */

import { promises as fs } from 'node:fs';
import { extname, join, relative, resolve as pathResolve } from 'node:path';
import { parseFile } from './yaml';
import type { AnyFile, TaskFile, TemplateFile } from './types';
import type { ValidationIssue, ValidationResult } from './validate';
import { ValidationError } from './validate';

/** 默认安全上限（与 CLI `SAFETY` 思路一致）。 */
export const LOADER_SAFETY = {
  /** 单文件最大字节数 */
  maxFileSize: 1024 * 1024,
  /** 目录递归最大深度 */
  maxDirDepth: 32,
  /** 单次加载最多文件数 */
  maxFiles: 5000,
} as const;

const SUPPORTED_EXT: ReadonlySet<string> = new Set(['.yaml', '.yml']);

export interface LoadedEntry<T extends AnyFile = AnyFile> {
  /** 解析后的文件对象 */
  file: T;
  /** 绝对路径 */
  absolutePath: string;
  /** 相对 rootDir 的展示路径（无 rootDir 时退化为 absolutePath） */
  displayPath: string;
}

export interface Registry {
  tasks: Map<string, LoadedEntry<TaskFile>>;
  templates: Map<string, LoadedEntry<TemplateFile>>;
  /** 加载过程产生的 issue（解析错误、重复 id 等），不抛错 */
  issues: ValidationIssue[];
}

export interface LoadOptions {
  /** 文件系统读取器；测试时可注入内存实现 */
  readFile?: (absPath: string) => Promise<string>;
  /** 目录扫描器；返回相对 root 的文件列表 */
  listFiles?: (rootDir: string) => Promise<string[]>;
  /** 安全上限覆盖 */
  safety?: Partial<typeof LOADER_SAFETY>;
}

// ──────────────────────────── 单文件 ────────────────────────────

/**
 * 读取并校验单个 YAML 文件。
 * 校验失败抛 Error；上层若需 lint 行为请直接用 `lintFile`。
 */
export async function loadFile(absPath: string, options: LoadOptions = {}): Promise<AnyFile> {
  const safety = { ...LOADER_SAFETY, ...(options.safety ?? {}) };
  const stat = await fs.lstat(absPath);
  if (stat.isSymbolicLink()) {
    throw new Error(`refusing to follow symlink: ${absPath}`);
  }
  if (!stat.isFile()) {
    throw new Error(`not a regular file: ${absPath}`);
  }
  if (stat.size > safety.maxFileSize) {
    throw new Error(`file size ${stat.size} exceeds limit ${safety.maxFileSize}: ${absPath}`);
  }
  const text = options.readFile ? await options.readFile(absPath) : await fs.readFile(absPath, 'utf8');
  try {
    return parseFile(text, { filePath: absPath });
  } catch (error) {
    if (error instanceof ValidationError) {
      const summary = error.issues
        .filter((i) => i.severity === 'error')
        .map((i) => `${i.path}: ${i.message}`)
        .join('; ');
      throw new Error(`Failed to load ${absPath}: ${summary}`);
    }
    throw error;
  }
}

// ──────────────────────────── 目录加载 ────────────────────────────

/**
 * 递归加载目录下的全部 YAML，构建 id 注册表。
 * - 不抛错：解析/校验/重复 id 都进 `issues`。
 * - 已自动跳过 dot 目录、`node_modules` 与 symlink。
 */
export async function loadDirectory(rootDir: string, options: LoadOptions = {}): Promise<Registry> {
  const safety = { ...LOADER_SAFETY, ...(options.safety ?? {}) };
  const issues: ValidationIssue[] = [];
  const tasks = new Map<string, LoadedEntry<TaskFile>>();
  const templates = new Map<string, LoadedEntry<TemplateFile>>();

  const absRoot = pathResolve(rootDir);

  // 入口 lstat：拒绝跟随 symlink 作为根目录
  if (!options.listFiles) {
    let rootStat;
    try {
      rootStat = await fs.lstat(absRoot);
    } catch (error) {
      issues.push({
        path: absRoot,
        message: `cannot stat root: ${error instanceof Error ? error.message : String(error)}`,
        severity: 'error',
      });
      return { tasks, templates, issues };
    }
    if (rootStat.isSymbolicLink()) {
      issues.push({ path: absRoot, message: 'refusing to follow symlink root', severity: 'error' });
      return { tasks, templates, issues };
    }
    if (!rootStat.isDirectory()) {
      issues.push({ path: absRoot, message: 'root is not a directory', severity: 'error' });
      return { tasks, templates, issues };
    }
  }

  let files: string[];
  try {
    files = options.listFiles
      ? normalizeInjectedPaths(await options.listFiles(absRoot), absRoot, issues)
      : await defaultListFiles(absRoot, safety);
  } catch (error) {
    issues.push({
      path: absRoot,
      message: error instanceof Error ? error.message : String(error),
      severity: 'error',
    });
    return { tasks, templates, issues };
  }

  if (files.length > safety.maxFiles) {
    issues.push({
      path: relative(absRoot, absRoot) || absRoot,
      message: `too many files (${files.length} > ${safety.maxFiles})`,
      severity: 'error',
    });
    return { tasks, templates, issues };
  }

  for (const absPath of files) {
    const display = relative(absRoot, absPath) || absPath;
    let file: AnyFile;
    try {
      file = await loadFile(absPath, options);
    } catch (error) {
      issues.push({
        path: display,
        message: error instanceof Error ? error.message : String(error),
        severity: 'error',
      });
      continue;
    }

    const id = file.metadata.id;
    if (file.kind === 'Task') {
      insertEntry(tasks, id, { file, absolutePath: absPath, displayPath: display }, 'Task', issues);
    } else {
      insertEntry(templates, id, { file, absolutePath: absPath, displayPath: display }, 'Template', issues);
    }
  }

  return { tasks, templates, issues };
}

function insertEntry<T extends AnyFile>(
  bucket: Map<string, LoadedEntry<T>>,
  id: string,
  entry: LoadedEntry<T>,
  kind: 'Task' | 'Template',
  issues: ValidationIssue[],
): void {
  const existing = bucket.get(id);
  if (existing) {
    issues.push({
      path: entry.displayPath,
      message: `duplicate ${kind} id "${id}" (also at ${existing.displayPath})`,
      severity: 'error',
    });
    return;
  }
  bucket.set(id, entry);
}

// ──────────────────────────── 引用解析 ────────────────────────────

/**
 * 检查注册表中所有跨文件引用是否能解析。
 * 当前只覆盖：`Task.spec.templateRef` → `Template.metadata.id`。
 * 不修改 registry，仅返回 issue 列表。
 */
export function resolveReferences(registry: Registry): ValidationResult {
  const issues: ValidationIssue[] = [];
  for (const entry of registry.tasks.values()) {
    const ref = entry.file.spec.templateRef;
    if (ref === undefined) continue;
    if (!registry.templates.has(ref)) {
      issues.push({
        path: `${entry.displayPath} $.spec.templateRef`,
        message: `unresolved templateRef "${ref}" — no Template with that id was loaded`,
        severity: 'error',
      });
    }
  }
  return { ok: issues.length === 0, issues };
}

// ──────────────────────────── 私有 ────────────────────────────

async function defaultListFiles(
  absRoot: string,
  safety: typeof LOADER_SAFETY,
): Promise<string[]> {
  const out: string[] = [];
  await walk(absRoot, out, 0, safety);
  out.sort();
  return out;
}

function normalizeInjectedPaths(
  raw: string[],
  absRoot: string,
  issues: ValidationIssue[],
): string[] {
  const out: string[] = [];
  const rootWithSep = absRoot.endsWith('/') ? absRoot : `${absRoot}/`;
  for (const p of raw) {
    const abs = pathResolve(absRoot, p);
    if (abs !== absRoot && !abs.startsWith(rootWithSep)) {
      issues.push({
        path: p,
        message: `path escapes rootDir: ${abs}`,
        severity: 'error',
      });
      continue;
    }
    out.push(abs);
  }
  return out;
}

async function walk(
  dir: string,
  out: string[],
  depth: number,
  safety: typeof LOADER_SAFETY,
): Promise<void> {
  if (depth > safety.maxDirDepth) {
    throw new Error(`directory depth exceeds ${safety.maxDirDepth}: ${dir}`);
  }
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (out.length > safety.maxFiles) return; // 提前退出，避免扫描浪费
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    if (entry.isSymbolicLink()) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(full, out, depth + 1, safety);
    } else if (entry.isFile() && SUPPORTED_EXT.has(extname(entry.name).toLowerCase())) {
      out.push(full);
    }
  }
}
