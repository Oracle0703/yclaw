import { app } from 'electron';
import { App } from './app';

let application: App;

// 进程崩溃保护
process.on('uncaughtException', (error) => {
  console.error('[FATAL] Uncaught exception:', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] Unhandled rejection:', reason);
});

app.whenReady().then(() => {
  application = new App();
  application.start();
});

app.on('window-all-closed', () => {
  // macOS 下关闭所有窗口不退出应用
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // macOS 下点击 dock 图标重新创建窗口
  application.start();
});

app.on('before-quit', () => {
  application.shutdown();
});
