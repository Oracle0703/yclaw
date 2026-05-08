import fs from 'fs';
import path from 'path';
import type { ExtractionResult } from '@shared/types';
import type { DataExporter } from '../DataExportService';

export class CsvExporter implements DataExporter {
  async export(input: {
    records: ExtractionResult[];
    targetConfig: Record<string, unknown>;
    fileName: string;
  }): Promise<{ outputPath: string; resultCount: number }> {
    const directory = String(input.targetConfig.directory ?? process.cwd());
    const outputPath = path.join(directory, `${input.fileName}.csv`);
    const fieldNames = Array.from(new Set(input.records.flatMap((item) => Object.keys(item.data))));
    const escapeCell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const header = ['id', 'taskId', 'batchId', ...fieldNames].map(escapeCell).join(',');
    const rows = input.records.map((item) =>
      [item.id, item.taskId, item.batchId, ...fieldNames.map((field) => item.data[field] ?? '')]
        .map(escapeCell)
        .join(','),
    );

    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(outputPath, [header, ...rows].join('\n'), 'utf8');
    return { outputPath, resultCount: input.records.length };
  }
}
