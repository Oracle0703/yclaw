import type { App as ElectronApp } from 'electron';
import { setupSingleInstanceGuard } from './single-instance';

interface MainApplication {
  start(): Promise<void>;
  showWorkbench(): void;
  shutdown(): void;
}

export function bootstrapMainProcess(
  app: Pick<ElectronApp, 'requestSingleInstanceLock' | 'quit' | 'whenReady' | 'on'>,
  createApplication: () => MainApplication,
): void {
  let application: MainApplication | null = null;
  let startPromise: Promise<void> | null = null;

  function getApplication(): MainApplication {
    if (!application) {
      application = createApplication();
    }
    return application;
  }

  function ensureApplicationStarted(): Promise<MainApplication> {
    const instance = getApplication();
    if (!startPromise) {
      startPromise = Promise.resolve(instance.start());
    }

    return startPromise.then(() => instance);
  }

  const acquiredSingleInstance = setupSingleInstanceGuard(app, () => {
    void app.whenReady().then(async () => {
      const instance = await ensureApplicationStarted();
      instance.showWorkbench();
    });
  });

  if (acquiredSingleInstance) {
    void app.whenReady().then(() => {
      void ensureApplicationStarted();
    });
  }

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('activate', () => {
    void ensureApplicationStarted().then((instance) => {
      instance.showWorkbench();
    });
  });

  app.on('before-quit', () => {
    application?.shutdown();
  });
}
