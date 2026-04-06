import { app } from 'electron';
import path from 'path';

/**
 * 应用路径管理
 */
export function getUserDataPath(): string {
  return app.getPath('userData');
}

export function getDatabasePath(): string {
  return path.join(getUserDataPath(), 'databases');
}

export function getStoragePath(): string {
  return path.join(getUserDataPath(), 'storage');
}

export function getConfigPath(): string {
  return path.join(getUserDataPath(), 'config');
}

export function getLogPath(): string {
  return path.join(getUserDataPath(), 'logs');
}

export function getPluginsPath(): string {
  return path.join(getUserDataPath(), 'plugins');
}

export function getRendererUrl(entry: string): string {
  if (process.env.NODE_ENV === 'development') {
    return `http://localhost:5173/entries/${entry}/index.html`;
  }
  return `file://${path.join(__dirname, '..', 'renderer', 'entries', entry, 'index.html')}`;
}
