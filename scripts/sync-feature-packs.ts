import fs from 'fs';
import path from 'path';

const rootDir = path.resolve(__dirname, '..');
const sourceRoot = path.resolve(rootDir, 'dist', 'features');
const targetRoot = path.resolve(rootDir, 'resources', 'feature-packs');

function copyDirectory(sourceDir: string, targetDir: string): void {
  fs.mkdirSync(targetDir, { recursive: true });

  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      copyDirectory(sourcePath, targetPath);
    } else {
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}

fs.rmSync(targetRoot, { recursive: true, force: true });

if (!fs.existsSync(sourceRoot)) {
  process.exit(0);
}

for (const entry of fs.readdirSync(sourceRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) {
    continue;
  }
  copyDirectory(path.join(sourceRoot, entry.name), path.join(targetRoot, entry.name));
}
