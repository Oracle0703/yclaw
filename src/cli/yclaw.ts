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
import { serveMcpStdio } from '../mcp/server/serveStdio';
import { serveMcpHttp } from '../mcp/server/serveHttp';
import type { McpServeArgs } from '../mcp/shared/types';
import { runRunnerList, type RunnerListArgs, type RunnerListResult } from '../runner/cli/list';
import { runRunnerDaemon, type RunnerDaemonArgs, type RunnerDaemonResult } from '../runner/cli/daemon';
import { runRunnerTask, type RunnerRunArgs, type RunnerRunResult } from '../runner/cli/run';

const HELP = `yclaw — Task-as-Code CLI

Usage:
  yclaw lint   <path...> [--format text|json|sarif] [--strict] [--check-refs] [--migrate]
  yclaw import <path...> [--out <dir>] [--migrate] [--check-refs]
  yclaw export <jsonpath...> [--out <dir>]
  yclaw run    <taskId> [--output text|json] [--headed] [--browser-executable <path>]
  yclaw list   tasks [--output text|json]
  yclaw list   batches --task <id> [--limit <number>] [--output text|json]
  yclaw mcp    serve [--transport stdio|http] [--port <number>]

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

Options (list):
  --output <fmt>   Output format: text (default) or json
  --task <id>      Required for "list batches"
  --limit <n>      Limit batch rows for "list batches"

Options (run):
  --output <fmt>              Output format: text (default) or json
  --headed                    Run browser automation with a visible browser window
  --browser-executable <path> Use a specific Chromium/Chrome/Edge executable

Global:
  -h, --help       Show this help

Exit codes:
  0  success
  1  one or more files have errors (or warnings in --strict)
  2  CLI usage/configuration error
  3  runtime/service failure
`;

const MCP_SERVE_HELP = `yclaw mcp serve

Usage:
  yclaw mcp serve [--transport stdio|http] [--port <number>]

Options:
  --transport <mode>  Transport mode: stdio (default) or http
  --port <number>     HTTP transport port; stdio mode ignores this option
  -h, --help          Show this help
`;

export interface CliOptions {
  argv: string[];
  stdout?: { write: (chunk: string) => unknown };
  stderr?: { write: (chunk: string) => unknown };
  cwd?: string;
  mcpServe?: (args: McpServeArgs) => Promise<number>;
  runnerList?: (args: RunnerListArgs) => Promise<RunnerListResult>;
  runnerRun?: (args: RunnerRunArgs) => Promise<RunnerRunResult>;
  runnerDaemon?: (args: RunnerDaemonArgs) => Promise<RunnerDaemonResult>;
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
  if (command === 'run') {
    return runRunCli(rest, { stdout, stderr, runnerRun: options.runnerRun });
  }
  if (command === 'list') {
    return runListCli(rest, { stdout, stderr, runnerList: options.runnerList });
  }
  if (command === 'mcp') {
    return runMcpCli(rest, { stdout, stderr, mcpServe: options.mcpServe });
  }
  if (command === 'runner') {
    return runRunnerCli(rest, { stdout, stderr, runnerDaemon: options.runnerDaemon });
  }

  stderr.write(`yclaw: unknown command "${command}"\n${HELP}`);
  return 2;
}

async function runRunCli(
  args: string[],
  io: {
    stdout: NonNullable<CliOptions['stdout']>;
    stderr: NonNullable<CliOptions['stderr']>;
    runnerRun?: CliOptions['runnerRun'];
  },
): Promise<number> {
  if (args.length === 0 || args[0] === '-h' || args[0] === '--help') {
    io.stderr.write('yclaw run: task id is required\n');
    return args.length === 0 ? 2 : 0;
  }

  const taskId = args[0];
  let output: RunnerRunArgs['output'] = 'text';
  let headed = false;
  let browserExecutable: string | undefined;

  for (let i = 1; i < args.length; i += 1) {
    const arg = args[i]!;
    if (arg === '--output') {
      const next = args[i + 1];
      if (next !== 'text' && next !== 'json') {
        io.stderr.write('yclaw run: --output must be "text" or "json"\n');
        return 2;
      }
      output = next;
      i += 1;
      continue;
    }
    if (arg.startsWith('--output=')) {
      const value = arg.slice('--output='.length);
      if (value !== 'text' && value !== 'json') {
        io.stderr.write('yclaw run: --output must be "text" or "json"\n');
        return 2;
      }
      output = value;
      continue;
    }
    if (arg === '--headed') {
      headed = true;
      continue;
    }
    if (arg === '--browser-executable') {
      const next = args[i + 1];
      if (!next) {
        io.stderr.write('yclaw run: --browser-executable requires a path\n');
        return 2;
      }
      browserExecutable = next;
      i += 1;
      continue;
    }
    if (arg.startsWith('--browser-executable=')) {
      const value = arg.slice('--browser-executable='.length);
      if (!value) {
        io.stderr.write('yclaw run: --browser-executable requires a path\n');
        return 2;
      }
      browserExecutable = value;
      continue;
    }
    io.stderr.write(`yclaw run: unknown option "${arg}"\n`);
    return 2;
  }

  const runnerRun = io.runnerRun ?? runRunnerTask;
  const result = await runnerRun({
    taskId,
    output,
    headed: headed || undefined,
    browserExecutable,
  });
  if (result.output) {
    io.stdout.write(result.output.endsWith('\n') ? result.output : `${result.output}\n`);
  }
  if (result.error) {
    io.stderr.write(result.error.endsWith('\n') ? result.error : `${result.error}\n`);
  }
  return result.exitCode;
}

