import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { IndicatorResult, IndicatorType, OHLCVData } from '@shared/types';
import { IPC_CHANNELS } from '@shared/constants';

const { invokeMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
}));

vi.mock('@ant-design/icons', () => ({
  SearchOutlined: () => <span>search</span>,
}));

vi.mock('antd', () => ({
  Alert: ({
    message,
    description,
  }: {
    message?: React.ReactNode;
    description?: React.ReactNode;
  }) => (
    <div>
      <div>{message}</div>
      <div>{description}</div>
    </div>
  ),
  Checkbox: {
    Group: ({
      options,
      value,
      onChange,
    }: {
      options: Array<{ label: string; value: string }>;
      value?: string[];
      onChange?: (values: string[]) => void;
    }) => (
      <div>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value?.includes(option.value)}
            onClick={() => onChange?.([option.value])}
          >
            {option.label}
          </button>
        ))}
      </div>
    ),
  },
  Col: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Input: ({
    value,
    onChange,
    onPressEnter,
    placeholder,
  }: {
    value?: string;
    onChange?: (event: { target: { value: string } }) => void;
    onPressEnter?: () => void;
    placeholder?: string;
  }) => (
    <input
      aria-label={placeholder}
      value={value ?? ''}
      placeholder={placeholder}
      onChange={(event) => onChange?.({ target: { value: event.target.value } })}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          onPressEnter?.();
        }
      }}
    />
  ),
  Row: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Segmented: ({
    options,
    value,
    onChange,
  }: {
    options: Array<{ label: string; value: string }>;
    value?: string;
    onChange?: (value: string) => void;
  }) => (
    <div>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange?.(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  ),
  Skeleton: () => <div>loading chart</div>,
  Space: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Tag: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  Typography: {
    Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
    Title: ({ children }: { children?: React.ReactNode }) => <strong>{children}</strong>,
  },
}));

vi.mock('@ant-design/pro-components', () => ({
  ProCard: ({ children, title }: { children?: React.ReactNode; title?: React.ReactNode }) => (
    <section>
      {title ? <h2>{title}</h2> : null}
      {children}
    </section>
  ),
}));

vi.mock('@renderer/shared/components/PageShell', () => ({
  PageShell: ({
    children,
    extra,
    title,
  }: {
    children: React.ReactNode;
    extra: React.ReactNode;
    title: React.ReactNode;
  }) => (
    <div>
      <h1>{title}</h1>
      <div>{extra}</div>
      <div>{children}</div>
    </div>
  ),
}));

vi.mock('@renderer/entries/stock/components/KLineChart', () => ({
  KLineChart: ({ data }: { data: OHLCVData[] }) => (
    <div>chart latest:{data.at(-1)?.close ?? 'empty'}</div>
  ),
}));

vi.mock('@renderer/shared/hooks', () => ({
  useIpc: () => ({
    invoke: invokeMock,
  }),
  useIpcEvent: vi.fn(),
}));

import StockApp from '@renderer/entries/stock/App';

function createSeries(baseClose: number): OHLCVData[] {
  return [
    { time: 1000, open: baseClose - 1, high: baseClose + 1, low: baseClose - 2, close: baseClose, volume: 100 },
    { time: 2000, open: baseClose, high: baseClose + 2, low: baseClose - 1, close: baseClose + 1, volume: 120 },
  ];
}

function createIndicator(type: IndicatorType, data: OHLCVData[]): IndicatorResult {
  return {
    type,
    values: data.map((point) => point.close),
  };
}

describe('Stock App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invokeMock.mockImplementation(async (channel: string, payload?: { type?: IndicatorType; data?: OHLCVData[] }) => {
      if (channel === IPC_CHANNELS.STOCK_INDICATOR_CALC) {
        return createIndicator(payload?.type ?? 'MA', payload?.data ?? []);
      }
      return createSeries(100);
    });
  });

  it('ignores stale stock data responses after symbol changes', async () => {
    let resolveAaplData: (value: OHLCVData[]) => void = () => {};
    let resolveMsftData: (value: OHLCVData[]) => void = () => {};
    let stockDataCallCount = 0;

    invokeMock.mockImplementation((channel: string, payload?: { type?: IndicatorType; data?: OHLCVData[] }) => {
      if (channel === IPC_CHANNELS.STOCK_INDICATOR_CALC) {
        return Promise.resolve(createIndicator(payload?.type ?? 'MA', payload?.data ?? []));
      }

      if (channel !== IPC_CHANNELS.STOCK_DATA) {
        return Promise.resolve(null);
      }

      stockDataCallCount += 1;
      if (stockDataCallCount === 1) {
        return new Promise((resolve) => {
          resolveAaplData = resolve;
        });
      }

      return new Promise((resolve) => {
        resolveMsftData = resolve;
      });
    });

    render(<StockApp />);

    fireEvent.change(screen.getByPlaceholderText('股票代码'), {
      target: { value: 'MSFT' },
    });

    await waitFor(() => {
      expect(stockDataCallCount).toBe(2);
    });

    await act(async () => {
      resolveMsftData(createSeries(200));
    });

    expect(await screen.findByText('201.00 USD')).toBeDefined();

    await act(async () => {
      resolveAaplData(createSeries(100));
    });

    await waitFor(() => {
      expect(screen.queryByText('101.00 USD')).toBeNull();
    });
    expect(screen.getByText('201.00 USD')).toBeDefined();
  });
});
