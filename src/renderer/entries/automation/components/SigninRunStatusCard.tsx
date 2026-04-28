import { Alert, Button, Space, Tag, Typography } from 'antd';
import { ProCard } from '@ant-design/pro-components';
import type { SigninRunSummary } from '@shared/types';
import { formatBeijingDateTime } from '@renderer/shared/utils/format';

interface SigninRunStatusCardProps {
  taskId?: string | null;
  summary?: SigninRunSummary | null;
  history?: SigninRunSummary[];
  onRunNow: (taskId: string) => void | Promise<void>;
  onRetryIntervention: (taskId: string) => void | Promise<void>;
}

export function SigninRunStatusCard(props: SigninRunStatusCardProps) {
  const { taskId, summary, history = [], onRunNow, onRetryIntervention } = props;
  const canRun = typeof taskId === 'string' && taskId.length > 0;
  const needsIntervention = summary?.status === 'needs_intervention' && canRun;

  return (
    <ProCard className="yclaw-panel-card" title="签到运行状态">
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        {summary ? (
          <>
            <Space wrap>
              <Tag color={resolveStatusColor(summary.status)}>{summary.status}</Tag>
              {summary.strategyUsed ? <Tag>{summary.strategyUsed}</Tag> : null}
              <Typography.Text>重试次数：{summary.retryCount}</Typography.Text>
            </Space>

            <Typography.Text>最近执行：{formatBeijingDateTime(summary.runAt)}</Typography.Text>

            {summary.detail ? (
              <Alert
                message={summary.failureReason ?? '执行详情'}
                description={summary.detail}
                type={needsIntervention ? 'warning' : 'info'}
              />
            ) : null}

            {summary.debug ? (
              <Space direction="vertical" size={4}>
                {summary.debug.pageTitle ? (
                  <Typography.Text>页面标题：{summary.debug.pageTitle}</Typography.Text>
                ) : null}
                {summary.debug.pageUrl ? (
                  <Typography.Text>页面地址：{summary.debug.pageUrl}</Typography.Text>
                ) : null}
                {summary.debug.domSummary ? (
                  <Typography.Text>DOM 摘要：{summary.debug.domSummary}</Typography.Text>
                ) : null}
                {summary.debug.readyState ? (
                  <Typography.Text>文档状态：{summary.debug.readyState}</Typography.Text>
                ) : null}
                {summary.debug.visibilityState ? (
                  <Typography.Text>页面可见性：{summary.debug.visibilityState}</Typography.Text>
                ) : null}
                {summary.debug.viewport ? (
                  <Typography.Text>视口尺寸：{summary.debug.viewport}</Typography.Text>
                ) : null}
                {typeof summary.debug.activityAnchorFound === 'boolean' ? (
                  <Typography.Text>
                    活动锚点：{summary.debug.activityAnchorFound ? '已找到' : '未找到'}
                  </Typography.Text>
                ) : null}
                {typeof summary.debug.signBarCount === 'number' ? (
                  <Typography.Text>签到卡数量：{summary.debug.signBarCount}</Typography.Text>
                ) : null}
                {typeof summary.debug.dateCardCandidateCount === 'number' ? (
                  <Typography.Text>日期卡候选数：{summary.debug.dateCardCandidateCount}</Typography.Text>
                ) : null}
                {summary.debug.screenshotDataUrl ? (
                  <img
                    alt="失败截图预览"
                    src={summary.debug.screenshotDataUrl}
                    style={{
                      maxWidth: '100%',
                      borderRadius: 8,
                      border: '1px solid #f0f0f0',
                    }}
                  />
                ) : null}
              </Space>
            ) : null}

            {history.length > 0 ? (
              <Space direction="vertical" size={4}>
                <Typography.Text>最近运行记录</Typography.Text>
                {history.map((item) => (
                  <Typography.Text key={`${item.taskId}-${item.runAt}-${item.retryCount}`}>
                    {formatHistoryLine(item)}
                  </Typography.Text>
                ))}
              </Space>
            ) : null}
          </>
        ) : (
          <Typography.Text type="secondary">
            还没有执行记录。保存任务后可立即执行一次验证链路。
          </Typography.Text>
        )}

        <Space wrap>
          <Button type="primary" disabled={!canRun} onClick={() => canRun && void onRunNow(taskId)}>
            立即执行
          </Button>
          {needsIntervention ? (
            <Button onClick={() => canRun && void onRetryIntervention(taskId)}>
              处理完成，重试
            </Button>
          ) : null}
        </Space>
      </Space>
    </ProCard>
  );
}

function formatHistoryLine(item: SigninRunSummary): string {
  const parts = [formatBeijingDateTime(item.runAt), item.status];
  if (item.strategyUsed) {
    parts.push(item.strategyUsed);
  }
  if (item.failureReason) {
    parts.push(item.failureReason);
  }
  parts.push(`重试 ${item.retryCount}`);
  return parts.join(' · ');
}

function resolveStatusColor(status: SigninRunSummary['status']): string {
  if (status === 'success') {
    return 'success';
  }
  if (status === 'needs_intervention' || status === 'failed') {
    return 'error';
  }
  if (status === 'retry_scheduled') {
    return 'warning';
  }
  return 'processing';
}
