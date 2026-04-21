import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';

vi.mock('antd', () => ({
  Card: ({ title, children }: { title?: React.ReactNode; children?: React.ReactNode }) => (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  ),
  Col: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Row: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Statistic: ({ title, value }: { title?: React.ReactNode; value?: React.ReactNode }) => (
    <div>
      <span>{title}</span>
      <strong>{value}</strong>
    </div>
  ),
}));

import { OpsSummary } from '@renderer/entries/automation/components/OpsSummary';

describe('OpsSummary', () => {
  it('renders execution summary metrics', () => {
    render(
      <OpsSummary
        summary={{
          queued: 3,
          running: 2,
          failed: 1,
          waitingIntervention: 4,
        }}
      />,
    );

    expect(screen.getByText('执行总览')).toBeDefined();
    expect(screen.getByText('待执行')).toBeDefined();
    expect(screen.getByText('3')).toBeDefined();
  });

  it('renders acceptance metrics when provided', () => {
    render(
      <OpsSummary
        summary={{
          queued: 3,
          running: 2,
          failed: 1,
          waitingIntervention: 4,
        }}
        acceptanceMetrics={[
          {
            key: 'taskSuccessRate',
            label: '任务执行成功率',
            value: 0.92,
            target: 0.9,
            unit: 'ratio',
            passed: true,
          },
        ]}
      />,
    );

    expect(screen.getByText('任务执行成功率：92.0% / 目标 90.0%')).toBeDefined();
  });
});
