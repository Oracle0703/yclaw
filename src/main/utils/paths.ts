import os from 'node:os';
import path from 'path';

function resolveElectronApp(): { getPath: (name: string) => string } | null {
  try {
    // Use eval('require') so this file compiles under both the CommonJS main
    // tsconfig and ESNext-style runner/test configs without referencing
    // import.meta (which is illegal in CommonJS emit).
    // eslint-disable-next-line no-eval
    const req = eval('typeof require === "function" ? require : null') as NodeRequire | null;
    if (!req) {
      return null;
    }
    const electron = req('electron') as { app?: { getPath: (name: string) => string } };
    return electron?.app ?? null;
  } catch {
    return null;
  }
}

/**
 * 应用路径管理
 */
export function getUserDataPath(): string {
  const explicitRoot = process.env.YCLAW_DATA_DIR;
  if (explicitRoot) {
    return explicitRoot;
  }

  const electronApp = resolveElectronApp();
  if (electronApp) {
    return electronApp.getPath('userData');
  }

  return path.join(os.homedir(), '.yclaw');
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

export function getFeaturePackagesPath(): string {
  return path.join(getUserDataPath(), 'features');
}

export function getRendererUrl(entry: string): string {
  if (process.env.NODE_ENV === 'development') {
    const devServerUrl = (process.env.ELECTRON_RENDERER_URL ?? 'http://localhost:5173').replace(
      /\/$/,
      '',
    );
    return `${devServerUrl}/entries/${entry}/index.html`;
  }
  return `file://${path.join(__dirname, '..', '..', '..', 'renderer', 'entries', entry, 'index.html')}`;
}
