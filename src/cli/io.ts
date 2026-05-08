/**
 * yclaw CLI — `import` / `export` 子命令
 *
 * 设计：
 * - `import`：YAML → 校验/可选迁移 → mapping 为运行时形式 → 输出 JSON
 *   （单文件或目录递归；目录模式输出 `{tasks:[], templates:[]}` 聚合）
 * - `export`：JSON → mapping 为文件形式 → 序列化为 YAML
 *   （输入需要明确 `kind: 'Task' | 'Template'` 字段以便分流）
 *
 * 不直接依赖 IPC/DB；后续 Electron 主进程可以 wrap 这两个函数对接 TaskService。
 */

import { promises as fs } from 'node:fs';
import { join, relative, resolve, dirname } from 'node:path';
import {
  lintFile,
  loadDirectory,
  parseFile,
  parseFileMigrating,
  resolveReferences,
  serializeFile,
  taskFromFile,
  taskToFile,
  templateFromFile,
  templateToFile,
  type AnyFile,
  type ValidationIssue,
} from '@shared/serialization';
import { collectYamlFiles } from './fs-walk';

/** 同 lint：单文件大小上限。超出按错误处理。 */
export const IO_SAFETY = {
  maxFileSize: 1024 * 1024,
} as const;

export interface IoIO {
  stdout?: { write: (chunk: string) => unknown };
  stderr?: { write: (chunk: string) => unknown };
  cwd?: string;
}

export interface ImportOptions extends IoIO {
  inputs: string[];
  /** 输出目录；若给出则按 `<id>.task.json` / `<id>.template.json` 写入；否则打印到 stdout（聚合 JSON）。 */
  outDir?: string;
  /** 自动升级旧 schemaVersion。 */
  migrate?: boolean;
  /** 同 `--check-refs`：单一目录输入时检查 templateRef 可解析。 */
  checkRefs?: boolean;
  /** 注入：写文件函数（便于测试）。 */
  writeFile?: (path: string, data: string) => Promise<void>;
  /** 注入：稳定时间戳（便于快照测试）。默认 `new Date().toISOString()`。 */
  now?: () => string;
}

export interface ImportRunResult {
  taskCount: number;
  templateCount: number;
  issues: ValidationIssue[];
  exitCode: 0 | 1 | 2;
}

export interface ExportOptions extends IoIO {
  inputs: string[];
  /** 输出目录；若给出按 `<id>.yaml` 写入；否则打印 YAML 到 stdout（多个则用 `---` 分隔）。 */
  outDir?: string;
  writeFile?: (path: string, data: string) => Promise<void>;
}

export interface ExportRunResult {
  count: number;
  issues: ValidationIssue[];
  exitCode: 0 | 1 | 2;
}

// ────────────────────────── import ──────────────────────────

