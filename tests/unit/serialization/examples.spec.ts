import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseFile } from '@shared/serialization';

const EXAMPLES_DIR = join(__dirname, '..', '..', '..', 'examples', 'tasks');

describe('serialization · examples', () => {
  const files = readdirSync(EXAMPLES_DIR).filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'));

  it('discovers example yaml files', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)('parses %s as a valid TaskFile or TemplateFile', (name) => {
    const text = readFileSync(join(EXAMPLES_DIR, name), 'utf8');
    const file = parseFile(text, { filePath: name });
    expect(['Task', 'Template']).toContain(file.kind);
  });
});
