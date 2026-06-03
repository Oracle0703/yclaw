import { useState } from 'react';
import { Button, Card, List, Space, Tag, Typography, message } from 'antd';
import { IPC_CHANNELS } from '@shared/constants';
import { useIpc } from '../../../shared/hooks';
import type {
  InvestigationRecordingResult,
  RecorderSitePreset,
  TaskStep,
} from '@shared/types';

interface RecorderPanelProps {
  tabId: number | null;
  onCreateTab?: () => Promise<number | null>;
  onRecorded?: (steps: TaskStep[]) => void;
}

export function RecorderPanel({ tabId, onCreateTab, onRecorded }: RecorderPanelProps) {
  const { invoke } = useIpc();
  const [recording, setRecording] = useState(false);
  const [pending, setPending] = useState(false);
  const [steps, setSteps] = useState<TaskStep[]>([]);
  const [sitePreset, setSitePreset] = useState<RecorderSitePreset>('jd');
  const [customDomains, setCustomDomains] = useState('');
  const [investigationResult, setInvestigationResult] =
    useState<InvestigationRecordingResult | null>(null);
  const canStartRecording = !recording && !pending && (tabId != null || Boolean(onCreateTab));

  const resolveRecordingTabId = async (): Promise<number | null> => {
    if (tabId != null) {
      return tabId;
    }
    if (!onCreateTab) {
      return null;
    }
    return onCreateTab();
  };

  const handleStart = async () => {
    if (pending || recording) {
      return;
    }

    setPending(true);
    try {
      const recordingTabId = await resolveRecordingTabId();
      if (recordingTabId == null) {
        message.error('请先创建或选择一个采集页');
        return;
      }
      await invoke(IPC_CHANNELS.RECORDER_START, { tabId: recordingTabId });
      setInvestigationResult(null);
      setRecording(true);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '启动录制失败');
    } finally {
      setPending(false);
    }
  };

  const handleInvestigationStart = async () => {
    if (pending || recording) {
      return;
    }

    setPending(true);
    try {
      const recordingTabId = await resolveRecordingTabId();
      if (recordingTabId == null) {
        message.error('请先创建或选择一个采集页');
        return;
      }
      await invoke(IPC_CHANNELS.RECORDER_START, {
        tabId: recordingTabId,
        options: {
          mode: 'investigation',
          sitePreset,
          includeNetwork: true,
          filterStaticResources: true,
          captureStorageSnapshot: true,
          domainAllowlist: resolveDomainAllowlist(sitePreset, customDomains),
        },
      });
      setInvestigationResult(null);
      setRecording(true);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '启动调查录制失败');
    } finally {
      setPending(false);
    }
  };

  const handleStop = async () => {
    if (tabId == null || pending || !recording) {
      return;
    }

    setPending(true);
    try {
      const result = await invoke<TaskStep[] | InvestigationRecordingResult>(
        IPC_CHANNELS.RECORDER_STOP,
        { tabId },
      );
      const nextSteps = Array.isArray(result) ? result : result?.steps ?? [];
      setRecording(false);
      if (!Array.isArray(result) && result?.kind === 'investigation-recording') {
        setInvestigationResult(result);
      }
      setSteps(nextSteps ?? []);
      onRecorded?.(nextSteps ?? []);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '停止录制失败');
    } finally {
      setPending(false);
    }
  };

  return (
    <Card className="yclaw-panel-card" title="录制器" extra={<Tag color={recording ? 'processing' : 'default'}>{recording ? '录制中' : '待机'}</Tag>}>
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Space wrap>
          <Button
            type="primary"
            onClick={() => void handleStart()}
            disabled={!canStartRecording}
          >
            开始录制
          </Button>
          <Button
            onClick={() => void handleInvestigationStart()}
            disabled={!canStartRecording}
          >
            开始调查录制
          </Button>
          <Button onClick={() => void handleStop()} disabled={tabId == null || !recording || pending}>
            停止录制
          </Button>
        </Space>

        <Space wrap>
          <select
            aria-label="站点预设"
            value={sitePreset}
            disabled={recording || pending}
            onChange={(event) => setSitePreset(event.target.value as RecorderSitePreset)}
          >
            <option value="jd">京东</option>
            <option value="taobao">淘宝</option>
            <option value="pinduoduo">拼多多</option>
            <option value="all">通用</option>
            <option value="custom">自定义</option>
          </select>
          <input
            aria-label="自定义域名"
            value={customDomains}
            disabled={recording || pending}
            onChange={(event) => setCustomDomains(event.target.value)}
            placeholder="example.com, api.example.com"
            style={{ minWidth: 220 }}
          />
        </Space>

        <Typography.Text type="secondary">
          {tabId == null
            ? '当前没有操作窗口，开始录制时会先自动打开一个真实可操作窗口。'
            : '录制结束后会展示步骤预览；调查录制会额外展示网络请求和 API 重放草案。'}
        </Typography.Text>

        {investigationResult ? (
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            <Space wrap>
              <Tag>网络请求：{investigationResult.network.length}</Tag>
              <Tag>重放草案：{investigationResult.replayDrafts.length}</Tag>
              <Tag>{investigationResult.sitePreset}</Tag>
              <Button onClick={() => exportInvestigationJson(investigationResult)}>
                导出 JSON
              </Button>
            </Space>
            <List
              bordered
              dataSource={investigationResult.replayDrafts}
              locale={{ emptyText: '暂无 API 重放草案' }}
              renderItem={(draft) => (
                <List.Item>
                  <Space direction="vertical" size={2}>
                    <Space>
                      <Tag>{draft.method}</Tag>
                      <Typography.Text>{draft.url}</Typography.Text>
                    </Space>
                    <Typography.Text type="secondary">{draft.reason}</Typography.Text>
                  </Space>
                </List.Item>
              )}
            />
          </Space>
        ) : null}

        <List
          bordered
          dataSource={steps}
          locale={{ emptyText: '暂无录制步骤' }}
          renderItem={(step) => (
            <List.Item>
              <Space>
                <Tag>{step.action.type}</Tag>
                <Typography.Text>{step.name}</Typography.Text>
                <Typography.Text type="secondary">{step.action.selector}</Typography.Text>
              </Space>
            </List.Item>
          )}
        />
      </Space>
    </Card>
  );
}

function resolveDomainAllowlist(
  sitePreset: RecorderSitePreset,
  customDomains: string,
): string[] {
  const custom = customDomains
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  const presets: Record<RecorderSitePreset, string[]> = {
    jd: ['jd.com', '3.cn', 'api.m.jd.com', 'm.jd.com', 'jingxi.com'],
    taobao: ['taobao.com', 'tmall.com', 'alicdn.com', 'h5api.m.taobao.com'],
    pinduoduo: ['pinduoduo.com', 'yangkeduo.com', 'pddpic.com'],
    all: [],
    custom: [],
  };

  return Array.from(new Set([...presets[sitePreset], ...custom]));
}

function exportInvestigationJson(result: InvestigationRecordingResult): void {
  const blob = new Blob([JSON.stringify(result, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `yclaw-investigation-${result.sitePreset}-${Date.now()}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
