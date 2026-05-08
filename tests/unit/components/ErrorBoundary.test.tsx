import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

const { notificationErrorMock } = vi.hoisted(() => ({
  notificationErrorMock: vi.fn(),
}));

vi.mock('antd', () => ({
  Button: ({
    children,
    onClick,
  }: {
    children?: React.ReactNode;
    onClick?: () => void;
  }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
  Result: ({
    title,
    subTitle,
    extra,
  }: {
    title?: React.ReactNode;
    subTitle?: React.ReactNode;
    extra?: React.ReactNode;
  }) => (
    <section>
      <h1>{title}</h1>
      <p>{subTitle}</p>
      {extra}
    </section>
  ),
  notification: {
    error: notificationErrorMock,
  },
}));

import { ErrorBoundary } from '@renderer/shared/components/ErrorBoundary';

function ThrowOnRender() {
  throw new Error('boom');
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('shows notification and fallback when children crash', async () => {
    render(
      <ErrorBoundary>
        <ThrowOnRender />
      </ErrorBoundary>,
    );

    await waitFor(() => {
      expect(notificationErrorMock).toHaveBeenCalledWith(
        expect.objectContaining({
          message: '页面渲染出错',
          description: 'boom',
        }),
      );
    });

    expect(screen.getByText('页面渲染出错')).toBeDefined();
    expect(screen.getByText('boom')).toBeDefined();
  });
});
