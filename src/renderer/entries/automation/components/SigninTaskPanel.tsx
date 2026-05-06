import { useEffect, useState } from 'react';
import { Button, Space, Tag, Typography } from 'antd';
import { ProCard } from '@ant-design/pro-components';
import type {
  BrowserSession,
  SigninCaptureDiagnostics,
  SigninLoginSnapshot,
  SigninTaskConfig,
} from '@shared/types';

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
  /**
   * 打开京东登录页采集登录态。返回值由调用方负责持久化与提示，
   * 此处只负责拿到结果后把登录态回填到表单。
   */
  onCaptureLogin?: (payload: SigninTaskPanelSubmitPayload) => Promise<(SigninLoginSnapshot & {
    taskId: string;
    timedOut?: boolean;
  }) | null>;
}

const DEFAULT_ENTRY_URL = 'https://interact.jd.com/';
const DEFAULT_TASK_NAME = '京东签到';

export function SigninTaskPanel(props: SigninTaskPanelProps) {
  const {
    taskId = null,
    initialTaskName,
    initialValue,
    sessions,
    onSubmit,
    onCaptureLogin,
  } = props;
  const [taskName, setTaskName] = useState(initialTaskName ?? '');
  const [entryUrl, setEntryUrl] = useState(
    initialValue?.signin?.site === 'jd' && initialValue.entryUrl
      ? initialValue.entryUrl
      : DEFAULT_ENTRY_URL,
  );
  const [sessionId, setSessionId] = useState(initialValue?.sessionId ?? null);
  const [enabled, setEnabled] = useState(initialValue?.enabled ?? true);
  const [loginSnapshot, setLoginSnapshot] = useState<SigninLoginSnapshot>(
    pickLoginSnapshot(initialValue?.signin),
  );
  const [maxRetryPerDay, setMaxRetryPerDay] = useState(initialValue?.signin?.maxRetryPerDay ?? 1);
  const [capturing, setCapturing] = useState(false);
  const canCaptureLogin = typeof onCaptureLogin === 'function';
  const resolvedTaskName =
    taskName.trim() || initialTaskName?.trim() || DEFAULT_TASK_NAME;
  const localStorageKeys = Object.keys(loginSnapshot.localStorageSnapshot ?? {});
  const captureDiagnostics = loginSnapshot.captureDiagnostics ?? null;
  const hasCapturedSnapshot =
    Boolean(loginSnapshot.userName) ||
    Boolean(loginSnapshot.userId) ||
    localStorageKeys.length > 0;
  const buildSubmitPayload = (): SigninTaskPanelSubmitPayload => ({
    taskId,
    name: resolvedTaskName,
    entryUrl: entryUrl.trim(),
    sessionId,
    enabled,
    signin: {
      site: 'jd',
      mode: 'api-first-browser-fallback',
      fallbackApiEnabled: true,
      ...normalizeLoginSnapshot(loginSnapshot),
      maxRetryPerDay,
      manualInterventionEnabled: true,
    },
  });

  useEffect(() => {
    setTaskName(initialTaskName ?? '');
    setEntryUrl(
      initialValue?.signin?.site === 'jd' && initialValue.entryUrl
        ? initialValue.entryUrl
        : DEFAULT_ENTRY_URL,
    );
    setSessionId(initialValue?.sessionId ?? null);
    setEnabled(initialValue?.enabled ?? true);
    setLoginSnapshot(pickLoginSnapshot(initialValue?.signin));
    setMaxRetryPerDay(initialValue?.signin?.maxRetryPerDay ?? 1);
  }, [initialTaskName, initialValue, taskId]);

  const canSubmit = resolvedTaskName.length > 0 && entryUrl.trim().length > 0;

  return (
    <ProCard className="yclaw-panel-card" title="京东签到配置">
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Space wrap>
          <Tag color="processing">JD</Tag>
          <Tag color="warning">API 优先 + 浏览器补领</Tag>
          {hasCapturedSnapshot ? <Tag color="success">已采集</Tag> : null}
        </Space>

        <label>
          <Typography.Text>任务名称</Typography.Text>
          <input
            aria-label="任务名称"
            value={taskName}
            onChange={(event) => setTaskName(event.target.value)}
            placeholder={`例如：${DEFAULT_TASK_NAME}`}
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

        <Typography.Text type="secondary">
          复用京东浏览器会话 Cookie/localStorage
        </Typography.Text>

        {canCaptureLogin ? (
          <Space>
            <Button
              disabled={!canSubmit || capturing}
              loading={capturing}
              onClick={async () => {
                setCapturing(true);
                try {
                  const captured = await onCaptureLogin(buildSubmitPayload());
                  if (captured) {
                    setLoginSnapshot((prev) => ({
                      ...prev,
                      ...captured,
                    }));
                  }
                } finally {
                  setCapturing(false);
                }
              }}
            >
              打开浏览器采集登录态
            </Button>
            {!taskId && canSubmit ? (
              <Typography.Text type="secondary">将先自动保存当前草稿，再采集登录态</Typography.Text>
            ) : null}
            <Typography.Text type="secondary">检测到京东 Cookie/localStorage 后会自动保存并关闭窗口</Typography.Text>
          </Space>
        ) : null}

        {captureDiagnostics ? (
          <div aria-label="最近一次采集诊断" style={{ border: '1px solid #f0f0f0', padding: 12 }}>
            <Typography.Text>最近一次采集诊断</Typography.Text>
            <div style={{ marginTop: 8 }}>页面地址：{captureDiagnostics.pageUrl ?? '-'}</div>
            <div>页面标题：{captureDiagnostics.pageTitle ?? '-'}</div>
            <div>
              LocalStorage Keys：
              {captureDiagnostics.localStorageKeys?.length
                ? captureDiagnostics.localStorageKeys.join(', ')
                : '-'}
            </div>
            <div>
              SessionStorage Keys：
              {captureDiagnostics.sessionStorageKeys?.length
                ? captureDiagnostics.sessionStorageKeys.join(', ')
                : '-'}
            </div>
            <div>
              Cookie 域：
              {captureDiagnostics.cookieDomains?.length
                ? captureDiagnostics.cookieDomains.join(', ')
                : '-'}
            </div>
            <div>网络响应数：{captureDiagnostics.networkResponseCount ?? 0}</div>
            <div>
              含 Token 线索的响应：
              {captureDiagnostics.tokenHintResponseUrls?.length
                ? captureDiagnostics.tokenHintResponseUrls.join(', ')
                : '-'}
            </div>
          </div>
        ) : null}

        {hasCapturedSnapshot ? (
          <div aria-label="已采集登录态" style={{ border: '1px solid #f0f0f0', padding: 12 }}>
            <Typography.Text>已采集登录态</Typography.Text>
            <div style={{ marginTop: 8 }}>状态：已采集</div>
            <div>登录态已获取，预览窗口会自动关闭</div>
            <div style={{ marginTop: 8 }}>账号昵称：{loginSnapshot.userName ?? '-'}</div>
            <div>用户 ID：{loginSnapshot.userId ?? '-'}</div>
            {localStorageKeys.length > 0 ? (
              <>
                <div style={{ marginTop: 8 }}>
                  localStorage 已采集 {localStorageKeys.length} 项
                </div>
                <div>{localStorageKeys.join(', ')}</div>
              </>
            ) : null}
            {localStorageKeys.length > 0 ? (
              <label style={{ display: 'block', marginTop: 8 }}>
                <Typography.Text>LocalStorage 快照</Typography.Text>
                <textarea
                  aria-label="LocalStorage 快照"
                  readOnly
                  rows={8}
                  value={formatJson(loginSnapshot.localStorageSnapshot)}
                  style={{ display: 'block', width: '100%', marginTop: 6 }}
                />
              </label>
            ) : null}
          </div>
        ) : null}

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
          onClick={() => void onSubmit(buildSubmitPayload())}
        >
          保存签到任务
        </Button>
      </Space>
    </ProCard>
  );
}

