import type {
  HotTimelineConfig,
  HotTimelinePreset,
  HotTimelinePresetOption,
  ScheduleConfig,
} from '@shared/types';

export class HotTimelineScheduler {
  listPresets(): HotTimelinePresetOption[] {
    return (['all-day', 'morning-evening', 'workday', 'custom'] as const).map((preset) => ({
      ...this.resolvePreset(preset),
      label: getPresetLabel(preset),
    }));
  }

  resolvePreset(preset: HotTimelinePreset): HotTimelineConfig & { schedule: ScheduleConfig } {
    switch (preset) {
      case 'workday':
        return {
          preset,
          windows: [
            { start: '09:00', end: '12:00', daysOfWeek: [1, 2, 3, 4, 5] },
            { start: '13:30', end: '18:30', daysOfWeek: [1, 2, 3, 4, 5] },
          ],
          schedule: { type: 'cron', cron: '*/30 9-18 * * 1-5' },
        };
      case 'morning-evening':
        return {
          preset,
          windows: [
            { start: '08:00', end: '10:00' },
            { start: '18:00', end: '22:00' },
          ],
          schedule: { type: 'cron', cron: '*/30 8-10,18-22 * * *' },
        };
      case 'all-day':
        return {
          preset,
          windows: [{ start: '00:00', end: '23:59' }],
          schedule: { type: 'cron', cron: '*/30 * * * *' },
        };
      case 'custom':
      default:
        return {
          preset: 'custom',
          windows: [],
          schedule: { type: 'manual' },
        };
    }
  }
}

function getPresetLabel(preset: HotTimelinePreset): string {
  switch (preset) {
    case 'all-day':
      return '全天';
    case 'morning-evening':
      return '早晚高峰';
    case 'workday':
      return '工作日';
    case 'custom':
    default:
      return '自定义';
  }
}