export async function runImport(options: ImportOptions): Promise<ImportRunResult> {
  const stdout = options.stdout ?? process.stdout;
  const stderr = options.stderr ?? process.stderr;
  const cwd = options.cwd ?? process.cwd();
  const writeFile = options.writeFile ?? defaultWriteFile;
  const now = options.now ?? (() => new Date().toISOString());

  if (options.inputs.length === 0) {
    stderr.write('yclaw import: no input paths provided\n');
    return { taskCount: 0, templateCount: 0, issues: [], exitCode: 2 };
  }

  let yamlFiles: string[];
  try {
    yamlFiles = await collectYamlFiles(options.inputs);
  } catch (err) {
    stderr.write(`yclaw import: ${errMsg(err)}\n`);
    return { taskCount: 0, templateCount: 0, issues: [], exitCode: 2 };
  }
  if (yamlFiles.length === 0) {
    stderr.write('yclaw import: no .yaml/.yml files found\n');
    return { taskCount: 0, templateCount: 0, issues: [], exitCode: 2 };
  }

  const issues: ValidationIssue[] = [];
  const tasks: Array<ReturnType<typeof taskFromFile>> = [];
  const templates: Array<ReturnType<typeof templateFromFile>> = [];

  for (const filePath of yamlFiles) {
    const display = relative(cwd, filePath) || filePath;
    const read = await readFileWithLimit(filePath, display);
    if ('error' in read) {
      issues.push(read.error);
      continue;
    }
    const text = read.text;
    let file: AnyFile;
    try {
      file = options.migrate
        ? parseFileMigrating(text, { filePath: display }).file
        : parseFile(text, { filePath: display });
    } catch (err) {
      // 走 lintFile 提取详细 issue 列表
      const lintRes = lintFile(text, { filePath: display, migrate: options.migrate });
      if (!lintRes.ok) issues.push(...lintRes.issues);
      else issues.push({ path: display, message: errMsg(err), severity: 'error' });
      continue;
    }
    if (file.kind === 'Task') {
      tasks.push(taskFromFile(file, { now: now() }));
    } else {
      templates.push(templateFromFile(file, { now: now() }));
    }
  }

  // 可选 cross-file 引用检查
  if (options.checkRefs && options.inputs.length === 1) {
    try {
      const stat = await fs.stat(options.inputs[0]!);
      if (stat.isDirectory()) {
        const reg = await loadDirectory(resolve(options.inputs[0]!));
        issues.push(...reg.issues, ...resolveReferences(reg).issues);
      }
    } catch (err) {
      issues.push({ path: options.inputs[0]!, message: `ref check failed: ${errMsg(err)}`, severity: 'error' });
    }
  }

  const errorCount = issues.filter((i) => i.severity === 'error').length;
  if (errorCount > 0) {
    printIssues(stderr, issues);
    return { taskCount: tasks.length, templateCount: templates.length, issues, exitCode: 1 };
  }

  if (options.outDir) {
    const outAbs = resolve(cwd, options.outDir);
    await fs.mkdir(outAbs, { recursive: true });
    const taken = new Set<string>();
    const collisions: string[] = [];
    for (const t of tasks) {
      const name = `${safeFileId(t.id)}.task.json`;
      if (taken.has(name)) collisions.push(name);
      else taken.add(name);
      await writeFile(join(outAbs, name), JSON.stringify(t, null, 2) + '\n');
    }
    for (const tpl of templates) {
      const name = `${safeFileId(tpl.id)}.template.json`;
      if (taken.has(name)) collisions.push(name);
      else taken.add(name);
      await writeFile(join(outAbs, name), JSON.stringify(tpl, null, 2) + '\n');
    }
    if (collisions.length > 0) {
      stderr.write(`yclaw import: output filename collision(s): ${collisions.join(', ')}\n`);
      return { taskCount: tasks.length, templateCount: templates.length, issues, exitCode: 1 };
    }
    stdout.write(`imported ${tasks.length} task(s), ${templates.length} template(s) → ${relative(cwd, outAbs) || outAbs}\n`);
  } else {
    stdout.write(JSON.stringify({ tasks, templates }, null, 2) + '\n');
  }

  return { taskCount: tasks.length, templateCount: templates.length, issues, exitCode: 0 };
}

// ────────────────────────── export ──────────────────────────

interface ExportInputRecord {
  kind?: unknown;
  id?: unknown;
}

export async function runExport(options: ExportOptions): Promise<ExportRunResult> {
  const stdout = options.stdout ?? process.stdout;
  const stderr = options.stderr ?? process.stderr;
  const cwd = options.cwd ?? process.cwd();
  const writeFile = options.writeFile ?? defaultWriteFile;

  if (options.inputs.length === 0) {
    stderr.write('yclaw export: no input paths provided\n');
    return { count: 0, issues: [], exitCode: 2 };
  }

  const issues: ValidationIssue[] = [];
  const yamls: Array<{ id: string; kind: 'Task' | 'Template'; text: string }> = [];

  for (const inputPath of options.inputs) {
    const display = relative(cwd, inputPath) || inputPath;
    const read = await readFileWithLimit(inputPath, display);
    if ('error' in read) {
      issues.push(read.error);
      continue;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(read.text);
    } catch (err) {
      issues.push({ path: display, message: `JSON parse error: ${errMsg(err)}`, severity: 'error' });
      continue;
    }
    const records = unwrapExportPayload(parsed);
    if (records.length === 0) {
      issues.push({ path: display, message: 'no Task/Template records found in JSON', severity: 'error' });
      continue;
    }
    for (const rec of records) {
      try {
        const out = recordToYaml(rec);
        yamls.push({ id: out.id, kind: out.kind, text: out.text });
      } catch (err) {
        issues.push({ path: display, message: errMsg(err), severity: 'error' });
      }
    }
  }

  const errorCount = issues.filter((i) => i.severity === 'error').length;
  if (errorCount > 0) {
    printIssues(stderr, issues);
    return { count: yamls.length, issues, exitCode: 1 };
  }

  if (options.outDir) {
    const outAbs = resolve(cwd, options.outDir);
    await fs.mkdir(outAbs, { recursive: true });
    const taken = new Set<string>();
    const collisions: string[] = [];
    for (const y of yamls) {
      const ext = y.kind === 'Template' ? '.template.yaml' : '.yaml';
      const name = `${safeFileId(y.id)}${ext}`;
      if (taken.has(name)) collisions.push(name);
      else taken.add(name);
      await writeFile(join(outAbs, name), y.text);
    }
    if (collisions.length > 0) {
      stderr.write(`yclaw export: output filename collision(s): ${collisions.join(', ')}\n`);
      return { count: yamls.length, issues, exitCode: 1 };
    }
    stdout.write(`exported ${yamls.length} file(s) → ${relative(cwd, outAbs) || outAbs}\n`);
  } else {
    stdout.write(yamls.map((y) => y.text).join('---\n'));
  }

  return { count: yamls.length, issues, exitCode: 0 };
}

