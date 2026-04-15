export interface Tab {
  id: number;
  title: string;
  url: string;
  loading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  sessionPartition: string;
}

export interface BrowserSession {
  id: string;
  name: string;
  domain: string;
  partition: string;
  createdAt: string;
  updatedAt: string;
}

export type FlowRunnerStatus =
  | 'idle'
  | 'running'
  | 'paused'
  | 'failed'
  | 'completed'
  | 'intervention';

export interface InterventionState {
  taskId: string;
  batchId: string;
  flowRunnerStatus: FlowRunnerStatus;
  webContentsId: number;
  sessionPartition: string;
  breakpoint?: {
    stepIndex: number;
    error: string;
    screenshot?: string;
    domSnapshot?: string;
  } | null;
}
