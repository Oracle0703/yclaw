import { Drawer, Typography } from 'antd';
import type { DataCenterResultDetail } from '@shared/types';

interface ResultDetailDrawerProps {
  open: boolean;
  detail: DataCenterResultDetail | null;
  onClose: () => void;
}

export function ResultDetailDrawer({ open, detail, onClose }: ResultDetailDrawerProps) {
  return (
    <Drawer title="结果详情" open={open} onClose={onClose}>
      <Typography.Paragraph>执行日志</Typography.Paragraph>
      <pre>{JSON.stringify(detail, null, 2)}</pre>
    </Drawer>
  );
}
