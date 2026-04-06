import { Button, Col, Form, Input, InputNumber, Row, Select, Space, Typography } from 'antd';
import { ProCard } from '@ant-design/pro-components';
import type { TaskStep, ActionType } from '@shared/types';

const ACTION_TYPES: { value: ActionType; label: string }[] = [
  { value: 'click', label: '点击' },
  { value: 'input', label: '输入' },
  { value: 'scroll', label: '滚动' },
  { value: 'extract', label: '采集' },
  { value: 'screenshot', label: '截图' },
];

interface StepEditorProps {
  steps: TaskStep[];
  onChange: (steps: TaskStep[]) => void;
}

export function StepEditor({ steps, onChange }: StepEditorProps) {
  const addStep = () => {
    const newStep: TaskStep = {
      id: `step-${Date.now()}`,
      name: `步骤 ${steps.length + 1}`,
      action: { type: 'click', selector: '' },
    };
    onChange([...steps, newStep]);
  };

  const removeStep = (index: number) => {
    onChange(steps.filter((_, i) => i !== index));
  };

  const updateStep = (index: number, partial: Partial<TaskStep>) => {
    const updated = steps.map((s, i) => (i === index ? { ...s, ...partial } : s));
    onChange(updated);
  };

  const moveStep = (from: number, direction: -1 | 1) => {
    const to = from + direction;
    if (to < 0 || to >= steps.length) return;
    const arr = [...steps];
    [arr[from], arr[to]] = [arr[to], arr[from]];
    onChange(arr);
  };

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      {steps.map((step, i) => (
        <ProCard
          key={step.id}
          className="yclaw-panel-card"
          title={
            <Space>
              <Typography.Text strong>#{i + 1}</Typography.Text>
              <Typography.Text>{step.name}</Typography.Text>
            </Space>
          }
          extra={
            <Space>
              <Button onClick={() => moveStep(i, -1)} disabled={i === 0}>
                上移
              </Button>
              <Button onClick={() => moveStep(i, 1)} disabled={i === steps.length - 1}>
                下移
              </Button>
              <Button danger onClick={() => removeStep(i)}>
                删除
              </Button>
            </Space>
          }
        >
          <Form layout="vertical">
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item label="步骤名称">
                  <Input
                    value={step.name}
                    onChange={(e) => updateStep(i, { name: e.target.value })}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label="动作类型">
                  <Select
                    value={step.action.type}
                    options={ACTION_TYPES}
                    onChange={(value) =>
                      updateStep(i, {
                        action: { ...step.action, type: value as ActionType },
                      })
                    }
                  />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col xs={24} md={18}>
                <Form.Item label="选择器">
                  <Input
                    placeholder="CSS 选择器，如 #submit-btn"
                    value={step.action.selector}
                    onChange={(e) =>
                      updateStep(i, {
                        action: { ...step.action, selector: e.target.value },
                      })
                    }
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={6}>
                <Form.Item label="超时(ms)">
                  <InputNumber
                    min={0}
                    style={{ width: '100%' }}
                    value={step.action.timeout}
                    onChange={(value) =>
                      updateStep(i, {
                        action: { ...step.action, timeout: value ?? undefined },
                      })
                    }
                  />
                </Form.Item>
              </Col>
            </Row>

            {step.action.type === 'input' && (
              <Form.Item label="输入值">
                <Input
                  placeholder="输入内容"
                  value={(step.action.params?.value as string) ?? ''}
                  onChange={(e) =>
                    updateStep(i, {
                      action: {
                        ...step.action,
                        params: { ...step.action.params, value: e.target.value },
                      },
                    })
                  }
                />
              </Form.Item>
            )}
          </Form>
        </ProCard>
      ))}

      <Button type="primary" onClick={addStep}>
        添加步骤
      </Button>
    </Space>
  );
}
