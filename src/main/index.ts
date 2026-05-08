import { app } from 'electron';
import { App } from './app';
import { bootstrapMainProcess } from './bootstrap';

// 进程崩溃保护
process.on('uncaughtException', (error) => {
  console.error('[FATAL] Uncaught exception:', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] Unhandled rejection:', reason);
});

bootstrapMainProcess(app, () => new App());
