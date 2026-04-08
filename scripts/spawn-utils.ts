export interface SpawnSpec {
  command: string;
  args: string[];
  shell?: boolean;
}

export function buildSpawnSpec(
  command: string,
  args: string[],
  isWindows = process.platform === 'win32',
): SpawnSpec {
  if (isWindows && /\.(cmd|bat)$/i.test(command)) {
    return {
      command,
      args,
      shell: true,
    };
  }

  return { command, args };
}
