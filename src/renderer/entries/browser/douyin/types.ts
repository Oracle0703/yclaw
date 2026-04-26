export interface DouyinSearchItem {
  id: string;
  title: string;
  authorName: string;
  publishLabel: string;
  url: string;
  coverUrl?: string;
  metricsSummary?: string;
  keywords?: string[];
}

export interface DouyinAnalysisTarget {
  item: DouyinSearchItem;
  pageTitle?: string;
  topicTags: string[];
  commentSamples: string[];
  captureStatus: 'idle' | 'loading' | 'ready' | 'error';
}

export interface DouyinCommentInsight {
  summary: string;
  keywords: string[];
  sentiment: 'positive' | 'neutral' | 'negative' | 'mixed';
  riskFlags: string[];
}

export interface DouyinDownloadRequest {
  targetId: string;
  authorized: boolean;
  status: 'idle' | 'confirming' | 'ready' | 'downloading' | 'done' | 'error';
  confirmedAt?: string;
  savedPath?: string;
}

export interface DouyinQueueItem {
  id: string;
  title: string;
  note: string;
  status: 'pending' | 'ready' | 'archived';
}

export interface DouyinDownloadRecord {
  targetId: string;
  title: string;
  sourceUrl: string;
  status: 'downloading' | 'done';
  confirmedAt: string;
  savedPath?: string;
}