async function runListCli(
  args: string[],
  io: {
    stdout: NonNullable<CliOptions['stdout']>;
    stderr: NonNullable<CliOptions['stderr']>;
    runnerList?: CliOptions['runnerList'];
  },
): Promise<number> {
  if (args.length === 0 || args[0] === '-h' || args[0] === '--help') {
    io.stdout.write(HELP);
    return args.length === 0 ? 2 : 0;
  }

  const target = args[0];
  if (target !== 'tasks' && target !== 'batches') {
    io.stderr.write(`yclaw list: target must be "tasks" or "batches"\n`);
    return 2;
  }

  let output: RunnerListArgs['output'] = 'text';
  let taskId: string | undefined;
  let limit: number | undefined;

  for (let i = 1; i < args.length; i += 1) {
    const arg = args[i]!;
    if (arg === '--output') {
      const next = args[i + 1];
      if (next !== 'text' && next !== 'json') {
        io.stderr.write('yclaw list: --output must be "text" or "json"\n');
        return 2;
      }
      output = next;
      i += 1;
      continue;
    }
    if (arg.startsWith('--output=')) {
      const value = arg.slice('--output='.length);
      if (value !== 'text' && value !== 'json') {
        io.stderr.write('yclaw list: --output must be "text" or "json"\n');
        return 2;
      }
      output = value;
      continue;
    }
    if (arg === '--task') {
      const next = args[i + 1];
      if (!next) {
        io.stderr.write('yclaw list batches: --task requires a task id\n');
        return 2;
      }
      taskId = next;
      i += 1;
      continue;
    }
    if (arg.startsWith('--task=')) {
      taskId = arg.slice('--task='.length);
      continue;
    }
    if (arg === '--limit') {
      const parsed = Number.parseInt(args[i + 1] ?? '', 10);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        io.stderr.write('yclaw list batches: --limit requires a positive integer\n');
        return 2;
      }
      limit = parsed;
      i += 1;
      continue;
    }
    if (arg.startsWith('--limit=')) {
      const parsed = Number.parseInt(arg.slice('--limit='.length), 10);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        io.stderr.write('yclaw list batches: --limit requires a positive integer\n');
        return 2;
      }
      limit = parsed;
      continue;
    }
    io.stderr.write(`yclaw list: unknown option "${arg}"\n`);
    return 2;
  }

  if (target === 'batches' && !taskId) {
    io.stderr.write('yclaw list batches: --task is required\n');
    return 2;
  }

  const runnerList = io.runnerList ?? runRunnerList;
  const result = await runnerList({ target, output, taskId, limit });
  if (result.output) {
    io.stdout.write(result.output.endsWith('\n') ? result.output : `${result.output}\n`);
  }
  if (result.error) {
    io.stderr.write(result.error.endsWith('\n') ? result.error : `${result.error}\n`);
  }
  return result.exitCode;
}

