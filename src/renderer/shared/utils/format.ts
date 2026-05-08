/**
 * 通用格式化工具
 */

export function formatDate(date: Date | string | number): string {
  return new Date(date).toLocaleString('zh-CN');
}

export function formatBeijingDateTime(date: Date | string | number): string {
  const formatter = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(new Date(date));
  const valueMap = new Map(parts.map((part) => [part.type, part.value]));
  return `${valueMap.get('year')}-${valueMap.get('month')}-${valueMap.get('day')} ${valueMap.get('hour')}:${valueMap.get('minute')}:${valueMap.get('second')}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}
