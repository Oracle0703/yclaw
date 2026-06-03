import { describe, expect, it } from 'vitest';
import type { DataQualityScanResult } from '@shared/types';
import {
  buildVerificationQualityScanInput,
  formatQualityGrade,
  summarizeVerificationQuality,
} from '@renderer/entries/hot-monitor/verification';

describe('hot monitor verification helpers', () => {
  it('builds a quality scan input for the new hot batch', () => {
    expect(buildVerificationQualityScanInput('task-1', 'batch-new')).toEqual({
      query: {
        taskId: 'task-1',
        batchId: 'batch-new',
      },
      limit: 200,
    });
  });

  it('formats quality grades for Chinese UI', () => {
    expect(formatQualityGrade('excellent')).toBe('优秀');
    expect(formatQualityGrade('good')).toBe('良好');
    expect(formatQualityGrade('watch')).toBe('关注');
    expect(formatQualityGrade('poor')).toBe('较差');
    expect(formatQualityGrade(undefined)).toBe('-');
  });

  it('summarizes quality score and top rules from batch insight first', () => {
    const scan: DataQualityScanResult = {
      scannedAt: '2026-05-19T04:00:00.000Z',
      totalResults: 12,
      issueCount: 3,
      affectedResults: 2,
      rules: [
        {
          ruleId: 'failed-result',
          name: '失败结果',
          severity: 'error',
          hitCount: 1,
          sampleResultIds: ['result-1'],
        },
      ],
      issues: [],
      batchScore: {
        batchId: 'batch-new',
        score: 86,
        grade: 'good',
      },
      batchInsight: {
        id: 'insight-1',
        batchId: 'batch-new',
        taskId: 'task-1',
        score: 86,
        grade: 'good',
        totalResults: 12,
        issueCount: 3,
        affectedResults: 2,
        failedRate: 0.08,
        suspiciousRate: 0.16,
        duplicateRate: 0,
        topRules: [
          { ruleId: 'empty-data', count: 2 },
          { ruleId: 'failed-result', count: 1 },
        ],
        topFields: [{ fieldPath: 'payload.title', count: 2 }],
        severityBreakdown: { warning: 2, error: 1 },
        statusBreakdown: { succeeded: 11, failed: 1 },
        scoreTrendHint: 'flat',
        summary: '批次质量良好，但仍有空数据问题。',
        createdAt: '2026-05-19T04:00:00.000Z',
      },
    };

    expect(summarizeVerificationQuality(scan)).toEqual({
      scoreLabel: '86',
      gradeLabel: '良好',
      issueCount: 3,
      affectedResults: 2,
      totalResults: 12,
      topRules: [
        { ruleId: 'empty-data', count: 2 },
        { ruleId: 'failed-result', count: 1 },
      ],
      summary: '批次质量良好，但仍有空数据问题。',
    });
  });

  it('falls back to rule summaries when batch insight has no top rules', () => {
    const scan: DataQualityScanResult = {
      scannedAt: '2026-05-19T04:00:00.000Z',
      totalResults: 4,
      issueCount: 1,
      affectedResults: 1,
      rules: [
        {
          ruleId: 'duplicate-payload',
          name: '重复内容',
          severity: 'warning',
          hitCount: 1,
          sampleResultIds: ['result-2'],
        },
      ],
      issues: [],
    };

    expect(summarizeVerificationQuality(scan)).toEqual({
      scoreLabel: '-',
      gradeLabel: '-',
      issueCount: 1,
      affectedResults: 1,
      totalResults: 4,
      topRules: [{ ruleId: 'duplicate-payload', count: 1 }],
      summary: '暂无批次洞察摘要。',
    });
  });

  it('does not crash when scan rules or counters are missing', () => {
    const scan = {
      scannedAt: '2026-05-19T04:00:00.000Z',
      issues: [],
    } as unknown as DataQualityScanResult;

    expect(summarizeVerificationQuality(scan)).toEqual({
      scoreLabel: '-',
      gradeLabel: '-',
      issueCount: 0,
      affectedResults: 0,
      totalResults: 0,
      topRules: [],
      summary: '暂无批次洞察摘要。',
    });
  });
});