function pickLoginSnapshot(signin?: SigninTaskConfig | null): SigninLoginSnapshot {
  return {
    userName: signin?.userName ?? null,
    userId: signin?.userId ?? null,
    localStorageSnapshot: normalizeLocalStorageSnapshot(signin?.localStorageSnapshot),
    captureDiagnostics: normalizeCaptureDiagnostics(signin?.captureDiagnostics),
  };
}

function normalizeLoginSnapshot(snapshot: SigninLoginSnapshot): SigninLoginSnapshot {
  return {
    userName: normalizeOptionalToken(snapshot.userName),
    userId: normalizeOptionalToken(snapshot.userId),
    localStorageSnapshot: normalizeLocalStorageSnapshot(snapshot.localStorageSnapshot),
    captureDiagnostics: normalizeCaptureDiagnostics(snapshot.captureDiagnostics),
  };
}

function normalizeOptionalToken(value?: string | null): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeLocalStorageSnapshot(
  value?: Record<string, string> | null,
): Record<string, string> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const entries = Object.entries(value).filter((entry): entry is [string, string] => {
    const [key, itemValue] = entry;
    return key.trim().length > 0 && typeof itemValue === 'string';
  });
  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

function normalizeCaptureDiagnostics(
  value?: SigninCaptureDiagnostics | null,
): SigninCaptureDiagnostics | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return {
    pageUrl: normalizeOptionalToken(value.pageUrl),
    pageTitle: normalizeOptionalToken(value.pageTitle),
    localStorageKeys: normalizeStringArray(value.localStorageKeys),
    sessionStorageKeys: normalizeStringArray(value.sessionStorageKeys),
    cookieDomains: normalizeStringArray(value.cookieDomains),
    networkResponseCount:
      typeof value.networkResponseCount === 'number' && Number.isFinite(value.networkResponseCount)
        ? value.networkResponseCount
        : 0,
    tokenHintResponseUrls: normalizeStringArray(value.tokenHintResponseUrls),
  };
}

function normalizeStringArray(value?: string[] | null): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function formatJson(value: Record<string, unknown> | Record<string, string> | null | undefined): string {
  if (!value) {
    return '';
  }
  return JSON.stringify(value, null, 2);
}
