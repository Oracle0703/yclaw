# Data Quality Scoring and Insights Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend Data Center quality from simple scan/rule toggles into configurable rule compilation, explainable scoring, and batch insight summaries.

**Architecture:** Keep `DataQualityService` as orchestration, split evaluation into focused helpers: `RuleCompiler`, `ResultRuleEngine`, `ScoreCalculator`, `BatchInsightService`, `BatchComparator`, and `InsightSummaryBuilder`. Persist findings and batch insights in SQLite so UI can query repeatable results.

**Tech Stack:** Electron main process, React renderer, TypeScript, SQLite via `better-sqlite3`, Vitest, Ant Design / ProComponents.

---

## 1. File Map

### 1.1 New Files

- `src/main/services/data-center/quality/RuleCompiler.ts`: compile persisted rule configs into executable predicates.
- `src/main/services/data-center/quality/ResultRuleEngine.ts`: run compiled rules against extraction results.
- `src/main/services/data-center/quality/FingerprintBuilder.ts`: create stable duplicate fingerprints from full payloads or field subsets.
- `src/main/services/data-center/quality/ScoreCalculator.ts`: compute result and batch scores from findings.
- `src/main/services/data-center/quality/BatchInsightService.ts`: create batch-level insight DTOs.
- `src/main/services/data-center/quality/BatchComparator.ts`: compare current batch score with previous batch score.
- `src/main/services/data-center/quality/InsightSummaryBuilder.ts`: build deterministic summary text.
- `src/main/services/repositories/DataQualityFindingRepository.ts`: persist and query findings.
- `src/main/services/repositories/DataQualityBatchInsightRepository.ts`: persist and query batch insights.
- `tests/unit/services/data-center/quality/RuleCompiler.test.ts`
- `tests/unit/services/data-center/quality/ResultRuleEngine.test.ts`
- `tests/unit/services/data-center/quality/ScoreCalculator.test.ts`
- `tests/unit/services/data-center/quality/BatchInsightService.test.ts`
- `tests/unit/services/repositories/DataQualityFindingRepository.test.ts`
- `tests/unit/services/repositories/DataQualityBatchInsightRepository.test.ts`

### 1.2 Modified Files

- `src/shared/types/data-center.ts`
- `src/shared/types/index.ts`
- `src/shared/types/ipc.ts`
- `src/shared/constants/channels.ts`
- `src/main/services/DatabaseService.ts`
- `src/main/services/data-center/DataQualityService.ts`
- `src/main/services/repositories/DataQualityRuleRepository.ts`
- `src/main/services/repositories/index.ts`
- `src/main/ipc/data-center-handlers.ts`
- `src/main/app.ts`
- `src/renderer/shared/api/dataCenter.ts`
- `src/renderer/entries/data-center/components/QualityRulePanel.tsx`
- `tests/unit/services/data-center/DataQualityService.test.ts`
- `tests/unit/services/repositories/DataQualityRuleRepository.test.ts`
- `tests/integration/ipc/data-center-handlers.test.ts`
- `tests/unit/renderer/data-center/App.test.tsx`
- `docs/specs/data-center-v1.md`
- `docs/overview/current-status.md`

---

## 2. Tasks

### Task 1: Shared Quality Types and Rule Schema

**Files:**
- Modify: `src/shared/types/data-center.ts`
- Modify: `src/shared/types/index.ts`
- Modify: `src/shared/types/ipc.ts`
- Test: `tests/unit/services/data-center/quality/RuleCompiler.test.ts`

- [ ] **Step 1: Write failing type-driven rule compiler test**

