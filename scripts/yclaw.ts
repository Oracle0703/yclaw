#!/usr/bin/env node
/**
 * yclaw CLI 可执行包装。
 *
 * 通过 tsx 直接运行 .ts 入口，避免要求用户先 build。
 * 生产构建后可指向 dist/cli/yclaw.js。
 */

import { runCli } from '../src/cli/yclaw';

runCli({ argv: process.argv.slice(2) })
  .then((code) => {
    process.exit(code);
  })
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(`yclaw: fatal: ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
    process.exit(2);
  });
