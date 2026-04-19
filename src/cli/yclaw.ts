/**
 * yclaw CLI — argv 解析与命令分发
 *
 * 当前支持：
 *   yclaw lint <path...> [--format text|json] [--strict]
 *
 * 设计取舍：
 * - 不引入 commander/yargs，零依赖，便于在 CI / 容器中独立运行。
 * - 命令实现暴露程序化入口（runLint），CLI 仅做 argv 适配和退出码处理。
 */

import { runLint, type LintFormat } from './lint';
import { runImport, runExport } from './io';

const HELP = `yclaw — Task-as-Code CLI

Usage:
  yclaw lint   <path...> [--format text|json|sarif] [--strict] [--check-refs] [--migrate]
  yclaw import <path...> [--out <dir>] [--migrate] [--check-refs]
  yclaw export <jsonpath...> [--out <dir>]

Options (lint):
  --format <fmt>   Output format: text (default) or json
  --strict         Treat warnings as errors
  --check-refs     For directory inputs, also resolve cross-file templateRef
  --migrate        Auto-upgrade older schemaVersion files before validation

Options (import):
  --out <dir>      Write per-record JSON files to <dir>; default prints aggregate JSON to stdout
  --migrate        Same as lint
  --check-refs     Same as lint

Options (export):
  --out <dir>      Write per-record YAML files to <dir>; default prints YAML to stdout

Global:
  -h, --help       Show this help

Exit codes:
  0  all files passed
  1  one or more files have errors (or warnings in --strict)
  2  CLI usage error or I/O failure
`;

export interface CliOptions {
  argv: string[];
  stdout?: { write: (chunk: string) => unknown };
  stderr?: { write: (chunk: string) => unknown };
  cwd?: string;
}

/** 程序化入口：返回退出码而非 process.exit。 */
export async function runCli(options: CliOptions): Promise<number> {
  const stdout = options.stdout ?? process.stdout;
  const stderr = options.stderr ?? process.stderr;
  const argv = options.argv;

  if (argv.length === 0 || argv[0] === '-h' || argv[0] === '--help') {
    stdout.write(HELP);
    return argv.length === 0 ? 2 : 0;
  }

  const [command, ...rest] = argv;
  if (command === 'lint') {
    return runLintCli(rest, { stdout, stderr, cwd: options.cwd });
  }
  if (command === 'import') {
    return runImportCli(rest, { stdout, stderr, cwd: options.cwd });
  }
  if (command === 'export') {
    return runExportCli(rest, { stdout, stderr, cwd: options.cwd });
  }

  stderr.write(`yclaw: unknown command "${command}"\n${HELP}`);
  return 2;
}

async function runLintCli(
  args: string[],
  io: { stdout: NonNullable<CliOptions['stdout']>; stderr: NonNullable<CliOptions['stderr']>; cwd?: string },
): Promise<number> {
  const inputs: string[] = [];
  let format: LintFormat = 'text';
  let strict = false;
  let checkRefs = false;
  let migrate = false;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]!;
    if (arg === '--format') {
      const next = args[i + 1];
      if (next !== 'text' && next !== 'json' && next !== 'sarif') {
        io.stderr.write(`yclaw lint: --format must be "text", "json" or "sarif"\n`);
        return 2;
      }
      format = next;
      i += 1;
    } else if (arg.startsWith('--format=')) {
      const v = arg.slice('--format='.length);
      if (v !== 'text' && v !== 'json' && v !== 'sarif') {
        io.stderr.write(`yclaw lint: --format must be "text", "json" or "sarif"\n`);
        return 2;
      }
      format = v;
    } else if (arg === '--strict') {
      strict = true;
    } else if (arg === '--check-refs') {
      checkRefs = true;
    } else if (arg === '--migrate') {
      migrate = true;
    } else if (arg.startsWith('--')) {
      io.stderr.write(`yclaw lint: unknown option "${arg}"\n`);
      return 2;
    } else {
      inputs.push(arg);
    }
  }

  const result = await runLint({ inputs, format, strict, checkRefs, migrate, ...io });
  return result.exitCode;
}

async function runImportCli(
  args: string[],
  io: { stdout: NonNullable<CliOptions['stdout']>; stderr: NonNullable<CliOptions['stderr']>; cwd?: string },
): Promise<number> {
  const inputs: string[] = [];
  let outDir: string | undefined;
  let migrate = false;
  let checkRefs = false;
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]!;
    if (arg === '--out') {
      const next = args[i + 1];
      if (!next) { io.stderr.write('yclaw import: --out requires a directory\n'); return 2; }
      outDir = next; i += 1;
    } else if (arg.startsWith('--out=')) {
      outDir = arg.slice('--out='.length);
    } else if (arg === '--migrate') {
      migrate = true;
    } else if (arg === '--check-refs') {
      checkRefs = true;
    } else if (arg.startsWith('--')) {
      io.stderr.write(`yclaw import: unknown option "${arg}"\n`);
      return 2;
    } else {
      inputs.push(arg);
    }
  }
  const result = await runImport({ inputs, outDir, migrate, checkRefs, ...io });
  return result.exitCode;
}

async function runExportCli(
  args: string[],
  io: { stdout: NonNullable<CliOptions['stdout']>; stderr: NonNullable<CliOptions['stderr']>; cwd?: string },
): Promise<number> {
  const inputs: string[] = [];
  let outDir: string | undefined;
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]!;
    if (arg === '--out') {
      const next = args[i + 1];
      if (!next) { io.stderr.write('yclaw export: --out requires a directory\n'); return 2; }
      outDir = next; i += 1;
    } else if (arg.startsWith('--out=')) {
      outDir = arg.slice('--out='.length);
    } else if (arg.startsWith('--')) {
      io.stderr.write(`yclaw export: unknown option "${arg}"\n`);
      return 2;
    } else {
      inputs.push(arg);
    }
  }
  const result = await runExport({ inputs, outDir, ...io });
  return result.exitCode;
}
