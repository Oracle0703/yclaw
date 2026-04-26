import { useEffect, useState } from 'react';
import { Button, Card, Col, Row, Space, Tag, Typography, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { IPC_CHANNELS } from '@shared/constants/channels';
import { PageShell } from '../../shared/components/PageShell';
import { useIpc, useIpcEvent } from '../../shared/hooks';
import { useLoading } from '../../shared/hooks/useLoading';
import { AddressBar } from './components/AddressBar';
import { InterventionPanel } from './components/InterventionPanel';
import { RecorderPanel } from './components/RecorderPanel';
import { TabBar } from './components/TabBar';
import { WebViewContainer } from './components/WebViewContainer';
import type { AIChatResponse, AIConfig, TaskFlow, TaskStep } from '@shared/types';
import type { InterventionState, Tab } from '@shared/types/browser';

const DEFAULT_COLLECTION_URL = 'https://www.baidu.com';

interface PlatformPreset {
  name: string;
  url: string;
  description: string;
  modes: string[];
  workspaceTitle?: string;
  searchUrl?: string;
  trendingUrl?: string;
  profileUrl?: string;
}

interface PlatformCategory {
  key: string;
  title: string;
  summary: string;
  items: PlatformPreset[];
}

const PLATFORM_CATEGORIES: PlatformCategory[] = [
  {
    key: 'commerce',
    title: '电商与交易',
    summary: '适合抓商品详情、搜索结果、评价和店铺页，优先结合开放接口或商品库。',
    items: [
      { name: '淘宝', url: 'https://www.taobao.com', description: '商品详情、店铺、评价区', modes: ['浏览器', '需登录'] },
      { name: '京东', url: 'https://www.jd.com', description: '商品页、价格、促销信息', modes: ['API优先', '浏览器补充'] },
      { name: '拼多多', url: 'https://www.pinduoduo.com', description: '活动页、商品聚合、评论', modes: ['浏览器', '反爬注意'] },
      { name: '1688', url: 'https://www.1688.com', description: '工厂货盘、批发商品、供应商', modes: ['浏览器', '企业采购'] },
    ],
  },
  {
    key: 'content',
    title: '内容与社区',
    summary: '适合抓笔记、帖子、评论和用户主页，通常需要登录态或滚动加载支持。',
    items: [
      { name: '小红书', url: 'https://www.xiaohongshu.com', description: '笔记详情、评论、达人页', modes: ['浏览器', '需登录'] },
      { name: '知乎', url: 'https://www.zhihu.com', description: '问题、回答、专栏、评论', modes: ['API优先', '浏览器补充'] },
      { name: '微博', url: 'https://weibo.com', description: '热搜、博文、评论流', modes: ['浏览器', '滚动加载'] },
      { name: 'B站', url: 'https://www.bilibili.com', description: '视频页、评论区、UP主页', modes: ['API优先', '浏览器补充'] },
    ],
  },
  {
    key: 'video',
    title: '短视频与直播',
    summary: '适合处理强前端渲染页面，优先保留浏览器会话或切 Chrome 执行。',
    items: [
      { name: '抖音', url: 'https://www.douyin.com', description: '视频详情、评论、账号主页', modes: ['浏览器', '登录态'] },
      { name: '快手', url: 'https://www.kuaishou.com', description: '短视频、直播间、评论', modes: ['浏览器', '滚动加载'] },
      { name: '视频号', url: 'https://channels.weixin.qq.com', description: '微信生态视频内容', modes: ['浏览器', '微信生态'] },
      { name: '虎牙直播', url: 'https://www.huya.com', description: '直播间、主播页、弹幕信息', modes: ['浏览器', '直播场景'] },
    ],
  },
  {
    key: 'local-service',
    title: '本地生活与服务',
    summary: '适合门店列表、套餐、团购和评论采集，常用 API 与浏览器混合方案。',
    items: [
      { name: '大众点评', url: 'https://www.dianping.com', description: '门店页、评价、榜单', modes: ['浏览器', '反爬注意'] },
      { name: '美团', url: 'https://www.meituan.com', description: '本地生活、团购、商家信息', modes: ['浏览器', '混合采集'] },
      { name: '58同城', url: 'https://www.58.com', description: '分类信息、房产、招聘', modes: ['浏览器', '类目广'] },
      { name: '安居客', url: 'https://www.anjuke.com', description: '房源页、楼盘、租售列表', modes: ['浏览器', '房产场景'] },
    ],
  },
  {
    key: 'enterprise',
    title: '招聘与企业信息',
    summary: '适合职位列表、企业信息和工商数据核验，结构化需求可优先 API。',
    items: [
      { name: 'Boss直聘', url: 'https://www.zhipin.com', description: '职位页、公司页、筛选结果', modes: ['浏览器', '需登录'] },
      { name: '智联招聘', url: 'https://www.zhaopin.com', description: '职位搜索、城市分类、企业页', modes: ['浏览器', '招聘场景'] },
      { name: '企查查', url: 'https://www.qcc.com', description: '企业工商、风险、股权信息', modes: ['API优先', '浏览器补充'] },
      { name: '天眼查', url: 'https://www.tianyancha.com', description: '企业图谱、法务、招投标', modes: ['API优先', '浏览器补充'] },
    ],
  },
];

const SCRAPE_PLAYBOOK = [
  {
    title: 'API 拉取',
    description: '有开放接口或自有中台时优先走 API，拿结构化数据更稳定。',
    highlights: ['结构化', '低成本', '适合批量'],
  },
  {
    title: '浏览器采集',
    description: '页面渲染、登录态、滚动加载或评论区抓取时，直接打开站点处理。',
    highlights: ['JS渲染', '登录态', '录制操作'],
  },
  {
    title: 'Chrome 会话',
    description: '需要真实 Chrome/Chromium 环境时，可切换到任务执行侧托管浏览器。',
    highlights: ['兼容站点', '任务执行', '可接外部浏览器'],
  },
] as const;

interface WorkspaceAction {
  key: string;
  title: string;
  description: string;
  url?: string;
  reviewMode: string;
  note: string;
}

interface PlatformWorkspaceConfig {
  title: string;
  summary: string;
  actions: WorkspaceAction[];
  manualActions: string[];
  commentStarters: string[];
  guardrails: string[];
}

interface ReviewQueueItem {
  id: string;
  platformName: string;
  title: string;
  status: 'pending' | 'ready' | 'archived';
  createdAtLabel: string;
  note: string;
  linkedTaskId?: string | null;
  linkedTaskName?: string | null;
}

function getHostnameLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function buildWorkspaceConfig(platform: PlatformPreset): PlatformWorkspaceConfig {
  if (platform.name === '抖音') {
    return {
      title: platform.workspaceTitle ?? '抖音运营工作台',
      summary: '围绕账号主页、热视频、搜索结果和评论区做人工在环采集与运营辅助。',
      actions: [
        {
          key: 'home',
          title: '打开平台主页',
          description: '进入抖音首页或推荐流，开始人工确认后的页面采集。',
          url: platform.url,
          reviewMode: '浏览器会话',
          note: '采集首页推荐流时，先确认登录态，再记录目标账号或作品链接。',
        },
        {
          key: 'search',
          title: '打开搜索页',
          description: '用于输入关键词、话题或账号名，定位目标内容。',
          url: platform.searchUrl ?? platform.url,
          reviewMode: '浏览器会话',
          note: '先用搜索页缩小样本，再决定抓取作品详情还是评论区。',
        },
        {
          key: 'creator',
          title: '打开创作者主页',
          description: '进入创作者主页后，适合采集作品列表和基础画像。',
          url: platform.profileUrl ?? platform.url,
          reviewMode: '登录态优先',
          note: '主页采集建议先记录作者 UID、粉丝量和最近作品发布时间。',
        },
        {
          key: 'trending',
          title: '打开热榜页',
          description: '适合发现热点选题，再转到详情页做评论分析。',
          url: platform.trendingUrl ?? platform.url,
          reviewMode: '浏览器会话',
          note: '热点页适合先收集题材和标题，再筛选需要深入分析的内容。',
        },
      ],
      manualActions: [
        '评论草稿生成后人工确认再发送',
        '关注对象加入复核清单，由人工逐个确认',
        '授权素材可下载归档，禁止绕过平台限制',
      ],
      commentStarters: [
        '这条内容的信息量很足，我补充一个观察点：',
        '如果从实操角度继续展开，我会更关注这三个细节：',
        '这个案例很适合做复盘，我建议再看看评论区里大家最关心的问题。',
      ],
      guardrails: [
        '不做无水印下载、批量自动评论或批量自动关注。',
        '涉及互动动作时保留人工确认步骤，避免误操作和平台风控。',
        '优先采集公开内容与自有授权内容，敏感信息单独审核。',
      ],
    };
  }

  return {
    title: platform.workspaceTitle ?? `${platform.name} 采集工作台`,
    summary: '先用浏览器打开目标站点，再按页面结构、接口能力和登录态决定采集方式。',
    actions: [
      {
        key: 'home',
        title: '打开平台主页',
        description: '先进入主页确认页面结构与登录态。',
        url: platform.url,
        reviewMode: '浏览器会话',
        note: '先确认目标页面类型，再决定是否需要录制操作或切换任务模板。',
      },
      {
        key: 'search',
        title: '打开搜索入口',
        description: '适合先搜关键词、账号名或商品名。',
        url: platform.searchUrl ?? platform.url,
        reviewMode: '浏览器会话',
        note: '搜索结果页通常更适合作为批量采集入口。',
      },
      {
        key: 'trending',
        title: '打开热点页',
        description: '从热点榜单或推荐位快速发现高价值页面。',
        url: platform.trendingUrl ?? platform.url,
        reviewMode: '浏览器会话',
        note: '热点页适合先做样本筛选，再进入详情页深采。',
      },
    ],
    manualActions: [
      '评论建议由 AI 生成草稿，发送前人工确认',
      '关注、收藏、互动类动作保持人工复核',
      '下载仅限自有或授权内容，不绕过平台限制',
    ],
    commentStarters: [
      '这条内容的关键信息可以再补充一下：',
      '如果从用户最关心的问题看，我会继续关注：',
      '这个案例适合继续拆解，我建议从这几个点展开：',
    ],
    guardrails: [
      '避免批量互动和绕过平台限制的行为。',
      '涉及账号动作或下载动作时，保留人工确认。',
      '优先用 API 或公开页面采集结构化数据。',
    ],
  };
}

function buildCommentDrafts(
  platformName: string,
  context: string,
  tone: '专业' | '友好' | '转化',
  starters: string[],
): string[] {
  const normalizedContext = context.trim() || `${platformName} 内容页面`;
  const toneGuide: Record<'专业' | '友好' | '转化', string> = {
    专业: '表达克制、信息密度高，避免过度营销。',
    友好: '像真实用户交流，语气自然，不要堆砌套话。',
    转化: '突出下一步动作，但保持克制，不强推。',
  };

  return starters.slice(0, 3).map((starter, index) => {
    return [
      starter,
      `围绕「${normalizedContext}」补充第 ${index + 1} 个重点，${toneGuide[tone]}`,
      '如果要发布，先人工确认措辞、事实和互动对象。',
    ].join('');
  });
}

function hasUsableAiConfig(config: AIConfig | null): boolean {
  if (!config) {
    return false;
  }

  if (config.provider === 'ollama') {
    return true;
  }

  if ((config.provider === 'openai' || config.provider === 'custom') && !!config.apiKey) {
    return true;
  }

  return false;
}

function extractDraftsFromAiMessage(content: string): string[] {
  const normalized = content
    .split('\n')
    .map((line) => line.replace(/^[-*0-9.\s]+/, '').trim())
    .filter(Boolean);

  if (normalized.length >= 2) {
    return normalized.slice(0, 3);
  }

  return content
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .slice(0, 3);
}

function inferExecutionIntent(title: string): 'comment' | 'follow' | 'download' | 'general' {
  if (title.includes('评论')) {
    return 'comment';
  }

  if (title.includes('关注')) {
    return 'follow';
  }

  if (title.includes('下载')) {
    return 'download';
  }

  return 'general';
}

type ExecutionIntent = ReturnType<typeof inferExecutionIntent>;

interface ExecutionTaskBlueprint {
  intentLabel: string;
  notes: string[];
  steps: TaskStep[];
}

function buildBaseExecutionSteps(): TaskStep[] {
  return [
    {
      id: 'step-screenshot',
      name: '记录当前页面截图',
      action: { type: 'screenshot', selector: 'body', timeout: 15000 },
    },
    {
      id: 'step-page-title',
      name: '采集页面标题',
      action: {
        type: 'extract',
        selector: 'title',
        params: { attribute: 'textContent' },
        timeout: 15000,
      },
    },
  ];
}

function buildExecutionTaskBlueprint(
  platform: PlatformPreset,
  intent: ExecutionIntent,
  detail: string,
): ExecutionTaskBlueprint {
  const baseSteps = buildBaseExecutionSteps();
  const genericNotes = [
    '这是任务草案，不是静默自动执行脚本。',
    '启动前先在自动化页确认目标页面、登录态和交互对象。',
  ];

  if (platform.name === '抖音' && intent === 'comment') {
    return {
      intentLabel: '评论草案',
      notes: [
        ...genericNotes,
        '将评论输入框选择器替换为真实页面元素，再决定是否执行输入步骤。',
        '最终发送按钮保留人工点击，不在草案里自动提交。',
      ],
      steps: [
        ...baseSteps,
        {
          id: 'step-comment-candidates',
          name: '采集评论区文本样本',
          action: {
            type: 'extract',
            selector: '[class*="comment"], [data-e2e*="comment"], [data-testid*="comment"]',
            params: { attribute: 'textContent' },
            timeout: 15000,
          },
        },
        {
          id: 'step-comment-input-draft',
          name: '人工确认后填写评论框选择器',
          action: {
            type: 'input',
            selector: '[data-yclaw-confirm="comment-input"]',
            params: { value: detail, clear: true },
            timeout: 15000,
          },
        },
        {
          id: 'step-comment-preview-shot',
          name: '填写后截图复核',
          action: { type: 'screenshot', selector: 'body', timeout: 15000 },
        },
      ],
    };
  }

  if (platform.name === '抖音' && intent === 'follow') {
    return {
      intentLabel: '关注复核',
      notes: [
        ...genericNotes,
        '先核对主页身份、近期内容和当前登录账号，再补关注按钮的真实选择器。',
        '默认使用占位选择器，未人工修改前不要直接启动。',
      ],
      steps: [
        ...baseSteps,
        {
          id: 'step-profile-signals',
          name: '采集主页公开信息',
          action: {
            type: 'extract',
            selector: 'h1, h2, [class*="profile"], [class*="author"], [data-e2e*="user"]',
            params: { attribute: 'textContent' },
            timeout: 15000,
          },
        },
        {
          id: 'step-follow-button-click',
          name: '人工确认后替换关注按钮选择器',
          action: {
            type: 'click',
            selector: '[data-yclaw-confirm="follow-button"]',
            timeout: 15000,
          },
        },
        {
          id: 'step-follow-result-shot',
          name: '关注动作后截图复核',
          action: { type: 'screenshot', selector: 'body', timeout: 15000 },
        },
      ],
    };
  }

  if (intent === 'comment') {
    return {
      intentLabel: '评论草案',
      notes: [
        ...genericNotes,
        '需要先替换评论输入框选择器，再决定是否执行输入动作。',
      ],
      steps: [
        ...baseSteps,
        {
          id: 'step-comment-candidates',
          name: '采集互动文本样本',
          action: {
            type: 'extract',
            selector: '[class*="comment"], [data-testid*="comment"], article, section',
            params: { attribute: 'textContent' },
            timeout: 15000,
          },
        },
        {
          id: 'step-comment-input-draft',
          name: '人工确认后填写评论框选择器',
          action: {
            type: 'input',
            selector: '[data-yclaw-confirm="comment-input"]',
            params: { value: detail, clear: true },
            timeout: 15000,
          },
        },
      ],
    };
  }

  if (intent === 'follow') {
    return {
      intentLabel: '关注复核',
      notes: [
        ...genericNotes,
        '需要人工替换关注按钮选择器，再决定是否执行点击动作。',
      ],
      steps: [
        ...baseSteps,
        {
          id: 'step-profile-signals',
          name: '采集账号公开信息',
          action: {
            type: 'extract',
            selector: 'h1, h2, [class*="profile"], [class*="author"], main',
            params: { attribute: 'textContent' },
            timeout: 15000,
          },
        },
        {
          id: 'step-follow-button-click',
          name: '人工确认后替换关注按钮选择器',
          action: {
            type: 'click',
            selector: '[data-yclaw-confirm="follow-button"]',
            timeout: 15000,
          },
        },
      ],
    };
  }

  return {
    intentLabel: intent === 'download' ? '素材复核' : '人工复核',
    notes: [
      ...genericNotes,
      '默认只生成页面确认与信息采集步骤，后续动作在自动化页补全。',
    ],
    steps: baseSteps,
  };
}

function buildExecutionTaskDraft(params: {
  platform: PlatformPreset;
  queueItem: ReviewQueueItem;
  activeUrl?: string | null;
  workspaceNote: string;
}): Pick<TaskFlow, 'name' | 'description' | 'entryUrl' | 'steps' | 'schedule'> {
  const { platform, queueItem, activeUrl, workspaceNote } = params;
  const intent = inferExecutionIntent(queueItem.title);
  const detail = workspaceNote.trim() || queueItem.note;
  const blueprint = buildExecutionTaskBlueprint(platform, intent, detail);
  const timestamp = new Date().toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  const description = [
    `来源平台：${platform.name}`,
    `复核动作：${queueItem.title}`,
    `当前备注：${detail}`,
    ...blueprint.notes.map((item, index) => `${index + 1}. ${item}`),
  ].join('\n');

  return {
    name: `${platform.name} · ${blueprint.intentLabel} · ${timestamp}`,
    description,
    entryUrl: activeUrl ?? platform.url,
    steps: blueprint.steps,
    schedule: { type: 'manual' },
  };
}

export default function App() {
  const { invoke } = useIpc();
  const { withLoading } = useLoading();
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<number | null>(null);
  const [interventionState, setInterventionState] = useState<InterventionState | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformPreset | null>(null);
  const [workspaceNote, setWorkspaceNote] = useState('');
  const [draftContext, setDraftContext] = useState('');
  const [draftTone, setDraftTone] = useState<'专业' | '友好' | '转化'>('专业');
  const [generatedDrafts, setGeneratedDrafts] = useState<string[]>([]);
  const [reviewQueue, setReviewQueue] = useState<ReviewQueueItem[]>([]);
  const [draftModeLabel, setDraftModeLabel] = useState('固定模板');
  const [draftConversationId, setDraftConversationId] = useState<string | null>(null);
  const [draftPending, setDraftPending] = useState(false);

  const reportActionError = (error: unknown, fallbackMessage: string) => {
    message.error(error instanceof Error ? error.message : fallbackMessage);
  };

  // 初始化：从主进程同步当前标签列表
  useEffect(() => {
    void invoke<Tab[]>(IPC_CHANNELS.BROWSER_LIST_TABS)
      .then((existingTabs) => {
        if (existingTabs && existingTabs.length > 0) {
          setTabs(existingTabs);
          setActiveTabId(existingTabs[existingTabs.length - 1].id);
        }
      })
      .catch((error) => {
        reportActionError(error, '读取标签页失败');
      });
  }, [invoke]);

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const workspaceConfig = selectedPlatform ? buildWorkspaceConfig(selectedPlatform) : null;
  const selectedPlatformQueue = selectedPlatform
    ? reviewQueue.filter((item) => item.platformName === selectedPlatform.name)
    : [];
  const browserKpis = [
    { title: '平台分类数', value: `${PLATFORM_CATEGORIES.length}` },
    { title: '平台入口数', value: `${PLATFORM_CATEGORIES.reduce((count, category) => count + category.items.length, 0)}` },
    { title: '打开采集页', value: `${tabs.length}` },
    { title: '当前站点', value: activeTab?.url ? getHostnameLabel(activeTab.url) : '未选择' },
  ] as const;

  const createTab = async (url = DEFAULT_COLLECTION_URL) => {
    try {
      await withLoading(async () => {
        const res = await invoke<Tab>(IPC_CHANNELS.BROWSER_CREATE_TAB, {
          url,
        });
        if (res) {
          setTabs((prev) => [...prev, res]);
          setActiveTabId(res.id);
        }
      }, '正在创建标签页...');
    } catch (error) {
      reportActionError(error, '创建标签页失败');
    }
  };

  const closeTab = async (id: number) => {
    try {
      await invoke(IPC_CHANNELS.BROWSER_CLOSE_TAB, { id });
      setTabs((prev) => {
        const remaining = prev.filter((t) => t.id !== id);
        setActiveTabId((currentId) =>
          currentId === id
            ? remaining.length > 0
              ? remaining[remaining.length - 1].id
              : null
            : currentId,
        );
        return remaining;
      });
    } catch (error) {
      reportActionError(error, '关闭标签页失败');
    }
  };

  const navigate = async (url: string) => {
    if (activeTabId != null) {
      try {
        await invoke(IPC_CHANNELS.BROWSER_NAVIGATE, { tabId: activeTabId, url });
      } catch (error) {
        reportActionError(error, '页面跳转失败');
      }
    }
  };

  const runTabAction = async (channel: string, fallbackMessage: string) => {
    if (activeTabId == null) {
      return;
    }

    try {
      await invoke(channel, { tabId: activeTabId });
    } catch (error) {
      reportActionError(error, fallbackMessage);
    }
  };

  const openWorkspaceAction = async (action: WorkspaceAction) => {
    if (action.url) {
      await createTab(action.url);
    }
    setWorkspaceNote(action.note);
  };

  const queueManualAction = (platformName: string, title: string) => {
    const preservedNote = workspaceNote.trim();
    const platformIntro = `已进入 ${platformName} 功能页。`;
    const resolvedNote =
      preservedNote && !preservedNote.startsWith(platformIntro)
        ? preservedNote
        : `待人工确认：${title}`;

    const queueItem: ReviewQueueItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      platformName,
      title,
      status: 'pending',
      createdAtLabel: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      note: resolvedNote,
    };
    setReviewQueue((current) => [queueItem, ...current]);
    setWorkspaceNote(resolvedNote);
  };

  const updateQueueStatus = (id: string, status: ReviewQueueItem['status']) => {
    setReviewQueue((current) =>
      current.map((item) => (item.id === id ? { ...item, status } : item)),
    );
  };

  const openAutomationWorkspace = async () => {
    try {
      await invoke(IPC_CHANNELS.WINDOW_OPEN, { module: 'automation' });
    } catch (error) {
      reportActionError(error, '打开自动化页失败');
    }
  };

  const linkQueueItemTask = async (item: ReviewQueueItem) => {
    if (!selectedPlatform) {
      return;
    }

    try {
      const createdTask = await invoke<TaskFlow>(
        IPC_CHANNELS.TASK_CREATE,
        buildExecutionTaskDraft({
          platform: selectedPlatform,
          queueItem: item,
          activeUrl: activeTab?.url ?? null,
          workspaceNote,
        }),
      );

      setReviewQueue((current) =>
        current.map((queueItem) =>
          queueItem.id === item.id
            ? {
                ...queueItem,
                linkedTaskId: createdTask.id,
                linkedTaskName: createdTask.name,
              }
            : queueItem,
        ),
      );
      setWorkspaceNote(
        `已生成自动化任务：${createdTask.name}（${createdTask.id}）。请先在自动化页替换占位选择器并复核步骤，再决定是否启动。`,
      );
      await openAutomationWorkspace();
    } catch (error) {
      reportActionError(error, '创建自动化任务失败');
    }
  };

  const generateFallbackDraftSuggestions = () => {
    if (!selectedPlatform || !workspaceConfig) {
      return;
    }

    const drafts = buildCommentDrafts(
      selectedPlatform.name,
      draftContext,
      draftTone,
      workspaceConfig.commentStarters,
    );
    setGeneratedDrafts(drafts);
    setDraftModeLabel('固定模板');
    if (drafts[0]) {
      setWorkspaceNote(drafts[0]);
    }
  };

  const generateDraftSuggestions = async () => {
    if (!selectedPlatform || !workspaceConfig) {
      return;
    }

    setDraftPending(true);

    try {
      const config = await invoke<AIConfig>(IPC_CHANNELS.AI_CONFIG_GET);
      if (!hasUsableAiConfig(config ?? null)) {
        generateFallbackDraftSuggestions();
        return;
      }

      const prompt = [
        `你是 ${selectedPlatform.name} 运营助理。`,
        `请基于以下内容生成 3 条中文评论候选，语气要求：${draftTone}。`,
        '要求：',
        '1. 像真实用户表达，不要机械。',
        '2. 不要承诺收益，不要诱导，不要刷量口吻。',
        '3. 每条单独一行，不加序号前缀也可以。',
        '4. 只输出评论候选，不要解释。',
        '',
        `页面上下文：${draftContext.trim() || `${selectedPlatform.name} 内容页面`}`,
      ].join('\n');

      const response = await invoke<AIChatResponse>(IPC_CHANNELS.AI_CHAT, {
        message: prompt,
        conversationId: draftConversationId ?? undefined,
      });
      const aiDrafts = extractDraftsFromAiMessage(response.message.content).slice(0, 3);

      if (aiDrafts.length === 0) {
        generateFallbackDraftSuggestions();
        return;
      }

      setDraftConversationId(response.conversationId);
      setGeneratedDrafts(aiDrafts);
      setDraftModeLabel('模型回复');
      setWorkspaceNote(aiDrafts[0]);
    } catch {
      generateFallbackDraftSuggestions();
    } finally {
      setDraftPending(false);
    }
  };

  useIpcEvent('tab:title', (data: unknown) => {
    const nextTab = data as Tab;
    setTabs((prev) => prev.map((t) => (t.id === nextTab.id ? { ...t, ...nextTab } : t)));
  });

  useIpcEvent('tab:navigate', (data: unknown) => {
    const nextTab = data as Tab;
    setTabs((prev) => prev.map((t) => (t.id === nextTab.id ? { ...t, ...nextTab } : t)));
  });

  useIpcEvent('tab:loading', (data: unknown) => {
    const nextTab = data as Tab;
    setTabs((prev) => prev.map((t) => (t.id === nextTab.id ? { ...t, ...nextTab } : t)));
  });

  useIpcEvent(IPC_CHANNELS.INTERVENTION_STEP_INFO, (data: unknown) => {
    setInterventionState(data as InterventionState);
  });

  return (
    <PageShell
      title="平台采集浏览器"
      subTitle="按国内平台分类快速打开站点，配合 API 或浏览器处理采集任务"
      content="先选平台，再决定走 API、内嵌浏览器会话还是 Chrome 托管执行，减少来回切页。"
      extra={
        <Space wrap className="yclaw-page-actions">
          <Tag color="processing">国内平台</Tag>
          <Tag color="gold">API / Browser</Tag>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => void createTab()}>
            新建空白采集页
          </Button>
        </Space>
      }
    >
      <Space direction="vertical" size={20} style={{ width: '100%' }}>
        <Row gutter={[16, 16]}>
          {browserKpis.map((item) => (
            <Col xs={24} md={8} key={item.title}>
              <Card className="yclaw-panel-card yclaw-kpi-card">
                <div className="yclaw-kpi-card-head">
                  <Typography.Text type="secondary">{item.title}</Typography.Text>
                </div>
                <Typography.Title
                  level={3}
                  className="yclaw-kpi-card-value yclaw-kpi-card-value-compact"
                >
                  {item.value}
                </Typography.Title>
              </Card>
            </Col>
          ))}
        </Row>

        <Card className="yclaw-panel-card" title="国内平台分类">
          <div className="browser-platform-categories">
            {PLATFORM_CATEGORIES.map((category) => (
              <section key={category.key} className="browser-platform-category">
                <div className="browser-platform-category-head">
                  <div>
                    <Typography.Title level={4} className="browser-platform-category-title">
                      {category.title}
                    </Typography.Title>
                    <div className="browser-platform-category-summary">{category.summary}</div>
                  </div>
                  <Tag color="blue">{category.items.length} 个入口</Tag>
                </div>
                <div className="browser-platform-grid">
                  {category.items.map((item) => (
                    <button
                      key={`${category.key}-${item.name}`}
                      type="button"
                      className="browser-platform-tile"
                      onClick={() => {
                        setSelectedPlatform(item);
                        setDraftContext('');
                        setDraftTone('专业');
                        setGeneratedDrafts([]);
                        setDraftModeLabel('固定模板');
                        setWorkspaceNote(`已进入 ${item.name} 功能页。先选择一个入口动作，再决定是否开启评论草稿或人工确认流程。`);
                      }}
                    >
                      <div className="browser-platform-tile-head">
                        <span className="browser-platform-tile-name">{item.name}</span>
                        <span className="browser-platform-tile-domain">{getHostnameLabel(item.url)}</span>
                      </div>
                      <div className="browser-platform-tile-description">{item.description}</div>
                      <div className="browser-platform-tile-tags">
                        {item.modes.map((mode) => (
                          <span
                            key={`${item.name}-${mode}`}
                            className="browser-platform-pill"
                          >
                            {mode}
                          </span>
                        ))}
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </Card>

        <Card className="yclaw-panel-card" title="采集方式建议">
          <div className="browser-playbook-grid">
            {SCRAPE_PLAYBOOK.map((item) => (
              <section key={item.title} className="browser-playbook-card">
                <Typography.Title level={4} className="browser-playbook-title">
                  {item.title}
                </Typography.Title>
                <div className="browser-playbook-description">{item.description}</div>
                <div className="browser-platform-tile-tags">
                  {item.highlights.map((highlight) => (
                    <span key={`${item.title}-${highlight}`} className="browser-platform-pill">
                      {highlight}
                    </span>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </Card>

        <Card
          className="yclaw-panel-card"
          title={workspaceConfig ? workspaceConfig.title : '平台功能页'}
        >
          {selectedPlatform && workspaceConfig ? (
            <div className="browser-workspace-grid">
              <section className="browser-workspace-section">
                <div className="browser-workspace-summary">{workspaceConfig.summary}</div>
                <div className="browser-platform-tile-tags">
                  {selectedPlatform.modes.map((mode) => (
                    <span key={`${selectedPlatform.name}-${mode}`} className="browser-platform-pill">
                      {mode}
                    </span>
                  ))}
                </div>
                <div className="browser-workspace-actions">
                  {workspaceConfig.actions.map((action) => (
                    <div key={action.key} className="browser-workspace-action-card">
                      <div className="browser-workspace-action-title">{action.title}</div>
                      <div className="browser-workspace-action-description">{action.description}</div>
                      <div className="browser-workspace-action-meta">{action.reviewMode}</div>
                      <Button
                        type="primary"
                        onClick={() => {
                          void openWorkspaceAction(action);
                        }}
                      >
                        {action.title}
                      </Button>
                    </div>
                  ))}
                </div>
              </section>

              <section className="browser-workspace-section">
                <div className="browser-workspace-section-title">评论草稿助手</div>
                <div className="browser-workspace-summary">
                  这里只生成评论草稿和运营建议，发送前仍需人工确认。
                </div>
                <div className="browser-workspace-action-meta">
                  当前来源：{draftModeLabel} {draftPending ? '· 生成中' : ''}
                </div>
                <input
                  className="browser-workspace-input"
                  value={draftContext}
                  onChange={(event) => {
                    setDraftContext(event.target.value);
                  }}
                  placeholder="输入当前作品、评论区或账号页的关键信息"
                />
                <select
                  className="browser-workspace-select"
                  value={draftTone}
                  onChange={(event) => {
                    setDraftTone(event.target.value as '专业' | '友好' | '转化');
                  }}
                  aria-label="评论草稿语气"
                >
                  <option value="专业">专业</option>
                  <option value="友好">友好</option>
                  <option value="转化">转化</option>
                </select>
                <Button
                  type="primary"
                  onClick={() => {
                    void generateDraftSuggestions();
                  }}
                >
                  {draftPending ? '生成中...' : '生成评论草稿'}
                </Button>
                <div className="browser-workspace-draft-list">
                  {workspaceConfig.commentStarters.map((starter) => (
                    <button
                      key={`${selectedPlatform.name}-${starter}`}
                      type="button"
                      className="browser-draft-button"
                      onClick={() => {
                        setWorkspaceNote(starter);
                      }}
                    >
                      {starter}
                    </button>
                  ))}
                </div>
                {generatedDrafts.length > 0 ? (
                  <div className="browser-workspace-list">
                    {generatedDrafts.map((draft) => (
                      <button
                        key={`${selectedPlatform.name}-${draft}`}
                        type="button"
                        className="browser-workspace-list-item"
                        onClick={() => {
                          setWorkspaceNote(draft);
                        }}
                      >
                        {draft}
                      </button>
                    ))}
                  </div>
                ) : null}
                <textarea
                  className="browser-workspace-notes"
                  value={workspaceNote}
                  onChange={(event) => {
                    setWorkspaceNote(event.target.value);
                  }}
                  placeholder="这里记录评论草稿、采集备注或待人工确认的动作说明。"
                />
              </section>

              <section className="browser-workspace-section">
                <div className="browser-workspace-section-title">人工确认动作</div>
                <div className="browser-workspace-list">
                  {workspaceConfig.manualActions.map((item) => (
                    <button
                      key={`${selectedPlatform.name}-${item}`}
                      type="button"
                      className="browser-workspace-list-item"
                      onClick={() => {
                        queueManualAction(selectedPlatform.name, item);
                      }}
                    >
                      {item}
                    </button>
                  ))}
                </div>
                <div className="browser-workspace-section-title">待复核队列</div>
                <div className="browser-workspace-list">
                  {selectedPlatformQueue.length > 0 ? (
                    selectedPlatformQueue.map((item) => (
                        <div key={item.id} className="browser-review-queue-card">
                          <div className="browser-review-queue-title">
                            <span>{item.title}</span>
                            <span className={`browser-review-status is-${item.status}`}>
                              {item.status === 'pending'
                                ? '待复核'
                                : item.status === 'ready'
                                  ? '可执行'
                                  : '已归档'}
                            </span>
                          </div>
                          <div className="browser-workspace-action-meta">{item.createdAtLabel}</div>
                          <div className="browser-workspace-action-description">{item.note}</div>
                          {item.linkedTaskId ? (
                            <div className="browser-workspace-action-meta">
                              已建任务：{item.linkedTaskName ?? item.linkedTaskId}
                            </div>
                          ) : null}
                          <div className="browser-review-queue-actions">
                            <Button
                              onClick={() => {
                                setWorkspaceNote(item.note);
                              }}
                            >
                              写入备注
                            </Button>
                            <Button
                              onClick={() => {
                                updateQueueStatus(item.id, 'ready');
                              }}
                            >
                              标记可执行
                            </Button>
                            {item.status === 'ready' && !item.linkedTaskId ? (
                              <Button
                                onClick={() => {
                                  void linkQueueItemTask(item);
                                }}
                              >
                                生成执行任务
                              </Button>
                            ) : null}
                            {item.linkedTaskId ? (
                              <Button
                                onClick={() => {
                                  void openAutomationWorkspace();
                                }}
                              >
                                打开自动化页
                              </Button>
                            ) : null}
                            <Button
                              onClick={() => {
                                updateQueueStatus(item.id, 'archived');
                              }}
                            >
                              归档
                            </Button>
                          </div>
                        </div>
                      ))
                  ) : (
                    <div className="browser-workspace-empty">
                      还没有待复核动作，点击上面的动作项即可加入队列。
                    </div>
                  )}
                </div>
                <div className="browser-workspace-section-title">边界说明</div>
                <div className="browser-workspace-list">
                  {workspaceConfig.guardrails.map((item) => (
                    <div key={`${selectedPlatform.name}-guard-${item}`} className="browser-workspace-guardrail">
                      {item}
                    </div>
                  ))}
                </div>
              </section>
            </div>
          ) : (
            <div className="browser-workspace-empty">
              先从上方选择一个国内平台，再进入对应的平台功能页。
            </div>
          )}
        </Card>

        <Card className="yclaw-panel-card" title="当前采集会话">
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <TabBar
              tabs={tabs}
              activeTabId={activeTabId}
              onSwitch={setActiveTabId}
              onClose={(id) => {
                void closeTab(id);
              }}
              onNew={() => {
                void createTab();
              }}
            />
            <AddressBar
              url={activeTab?.url ?? ''}
              canGoBack={activeTab?.canGoBack ?? false}
              canGoForward={activeTab?.canGoForward ?? false}
              onNavigate={(url) => {
                void navigate(url);
              }}
              onBack={() => {
                void runTabAction(IPC_CHANNELS.BROWSER_GO_BACK, '后退失败');
              }}
              onForward={() => {
                void runTabAction(IPC_CHANNELS.BROWSER_GO_FORWARD, '前进失败');
              }}
              onReload={() => {
                void runTabAction(IPC_CHANNELS.BROWSER_RELOAD, '刷新失败');
              }}
            />
          </Space>
        </Card>

        <Card className="yclaw-panel-card" title="页面会话信息">
          <div className="browser-viewport yclaw-browser-frame">
            <WebViewContainer tab={activeTab ?? null} interventionState={interventionState} />
          </div>
        </Card>

        <InterventionPanel state={interventionState} />

        <RecorderPanel tabId={activeTabId} />
      </Space>
    </PageShell>
  );
}
