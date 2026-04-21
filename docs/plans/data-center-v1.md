# Data Center V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a first usable `数据中心` module that turns extraction results into queryable assets and persistent export jobs, then extends it with datasets, webhook delivery, local read-only API, and quality / scoring / insight hooks.

**Architecture:** Add a new `data-center` renderer entry and a main-process aggregation layer around existing `ResultService` / `BatchService` / `ExecutionLogService`. Keep `automation`'s lightweight result panel intact, and add dedicated repositories, IPC channels, and background-safe export services for the new module.

**Tech Stack:** Electron, React, Vite multi-entry, Ant Design / ProComponents, better-sqlite3, Vitest

---

## 0. Working Rules

- 当前仓库指令不要求自动 `git commit`，本计划不包含提交步骤。
- 所有新增文档放在 `docs/plans/`、`docs/specs/`、`docs/design/` 规范目录下。
- 所有实现步骤默认先写测试，再补最小实现，再跑定向测试。
- 每完成一个任务后，执行该任务列出的测试命令，再进入下一个任务。

## 1. File Map

### 1.1 New Files

- `src/shared/types/data-center.ts`：数据中心共享类型、查询对象、导出任务、数据集、Webhook、API Token
- `src/main/services/repositories/DataExportJobRepository.ts`：导出任务与审计持久化
- `src/main/services/repositories/DataDatasetRepository.ts`：数据集持久化
- `src/main/services/repositories/DataWebhookTargetRepository.ts`：Webhook 目标持久化
- `src/main/services/repositories/DataApiTokenRepository.ts`：API Token 持久化
- `src/main/services/data-center/DataCenterService.ts`：聚合查询与总览
- `src/main/services/data-center/DataExportService.ts`：导出任务创建、执行、重试
- `src/main/services/data-center/DatasetService.ts`：数据集增删改查
- `src/main/services/data-center/LocalDataApiService.ts`：本地只读 HTTP API 生命周期
- `src/main/services/data-center/WebhookDeliveryService.ts`：Webhook 投递与签名
- `src/main/services/data-center/DataQualityService.ts`：质量扫描服务与内置规则
- `src/main/services/data-center/exporters/CsvExporter.ts`
- `src/main/services/data-center/exporters/JsonExporter.ts`
- `src/main/services/data-center/exporters/JsonlExporter.ts`
- `src/main/services/data-center/exporters/WebhookExporter.ts`
- `src/main/ipc/data-center-handlers.ts`：数据中心 IPC 注册
- `src/renderer/shared/api/dataCenter.ts`：渲染端 API 封装
- `src/renderer/entries/data-center/index.html`
- `src/renderer/entries/data-center/main.tsx`
- `src/renderer/entries/data-center/App.tsx`
- `src/renderer/entries/data-center/components/DataOverview.tsx`
- `src/renderer/entries/data-center/components/ResultAssetTable.tsx`
- `src/renderer/entries/data-center/components/ResultDetailDrawer.tsx`
- `src/renderer/entries/data-center/components/ExportJobTable.tsx`
- `src/renderer/entries/data-center/components/DatasetPanel.tsx`
- `src/renderer/entries/data-center/components/ApiAccessPanel.tsx`
- `src/renderer/entries/data-center/components/QualityRulePanel.tsx`
- `tests/unit/services/data-center/DataCenterService.test.ts`
- `tests/unit/services/data-center/DataExportService.test.ts`
- `tests/unit/services/data-center/DatasetService.test.ts`
- `tests/unit/services/data-center/LocalDataApiService.test.ts`
- `tests/unit/services/repositories/DataExportJobRepository.test.ts`
- `tests/unit/services/repositories/DataDatasetRepository.test.ts`
- `tests/unit/services/repositories/DataWebhookTargetRepository.test.ts`
- `tests/unit/services/repositories/DataApiTokenRepository.test.ts`
- `tests/integration/ipc/data-center-handlers.test.ts`
- `tests/unit/renderer/data-center/App.test.tsx`

### 1.2 Modified Files

- `src/shared/constants/channels.ts`
- `src/shared/types/ipc.ts`
- `src/shared/types/index.ts`
- `src/main/services/DatabaseService.ts`
- `src/main/services/repositories/index.ts`
- `src/main/services/index.ts`
- `src/main/windows/preload.ts`
- `src/main/app.ts`
- `src/renderer/shared/hooks/useIpc.ts`
- `src/renderer/shared/components/AdminPageLayout.tsx`
- `src/renderer/shared/components/CommandPalette/CommandPalette.tsx`
- `src/main/ai/tools/navigateTools.ts`
- `src/renderer/entries/workbench/App.tsx`
- `src/renderer/entries/workbench/pages/Home.tsx`
- `scripts/build-feature-pack.ts`
- `package.json`
- `docs/README.md`
- `docs/specs/data-center-v1.md`
- `docs/overview/current-status.md`

