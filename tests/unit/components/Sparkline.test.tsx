import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import Sparkline from '@renderer/shared/components/Sparkline';

describe('Sparkline', () => {
  it('should render SVG with correct structure', () => {
    const { container } = render(
      <Sparkline data={[10, 20, 15, 30, 25, 35, 40]} />,
    );
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
    expect(svg?.querySelector('polyline')).toBeTruthy();
  });

  it('should render nothing with less than 2 data points', () => {
    const { container: c1 } = render(<Sparkline data={[]} />);
    expect(c1.querySelector('svg')).toBeNull();

    const { container: c2 } = render(<Sparkline data={[5]} />);
    expect(c2.querySelector('svg')).toBeNull();
  });

  it('should render fill path when fill is true', () => {
    const { container } = render(
      <Sparkline data={[10, 20, 30]} fill />,
    );
    expect(container.querySelector('path')).toBeTruthy();
  });

  it('should not render fill path when fill is false', () => {
    const { container } = render(
      <Sparkline data={[10, 20, 30]} fill={false} />,
    );
    expect(container.querySelector('path')).toBeNull();
  });

  it('should render with custom height', () => {
    const { container } = render(
      <Sparkline data={[10, 20, 30]} height={48} />,
    );
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('height')).toBe('48');
  });

  it('should have accessibility attributes', () => {
    const { container } = render(
      <Sparkline data={[10, 20, 30]} />,
    );
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('role')).toBe('img');
    expect(svg?.getAttribute('aria-label')).toBeTruthy();
  });

  it('should handle identical data points', () => {
    const { container } = render(
      <Sparkline data={[5, 5, 5, 5]} />,
    );
    expect(container.querySelector('svg')).toBeTruthy();
    expect(container.querySelector('polyline')).toBeTruthy();
  });
});
