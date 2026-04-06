import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { AddressBar } from '@renderer/entries/browser/components/AddressBar';

describe('AddressBar', () => {
  const onNavigate = vi.fn();
  const onBack = vi.fn();
  const onForward = vi.fn();
  const onReload = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should display current URL', () => {
    render(
      <AddressBar
        url="https://example.com"
        canGoBack={true}
        canGoForward={false}
        onNavigate={onNavigate}
        onBack={onBack}
        onForward={onForward}
        onReload={onReload}
      />,
    );
    const input = screen.getByPlaceholderText('输入网址...');
    expect((input as HTMLInputElement).value).toBe('https://example.com');
  });

  it('should call onNavigate on Enter', () => {
    render(
      <AddressBar
        url=""
        canGoBack={false}
        canGoForward={false}
        onNavigate={onNavigate}
        onBack={onBack}
        onForward={onForward}
        onReload={onReload}
      />,
    );
    const input = screen.getByPlaceholderText('输入网址...');
    fireEvent.change(input, { target: { value: 'example.com' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onNavigate).toHaveBeenCalledWith('https://example.com');
  });

  it('should not prefix URLs that already have https://', () => {
    render(
      <AddressBar
        url=""
        canGoBack={false}
        canGoForward={false}
        onNavigate={onNavigate}
        onBack={onBack}
        onForward={onForward}
        onReload={onReload}
      />,
    );
    const input = screen.getByPlaceholderText('输入网址...');
    fireEvent.change(input, { target: { value: 'https://google.com' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onNavigate).toHaveBeenCalledWith('https://google.com');
  });

  it('should call onBack when back button clicked', () => {
    render(
      <AddressBar
        url=""
        canGoBack={true}
        canGoForward={false}
        onNavigate={onNavigate}
        onBack={onBack}
        onForward={onForward}
        onReload={onReload}
      />,
    );
    fireEvent.click(screen.getByText('←'));
    expect(onBack).toHaveBeenCalled();
  });

  it('should call onForward when forward button clicked', () => {
    render(
      <AddressBar
        url=""
        canGoBack={false}
        canGoForward={true}
        onNavigate={onNavigate}
        onBack={onBack}
        onForward={onForward}
        onReload={onReload}
      />,
    );
    fireEvent.click(screen.getByText('→'));
    expect(onForward).toHaveBeenCalled();
  });

  it('should call onReload when reload button clicked', () => {
    render(
      <AddressBar
        url=""
        canGoBack={false}
        canGoForward={false}
        onNavigate={onNavigate}
        onBack={onBack}
        onForward={onForward}
        onReload={onReload}
      />,
    );
    fireEvent.click(screen.getByText('↻'));
    expect(onReload).toHaveBeenCalled();
  });
});