```ts
import { describe, expect, it } from 'vitest';
import { RuleCompiler } from '@main/services/data-center/quality/RuleCompiler';
import type { DataQualityRuleConfig } from '@shared/types';

const baseRule: DataQualityRuleConfig = {
  ruleId: 'price-range',
  name: '价格范围',
  description: '价格必须大于 0',
  severity: 'error',
  enabled: true,
  params: {},
  createdAt: '2026-04-22T00:00:00.000Z',
  updatedAt: '2026-04-22T00:00:00.000Z',
  ruleType: 'number-range',
  scope: 'result',
  fieldPath: 'data.price',
  operator: 'gt',
  expectedValue: 0,
  weight: 1,
};

describe('RuleCompiler', () => {
  it('compiles a number-range rule into an executable predicate', () => {
    const compiled = new RuleCompiler().compile([baseRule]);
    const [rule] = compiled;

    expect(rule.evaluate({ data: { price: -1 }, status: 'normal' })).toEqual({
      matched: true,
      fieldPath: 'data.price',
      actualValue: -1,
      expectedValue: 0,
    });
  });
});
```

- [ ] **Step 2: Run test and verify failure**

Run: `npm test -- tests/unit/services/data-center/quality/RuleCompiler.test.ts`

Expected: FAIL because `RuleCompiler` and advanced rule fields do not exist.

- [ ] **Step 3: Add shared types**

Add to `src/shared/types/data-center.ts`:

```ts
export type DataQualityRuleType =
  | 'status'
  | 'field-exists'
  | 'field-empty'
  | 'number-range'
  | 'string-match'
  | 'duplicate'
  | 'group';

export type DataQualityRuleScope = 'result' | 'batch';

export type DataQualityOperator =
  | 'exists'
  | 'isEmpty'
  | 'eq'
  | 'ne'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'in'
  | 'contains'
  | 'regex';

export interface DataQualityRuleGroup {
  mode: 'all' | 'any';
  conditions: Array<{
    fieldPath?: string;
    operator: DataQualityOperator;
    expectedValue?: unknown;
  }>;
}
```

Extend `DataQualityRuleConfig` with optional fields:

```ts
ruleType?: DataQualityRuleType;
scope?: DataQualityRuleScope;
fieldPath?: string | null;
operator?: DataQualityOperator | null;
expectedValue?: unknown;
weight?: number;
group?: DataQualityRuleGroup | null;
```

- [ ] **Step 4: Re-export new types**

Add the new type exports in `src/shared/types/index.ts`.

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`

Expected: PASS after types are complete.

---

### Task 2: Persist Advanced Rule Fields

**Files:**
- Modify: `src/main/services/DatabaseService.ts`
- Modify: `src/main/services/repositories/DataQualityRuleRepository.ts`
- Test: `tests/unit/services/repositories/DataQualityRuleRepository.test.ts`

- [ ] **Step 1: Extend repository test**

Add a test that saves and lists a rule with advanced fields:

```ts
it('saves advanced rule fields', () => {
  const db = new Database(':memory:');
  const databaseService = new DatabaseService({ database: db });
  databaseService.migrate();
  const repository = new DataQualityRuleRepository(databaseService);

  repository.saveRule({
    ruleId: 'price-range',
    name: '价格范围',
    description: '价格必须大于 0',
    severity: 'error',
    enabled: true,
    params: {},
    ruleType: 'number-range',
    scope: 'result',
    fieldPath: 'data.price',
    operator: 'gt',
    expectedValue: 0,
    weight: 1.5,
    group: null,
    createdAt: '2026-04-22T00:00:00.000Z',
    updatedAt: '2026-04-22T00:00:01.000Z',
  });

  expect(repository.listRules()[0]).toMatchObject({
    ruleId: 'price-range',
    ruleType: 'number-range',
    fieldPath: 'data.price',
    operator: 'gt',
    expectedValue: 0,
    weight: 1.5,
  });
});
```

- [ ] **Step 2: Run test and verify failure**

Run: `npm test -- tests/unit/services/repositories/DataQualityRuleRepository.test.ts`

Expected: FAIL because advanced columns are not persisted.

- [ ] **Step 3: Add migration version 10**

In `DatabaseService.runMigrations`, add columns if missing:

```ts
if (currentDbVersion < 10) {
  const addColumn = (column: string, ddl: string) => {
    if (!this.hasColumn('data_quality_rules', column)) {
      this.db!.exec(`ALTER TABLE data_quality_rules ADD COLUMN ${ddl}`);
    }
  };
  addColumn('rule_type', 'rule_type TEXT');
  addColumn('scope', 'scope TEXT');
  addColumn('field_path', 'field_path TEXT');
  addColumn('operator', 'operator TEXT');
  addColumn('expected_value_json', 'expected_value_json TEXT');
  addColumn('weight', 'weight REAL NOT NULL DEFAULT 1');
  addColumn('group_json', 'group_json TEXT');
  this.db!.exec('INSERT INTO migrations (version) VALUES (10);');
}
```

- [ ] **Step 4: Update repository mapper**

Include new columns in `SELECT`, `INSERT OR REPLACE`, and row mapper.

- [ ] **Step 5: Run repository test**

Run: `npm test -- tests/unit/services/repositories/DataQualityRuleRepository.test.ts`

Expected: PASS.

---

### Task 3: Implement Rule Compiler and Result Rule Engine

**Files:**
- Create: `src/main/services/data-center/quality/RuleCompiler.ts`
- Create: `src/main/services/data-center/quality/ResultRuleEngine.ts`
- Create: `src/main/services/data-center/quality/FingerprintBuilder.ts`
- Test: `tests/unit/services/data-center/quality/RuleCompiler.test.ts`
- Test: `tests/unit/services/data-center/quality/ResultRuleEngine.test.ts`

- [ ] **Step 1: Write failing engine test**

```ts
import { describe, expect, it } from 'vitest';
import { RuleCompiler } from '@main/services/data-center/quality/RuleCompiler';
import { ResultRuleEngine } from '@main/services/data-center/quality/ResultRuleEngine';

