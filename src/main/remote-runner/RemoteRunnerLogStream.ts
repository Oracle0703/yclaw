import type { RemoteExecutionLog } from '@shared/types/remote-runner';

export function parseSseLogChunk(chunk: string): RemoteExecutionLog[] {
  return chunk
    .split('\n\n')
    .map((event) => event.trim())
    .filter(Boolean)
    .flatMap((event) => {
      const dataLine = event.split('\n').find((line) => line.startsWith('data:'));
      if (!dataLine) {
        return [];
      }

      return [JSON.parse(dataLine.slice('data:'.length).trim()) as RemoteExecutionLog];
    });
}