---

### Task 1: Shared Types, Channels, and SQLite Migrations

**Files:**
- Create: `src/shared/types/data-center.ts`
- Modify: `src/shared/types/index.ts`
- Modify: `src/shared/types/ipc.ts`
- Modify: `src/shared/constants/channels.ts`
- Modify: `src/main/services/DatabaseService.ts`
- Test: `tests/unit/services/repositories/DataExportJobRepository.test.ts`
- Test: `tests/unit/services/repositories/DataDatasetRepository.test.ts`
- Test: `tests/unit/services/repositories/DataWebhookTargetRepository.test.ts`
- Test: `tests/unit/services/repositories/DataApiTokenRepository.test.ts`

- [ ] **Step 1: Write failing repository tests for new tables**

```ts
import { describe, expect, it } from 'vitest';
import { DatabaseService } from '@main/services/DatabaseService';

describe('data-center migrations', () => {
  it('creates export, dataset, webhook and token tables', () => {
    const database = new DatabaseService(':memory:');
    database.open();

    const tables = database
      .all<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'")
      .map((row) => row.name);

    expect(tables).toContain('data_export_jobs');
    expect(tables).toContain('data_export_audits');
    expect(tables).toContain('data_datasets');
    expect(tables).toContain('data_webhook_targets');
    expect(tables).toContain('data_api_tokens');
  });
});
```

- [ ] **Step 2: Run the migration-focused test and verify failure**

Run: `npm test -- tests/unit/services/repositories/DataExportJobRepository.test.ts`

Expected: FAIL with missing table assertions or missing repository file errors.

- [ ] **Step 3: Add shared data-center types and IPC payloads**

```ts
export interface DataCenterResultQuery {
  taskId?: string;
  batchId?: string;
  status?: Array<'normal' | 'suspicious' | 'failed' | 'ignored'>;
  createdFrom?: string;
  createdTo?: string;
  keyword?: string;
  page: number;
  pageSize: number;
}

export interface DataExportJob {
  id: string;
  name: string;
  datasetId?: string | null;
  format: 'csv' | 'json' | 'jsonl';
  targetType: 'file' | 'webhook' | 'local-api';
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'retrying' | 'cancelled';
  resultCount: number;
  outputPath?: string | null;
  retryCount: number;
  error?: string | null;
  createdAt: string;
  updatedAt: string;
}
```

- [ ] **Step 4: Add migration version 8 for data-center tables**

