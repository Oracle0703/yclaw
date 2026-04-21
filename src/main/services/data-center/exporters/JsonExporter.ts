import fs from 'fs';
import path from 'path';
import type { ExtractionResult } from '@shared/types';
import type { DataExporter } from '../DataExportService';

export class JsonExporter implements DataExporter {
  async export(input: {
    records: ExtractionResult[];
    targetConfig: Record<string, unknown>;
    fileName: string;
  }): Promise<{ outputPath: string; resultCount: number }> {
    const directory = String(input.targetConfig.directory ?? process.cwd());
    const outputPath = path.join(directory, `${input.fileName}.json`);

    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(input.records, null, 2), 'utf8');
    return { outputPath, resultCount: input.records.length };
  }
}
