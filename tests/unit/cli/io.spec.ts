import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runImport, runExport } from '@cli/io';

class StringSink {
  chunks: string[] = [];
  write(chunk: string): boolean {
    this.chunks.push(chunk);
    return true;
  }
  text(): string {
    return this.chunks.join('');
  }
}

const VALID_TASK_YAML = [
  'schemaVersion: 1',
  'kind: Task',
  'metadata:',
  '  id: t1',
  '  name: 任务一',
  'spec:',
  '  steps:',
  "    - id: s1",
  '      name: c',
  "      action: { type: click, selector: '#a' }",
  '',
].join('\n');

const VALID_TEMPLATE_YAML = [
  'schemaVersion: 1',
  'kind: Template',
  'metadata:',
  '  id: tpl1',
  '  name: 模板一',
  'spec:',
  '  fields:',
  '    - name: title',
  '      selector: h1',
  '      type: text',
  '      attribute: text',
  '',
].join('\n');

const V0_TASK_YAML = [
  'schemaVersion: 0',
  'kind: Task',
  'metadata:',
  '  id: t-old',
  '  title: 旧任务',
  'spec:',
  '  steps:',
  "    - id: s1",
  '      name: c',
  "      action: { type: click, selector: '#a' }",
  '',
].join('\n');

describe('cli · io · runImport', () => {
  let tmp = '';
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'yclaw-io-'));
  });
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it('imports a single task YAML and prints aggregate JSON to stdout', async () => {
    const file = join(tmp, 'task.yaml');
    writeFileSync(file, VALID_TASK_YAML, 'utf8');
    const stdout = new StringSink();
    const stderr = new StringSink();
    const r = await runImport({
      inputs: [file],
      stdout,
      stderr,
      now: () => '2026-01-01T00:00:00.000Z',
    });
    expect(r.exitCode).toBe(0);
    expect(r.taskCount).toBe(1);
    expect(r.templateCount).toBe(0);
    const parsed = JSON.parse(stdout.text());
    expect(parsed.tasks[0].id).toBe('t1');
    expect(parsed.tasks[0].createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(parsed.tasks[0].steps).toHaveLength(1);
  });

  it('imports a directory of mixed task + template YAMLs', async () => {
    writeFileSync(join(tmp, 'a.yaml'), VALID_TASK_YAML, 'utf8');
    writeFileSync(join(tmp, 'b.template.yaml'), VALID_TEMPLATE_YAML, 'utf8');
    const stdout = new StringSink();
    const stderr = new StringSink();
    const r = await runImport({ inputs: [tmp], stdout, stderr });
    expect(r.exitCode).toBe(0);
    expect(r.taskCount).toBe(1);
    expect(r.templateCount).toBe(1);
  });

  it('writes per-record JSON files when --out is provided', async () => {
    const yamlDir = join(tmp, 'yamls');
    const outDir = join(tmp, 'out');
    mkdirSync(yamlDir);
    writeFileSync(join(yamlDir, 'a.yaml'), VALID_TASK_YAML, 'utf8');
    writeFileSync(join(yamlDir, 'b.yaml'), VALID_TEMPLATE_YAML, 'utf8');
    const stdout = new StringSink();
    const stderr = new StringSink();
    const r = await runImport({
      inputs: [yamlDir],
      outDir,
      stdout,
      stderr,
      now: () => '2026-01-01T00:00:00.000Z',
    });
    expect(r.exitCode).toBe(0);
    const files = readdirSync(outDir).sort();
    expect(files).toEqual(['t1.task.json', 'tpl1.template.json']);
    const taskJson = JSON.parse(readFileSync(join(outDir, 't1.task.json'), 'utf8'));
    expect(taskJson.id).toBe('t1');
  });

  it('reports parse errors and returns exit code 1', async () => {
    const file = join(tmp, 'bad.yaml');
    writeFileSync(file, 'schemaVersion: 1\nkind: Task\n', 'utf8'); // missing metadata/spec
    const stdout = new StringSink();
    const stderr = new StringSink();
    const r = await runImport({ inputs: [file], stdout, stderr });
    expect(r.exitCode).toBe(1);
    expect(r.issues.length).toBeGreaterThan(0);
    expect(stderr.text()).toMatch(/error/);
  });

  it('rejects file larger than IO_SAFETY.maxFileSize', async () => {
    const file = join(tmp, 'big.yaml');
    // 写一个超过 1 MiB 的 YAML（注释填充）
    const bigContent = '# ' + 'x'.repeat(1024 * 1024 + 10) + '\n' + VALID_TASK_YAML;
    writeFileSync(file, bigContent, 'utf8');
    const stdout = new StringSink();
    const stderr = new StringSink();
    const r = await runImport({ inputs: [file], stdout, stderr });
    expect(r.exitCode).toBe(1);
    expect(stderr.text()).toMatch(/exceeds limit/);
  });

  it('with --migrate, imports v0 task successfully', async () => {
    const file = join(tmp, 'legacy.yaml');
    writeFileSync(file, V0_TASK_YAML, 'utf8');
    const stdout = new StringSink();
    const stderr = new StringSink();
    const r = await runImport({ inputs: [file], migrate: true, stdout, stderr });
    expect(r.exitCode).toBe(0);
    const parsed = JSON.parse(stdout.text());
    expect(parsed.tasks[0].name).toBe('旧任务');
  });

  it('without --migrate, v0 task fails import', async () => {
    const file = join(tmp, 'legacy.yaml');
    writeFileSync(file, V0_TASK_YAML, 'utf8');
    const stdout = new StringSink();
    const stderr = new StringSink();
    const r = await runImport({ inputs: [file], stdout, stderr });
    expect(r.exitCode).toBe(1);
  });

  it('returns exit 2 on no inputs', async () => {
    const stdout = new StringSink();
    const stderr = new StringSink();
    const r = await runImport({ inputs: [], stdout, stderr });
    expect(r.exitCode).toBe(2);
  });

  it('returns exit 2 when directory has no YAML files', async () => {
    const stdout = new StringSink();
    const stderr = new StringSink();
    const r = await runImport({ inputs: [tmp], stdout, stderr });
    expect(r.exitCode).toBe(2);
  });

  it('--check-refs surfaces unresolved templateRef', async () => {
    const taskWithRef = VALID_TASK_YAML.replace(
      'spec:\n  steps:',
      'spec:\n  templateRef: missing-tpl\n  steps:',
    );
    writeFileSync(join(tmp, 'a.yaml'), taskWithRef, 'utf8');
    const stdout = new StringSink();
    const stderr = new StringSink();
    const r = await runImport({ inputs: [tmp], checkRefs: true, stdout, stderr });
    expect(r.exitCode).toBe(1);
    expect(stderr.text()).toMatch(/templateRef|missing-tpl/);
  });
});

