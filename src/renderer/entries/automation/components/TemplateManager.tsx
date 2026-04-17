import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Empty, Input, List, Popconfirm, Space, Tag, Typography, message } from 'antd';
import { ProCard } from '@ant-design/pro-components';
import { useIpc } from '../../../shared/hooks';
import type { ExtractionField, ExtractionTemplate } from '@shared/types';

interface TemplateManagerProps {
  onSelectTemplate?: (templateId: string) => void;
  draftFields?: ExtractionField[];
}

export function TemplateManager({ onSelectTemplate, draftFields = [] }: TemplateManagerProps) {
  const { automation } = useIpc();
  const [templates, setTemplates] = useState<ExtractionTemplate[]>([]);
  const [templateName, setTemplateName] = useState('');
  const [loading, setLoading] = useState(false);
  const hasDraftFields = draftFields.length > 0;
  const requestSeqRef = useRef(0);

  const loadTemplates = useCallback(async () => {
    const requestSeq = requestSeqRef.current + 1;
    requestSeqRef.current = requestSeq;
    setLoading(true);
    try {
      const data = await automation.listTemplates();
      if (requestSeqRef.current === requestSeq) {
        setTemplates((data as ExtractionTemplate[]) ?? []);
      }
    } catch (error) {
      if (requestSeqRef.current === requestSeq) {
        message.error(error instanceof Error ? error.message : '加载模板失败');
      }
    } finally {
      if (requestSeqRef.current === requestSeq) {
        setLoading(false);
      }
    }
  }, [automation]);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  const handleSave = async () => {
    if (!templateName.trim() || !hasDraftFields) {
      return;
    }

    setLoading(true);
    try {
      await automation.saveTemplate(templateName.trim(), draftFields);
      message.success('模板已保存');
      setTemplateName('');
      await loadTemplates();
    } catch (error) {
      message.error(error instanceof Error ? error.message : '保存模板失败');
      setLoading(false);
    }
  };

  const handleDelete = async (templateId: string) => {
    setLoading(true);
    try {
      await automation.deleteTemplate(templateId);
      message.success('模板已删除');
      await loadTemplates();
    } catch (error) {
      message.error(error instanceof Error ? error.message : '删除模板失败');
      setLoading(false);
    }
  };

  return (
    <ProCard
      className="yclaw-panel-card"
      title="提取模板"
      extra={<Tag color="processing">{templates.length} 个模板</Tag>}
    >
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Space.Compact style={{ width: '100%' }}>
          <Input
            value={templateName}
            onChange={(event) => setTemplateName(event.target.value)}
            placeholder="输入模板名称"
          />
          <Button
            type="primary"
            onClick={() => void handleSave()}
            disabled={!templateName.trim() || !hasDraftFields}
          >
            保存模板
          </Button>
        </Space.Compact>

        <Typography.Text type="secondary">当前可保存字段数：{draftFields.length}</Typography.Text>

        <List
          loading={loading}
          locale={{
            emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无模板" />,
          }}
          dataSource={templates}
          renderItem={(template) => (
            <List.Item
              actions={[
                <Button key="select" type="link" onClick={() => onSelectTemplate?.(template.id)}>
                  使用模板
                </Button>,
                <Popconfirm
                  key="delete"
                  title="确认删除模板？"
                  onConfirm={() => void handleDelete(template.id)}
                >
                  <Button type="link" danger>
                    删除
                  </Button>
                </Popconfirm>,
              ]}
            >
              <List.Item.Meta
                title={template.name}
                description={`字段 ${template.fields.length} 个 · 更新于 ${template.updatedAt}`}
              />
            </List.Item>
          )}
        />
      </Space>
    </ProCard>
  );
}
