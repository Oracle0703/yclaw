export type TaskTemplateAdapter = 'signin' | 'hot' | 'comment' | 'generic';

export type TaskTemplateCategory = 'signin' | 'monitoring' | 'collection';

export type TaskTemplateStatus = 'ready' | 'preview';

export type TaskTemplateFieldType = 'text' | 'url' | 'select' | 'number' | 'switch';

export interface TaskTemplateParameterField {
  name: string;
  label: string;
  type: TaskTemplateFieldType;
  required?: boolean;
  placeholder?: string;
  defaultValue?: unknown;
  options?: Array<{
    label: string;
    value: string | number | boolean;
  }>;
}

export interface TaskTemplateDefinition {
  id: string;
  name: string;
  description: string;
  category: TaskTemplateCategory;
  adapter: TaskTemplateAdapter;
  requiredCapabilities: string[];
  status: TaskTemplateStatus;
  defaultEntryUrl?: string;
  defaultSchedule?: unknown;
  parameterFields: TaskTemplateParameterField[];
  runDisabledReason?: string;
}

const TASK_TEMPLATES: TaskTemplateDefinition[] = [
  {
    id: 'jd-signin',
    name: '京东签到任务',
    description: '使用已有京东签到服务创建本地签到任务，支持保存、立即运行和历史结果查看。',
    category: 'signin',
    adapter: 'signin',
    requiredCapabilities: ['browser-session', 'signin-provider'],
    status: 'ready',
    defaultEntryUrl: 'https://interact.jd.com/',
    defaultSchedule: { type: 'manual' },
    parameterFields: [
      {
        name: 'name',
        label: '任务名称',
        type: 'text',
        required: true,
        defaultValue: '京东签到',
      },
      {
        name: 'entryUrl',
        label: '入口 URL',
        type: 'url',
        required: true,
        defaultValue: 'https://interact.jd.com/',
      },
      {
        name: 'sessionId',
        label: '会话 ID',
        type: 'text',
        required: true,
        placeholder: '输入已登录浏览器会话 ID',
      },
      {
        name: 'mode',
        label: '签到策略',
        type: 'select',
        required: true,
        defaultValue: 'api-first-browser-fallback',
        options: [
          { label: 'API 优先，浏览器兜底', value: 'api-first-browser-fallback' },
          { label: '浏览器优先，API 兜底', value: 'browser-first-api-fallback' },
        ],
      },
      {
        name: 'fallbackApiEnabled',
        label: '启用兜底',
        type: 'switch',
        defaultValue: true,
      },
      {
        name: 'maxRetryPerDay',
        label: '每日最大重试',
        type: 'number',
        defaultValue: 1,
      },
    ],
  },
  {
    id: 'hot-monitor',
    name: '热点监控任务',
    description: '复用已有热点源、标准批次、标准结果和报告能力，创建可运行的热点监控任务。',
    category: 'monitoring',
    adapter: 'hot',
    requiredCapabilities: ['hot-source'],
    status: 'ready',
    defaultEntryUrl: 'https://newsnow.busiyi.world/',
    defaultSchedule: { type: 'manual' },
    parameterFields: [
      {
        name: 'name',
        label: '任务名称',
        type: 'text',
        required: true,
        defaultValue: '热点监控',
      },
      {
        name: 'sourceKind',
        label: '来源类型',
        type: 'select',
        required: true,
        defaultValue: 'api',
        options: [
          { label: 'API', value: 'api' },
          { label: '浏览器', value: 'browser' },
          { label: 'RSS', value: 'rss' },
        ],
      },
      {
        name: 'siteKey',
        label: '站点标识',
        type: 'text',
        required: true,
        defaultValue: 'trendradar',
      },
      {
        name: 'entryUrl',
        label: '入口 URL',
        type: 'url',
        required: true,
        defaultValue: 'https://newsnow.busiyi.world/',
      },
      {
        name: 'parserKey',
        label: '解析器',
        type: 'text',
        required: true,
        defaultValue: 'newsnow.batch',
      },
      {
        name: 'platformIds',
        label: '平台 ID',
        type: 'text',
        placeholder: '多个平台用英文逗号分隔',
      },
    ],
  },
  {
    id: 'comment-monitor',
    name: '评论监控任务',
    description: '包装已有评论源、MediaCrawler 导入和 AI 回复建议能力。Phase 0 仅作为预览模板展示。',
    category: 'monitoring',
    adapter: 'comment',
    requiredCapabilities: ['comment-source', 'mediacrawler'],
    status: 'preview',
    defaultSchedule: { type: 'manual' },
    runDisabledReason: '后续接入运行',
    parameterFields: [
      {
        name: 'sourceId',
        label: '评论来源',
        type: 'text',
        required: true,
        placeholder: '后续接入评论来源选择',
      },
    ],
  },
];

export function listTaskTemplates(): TaskTemplateDefinition[] {
  return TASK_TEMPLATES.map((template) => ({ ...template }));
}

export function getTaskTemplateById(templateId: string): TaskTemplateDefinition | null {
  return listTaskTemplates().find((template) => template.id === templateId) ?? null;
}