describe('ResultRuleEngine', () => {
  it('returns findings for field and group rules', () => {
    const compiler = new RuleCompiler();
    const rules = compiler.compile([
      {
        ruleId: 'missing-price',
        name: '缺少价格',
        description: '价格不能为空',
        severity: 'warning',
        enabled: true,
        params: {},
        ruleType: 'field-exists',
        scope: 'result',
        fieldPath: 'data.price',
        operator: 'exists',
        weight: 1,
        createdAt: '2026-04-22T00:00:00.000Z',
        updatedAt: '2026-04-22T00:00:00.000Z',
      },
    ]);

    const findings = new ResultRuleEngine().evaluate([
      { id: 'r1', taskId: 't1', batchId: 'b1', data: {}, status: 'normal', createdAt: '2026-04-22T00:00:00.000Z' },
    ], rules);

    expect(findings).toEqual([
      expect.objectContaining({ ruleId: 'missing-price', resultId: 'r1', fieldPath: 'data.price' }),
    ]);
  });
});
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npm test -- tests/unit/services/data-center/quality/RuleCompiler.test.ts tests/unit/services/data-center/quality/ResultRuleEngine.test.ts`

Expected: FAIL because files are missing.

- [ ] **Step 3: Implement `RuleCompiler`**

Implement `compile(rules)` and helper `getByPath(value, fieldPath)`.

- [ ] **Step 4: Implement `ResultRuleEngine`**

Return `DataQualityFinding[]` with `scoreImpact` based on severity and weight.

- [ ] **Step 5: Implement `FingerprintBuilder`**

Support full payload and selected field paths.

- [ ] **Step 6: Run tests**

Run: `npm test -- tests/unit/services/data-center/quality/RuleCompiler.test.ts tests/unit/services/data-center/quality/ResultRuleEngine.test.ts`

Expected: PASS.

---

### Task 4: Add Findings Persistence and Score Calculator

**Files:**
- Create: `src/main/services/repositories/DataQualityFindingRepository.ts`
- Create: `src/main/services/data-center/quality/ScoreCalculator.ts`
- Modify: `src/main/services/DatabaseService.ts`
- Modify: `src/main/services/repositories/index.ts`
- Test: `tests/unit/services/repositories/DataQualityFindingRepository.test.ts`
- Test: `tests/unit/services/data-center/quality/ScoreCalculator.test.ts`

- [ ] **Step 1: Write failing score test**

```ts
import { describe, expect, it } from 'vitest';
import { ScoreCalculator } from '@main/services/data-center/quality/ScoreCalculator';