```ts
if (currentDbVersion < 8) {
  this.db!.exec(`
    CREATE TABLE IF NOT EXISTS data_export_jobs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      dataset_id TEXT,
      query_json TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_config_json TEXT NOT NULL,
      format TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      result_count INTEGER NOT NULL DEFAULT 0,
      output_path TEXT,
      error TEXT,
      retry_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      started_at TEXT,
      finished_at TEXT
    );

    CREATE TABLE IF NOT EXISTS data_export_audits (
      id TEXT PRIMARY KEY,
      export_job_id TEXT NOT NULL,
      attempt INTEGER NOT NULL,
      status TEXT NOT NULL,
      target_type TEXT NOT NULL,
      request_summary TEXT,
      response_summary TEXT,
      error TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (export_job_id) REFERENCES data_export_jobs(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS data_datasets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      query_json TEXT NOT NULL,
      field_mapping_json TEXT,
      default_format TEXT NOT NULL DEFAULT 'jsonl',
      api_enabled INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS data_webhook_targets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      headers_json TEXT,
      secret_hash TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      timeout_ms INTEGER NOT NULL DEFAULT 10000,
      max_retries INTEGER NOT NULL DEFAULT 3,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS data_api_tokens (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      token_hash TEXT NOT NULL,
      scopes_json TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      last_used_at TEXT,
      created_at TEXT NOT NULL,
      revoked_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_data_export_jobs_status
      ON data_export_jobs(status, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_data_export_audits_job
      ON data_export_audits(export_job_id, attempt);
    CREATE INDEX IF NOT EXISTS idx_data_datasets_updated
      ON data_datasets(updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_data_webhook_targets_enabled
      ON data_webhook_targets(enabled, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_data_api_tokens_enabled
      ON data_api_tokens(enabled, created_at DESC);

    INSERT INTO migrations (version) VALUES (8);
  `);
}
```

- [ ] **Step 5: Run repository tests again**

Run: `npm test -- tests/unit/services/repositories/DataExportJobRepository.test.ts tests/unit/services/repositories/DataDatasetRepository.test.ts`

Expected: PASS for table existence checks.

---

### Task 2: Repositories and Aggregation Services

**Files:**
- Create: `src/main/services/repositories/DataExportJobRepository.ts`
- Create: `src/main/services/repositories/DataDatasetRepository.ts`
- Create: `src/main/services/repositories/DataWebhookTargetRepository.ts`
- Create: `src/main/services/repositories/DataApiTokenRepository.ts`
- Create: `src/main/services/data-center/DataCenterService.ts`
- Create: `src/main/services/data-center/DatasetService.ts`
- Modify: `src/main/services/repositories/index.ts`
- Modify: `src/main/services/index.ts`
- Test: `tests/unit/services/data-center/DataCenterService.test.ts`
- Test: `tests/unit/services/data-center/DatasetService.test.ts`
- Test: `tests/unit/services/repositories/DataExportJobRepository.test.ts`

- [ ] **Step 1: Write failing unit tests for result aggregation**

```ts
import { describe, expect, it, vi } from 'vitest';
import { DataCenterService } from '@main/services/data-center/DataCenterService';

describe('DataCenterService', () => {
  it('builds result detail with logs and batch context', async () => {
    const service = new DataCenterService({
      resultService: { listResults: vi.fn(), getResult: vi.fn(() => ({ id: 'r1', taskId: 't1', batchId: 'b1', data: {}, status: 'normal', createdAt: '2026-04-21T00:00:00.000Z' })) },
      batchService: { getBatch: vi.fn(() => ({ id: 'b1', taskId: 't1', status: 'success', stepResults: [], createdAt: '2026-04-21T00:00:00.000Z' })) },
      executionLogService: { query: vi.fn(() => [{ id: 1, taskId: 't1', batchId: 'b1', level: 'info', message: 'ok', createdAt: '2026-04-21T00:00:01.000Z' }]) },
      dataExportJobRepository: { listByResultId: vi.fn(() => []) },
    });

    const detail = await service.getResultDetail('r1');
    expect(detail.result.id).toBe('r1');
    expect(detail.batch?.id).toBe('b1');
    expect(detail.logs).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run the service test and verify failure**

Run: `npm test -- tests/unit/services/data-center/DataCenterService.test.ts`

Expected: FAIL because `DataCenterService` does not exist yet.

- [ ] **Step 3: Implement repository classes with JSON mapping helpers**

```ts
export class DataDatasetRepository {
  constructor(private readonly executor: Executor) {}

  listDatasets(): DataDataset[] {
    return this.executor
      .all<DataDatasetRow>('SELECT * FROM data_datasets ORDER BY updated_at DESC')
      .map(mapDatasetRow);
  }

  saveDataset(dataset: DataDataset): void {
    this.executor.run(
      `INSERT OR REPLACE INTO data_datasets (
        id, name, description, query_json, field_mapping_json, default_format, api_enabled, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        dataset.id,
        dataset.name,
        dataset.description ?? null,
        JSON.stringify(dataset.query),
        dataset.fieldMapping ? JSON.stringify(dataset.fieldMapping) : null,
        dataset.defaultFormat,
        dataset.apiEnabled ? 1 : 0,
        dataset.createdAt,
        dataset.updatedAt,
      ],
    );
  }
}
```

- [ ] **Step 4: Implement `DataCenterService` and `DatasetService`**

```ts
export class DataCenterService {
  async getOverview(): Promise<DataCenterOverview> {
    const recentResults = this.resultService.listResults({});
    const recentExports = this.dataExportJobRepository.listJobs({ page: 1, pageSize: 10 });
    return {
      totalResults: recentResults.length,
      suspiciousResults: recentResults.filter((item) => item.status === 'suspicious').length,
      failedExports: recentExports.items.filter((item) => item.status === 'failed').length,
      recentExports: recentExports.items,
    };
  }
}
```

- [ ] **Step 5: Add pagination contract to repository return values**

```ts
export interface DataPage<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
```

- [ ] **Step 6: Run service and repository tests**

Run: `npm test -- tests/unit/services/data-center/DataCenterService.test.ts tests/unit/services/data-center/DatasetService.test.ts tests/unit/services/repositories/DataDatasetRepository.test.ts`

Expected: PASS.

---

### Task 3: Exporters and Persistent Export Jobs

**Files:**
- Create: `src/main/services/data-center/DataExportService.ts`
- Create: `src/main/services/data-center/exporters/CsvExporter.ts`
- Create: `src/main/services/data-center/exporters/JsonExporter.ts`
- Create: `src/main/services/data-center/exporters/JsonlExporter.ts`
- Modify: `src/main/services/ResultService.ts`
- Test: `tests/unit/services/data-center/DataExportService.test.ts`
- Test: `tests/unit/services/ResultService.test.ts`

- [ ] **Step 1: Write failing tests for export job creation and retry**

```ts
import { describe, expect, it, vi } from 'vitest';
import { DataExportService } from '@main/services/data-center/DataExportService';

describe('DataExportService', () => {
  it('creates and completes a jsonl file export job', async () => {
    const service = new DataExportService({
      resultService: { listResults: vi.fn(() => [{ id: 'r1', taskId: 't1', batchId: 'b1', data: { price: 1 }, status: 'normal', createdAt: '2026-04-21T00:00:00.000Z' }]) },
      exportJobRepository: fakeExportJobRepository(),
      exporters: { jsonl: { export: vi.fn(async () => ({ outputPath: '/tmp/out.jsonl', resultCount: 1 })) } },
      now: () => new Date('2026-04-21T00:00:00.000Z'),
    });

    const job = await service.createAndRun({
      name: 'daily-jsonl',
      query: { page: 1, pageSize: 100 },
      format: 'jsonl',
      targetType: 'file',
      targetConfig: { directory: '/tmp' },
    });

    expect(job.status).toBe('succeeded');
    expect(job.outputPath).toBe('/tmp/out.jsonl');
  });
});
```

- [ ] **Step 2: Run the export service test and verify failure**

Run: `npm test -- tests/unit/services/data-center/DataExportService.test.ts`

Expected: FAIL because `DataExportService` and exporters are missing.

- [ ] **Step 3: Extend `ResultService` to support richer result queries and JSONL export**

```ts
export interface ResultQuery {
  taskId?: string;
  batchId?: string;
  status?: ExtractionResult['status'][];
  createdFrom?: string;
  createdTo?: string;
  page?: number;
  pageSize?: number;
}

exportResults(query: ResultQuery, format: 'csv' | 'json' | 'jsonl'): string {
  const results = this.listResults(query);
  if (format === 'jsonl') {
    fs.writeFileSync(outputPath, results.map((item) => JSON.stringify(item)).join('\n'), 'utf8');
    return outputPath;
  }
}
```

- [ ] **Step 4: Implement exporter classes with a shared output contract**

```ts
export interface FileExportResult {
  outputPath: string;
  resultCount: number;
}

export class JsonlExporter {
  async export(input: DataExportInput): Promise<FileExportResult> {
    const outputPath = path.join(input.directory, `${input.fileName}.jsonl`);
    fs.writeFileSync(outputPath, input.records.map((record) => JSON.stringify(record)).join('\n'), 'utf8');
    return { outputPath, resultCount: input.records.length };
  }
}
```

- [ ] **Step 5: Implement `DataExportService` state transitions**

```ts
const job = this.exportJobRepository.createJob({
  id: randomUUID(),
  status: 'pending',
  retryCount: 0,
  createdAt: now,
  updatedAt: now,
});

this.exportJobRepository.markRunning(job.id, now);
try {
  const output = await exporter.export({ records, directory, fileName: job.id });
  return this.exportJobRepository.markSucceeded(job.id, {
    resultCount: output.resultCount,
    outputPath: output.outputPath,
    finishedAt: this.now().toISOString(),
  });
} catch (error) {
  return this.exportJobRepository.markFailed(job.id, String(error), this.now().toISOString());
}
```

- [ ] **Step 6: Run export and result tests**

Run: `npm test -- tests/unit/services/data-center/DataExportService.test.ts tests/unit/services/ResultService.test.ts`

Expected: PASS, including JSONL coverage and retry-state assertions.

---

### Task 4: IPC Handlers, Preload, and App Composition

**Files:**
- Create: `src/main/ipc/data-center-handlers.ts`
- Modify: `src/main/app.ts`
- Modify: `src/main/windows/preload.ts`
- Modify: `src/shared/constants/channels.ts`
- Modify: `src/shared/types/ipc.ts`
- Create: `src/renderer/shared/api/dataCenter.ts`
- Modify: `src/renderer/shared/hooks/useIpc.ts`
- Test: `tests/integration/ipc/data-center-handlers.test.ts`
- Test: `tests/unit/services/AppIpcIntegration.test.ts`

- [ ] **Step 1: Write failing IPC integration tests**

```ts
import { describe, expect, it } from 'vitest';

describe('data-center handlers', () => {
  it('registers overview and export channels', async () => {
    const { invoke } = createDataCenterIpcHarness();
    const response = await invoke('datacenter:overview');
    expect(response.success).toBe(true);
    expect(response.data).toHaveProperty('totalResults');
  });
});
```

- [ ] **Step 2: Run the IPC test and verify failure**

Run: `npm test -- tests/integration/ipc/data-center-handlers.test.ts`

Expected: FAIL because channels are not registered.

- [ ] **Step 3: Add new IPC channels and payload types**

```ts
DATA_CENTER_OVERVIEW: 'datacenter:overview',
DATA_CENTER_RESULTS_LIST: 'datacenter:results:list',
DATA_CENTER_RESULTS_DETAIL: 'datacenter:results:detail',
DATA_CENTER_EXPORTS_CREATE: 'datacenter:exports:create',
DATA_CENTER_EXPORTS_LIST: 'datacenter:exports:list',
DATA_CENTER_EXPORTS_RETRY: 'datacenter:exports:retry',
DATA_CENTER_DATASETS_LIST: 'datacenter:datasets:list',
DATA_CENTER_DATASETS_SAVE: 'datacenter:datasets:save',
DATA_CENTER_API_STATUS: 'datacenter:api:status',
DATA_CENTER_API_START: 'datacenter:api:start',
DATA_CENTER_API_STOP: 'datacenter:api:stop',
DATA_CENTER_EXPORT_UPDATED: 'datacenter:exportupdated',
```

- [ ] **Step 4: Register handlers in `src/main/app.ts`**

```ts
registerDataCenterHandlers({
  ipcController: this.ipcController,
  eventBus: this.eventBus,
  dataCenterService: this.dataCenterService,
  dataExportService: this.dataExportService,
  datasetService: this.datasetService,
  localDataApiService: this.localDataApiService,
});
```

- [ ] **Step 5: Expose preload and renderer API**

```ts
const api = {
  taskAsCode: createTaskAsCodeApi({ invoke: electronAPI.invoke, on: electronAPI.on }),
  remoteRunner: createRemoteRunnerApi({ invoke: electronAPI.invoke }),
  runnerScheduler: createRunnerSchedulerApi({ invoke: electronAPI.invoke }),
  datacenter: createDataCenterApi({ invoke: electronAPI.invoke, on: electronAPI.on }),
};
```

- [ ] **Step 6: Extend `useIpc()` with `dataCenter` helpers**

```ts
const dataCenter = useMemo(
  () => createDataCenterApi({ invoke, on: window.electronAPI.on }),
  [invoke],
);

return { invoke, automation, featurePackages, dataCenter };
```

- [ ] **Step 7: Run IPC and app composition tests**

Run: `npm test -- tests/integration/ipc/data-center-handlers.test.ts tests/unit/services/AppIpcIntegration.test.ts`

Expected: PASS.

---

### Task 5: Renderer Entry, Menu Wiring, and Build Integration

**Files:**
- Create: `src/renderer/entries/data-center/index.html`
- Create: `src/renderer/entries/data-center/main.tsx`
- Create: `src/renderer/entries/data-center/App.tsx`
- Modify: `src/renderer/entries/workbench/App.tsx`
- Modify: `src/renderer/shared/components/AdminPageLayout.tsx`
- Modify: `src/renderer/shared/components/CommandPalette/CommandPalette.tsx`
- Modify: `src/renderer/entries/workbench/pages/Home.tsx`
- Modify: `src/main/ai/tools/navigateTools.ts`
- Modify: `vite.config.ts`
- Modify: `package.json`
- Test: `tests/unit/renderer/data-center/App.test.tsx`

- [ ] **Step 1: Write failing renderer smoke test**

```tsx
import { render, screen } from '@testing-library/react';
import App from '@renderer/entries/data-center/App';

describe('Data Center App', () => {
  it('renders overview and result asset tabs', () => {
    render(<App />);
    expect(screen.getByText('数据总览')).toBeInTheDocument();
    expect(screen.getByText('结果资产')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the renderer test and verify failure**

Run: `npm test -- tests/unit/renderer/data-center/App.test.tsx`

Expected: FAIL because the entry does not exist.

- [ ] **Step 3: Create the entry files using existing `createEntry` pattern**

```tsx
import { createEntry } from '@renderer/shared/createEntry';
import App from './App';

createEntry(App);
```

- [ ] **Step 4: Add the menu item, command palette action, and workbench shortcut**

```tsx
{
  key: '/data-center',
  label: '数据中心',
  icon: <DatabaseOutlined />,
}
```

- [ ] **Step 5: Add route and feature-pack build support**

```tsx
<Route
  path="/data-center"
  element={
    <FeatureModulePage
      moduleId="data-center"
      title="数据中心"
      description="结果资产、导出任务、本地接口与数据质量统一收口。"
    />
  }
/>
```

```json
"build:feature:data-center": "tsx scripts/build-feature-pack.ts data-center",
"build:features": "npm run build:feature:stock && npm run build:feature:automation && npm run build:feature:data-center && npm run build:feature:plugin-center && tsx scripts/sync-feature-packs.ts"
```

- [ ] **Step 6: Extend `navigateTools.ts` valid modules**

```ts
const validModules = ['workbench', 'stock', 'automation', 'browser', 'data-center', 'plugin-center'];
```

- [ ] **Step 7: Run renderer and build-related tests**

Run: `npm test -- tests/unit/renderer/data-center/App.test.tsx`

Expected: PASS.

---

### Task 6: P0 UI — Overview, Result Assets, Details, and Export Jobs

**Files:**
- Create: `src/renderer/entries/data-center/components/DataOverview.tsx`
- Create: `src/renderer/entries/data-center/components/ResultAssetTable.tsx`
- Create: `src/renderer/entries/data-center/components/ResultDetailDrawer.tsx`
- Create: `src/renderer/entries/data-center/components/ExportJobTable.tsx`
- Modify: `src/renderer/entries/data-center/App.tsx`
- Modify: `src/renderer/entries/automation/components/ResultTable.tsx`
- Modify: `src/renderer/shared/styles/globals.css`
- Test: `tests/unit/renderer/data-center/App.test.tsx`

- [ ] **Step 1: Write failing UI test for detail drawer interaction**

```tsx
it('opens result detail drawer from asset table', async () => {
  render(<App />);
  await userEvent.click(screen.getByRole('button', { name: '查看详情' }));
  expect(screen.getByText('执行日志')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the UI test and verify failure**

Run: `npm test -- tests/unit/renderer/data-center/App.test.tsx`

Expected: FAIL because detail UI and data hooks are missing.

- [ ] **Step 3: Build the P0 shell with tabs**

```tsx
<Tabs
  items={[
    { key: 'overview', label: '数据总览', children: <DataOverview /> },
    { key: 'results', label: '结果资产', children: <ResultAssetTable /> },
    { key: 'exports', label: '导出任务', children: <ExportJobTable /> },
  ]}
/>
```

- [ ] **Step 4: Implement result asset filters and detail drawer**

```tsx
<Button type="link" onClick={() => setSelectedResultId(record.id)}>
  查看详情
</Button>
<ResultDetailDrawer resultId={selectedResultId} open={Boolean(selectedResultId)} onClose={() => setSelectedResultId(null)} />
```

- [ ] **Step 5: Replace one-click CSV export in automation with jump-to-data-center**

```tsx
<Button
  size="small"
  disabled={!taskId}
  onClick={() => navigate(`/data-center?taskId=${taskId}${batchId ? `&batchId=${batchId}` : ''}`)}
>
  打开数据中心
</Button>
```

- [ ] **Step 6: Keep a secondary quick export button only for backwards compatibility**

```tsx
<Button size="small" onClick={() => void automation.exportResults(taskId, batchId ?? undefined, 'csv')}>
  快速导出 CSV
</Button>
```

- [ ] **Step 7: Run renderer tests**

Run: `npm test -- tests/unit/renderer/data-center/App.test.tsx`

Expected: PASS with overview, result list, detail drawer, and export job table coverage.

---

### Task 7: P1 — Datasets, Webhooks, Retry Queue, and Local API

**Files:**
- Create: `src/main/services/data-center/WebhookDeliveryService.ts`
- Create: `src/main/services/data-center/LocalDataApiService.ts`
- Create: `src/main/services/data-center/exporters/WebhookExporter.ts`
- Create: `src/renderer/entries/data-center/components/DatasetPanel.tsx`
- Create: `src/renderer/entries/data-center/components/ApiAccessPanel.tsx`
- Modify: `src/main/services/data-center/DataExportService.ts`
- Modify: `src/renderer/entries/data-center/App.tsx`
- Test: `tests/unit/services/data-center/LocalDataApiService.test.ts`
- Test: `tests/unit/services/data-center/DataExportService.test.ts`

- [ ] **Step 1: Write failing tests for webhook retries and local API auth**

```ts
it('retries webhook delivery and stores audit rows', async () => {
  const service = new WebhookDeliveryService({
    fetchImpl: vi.fn().mockRejectedValueOnce(new Error('timeout')).mockResolvedValueOnce(new Response('{}', { status: 200 })),
    auditRepository: fakeAuditRepository(),
    now: () => new Date('2026-04-21T00:00:00.000Z'),
  });

  const result = await service.deliver({
    url: 'http://127.0.0.1:3000/hook',
    headers: {},
    payload: { event: 'export.succeeded' },
    maxRetries: 2,
  });

  expect(result.status).toBe('succeeded');
});
```

- [ ] **Step 2: Run the P1 tests and verify failure**

Run: `npm test -- tests/unit/services/data-center/LocalDataApiService.test.ts tests/unit/services/data-center/DataExportService.test.ts`

Expected: FAIL because webhook and API services are missing.

- [ ] **Step 3: Implement dataset CRUD and dataset-backed exports**

```ts
const dataset = this.datasetRepository.getDataset(input.datasetId);
const query = dataset ? dataset.query : input.query;
const records = await this.dataCenterService.listResults(query);
```

- [ ] **Step 4: Implement `WebhookDeliveryService` with HMAC signature support**

```ts
const signature = createHmac('sha256', secret).update(body).digest('hex');
const requestHeaders = Object.assign(
  { 'content-type': 'application/json', 'x-yclaw-signature': signature },
  headers,
);
const response = await this.fetchImpl(url, {
  method: 'POST',
  headers: requestHeaders,
  body,
  signal,
});
```

- [ ] **Step 5: Implement `LocalDataApiService` with Node `http` and token scopes**

```ts
if (!token || !this.tokenRepository.verifyToken(token, ['results:read'])) {
  response.writeHead(401).end(JSON.stringify({ error: 'unauthorized' }));
  return;
}
```

- [ ] **Step 6: Add P1 tabs and forms in renderer**

```tsx
{ key: 'datasets', label: '数据集', children: <DatasetPanel /> }
{ key: 'api', label: '开放接口', children: <ApiAccessPanel /> }
```

- [ ] **Step 7: Run P1 tests**

Run: `npm test -- tests/unit/services/data-center/LocalDataApiService.test.ts tests/unit/services/data-center/DataExportService.test.ts tests/integration/ipc/data-center-handlers.test.ts`

Expected: PASS with webhook retry, token verification, and dataset export coverage.

---

### Task 8: P1.5/P2 Hooks — Quality Scan, Insights, and AI/MCP Readiness

**Files:**
- Create: `src/main/services/data-center/DataQualityService.ts`
- Create: `src/renderer/entries/data-center/components/QualityRulePanel.tsx`
- Modify: `src/main/ipc/data-center-handlers.ts`
- Modify: `src/shared/constants/channels.ts`
- Modify: `src/shared/types/data-center.ts`
- Modify: `src/renderer/shared/api/dataCenter.ts`
- Modify: `src/main/ai/tools/navigateTools.ts`
- Modify: `src/main/ai/AIService.ts`
- Modify: `src/mcp/shared/types.ts`
- Modify: `docs/specs/data-center-v1.md`
- Modify: `docs/overview/current-status.md`
- Test: `tests/unit/services/data-center/DataQualityService.test.ts`
- Test: `tests/integration/ipc/data-center-handlers.test.ts`
- Test: `tests/unit/renderer/data-center/App.test.tsx`

- [x] **Step 1: Write failing tests for quality scan**

```ts
it('scans extraction results for empty, failed, suspicious and duplicate payload issues', async () => {
  const service = new DataQualityService({
    resultService: {
      listResults: () => [
        { id: 'r1', data: {}, status: 'normal' },
        { id: 'r2', data: { title: 'x' }, status: 'failed' },
      ],
    },
  });

  const scan = await service.scan();
  expect(scan.issueCount).toBeGreaterThan(0);
});
```

- [x] **Step 2: Run the quality test and verify failure**

Run: `npm test -- tests/unit/services/data-center/DataQualityService.test.ts tests/integration/ipc/data-center-handlers.test.ts tests/unit/renderer/data-center/App.test.tsx`

Expected: FAIL because `DataQualityService` and `datacenter:quality:scan` are missing and the UI is still a placeholder.

- [x] **Step 3: Implement scan result types and default rules**

```ts
export interface DataQualityScanResult {
  scannedAt: string;
  totalResults: number;
  issueCount: number;
  affectedResults: number;
  rules: DataQualityRuleSummary[];
  issues: DataQualityIssue[];
}
```

- [x] **Step 4: Wire quality scan IPC and renderer API**

```ts
ipcController.handle(IPC_CHANNELS.DATA_CENTER_QUALITY_SCAN, (payload) =>
  dataQualityService.scan(payload),
);
```

- [x] **Step 5: Add a placeholder-free quality UI panel**

```tsx
<Button type="primary" onClick={() => void scanQuality()}>
  立即扫描
</Button>
```

- [ ] **Step 6: Reserve AI/MCP quality skill registration points**

```ts
toolRegistry.register({
  id: 'dataCenter.searchResults',
  description: '搜索数据中心结果资产',
  execute: async (params) => this.dataCenterService.listResults(params as DataCenterResultQuery),
});
```

- [x] **Step 7: Run quality scan tests**

Run: `npm test -- tests/unit/services/data-center/DataQualityService.test.ts tests/integration/ipc/data-center-handlers.test.ts tests/unit/renderer/data-center/App.test.tsx`

Expected: PASS.

---

## 2. Docs and Acceptance Sync

### Task 9: Spec, README, and Status Write-back

**Files:**
- Create: `docs/specs/data-center-v1.md`
- Modify: `docs/README.md`
- Modify: `docs/overview/current-status.md`

- [ ] **Step 1: Add the acceptance spec file**

```md
# YClaw 数据中心 V1 规格

## 验收范围
- 独立菜单入口 `数据中心`
- 结果资产分页、详情、可疑标记
- CSV / JSON / JSONL 导出任务与历史
- 数据集、Webhook、本地 API
```

- [ ] **Step 2: Add README navigation entries**

Run edit in `docs/README.md` to add:

```md
- [specs/data-center-v1.md](specs/data-center-v1.md)：数据中心 V1 验收规格
- [plans/data-center-v1.md](plans/data-center-v1.md)：数据中心 V1 实施计划
```

- [ ] **Step 3: Write implementation status back to `current-status.md`**

Add one row under “规格 / 方案落地状态”:

```md
| `docs/specs/data-center-v1.md` | 计划中 | 结果资产、导出任务、数据集、Webhook、本地 API 进入专项实施计划 | 与自动化结果链路复用同一数据底座 |
```

- [ ] **Step 4: Verify markdown references**

Run: `rg -n "data-center-v1|data-center.md" docs`

Expected: All links resolve to existing docs.

---

## 3. Recommended Execution Order

1. Task 1
2. Task 2
3. Task 3
4. Task 4
5. Task 5
6. Task 6
7. Task 7
8. Task 8
9. Task 9

## 4. Verification Checklist

- `npm test -- tests/unit/services/repositories/DataExportJobRepository.test.ts`
- `npm test -- tests/unit/services/data-center/DataCenterService.test.ts`
- `npm test -- tests/unit/services/data-center/DataExportService.test.ts`
- `npm test -- tests/integration/ipc/data-center-handlers.test.ts`
- `npm test -- tests/unit/renderer/data-center/App.test.tsx`
- `npm run typecheck`
- `npm run lint`

## 5. Scope Review

- Covered P0: 新菜单、结果资产、详情、CSV/JSON/JSONL、导出任务历史。
- Covered P1: 数据集、Webhook、只读本地 API、Token、重试与审计。
- Covered P1.5: 数据质量一键扫描、规则命中、问题样例、规则启停持久化。
- 已完成 P1.5 基础版：质量评分、批次洞察、复杂规则数据结构预留、findings / insight 持久化。
- Reserved P2: 可视化复杂规则编排、长期趋势分析、AI/MCP 深度技能预留。
- Excluded by design: 云同步、团队权限、通用 BI 大屏、外网公开 API。
