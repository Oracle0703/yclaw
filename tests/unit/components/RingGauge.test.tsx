import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import RingGauge from '@renderer/shared/components/RingGauge';

describe('RingGauge', () => {
  it('should render with percentage text', () => {
    render(<RingGauge percent={75} />);
    const gauge = screen.getByTestId('ring-gauge');
    expect(gauge).toBeTruthy();
    const svg = gauge.querySelector('svg');
    expect(svg).toBeTruthy();
    const text = svg?.querySelector('text');
    expect(text?.textContent).toBe('75%');
  });

  it('should render label when provided', () => {
    render(<RingGauge percent={50} label="CPU" />);
    expect(screen.getByText('CPU')).toBeTruthy();
  });

  it('should clamp percent to 0-100', () => {
    const { rerender } = render(<RingGauge percent={-10} />);
    let text = screen.getByTestId('ring-gauge').querySelector('text');
    expect(text?.textContent).toBe('0%');

    rerender(<RingGauge percent={150} />);
    text = screen.getByTestId('ring-gauge').querySelector('text');
    expect(text?.textContent).toBe('100%');
  });

  it('should use green color for percent < 60', () => {
    render(<RingGauge percent={30} />);
    const circles = screen.getByTestId('ring-gauge').querySelectorAll('circle');
    const progressCircle = circles[1];
    expect(progressCircle?.getAttribute('stroke')).toBe('#52c41a');
  });

  it('should use orange color for percent 60-80', () => {
    render(<RingGauge percent={70} />);
    const circles = screen.getByTestId('ring-gauge').querySelectorAll('circle');
    const progressCircle = circles[1];
    expect(progressCircle?.getAttribute('stroke')).toBe('#faad14');
  });

  it('should use red color for percent > 80', () => {
    render(<RingGauge percent={90} />);
    const circles = screen.getByTestId('ring-gauge').querySelectorAll('circle');
    const progressCircle = circles[1];
    expect(progressCircle?.getAttribute('stroke')).toBe('#ff4d4f');
  });

  it('should use custom color when provided', () => {
    render(<RingGauge percent={50} color="#1677ff" />);
    const circles = screen.getByTestId('ring-gauge').querySelectorAll('circle');
    const progressCircle = circles[1];
    expect(progressCircle?.getAttribute('stroke')).toBe('#1677ff');
  });

  it('should render with custom size', () => {
    render(<RingGauge percent={50} size={120} />);
    const svg = screen.getByTestId('ring-gauge').querySelector('svg');
    expect(svg?.getAttribute('width')).toBe('120');
    expect(svg?.getAttribute('height')).toBe('120');
  });
});