describe('ScoreCalculator', () => {
  it('calculates explainable result score from findings', () => {
    const score = new ScoreCalculator().calculateResultScore('r1', [
      { id: 'f1', ruleId: 'failed-result', resultId: 'r1', severity: 'error', scoreImpact: 20 },
      { id: 'f2', ruleId: 'missing-price', resultId: 'r1', severity: 'warning', scoreImpact: 8 },
    ] as never);

    expect(score).toEqual({
      resultId: 'r1',
      score: 72,
      grade: 'watch',
      deductions: [
        { ruleId: 'failed-result', points: 20 },
        { ruleId: 'missing-price', points: 8 },
      ],
    });
  });
});
```

- [ ] **Step 2: Add migration version 11 for findings**

Create `data_quality_findings` with fields from the design.

- [ ] **Step 3: Implement finding repository**

Methods:

```ts
saveFindings(scanId: string, findings: DataQualityFinding[]): void;
listFindingsByBatch(batchId: string): DataQualityFinding[];
clearFindingsByBatch(batchId: string): void;
```

- [ ] **Step 4: Implement `ScoreCalculator`**

Methods:

```ts
calculateResultScore(resultId: string, findings: DataQualityFinding[]): DataQualityResultScore;
calculateBatchScore(batchId: string, resultScores: DataQualityResultScore[]): DataQualityBatchScore;
```

- [ ] **Step 5: Run tests**

Run: `npm test -- tests/unit/services/repositories/DataQualityFindingRepository.test.ts tests/unit/services/data-center/quality/ScoreCalculator.test.ts`

Expected: PASS.

---

### Task 5: Add Batch Insight Service

**Files:**
- Create: `src/main/services/repositories/DataQualityBatchInsightRepository.ts`
- Create: `src/main/services/data-center/quality/BatchInsightService.ts`
- Create: `src/main/services/data-center/quality/BatchComparator.ts`
- Create: `src/main/services/data-center/quality/InsightSummaryBuilder.ts`
- Modify: `src/main/services/DatabaseService.ts`
- Test: `tests/unit/services/repositories/DataQualityBatchInsightRepository.test.ts`
- Test: `tests/unit/services/data-center/quality/BatchInsightService.test.ts`

- [ ] **Step 1: Write failing batch insight test**

```ts
import { describe, expect, it } from 'vitest';
import { BatchInsightService } from '@main/services/data-center/quality/BatchInsightService';

