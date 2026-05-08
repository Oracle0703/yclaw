import { createRemoteRunnerServer } from '@runner/daemon';

export interface RunnerDaemonArgs {
  port: number;
  token: string;
  workspaceId: string;
}

export interface RunnerDaemonResult {
  exitCode: number;
  output?: string;
  error?: string;
}

export async function runRunnerDaemon(args: RunnerDaemonArgs): Promise<RunnerDaemonResult> {
  const server = await createRemoteRunnerServer(args);
  return {
    exitCode: 0,
    output: `YClaw Remote Runner listening on ${server.url}`,
  };
}
