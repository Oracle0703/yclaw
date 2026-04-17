import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('antd', () => {
  const Space = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  Space.displayName = 'MockSpace';
  Space.Compact = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  Space.Compact.displayName = 'MockSpaceCompact';

  const List = ({
    dataSource = [],
    renderItem,
  }: {
    dataSource?: Array<Record<string, unknown>>;
    renderItem: (item: Record<string, unknown>) => React.ReactNode;
  }) => <div>{dataSource.map((item) => React.createElement(React.Fragment, { key: String(item.id) }, renderItem(item)))}</div>;
  List.displayName = 'MockList';
  List.Item = ({
    children,
    actions,
  }: {
    children?: React.ReactNode;
    actions?: React.ReactNode[];
  }) => (
    <div>
      {children}
      {actions}
    </div>
  );
  List.Item.displayName = 'MockListItem';
  const ListItemMeta = ({
    title,
    description,
  }: {
    title?: React.ReactNode;
    description?: React.ReactNode;
  }) => (
    <div>
      <div>{title}</div>
      <div>{description}</div>
    </div>
  );
  ListItemMeta.displayName = 'MockListMeta';
  List.Item.Meta = ListItemMeta;

  return {
    Button: ({
      children,
      onClick,
      disabled,
    }: {
      children?: React.ReactNode;
      onClick?: () => void;
      disabled?: boolean;
    }) => (
      <button type="button" onClick={onClick} disabled={disabled}>
        {children}
      </button>
    ),
    Empty: ({ description }: { description?: React.ReactNode }) => <div>{description}</div>,
    Input: ({
      value,
      onChange,
      placeholder,
    }: {
      value?: string;
      onChange?: (event: { target: { value: string } }) => void;
      placeholder?: string;
    }) => (
      <input
        value={value ?? ''}
        placeholder={placeholder}
        onChange={(event) => onChange?.({ target: { value: event.target.value } })}
      />
    ),
    List,
    Popconfirm: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    Space,
    Tag: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
    Typography: {
      Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
    },
    message: {
      success: vi.fn(),
      error: vi.fn(),
    },
  };
});

import { TemplateManager } from '@renderer/entries/automation/components/TemplateManager';
import { IPC_CHANNELS } from '@shared/constants';

describe('TemplateManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(window.electronAPI.invoke).mockImplementation(async (channel: string) => {
      if (channel === IPC_CHANNELS.TEMPLATE_LIST) {
        return {
          success: true,
          data: [
            {
              id: 'template-1',
              name: '价格采集',
              fields: [{ name: 'price', selector: '.price', attribute: 'textContent' }],
              createdAt: '2026-04-15T00:00:00.000Z',
              updatedAt: '2026-04-15T00:00:00.000Z',
            },
          ],
        };
      }

      return { success: true, data: null };
    });
  });

  it('loads existing templates on mount', async () => {
    render(<TemplateManager onSelectTemplate={vi.fn()} />);

    expect(await screen.findByText('价格采集')).toBeDefined();
    expect(window.electronAPI.invoke).toHaveBeenCalledTimes(1);
  });

  it('notifies selection when a template is chosen', async () => {
    const onSelectTemplate = vi.fn();
    render(<TemplateManager onSelectTemplate={onSelectTemplate} />);

    await screen.findByText('价格采集');
    fireEvent.click(screen.getByRole('button', { name: /使用模板/ }));

    expect(onSelectTemplate).toHaveBeenCalledWith('template-1');
  });

  it('ignores stale template responses after saving refreshes the list', async () => {
    let resolveInitialList: (value: unknown) => void = () => {};
    let resolveRefreshList: (value: unknown) => void = () => {};
    let listCallCount = 0;

    vi.mocked(window.electronAPI.invoke).mockImplementation(async (channel: string) => {
      if (channel === IPC_CHANNELS.TEMPLATE_SAVE) {
        return { success: true, data: null };
      }

      if (channel !== IPC_CHANNELS.TEMPLATE_LIST) {
        return { success: true, data: null };
      }

      listCallCount += 1;
      if (listCallCount === 1) {
        return new Promise((resolve) => {
          resolveInitialList = resolve;
        }) as never;
      }

      return new Promise((resolve) => {
        resolveRefreshList = resolve;
      }) as never;
    });

    render(
      <TemplateManager
        onSelectTemplate={vi.fn()}
        draftFields={[{ name: 'price', selector: '.price', attribute: 'textContent' }]}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('输入模板名称'), {
      target: { value: '最新模板' },
    });
    fireEvent.click(screen.getByRole('button', { name: /保存模板/ }));

    await waitFor(() => {
      expect(window.electronAPI.invoke).toHaveBeenCalledWith(IPC_CHANNELS.TEMPLATE_SAVE, {
        name: '最新模板',
        fields: [{ name: 'price', selector: '.price', attribute: 'textContent' }],
      });
    });

    await waitFor(() => {
      expect(listCallCount).toBe(2);
    });

    await act(async () => {
      resolveRefreshList({
        success: true,
        data: [
          {
            id: 'template-new',
            name: '最新模板',
            fields: [{ name: 'price', selector: '.price', attribute: 'textContent' }],
            createdAt: '2026-04-15T00:01:00.000Z',
            updatedAt: '2026-04-15T00:01:00.000Z',
          },
        ],
      });
    });

    expect(await screen.findByText('最新模板')).toBeDefined();

    await act(async () => {
      resolveInitialList({
        success: true,
        data: [
          {
            id: 'template-old',
            name: '旧模板',
            fields: [{ name: 'title', selector: '.title', attribute: 'textContent' }],
            createdAt: '2026-04-15T00:00:00.000Z',
            updatedAt: '2026-04-15T00:00:00.000Z',
          },
        ],
      });
    });

    await waitFor(() => {
      expect(screen.queryByText('旧模板')).toBeNull();
    });
    expect(screen.getByText('最新模板')).toBeDefined();
  });
});