// ────────────────────────── helpers ──────────────────────────

function unwrapExportPayload(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) {
    return raw.filter(isPlainRecord);
  }
  if (!isPlainRecord(raw)) return [];
  if (Array.isArray(raw.tasks) || Array.isArray(raw.templates)) {
    const out: Record<string, unknown>[] = [];
    if (Array.isArray(raw.tasks)) for (const t of raw.tasks) if (isPlainRecord(t)) out.push({ ...t, kind: 'Task' });
    if (Array.isArray(raw.templates)) for (const t of raw.templates) if (isPlainRecord(t)) out.push({ ...t, kind: 'Template' });
    return out;
  }
  return [raw];
}

function recordToYaml(rec: ExportInputRecord & Record<string, unknown>): { text: string; id: string; kind: 'Task' | 'Template' } {
  const kind = inferKind(rec);
  if (kind === 'Task') {
    const file = taskToFile(rec as unknown as Parameters<typeof taskToFile>[0]);
    return { text: serializeFile(file), id: file.metadata.id, kind: 'Task' };
  }
  const file = templateToFile(rec as unknown as Parameters<typeof templateToFile>[0]);
  return { text: serializeFile(file), id: file.metadata.id, kind: 'Template' };
}

function inferKind(rec: Record<string, unknown>): 'Task' | 'Template' {
  if (rec.kind === 'Task') return 'Task';
  if (rec.kind === 'Template') return 'Template';
  // 启发式：有 steps[] → Task；有 fields[] → Template
  if (Array.isArray((rec as { steps?: unknown }).steps)) return 'Task';
  if (Array.isArray((rec as { fields?: unknown }).fields)) return 'Template';
  throw new Error(`cannot infer kind for record id=${JSON.stringify(rec.id)}; expected kind: 'Task' | 'Template'`);
}

function isPlainRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

/** 读取文件并检查大小上限；失败返回 issue 而非抛错。 */
async function readFileWithLimit(
  absPath: string,
  displayPath: string,
): Promise<{ text: string } | { error: ValidationIssue }> {
  try {
    // 使用 lstat 拒绝符号链接，避免被诱导读取 /dev/* 或跳出工作区。
    const stat = await fs.lstat(absPath);
    if (stat.isSymbolicLink()) {
      return {
        error: { path: displayPath, message: 'refusing to read symlink input', severity: 'error' },
      };
    }
    if (!stat.isFile()) {
      return {
        error: { path: displayPath, message: 'not a regular file', severity: 'error' },
      };
    }
    if (stat.size > IO_SAFETY.maxFileSize) {
      return {
        error: {
          path: displayPath,
          message: `file size ${stat.size} exceeds limit ${IO_SAFETY.maxFileSize}`,
          severity: 'error',
        },
      };
    }
    const text = await fs.readFile(absPath, 'utf8');
    return { text };
  } catch (err) {
    return {
      error: { path: displayPath, message: `read error: ${errMsg(err)}`, severity: 'error' },
    };
  }
}

function printIssues(stderr: { write: (chunk: string) => unknown }, issues: ValidationIssue[]): void {
  for (const issue of issues) {
    const tag = issue.severity === 'error' ? 'error' : 'warn ';
    stderr.write(`${tag}  ${issue.path}: ${issue.message}\n`);
  }
}

function safeFileId(id: string): string {
  // 文件名安全化：仅允许 [A-Za-z0-9._-]，其它替换为 `_`；
  // 额外把连续的 `.` 折叠为单个，并去除前导 `.`，避免 `..` / 隐藏文件命名。
  const sanitized = id.replace(/[^A-Za-z0-9._-]/g, '_').replace(/\.{2,}/g, '_').replace(/^\.+/, '');
  const trimmed = sanitized.slice(0, 120);
  return trimmed || 'unnamed';
}

async function defaultWriteFile(path: string, data: string): Promise<void> {
  await fs.mkdir(dirname(path), { recursive: true });
  await fs.writeFile(path, data, 'utf8');
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
