import { startEmbeddedMcpHttpServer, type EmbeddedMcpHttpHandle } from './startEmbeddedHttpServer';
import { createCliMcpRuntime } from './createCliMcpServer';

export interface ServeMcpHttpOptions {
  host?: string;
  port?: number;
  path?: string;
  token?: string;
  stdout?: {
    write: (chunk: string) => unknown;
  };
  stderr?: {
    write: (chunk: string) => unknown;
  };
}

export async function serveMcpHttp(options: ServeMcpHttpOptions = {}): Promise<void> {
  const runtime = createCliMcpRuntime();
  let handle: EmbeddedMcpHttpHandle | null = null;
  let settled = false;
  let currentResolve: (() => void) | null = null;
  let currentReject: ((error: unknown) => void) | null = null;

  const onSigint = async () => {
    await finish();
  };

  const onSigterm = async () => {
    await finish();
  };

  const finish = async (error?: unknown) => {
    if (settled) {
      return;
    }
    settled = true;

    process.off('SIGINT', onSigint);
    process.off('SIGTERM', onSigterm);

    try {
      if (handle) {
        await handle.close();
      }
      runtime.close();
      if (error !== undefined) {
        currentReject?.(error);
        return;
      }
      currentResolve?.();
    } catch (closeError) {
      currentReject?.(closeError);
    }
  };

  const promise = new Promise<void>((resolve, reject) => {
    currentResolve = resolve;
    currentReject = reject;

    void (async () => {
      try {
        handle = await startEmbeddedMcpHttpServer({
          createServer: runtime.createServer,
          host: options.host,
          port: options.port,
          path: options.path,
          token: options.token,
        });

        const output = options.stderr ?? options.stdout ?? process.stderr;
        output.write(`yclaw mcp serve: listening on ${handle.endpoint}\n`);

        process.once('SIGINT', onSigint);
        process.once('SIGTERM', onSigterm);
      } catch (error) {
        await finish(error);
      }
    })();
  });

  return promise;
}
