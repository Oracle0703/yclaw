/**
 * yclaw CLI — `lint` 命令
 *
 * 对单个 YAML 文件或目录递归 lint，输出 text/json 两种格式。
 * 退出码：所有文件通过 → 0；存在 error 级 issue → 1；CLI 内部错误 → 2。
 */

import { promises as fs } from 'node:fs';
import { relative } from 'node:path';
import { lintFile, loadDirectory, resolveReferences } from '@shared/serialization';
import type { ValidationIssue } from '@shared/serialization';
import { collectYamlFiles } from './fs-walk';

export type LintFormat = 'text' | 'json';

export interface LintOptions {
  /** 输入路径列表（文件或目录）。 */
  inputs: string[];
  /** 输出格式，默认 'text'。 */
  format?: LintFormat;
  /** 把警告也视为失败。 */
  strict?: boolean;
  /** 针对目录输入，额外检查跨文件 templateRef 是否可解析。 */
  checkRefs?: boolean;
  /** 允许旧 schemaVersion 文件：在校验前运行迁移。 */
  migrate?: boolean;
  /** stdout/stderr 注入便于测试。 */
  stdout?: { write: (chunk: string) => unknown };
  stderr?: { write: (chunk: string) => unknown };
  /** 工作目录，便于在输出中显示相对路径。 */
  cwd?: string;
}

export interface LintFileResult {
  filePath: string;
  issues: ValidationIssue[];
}

export interface LintRunResult {
  files: LintFileResult[];
  errorCount: number;
  warningCount: number;
  exitCode: 0 | 1 | 2;
}

const SUPPORTED_EXT_NOTE = '.yaml/.yml';

/** 安全上限，避免恶意输入与环形符号链接。 */
export const SAFETY = {
  /** 递归目录最大深度。 */
  maxDirDepth: 32,
  /** 单个 YAML 文件最大字节数。1 MiB 足够覆盖上万行任务定义。 */
  maxFileSize: 1024 * 1024,
} as const;

/** 程序化入口（便于测试）。返回结构化结果，不调用 process.exit。 */
export async function runLint(options: LintOptions): Promise<LintRunResult> {
  const stdout = options.stdout ?? process.stdout;
  const stderr = options.stderr ?? process.stderr;
  const cwd = options.cwd ?? process.cwd();
  const format: LintFormat = options.format ?? 'text';
  const strict = options.strict ?? false;

  if (options.inputs.length === 0) {
    stderr.write('yclaw lint: no input paths provided\n');
    return { files: [], errorCount: 0, warningCount: 0, exitCode: 2 };
  }

  let files: string[];
  try {
    files = await collectYamlFiles(options.inputs, { maxDirDepth: SAFETY.maxDirDepth });
  } catch (error) {
    stderr.write(`yclaw lint: ${error instanceof Error ? error.message : String(error)}\n`);
    return { files: [], errorCount: 0, warningCount: 0, exitCode: 2 };
  }

  if (files.length === 0) {
    stderr.write('yclaw lint: no .yaml/.yml files found\n');
    return { files: [], errorCount: 0, warningCount: 0, exitCode: 2 };
  }

  const fileResults: LintFileResult[] = [];
  let errorCount = 0;
  let warningCount = 0;

  for (const filePath of files) {
    const display = relative(cwd, filePath) || filePath;
    let text: string;
    try {
      const fileStat = await fs.stat(filePath);
      if (fileStat.size > SAFETY.maxFileSize) {
        throw new Error(
          `file size ${fileStat.size} exceeds limit ${SAFETY.maxFileSize}`,
        );
      }
      text = await fs.readFile(filePath, 'utf8');
    } catch (error) {
      const issue: ValidationIssue = {
        path: display,
        message: `read error: ${error instanceof Error ? error.message : String(error)}`,
        severity: 'error',
      };
      fileResults.push({ filePath, issues: [issue] });
      errorCount += 1;
      continue;
    }
    const result = lintFile(text, { filePath: display, migrate: options.migrate });
    fileResults.push({ filePath, issues: result.issues });
    for (const issue of result.issues) {
      if (issue.severity === 'error') errorCount += 1;
      else warningCount += 1;
    }
  }

  // --check-refs：仅当输入恰好是单一目录时执行跨文件引用解析
  const refIssues: ValidationIssue[] = [];
  if (options.checkRefs && options.inputs.length === 1) {
    try {
      const stat = await fs.stat(options.inputs[0]!);
      if (stat.isDirectory()) {
        const reg = await loadDirectory(options.inputs[0]!);
        const refs = resolveReferences(reg);
        refIssues.push(...refs.issues);
        for (const i of refs.issues) {
          if (i.severity === 'error') errorCount += 1;
          else warningCount += 1;
        }
      }
    } catch {
      // 单文件输入不做引用检查；stat 已在前面成功，这里不可能失败
    }
  }

  const exitCode: 0 | 1 = errorCount > 0 || (strict && warningCount > 0) ? 1 : 0;

  if (format === 'json') {
    stdout.write(
      `${JSON.stringify(
        { files: fileResults, refIssues, errorCount, warningCount, exitCode, strict },
        null,
        2,
      )}\n`,
    );
  } else {
    stdout.write(formatTextReport(fileResults, cwd));
    if (refIssues.length > 0) {
      stdout.write('\n  cross-file references:');
      for (const issue of refIssues) {
        const tag = issue.severity === 'error' ? 'error  ' : 'warning';
        stdout.write(`\n        ${tag} ${issue.path}: ${issue.message}`);
      }
    }
    const strictSuffix = strict ? ' (strict: warnings count as failures)' : '';
    stdout.write(
      `\n${errorCount} error(s), ${warningCount} warning(s) across ${files.length} file(s).${strictSuffix}\n`,
    );
  }

  return { files: fileResults, errorCount, warningCount, exitCode };
}

function formatTextReport(results: LintFileResult[], cwd: string): string {
  const lines: string[] = [];
  for (const r of results) {
    const display = relative(cwd, r.filePath) || r.filePath;
    if (r.issues.length === 0) {
      lines.push(`  ok  ${display}`);
      continue;
    }
    lines.push(`  ✖  ${display}`);
    for (const issue of r.issues) {
      const tag = issue.severity === 'error' ? 'error  ' : 'warning';
      lines.push(`        ${tag} ${issue.path}: ${issue.message}`);
    }
  }
  return lines.join('\n');
}
