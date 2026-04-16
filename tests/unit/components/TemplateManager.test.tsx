import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
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
  });

  it('notifies selection when a template is chosen', async () => {
    const onSelectTemplate = vi.fn();
    render(<TemplateManager onSelectTemplate={onSelectTemplate} />);

    await screen.findByText('价格采集');
    fireEvent.click(screen.getByRole('button', { name: /使用模板/ }));

    expect(onSelectTemplate).toHaveBeenCalledWith('template-1');
  });
});
