import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import TaskTimeline from '@renderer/shared/components/TaskTimeline';
import type { TimelineItem } from '@renderer/shared/components/TaskTimeline';

describe('TaskTimeline', () => {
  const mockItems: TimelineItem[] = [
    { id: '1', name: '股票数据采集', time: '09:00', status: 'success' },
    { id: '2', name: '价格监控任务', time: '10:30', status: 'running' },
    { id: '3', name: '新闻采集', time: '12:00', status: 'partial' },
    { id: '4', name: '数据备份', time: '14:30', status: 'failed' },
    { id: '5', name: '收盘数据采集', time: '16:00', status: 'pending' },
  ];

  it('should render all timeline items', () => {
    render(<TaskTimeline items={mockItems} />);
    expect(screen.getByText('股票数据采集')).toBeTruthy();
    expect(screen.getByText('价格监控任务')).toBeTruthy();
    expect(screen.getByText('新闻采集')).toBeTruthy();
    expect(screen.getByText('数据备份')).toBeTruthy();
    expect(screen.getByText('收盘数据采集')).toBeTruthy();
  });

  it('should display time for each item', () => {
    render(<TaskTimeline items={mockItems} />);
    expect(screen.getByText('09:00')).toBeTruthy();
    expect(screen.getByText('10:30')).toBeTruthy();
    expect(screen.getByText('16:00')).toBeTruthy();
  });

  it('should display status labels', () => {
    render(<TaskTimeline items={mockItems} />);
    expect(screen.getByText('成功')).toBeTruthy();
    expect(screen.getByText('进行中')).toBeTruthy();
    expect(screen.getByText('部分失败')).toBeTruthy();
    expect(screen.getByText('失败')).toBeTruthy();
    expect(screen.getByText('待执行')).toBeTruthy();
  });

  it('should render empty state when no items', () => {
    const { container } = render(<TaskTimeline items={[]} />);
    expect(container.querySelector('.ant-timeline-item')).toBeNull();
  });

  it('should show view button when onItemClick provided', () => {
    const onItemClick = () => {};
    render(<TaskTimeline items={mockItems} onItemClick={onItemClick} />);
    const viewButtons = screen.getAllByText('查看');
    expect(viewButtons.length).toBe(mockItems.length);
  });

  it('should not show view button when onItemClick is undefined', () => {
    render(<TaskTimeline items={mockItems} />);
    expect(screen.queryByText('查看')).toBeNull();
  });
});
