const KNOWN_ELECTRON_STDERR_NOISE = [
  /network_change_notifier_win\.cc:\d+\] WSALookupServiceBegin failed with: 10108$/,
];

function shouldSuppressElectronStderrLine(line: string): boolean {
  const normalized = line.replace(/\r?\n$/, '');
  return KNOWN_ELECTRON_STDERR_NOISE.some((pattern) => pattern.test(normalized));
}

export interface ElectronStderrFilter {
  push(chunk: string): void;
  flush(): void;
}

export function createElectronStderrFilter(write: (line: string) => void): ElectronStderrFilter {
  let buffer = '';

  function emitCompleteLines(): void {
    const parts = buffer.split(/\n/);
    buffer = parts.pop() ?? '';

    for (const part of parts) {
      const line = `${part}\n`;
      if (!shouldSuppressElectronStderrLine(line)) {
        write(line);
      }
    }
  }

  return {
    push(chunk: string): void {
      buffer += chunk;
      emitCompleteLines();
    },
    flush(): void {
      if (!buffer) {
        return;
      }

      if (!shouldSuppressElectronStderrLine(buffer)) {
        write(buffer);
      }
      buffer = '';
    },
  };
}
