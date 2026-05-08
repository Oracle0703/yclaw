import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const rootDir = resolve(__dirname, '../../..');

describe('AdminPageLayout styles', () => {
  it('keeps the sidebar menu vertically scrollable without a horizontal scrollbar', () => {
    const css = readFileSync(
      resolve(rootDir, 'src/renderer/shared/styles/globals.css'),
      'utf-8',
    );

    const menuRule = css.match(/\.yclaw-admin-shell \.yclaw-admin-menu\s*\{[^}]+\}/)?.[0] ?? '';

    expect(menuRule).toContain('overflow-y: auto;');
    expect(menuRule).toContain('overflow-x: hidden;');
  });

  it('keeps the content header scoped to the right side and the sidebar flush to the top', () => {
    const css = readFileSync(
      resolve(rootDir, 'src/renderer/shared/styles/globals.css'),
      'utf-8',
    );

    const rootRule = css.match(/:root\s*\{[^}]+\}/)?.[0] ?? '';
    const headerRule =
      css.match(/\.yclaw-admin-header\.ant-layout-header\s*\{[^}]+\}/)?.[0] ?? '';
    const menuRule = css.match(/\.yclaw-admin-shell \.yclaw-admin-menu\s*\{[^}]+\}/)?.[0] ?? '';

    expect(rootRule).toContain('--yclaw-admin-header-height: 44px;');
    expect(headerRule).toContain('min-height: var(--yclaw-admin-header-height);');
    expect(menuRule).toContain('padding-top: 8px;');
    expect(css).not.toContain('.yclaw-admin-topbar');
    expect(css).not.toContain('.yclaw-admin-sider-header');
  });
});
