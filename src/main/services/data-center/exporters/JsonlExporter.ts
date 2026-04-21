import fs from 'fs';
import path from 'path';
import type { ExtractionResult } from '@shared/types';
import type { DataExporter } from '../DataExportService';

export class JsonlExporter implements DataExporter {
  async export(input: {
    records: ExtractionResult[];
    targetConfig: Record<string, unknown>;
    fileName: string;
  }): Promise<{ outputPath: string; resultCount: number }> {
    const directory = String(input.targetConfig.directory ?? process.cwd());
    const outputPath = path.join(directory, `${input.fileName}.jsonl`);

    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(outputPath, input.records.map((item) => JSON.stringify(item)).join('\n'), 'utf8');
    return { outputPath, resultCount: input.records.length };
  }
}