describe('BatchInsightService', () => {
  it('summarizes score, rates and top rules for a batch', () => {
    const insight = new BatchInsightService().buildInsight({
      batchId: 'batch-1',
      taskId: 'task-1',
      results: [
        { id: 'r1', status: 'failed' },
        { id: 'r2', status: 'normal' },
      ] as never,
      findings: [
        { ruleId: 'failed-result', severity: 'error', fieldPath: 'status' },
      ] as never,
      batchScore: { score: 80, grade: 'good' } as never,
      previousBatchScore: { score: 92, grade: 'excellent' } as never,
    });

    expect(insight).toMatchObject({
      batchId: 'batch-1',
      score: 80,
      failedRate: 0.5,
      scoreTrendHint: 'down',
    });
    expect(insight.summary).toContain('下降');
  });
});
```

- [ ] **Step 2: Add migration version 12 for batch insights**

Create `data_quality_batch_insights` with fields from the design.

- [ ] **Step 3: Implement repository and service**

Repository methods:

```ts
saveInsight(insight: DataQualityBatchInsight): void;
getInsight(batchId: string): DataQualityBatchInsight | null;
listInsightsByTask(taskId: string): DataQualityBatchInsight[];
```

- [ ] **Step 4: Implement comparator and summary builder**

Comparator returns `up | flat | down` using score difference thresholds: `>= 3`, `<= -3`, else `flat`.

- [ ] **Step 5: Run tests**

Run: `npm test -- tests/unit/services/repositories/DataQualityBatchInsightRepository.test.ts tests/unit/services/data-center/quality/BatchInsightService.test.ts`

Expected: PASS.

---

### Task 6: Wire DataQualityService, IPC, and UI

**Files:**
- Modify: `src/main/services/data-center/DataQualityService.ts`
- Modify: `src/main/ipc/data-center-handlers.ts`
- Modify: `src/main/app.ts`
- Modify: `src/shared/constants/channels.ts`
- Modify: `src/renderer/shared/api/dataCenter.ts`
- Modify: `src/renderer/entries/data-center/components/QualityRulePanel.tsx`
- Test: `tests/unit/services/data-center/DataQualityService.test.ts`
- Test: `tests/integration/ipc/data-center-handlers.test.ts`
- Test: `tests/unit/renderer/data-center/App.test.tsx`

- [ ] **Step 1: Add failing orchestration test**

Assert `DataQualityService.scan({ query: { batchId } })` returns `batchScore` and `batchInsight`.

- [ ] **Step 2: Add IPC tests**

Assert handlers register:

```ts
IPC_CHANNELS.DATA_CENTER_QUALITY_SCORE_BATCH
IPC_CHANNELS.DATA_CENTER_QUALITY_INSIGHT_BATCH
```

- [ ] **Step 3: Add renderer test**

Assert quality page renders:

- `质量评分`
- `批次洞察`
- `Top 规则`
- summary text

- [ ] **Step 4: Implement wiring**

Add channels:

```ts
DATA_CENTER_QUALITY_SCORE_BATCH: 'datacenter:quality:score:batch'
DATA_CENTER_QUALITY_INSIGHT_BATCH: 'datacenter:quality:insight:batch'
```

- [ ] **Step 5: Run focused tests**

Run:

```bash
npm test -- tests/unit/services/data-center/DataQualityService.test.ts tests/integration/ipc/data-center-handlers.test.ts tests/unit/renderer/data-center/App.test.tsx
```

Expected: PASS.

---

### Task 7: Docs and Final Verification

**Files:**
- Modify: `docs/specs/data-center-v1.md`
- Modify: `docs/overview/current-status.md`
- Modify: `docs/design/data-center.md`
- Modify: `docs/plans/data-center-v1.md`

- [ ] **Step 1: Update spec**

Add acceptance bullets for:

- advanced rule config
- explainable score
- batch insight

- [ ] **Step 2: Update status overview**

Change Data Center status from “质量规则启停” to “复杂规则、评分、批次洞察基础版”。

- [ ] **Step 3: Run verification**

Run:

```bash
npm run typecheck
npm test -- tests/unit/services/data-center/DataQualityService.test.ts tests/integration/ipc/data-center-handlers.test.ts tests/unit/renderer/data-center/App.test.tsx
npm run lint
```

Expected:

- `typecheck`: PASS
- focused tests: PASS
- `lint`: 0 errors; existing warnings may remain if unrelated

---

## 3. Execution Order

1. Task 1: Shared types
2. Task 2: Rule persistence
3. Task 3: Rule compiler and engine
4. Task 4: Findings and scoring
5. Task 5: Batch insight
6. Task 6: Service / IPC / UI wiring
7. Task 7: Docs and verification

## 4. Scope Review

- Covers complex rule composition through condition fields and `all/any` groups.
- Covers explainable result and batch scoring.
- Covers batch insight summaries and previous-batch comparison.
- Does not cover visual drag-and-drop rule builder.
- Does not cover ML scoring or long-term trend charts.
