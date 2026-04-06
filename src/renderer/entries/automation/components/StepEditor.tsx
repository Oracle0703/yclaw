import React, { useState } from 'react';
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
    <div className="step-editor">
      {steps.map((step, i) => (
        <div key={step.id} className="step-card">
          <div className="step-header">
            <span className="step-index">#{i + 1}</span>
            <input
              className="step-name-input"
              value={step.name}
              onChange={(e) => updateStep(i, { name: e.target.value })}
            />
            <div className="step-actions">
              <button onClick={() => moveStep(i, -1)} disabled={i === 0}>↑</button>
              <button onClick={() => moveStep(i, 1)} disabled={i === steps.length - 1}>↓</button>
              <button onClick={() => removeStep(i)}>✕</button>
            </div>
          </div>
          <div className="step-body">
            <label>
              动作类型
              <select
                value={step.action.type}
                onChange={(e) =>
                  updateStep(i, {
                    action: { ...step.action, type: e.target.value as ActionType },
                  })
                }
              >
                {ACTION_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </label>
            <label>
              选择器
              <input
                placeholder="CSS 选择器，如 #submit-btn"
                value={step.action.selector}
                onChange={(e) =>
                  updateStep(i, {
                    action: { ...step.action, selector: e.target.value },
                  })
                }
              />
            </label>
            {step.action.type === 'input' && (
              <label>
                输入值
                <input
                  placeholder="输入内容"
                  value={(step.action.params?.value as string) ?? ''}
                  onChange={(e) =>
                    updateStep(i, {
                      action: { ...step.action, params: { ...step.action.params, value: e.target.value } },
                    })
                  }
                />
              </label>
            )}
          </div>
        </div>
      ))}
      <button className="add-step-btn" onClick={addStep}>+ 添加步骤</button>
    </div>
  );
}
