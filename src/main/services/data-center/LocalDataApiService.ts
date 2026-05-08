import http, { type IncomingMessage, type ServerResponse } from 'http';
import { URL } from 'url';
import type { DataPage, DataDataset, DataExportJob, ExtractionResult } from '@shared/types';
import type { DataCenterApiStatusResponse } from '@shared/types/ipc';

interface StartOptions {
  host?: string;
  port?: number;
}

interface LocalDataApiServiceOptions {
  dataCenterService?: {
    listResults(query: { page: number; pageSize: number; taskId?: string; batchId?: string }): Promise<
      DataPage<ExtractionResult>
    > | DataPage<ExtractionResult>;
  };
  datasetService?: {
    listDatasets(): DataDataset[];
  };
  dataExportService?: {
    listJobs(query?: { page?: number; pageSize?: number; status?: DataExportJob['status'] }): DataPage<DataExportJob>;
  };
  tokenVerifier?: {
    verifyToken(token: string, scopes: string[]): boolean;
  };
}

export class LocalDataApiService {
  private readonly dataCenterService?: LocalDataApiServiceOptions['dataCenterService'];
  private readonly datasetService?: LocalDataApiServiceOptions['datasetService'];
  private readonly dataExportService?: LocalDataApiServiceOptions['dataExportService'];
  private readonly tokenVerifier?: LocalDataApiServiceOptions['tokenVerifier'];
  private server: http.Server | null = null;
  private status: DataCenterApiStatusResponse = {
    running: false,
  };

  constructor(options: LocalDataApiServiceOptions = {}) {
    this.dataCenterService = options.dataCenterService;
    this.datasetService = options.datasetService;
    this.dataExportService = options.dataExportService;
    this.tokenVerifier = options.tokenVerifier;
  }

  getStatus(): DataCenterApiStatusResponse {
    return this.status;
  }

  async start(options: StartOptions = {}): Promise<DataCenterApiStatusResponse> {
    if (this.server) {
      return this.status;
    }

    const host = options.host ?? '127.0.0.1';
    const requestedPort = options.port ?? 3941;

    this.server = http.createServer((request, response) => {
      void this.handleRequest(request, response);
    });

    await new Promise<void>((resolve, reject) => {
      const onError = (error: Error) => {
        this.server?.off('error', onError);
        reject(error);
      };
      this.server?.once('error', onError);
      this.server?.listen(requestedPort, host, () => {
        this.server?.off('error', onError);
        resolve();
      });
    });

    const address = this.server.address();
    const port =
      typeof address === 'object' && address !== null ? address.port : requestedPort;

    this.status = {
      running: true,
      host,
      port,
    };
    return this.status;
  }

  async stop(): Promise<DataCenterApiStatusResponse> {
    if (this.server) {
      await new Promise<void>((resolve, reject) => {
        this.server?.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
      this.server = null;
    }

    this.status = {
      running: false,
    };
    return this.status;
  }

  private async handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');

    try {
      if (request.method !== 'GET') {
        this.writeJson(response, 405, { error: 'method_not_allowed' });
        return;
      }

      if (url.pathname === '/health') {
        this.writeJson(response, 200, { ok: true, ...this.status });
        return;
      }

      if (!this.isAuthorized(request)) {
        this.writeJson(response, 401, { error: 'unauthorized' });
        return;
      }

      if (url.pathname === '/datasets') {
        this.writeJson(response, 200, {
          items: this.datasetService?.listDatasets() ?? [],
        });
        return;
      }

      if (url.pathname === '/results') {
        const page = parsePositiveInt(url.searchParams.get('page'), 1);
        const pageSize = parsePositiveInt(url.searchParams.get('pageSize'), 20);
        const result = await this.dataCenterService?.listResults({
          page,
          pageSize,
          taskId: url.searchParams.get('taskId') ?? undefined,
          batchId: url.searchParams.get('batchId') ?? undefined,
        });
        this.writeJson(response, 200, result ?? { items: [], total: 0, page, pageSize });
        return;
      }

      if (url.pathname === '/exports') {
        const page = parsePositiveInt(url.searchParams.get('page'), 1);
        const pageSize = parsePositiveInt(url.searchParams.get('pageSize'), 20);
        this.writeJson(response, 200, this.dataExportService?.listJobs({ page, pageSize }) ?? {
          items: [],
          total: 0,
          page,
          pageSize,
        });
        return;
      }

      this.writeJson(response, 404, { error: 'not_found' });
    } catch (error) {
      this.writeJson(response, 500, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private writeJson(response: ServerResponse, statusCode: number, payload: unknown): void {
    response.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify(payload));
  }

  private isAuthorized(request: IncomingMessage): boolean {
    if (!this.tokenVerifier) {
      return true;
    }

    const authorization = request.headers.authorization ?? '';
    const token = Array.isArray(authorization) ? authorization[0] : authorization;
    const normalizedToken = token.startsWith('Bearer ') ? token.slice('Bearer '.length) : '';

    return Boolean(normalizedToken && this.tokenVerifier.verifyToken(normalizedToken, ['results:read']));
  }
}

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}
