export interface Tab {
  id: number;
  title: string;
  url: string;
  loading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  sessionPartition: string;
}