describe('cli · io · runExport', () => {
  let tmp = '';
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'yclaw-io-exp-'));
  });
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  function makeAggregateJson(): string {
    return JSON.stringify({
      tasks: [
        {
          id: 't1',
          name: 'X',
          steps: [{ id: 's1', name: 'c', action: { type: 'click', selector: '#a' } }],
          enabled: true,
          tags: ['demo'],
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      templates: [
        {
          id: 'tpl1',
          name: 'Y',
          fields: [{ name: 'title', selector: 'h1', type: 'text', attribute: 'text' }],
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    });
  }

  it('exports aggregate JSON to stdout YAML stream', async () => {
    const jsonFile = join(tmp, 'in.json');
    writeFileSync(jsonFile, makeAggregateJson(), 'utf8');
    const stdout = new StringSink();
    const stderr = new StringSink();
    const r = await runExport({ inputs: [jsonFile], stdout, stderr });
    expect(r.exitCode).toBe(0);
    expect(r.count).toBe(2);
    const out = stdout.text();
    expect(out).toMatch(/kind: Task/);
    expect(out).toMatch(/kind: Template/);
    expect(out).toMatch(/^---$/m);
  });

  it('exports per-record YAML files to --out dir', async () => {
    const jsonFile = join(tmp, 'in.json');
    writeFileSync(jsonFile, makeAggregateJson(), 'utf8');
    const outDir = join(tmp, 'out');
    const r = await runExport({
      inputs: [jsonFile],
      outDir,
      stdout: new StringSink(),
      stderr: new StringSink(),
    });
    expect(r.exitCode).toBe(0);
    const files = readdirSync(outDir).sort();
    expect(files).toEqual(['t1.yaml', 'tpl1.template.yaml']);
    const yaml = readFileSync(join(outDir, 't1.yaml'), 'utf8');
    expect(yaml).toMatch(/schemaVersion: 1/);
    expect(yaml).toMatch(/id: t1/);
  });

  it('infers kind from steps[]/fields[] when kind is missing', async () => {
    const jsonFile = join(tmp, 'no-kind.json');
    writeFileSync(
      jsonFile,
      JSON.stringify([
        {
          id: 't2',
          name: 'inferred',
          steps: [{ id: 's', name: 'n', action: { type: 'click', selector: '#x' } }],
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ]),
      'utf8',
    );
    const stdout = new StringSink();
    const stderr = new StringSink();
    const r = await runExport({ inputs: [jsonFile], stdout, stderr });
    expect(r.exitCode).toBe(0);
    expect(stdout.text()).toMatch(/kind: Task/);
  });

  it('reports JSON parse errors with exit 1', async () => {
    const jsonFile = join(tmp, 'bad.json');
    writeFileSync(jsonFile, '{not valid', 'utf8');
    const stdout = new StringSink();
    const stderr = new StringSink();
    const r = await runExport({ inputs: [jsonFile], stdout, stderr });
    expect(r.exitCode).toBe(1);
    expect(stderr.text()).toMatch(/JSON parse error/);
  });

  it('reports records that cannot be classified', async () => {
    const jsonFile = join(tmp, 'unknown.json');
    writeFileSync(jsonFile, JSON.stringify([{ id: 'x', name: 'mystery' }]), 'utf8');
    const stdout = new StringSink();
    const stderr = new StringSink();
    const r = await runExport({ inputs: [jsonFile], stdout, stderr });
    expect(r.exitCode).toBe(1);
    expect(stderr.text()).toMatch(/cannot infer kind/);
  });

  it('returns exit 2 on no inputs', async () => {
    const stdout = new StringSink();
    const stderr = new StringSink();
    const r = await runExport({ inputs: [], stdout, stderr });
    expect(r.exitCode).toBe(2);
  });

  it('round-trip: import then export yields semantically identical YAML', async () => {
    // import a task → JSON
    const yamlIn = join(tmp, 'in.yaml');
    writeFileSync(yamlIn, VALID_TASK_YAML, 'utf8');
    const jsonOutDir = join(tmp, 'json');
    await runImport({
      inputs: [yamlIn],
      outDir: jsonOutDir,
      stdout: new StringSink(),
      stderr: new StringSink(),
      now: () => '2026-01-01T00:00:00.000Z',
    });

    // export the JSON back to YAML
    const yamlOutDir = join(tmp, 'yaml-back');
    await runExport({
      inputs: [join(jsonOutDir, 't1.task.json')],
      outDir: yamlOutDir,
      stdout: new StringSink(),
      stderr: new StringSink(),
    });
    const back = readFileSync(join(yamlOutDir, 't1.yaml'), 'utf8');
    expect(back).toMatch(/id: t1/);
    expect(back).toMatch(/name: 任务一/);
    expect(back).toMatch(/type: click/);
  });
});
