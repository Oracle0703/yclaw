const fs = require('fs');
const path = require('path');

async function afterPack(context) {
  const unpackedRoot = path.join(
    context.appOutDir,
    'resources',
    'app.asar.unpacked',
    'node_modules',
    'better-sqlite3',
  );

  if (!fs.existsSync(unpackedRoot)) {
    return;
  }

  const keepFile = path.join(unpackedRoot, 'build', 'Release', 'better_sqlite3.node');

  for (const entry of fs.readdirSync(unpackedRoot)) {
    const entryPath = path.join(unpackedRoot, entry);
    if (entryPath === path.join(unpackedRoot, 'build')) {
      continue;
    }
    fs.rmSync(entryPath, { recursive: true, force: true });
  }

  const buildRoot = path.join(unpackedRoot, 'build');
  if (fs.existsSync(buildRoot)) {
    for (const entry of fs.readdirSync(buildRoot)) {
      const entryPath = path.join(buildRoot, entry);
      if (entryPath === path.join(unpackedRoot, 'build', 'Release')) {
        continue;
      }
      fs.rmSync(entryPath, { recursive: true, force: true });
    }
  }

  const releaseRoot = path.join(unpackedRoot, 'build', 'Release');
  if (fs.existsSync(releaseRoot)) {
    for (const entry of fs.readdirSync(releaseRoot)) {
      const entryPath = path.join(releaseRoot, entry);
      if (entryPath === keepFile) {
        continue;
      }
      fs.rmSync(entryPath, { recursive: true, force: true });
    }
  }
}

module.exports = afterPack;
