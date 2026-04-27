import type {
  DouyinCommentInsight,
  DouyinDownloadRequest,
  DouyinSearchItem,
} from './types';

const SAMPLE_AUTHORS = ['穿搭实验室', '选品观察站', '品牌拆解员'];

export function buildDouyinSearchResults(keyword: string): DouyinSearchItem[] {
  const normalized = keyword.trim() || '抖音热点';

  return SAMPLE_AUTHORS.map((authorName, index) => ({
    id: `douyin-search-${index + 1}`,
    title: `${normalized} 第 ${index + 1} 条样本`,
    authorName,
    publishLabel: `${index + 1} 小时前`,
    url: `https://www.douyin.com/video/100${index + 1}`,
    metricsSummary: `点赞 ${3 + index}.${index}w · 评论 ${800 + index * 120}`,
    keywords: [normalized, '评论分析', '样本'],
  }));
}

export function buildDouyinInsight(input: {
  title: string;
  commentSamples: string[];
}): DouyinCommentInsight {
  const allText = [input.title, ...input.commentSamples].join(' ');
  const sentiment =
    input.commentSamples.some((item) => item.includes('太高') || item.includes('避坑'))
      ? 'mixed'
      : 'positive';

  return {
    summary: `当前视频「${input.title}」的评论讨论集中在购买判断、信息补充和实际体验。`,
    keywords: Array.from(new Set(allText.split(/[\s，。；、]/).filter(Boolean))).slice(0, 5),
    sentiment,
    riskFlags:
      sentiment === 'mixed'
        ? ['价格争议', '评论分歧，需要人工复核']
        : ['需确认是否涉及营销承诺'],
  };
}

export function buildDouyinReviewQueueNote(input: {
  actionTitle: string;
  targetTitle: string;
  targetUrl: string;
  workspaceNote: string;
}): string {
  return [
    `目标视频：${input.targetTitle}`,
    `来源链接：${input.targetUrl}`,
    `动作类型：${input.actionTitle}`,
    `当前备注：${input.workspaceNote.trim() || '无'}`,
  ].join('\n');
}

export function createInitialDownloadRequest(targetId: string): DouyinDownloadRequest {
  return { targetId, authorized: false, status: 'idle' };
}

export function confirmDownloadAuthorization(
  request: DouyinDownloadRequest,
  authorized: boolean,
  confirmedAt: string,
): DouyinDownloadRequest {
  return {
    ...request,
    authorized,
    status: authorized ? 'ready' : 'confirming',
    confirmedAt: authorized ? confirmedAt : undefined,
  };
}

export function markDownloadStarted(
  request: DouyinDownloadRequest,
): DouyinDownloadRequest {
  return { ...request, status: 'downloading' };
}

export function markDownloadCompleted(
  request: DouyinDownloadRequest,
  savedPath: string,
): DouyinDownloadRequest {
  return { ...request, status: 'done', savedPath };
}

export function buildDouyinDraftPrompt(input: {
  targetTitle: string;
  commentSamples: string[];
  workspaceNote: string;
  tone: '专业' | '友好' | '转化';
}): string {
  return [
    `请基于抖音视频「${input.targetTitle}」生成 3 条评论草稿。`,
    `语气：${input.tone}`,
    `评论样本：${input.commentSamples.join(' | ')}`,
    `补充备注：${input.workspaceNote.trim() || '无'}`,
    '要求：自然、克制、适合人工审核后发送。',
  ].join('\n');
}
