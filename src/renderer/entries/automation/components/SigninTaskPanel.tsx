import { useEffect, useState } from 'react';
import { Button, Space, Tag, Typography } from 'antd';
import { ProCard } from '@ant-design/pro-components';
import type { BrowserSession, SigninTaskConfig } from '@shared/types';

interface SigninTaskPanelValue {
  entryUrl?: string;
  sessionId?: string | null;
  enabled?: boolean;
  signin?: SigninTaskConfig | null;
}

interface SigninTaskPanelSubmitPayload {
  taskId: string | null;
  name: string;
  entryUrl: string;
  sessionId: string | null;
  enabled: boolean;
  signin: SigninTaskConfig;
}

interface SigninTaskPanelProps {
  taskId?: string | null;
  initialTaskName?: string;
  initialValue?: SigninTaskPanelValue | null;
  sessions: BrowserSession[];
  onSubmit: (payload: SigninTaskPanelSubmitPayload) => void | Promise<void>;
}

const DEFAULT_ENTRY_URL = 'https://www.aliyundrive.com/';

export function SigninTaskPanel(props: SigninTaskPanelProps) {
  const { taskId = null, initialTaskName, initialValue, sessions, onSubmit } = props;
  const [taskName, setTaskName] = useState(initialTaskName ?? '');
  const [entryUrl, setEntryUrl] = useState(initialValue?.entryUrl ?? DEFAULT_ENTRY_URL);
  const [sessionId, setSessionId] = useState(initialValue?.sessionId ?? null);
  const [enabled, setEnabled] = useState(initialValue?.enabled ?? true);
  const [fallbackApiEnabled, setFallbackApiEnabled] = useState(
    initialValue?.signin?.fallbackApiEnabled ?? false,
  );
  const [refreshToken, setRefreshToken] = useState(initialValue?.signin?.refreshToken ?? '');
  const [maxRetryPerDay, setMaxRetryPerDay] = useState(initialValue?.signin?.maxRetryPerDay ?? 1);

  useEffect(() => {
    setTaskName(initialTaskName ?? '');
    setEntryUrl(initialValue?.entryUrl ?? DEFAULT_ENTRY_URL);
    setSessionId(initialValue?.sessionId ?? null);
    setEnabled(initialValue?.enabled ?? true);
    setFallbackApiEnabled(initialValue?.signin?.fallbackApiEnabled ?? false);
    setRefreshToken(initialValue?.signin?.refreshToken ?? '');
    setMaxRetryPerDay(initialValue?.signin?.maxRetryPerDay ?? 1);
  }, [initialTaskName, initialValue, taskId]);

  const canSubmit = taskName.trim().length > 0 && entryUrl.trim().length > 0;

  return (
    <ProCard className="yclaw-panel-card" title="阿里云盘签到配置">
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Space wrap>
          <Tag color="processing">AliyunDrive</Tag>
          <Tag color={fallbackApiEnabled ? 'warning' : 'default'}>
            {fallbackApiEnabled ? '页面优先 + API 兜底' : '仅页面签到'}
          </Tag>
        </Space>

        <label>
          <Typography.Text>任务名称</Typography.Text>
          <input
            aria-label="任务名称"
            value={taskName}
            onChange={(event) => setTaskName(event.target.value)}
            placeholder="例如：阿里云盘签到"
            style={{ display: 'block', width: '100%', marginTop: 6 }}
          />
        </label>

        <label>
          <Typography.Text>入口地址</Typography.Text>
          <input
            aria-label="入口地址"
            value={entryUrl}
            onChange={(event) => setEntryUrl(event.target.value)}
            placeholder={DEFAULT_ENTRY_URL}
            style={{ display: 'block', width: '100%', marginTop: 6 }}
          />
        </label>

        <label>
          <Typography.Text>浏览器会话</Typography.Text>
          <select
            aria-label="浏览器会话"
            value={sessionId ?? ''}
            onChange={(event) => setSessionId(event.target.value || null)}
            style={{ display: 'block', width: '100%', marginTop: 6 }}
          >
            <option value="">默认会话</option>
            {sessions.map((session) => (
              <option key={session.id} value={session.id}>
                {session.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          <Typography.Text>Refresh Token</Typography.Text>
          <textarea
            aria-label="Refresh Token"
            value={refreshToken}
            onChange={(event) => setRefreshToken(event.target.value)}
            placeholder="可选。页面签到失败时使用 API 兜底"
            rows={3}
            style={{ display: 'block', width: '100%', marginTop: 6 }}
          />
        </label>

        <label>
          <Typography.Text>失败重试次数</Typography.Text>
          <input
            aria-label="失败重试次数"
            type="number"
            min={0}
            value={maxRetryPerDay}
            onChange={(event) => {
              const nextValue = Number(event.target.value);
              setMaxRetryPerDay(Number.isFinite(nextValue) ? nextValue : 0);
            }}
            style={{ display: 'block', width: 120, marginTop: 6 }}
          />
        </label>

        <label>
          <input
            aria-label="启用 API 兜底"
            type="checkbox"
            checked={fallbackApiEnabled}
            onChange={(event) => setFallbackApiEnabled(event.target.checked)}
          />
          <span style={{ marginLeft: 8 }}>启用 API 兜底</span>
        </label>

        <label>
          <input
            aria-label="任务启用"
            type="checkbox"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
          />
          <span style={{ marginLeft: 8 }}>任务启用</span>
        </label>

        <Button
          type="primary"
          disabled={!canSubmit}
          onClick={() =>
            void onSubmit({
              taskId,
              name: taskName.trim(),
              entryUrl: entryUrl.trim(),
              sessionId,
              enabled,
              signin: {
                site: 'aliyundrive',
                mode: 'browser-first-api-fallback',
                fallbackApiEnabled,
                refreshToken: refreshToken.trim() || null,
                maxRetryPerDay,
                manualInterventionEnabled: true,
              },
            })
          }
        >
          保存签到任务
        </Button>
      </Space>
    </ProCard>
  );
}