async function runRunnerCli(
  args: string[],
  io: {
    stdout: NonNullable<CliOptions['stdout']>;
    stderr: NonNullable<CliOptions['stderr']>;
    runnerDaemon?: CliOptions['runnerDaemon'];
  },
): Promise<number> {
  if (args.length === 0 || args[0] === '-h' || args[0] === '--help') {
    io.stderr.write('yclaw runner: subcommand is required\n');
    return args.length === 0 ? 2 : 0;
  }

  const subcommand = args[0];
  if (subcommand !== 'daemon') {
    io.stderr.write(`yclaw runner: unknown subcommand "${subcommand}"\n`);
    return 2;
  }

  let port = 7421;
  let token: string | undefined;
  let workspaceId = 'default';

  for (let index = 1; index < args.length; index += 1) {
    const arg = args[index]!;
    if (arg === '--port') {
      const next = args[index + 1];
      if (!next || Number.isNaN(Number(next))) {
        io.stderr.write('yclaw runner daemon: --port requires a number\n');
        return 2;
      }
      port = Number(next);
      index += 1;
      continue;
    }
    if (arg.startsWith('--port=')) {
      const value = Number(arg.slice('--port='.length));
      if (Number.isNaN(value)) {
        io.stderr.write('yclaw runner daemon: --port requires a number\n');
        return 2;
      }
      port = value;
      continue;
    }
    if (arg === '--token') {
      const next = args[index + 1];
      if (!next) {
        io.stderr.write('yclaw runner daemon: --token is required\n');
        return 2;
      }
      token = next;
      index += 1;
      continue;
    }
    if (arg.startsWith('--token=')) {
      token = arg.slice('--token='.length);
      continue;
    }
    if (arg === '--workspace') {
      const next = args[index + 1];
      if (!next) {
        io.stderr.write('yclaw runner daemon: --workspace is required\n');
        return 2;
      }
      workspaceId = next;
      index += 1;
      continue;
    }
    if (arg.startsWith('--workspace=')) {
      workspaceId = arg.slice('--workspace='.length);
      continue;
    }
    io.stderr.write(`yclaw runner daemon: unknown option "${arg}"\n`);
    return 2;
  }

  if (!token) {
    io.stderr.write('yclaw runner daemon: --token is required\n');
    return 2;
  }

  const runnerDaemon = io.runnerDaemon ?? runRunnerDaemon;
  const result = await runnerDaemon({
    port,
    token,
    workspaceId,
  });
  if (result.output) {
    io.stdout.write(result.output.endsWith('\n') ? result.output : `${result.output}\n`);
  }
  if (result.error) {
    io.stderr.write(result.error.endsWith('\n') ? result.error : `${result.error}\n`);
  }
  return result.exitCode;
}

async function runMcpCli(
  args: string[],
  io: {
    stdout: NonNullable<CliOptions['stdout']>;
    stderr: NonNullable<CliOptions['stderr']>;
    mcpServe?: CliOptions['mcpServe'];
  },
): Promise<number> {
  if (args.length === 0 || args[0] === '-h' || args[0] === '--help') {
    io.stdout.write(MCP_SERVE_HELP);
    return args.length === 0 ? 2 : 0;
  }

  const [subcommand, ...rest] = args;
  if (subcommand !== 'serve') {
    io.stderr.write(`yclaw mcp: unknown command "${subcommand}"\n${MCP_SERVE_HELP}`);
    return 2;
  }

  return runMcpServeCli(rest, io);
}

async function runMcpServeCli(
  args: string[],
  io: {
    stdout: NonNullable<CliOptions['stdout']>;
    stderr: NonNullable<CliOptions['stderr']>;
    mcpServe?: CliOptions['mcpServe'];
  },
): Promise<number> {
  let transport: McpServeArgs['transport'] = 'stdio';
  let port: number | undefined;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]!;
    if (arg === '-h' || arg === '--help') {
      io.stdout.write(MCP_SERVE_HELP);
      return 0;
    }
    if (arg === '--transport') {
      const next = args[i + 1];
      if (next !== 'stdio' && next !== 'http') {
        io.stderr.write('yclaw mcp serve: --transport must be "stdio" or "http"\n');
        return 2;
      }
      transport = next;
      i += 1;
      continue;
    }
    if (arg.startsWith('--transport=')) {
      const value = arg.slice('--transport='.length);
      if (value !== 'stdio' && value !== 'http') {
        io.stderr.write('yclaw mcp serve: --transport must be "stdio" or "http"\n');
        return 2;
      }
      transport = value;
      continue;
    }
    if (arg === '--port') {
      const next = args[i + 1];
      const parsed = Number.parseInt(next ?? '', 10);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        io.stderr.write('yclaw mcp serve: --port requires a positive integer\n');
        return 2;
      }
      port = parsed;
      i += 1;
      continue;
    }
    if (arg.startsWith('--port=')) {
      const parsed = Number.parseInt(arg.slice('--port='.length), 10);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        io.stderr.write('yclaw mcp serve: --port requires a positive integer\n');
        return 2;
      }
      port = parsed;
      continue;
    }
    io.stderr.write(`yclaw mcp serve: unknown option "${arg}"\n`);
    return 2;
  }

  const serveArgs: McpServeArgs = { transport, port };
  if (io.mcpServe) {
    return io.mcpServe(serveArgs);
  }

  if (transport === 'http') {
    await serveMcpHttp({
      port,
      stdout: io.stdout,
      stderr: io.stderr,
    });
    return 0;
  }

  await serveMcpStdio();
  return 0;
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
