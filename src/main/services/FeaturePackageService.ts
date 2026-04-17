import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import http from 'http';
import https from 'https';
import type {
  AppConfig,
  FeaturePackageCatalogItem,
  FeaturePackageInstallResult,
  FeaturePackageManifestDocument,
  FeaturePackageManifestEntry,
} from '@shared/types';
import { getFeaturePackagesPath } from '../utils/paths';

interface FeaturePackageConfigAdapter {
  get<K extends keyof AppConfig>(key: K): AppConfig[K];
  set<K extends keyof AppConfig>(key: K, value: AppConfig[K]): void;
}

interface FeaturePackageServiceOptions {
  configService?: FeaturePackageConfigAdapter;
  manifestPath?: string;
  installRoot?: string;
}

const FEATURE_MANIFEST_FILENAME = 'feature-manifest.json';
const DOWNLOAD_TIMEOUT_MS = 30_000;
const MAX_DOWNLOAD_REDIRECTS = 5;

function resolveDefaultManifestPath(): string {
  const candidates: string[] = [];

  if (process.env.YCLAW_FEATURE_MANIFEST_PATH) {
    candidates.push(process.env.YCLAW_FEATURE_MANIFEST_PATH);
  }

  // 打包后资源目录
  if (typeof process.resourcesPath === 'string' && process.resourcesPath.length > 0) {
    candidates.push(path.join(process.resourcesPath, 'resources', FEATURE_MANIFEST_FILENAME));
    candidates.push(path.join(process.resourcesPath, FEATURE_MANIFEST_FILENAME));
  }

  // 开发模式 / 源码运行
  candidates.push(path.resolve(process.cwd(), 'resources', FEATURE_MANIFEST_FILENAME));

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  // 都找不到时返回第一个优先级最高的候选以便下游打印更有诊断性的路径
  return candidates[0] ?? path.resolve(process.cwd(), 'resources', FEATURE_MANIFEST_FILENAME);
}

export class FeaturePackageService {
  private readonly configService: FeaturePackageConfigAdapter;
  private readonly manifestPath: string;
  private readonly installRoot: string;
  private manifest: FeaturePackageManifestDocument;

  constructor(options: FeaturePackageServiceOptions = {}) {
    if (!options.configService) {
      throw new Error('configService is required');
    }

    this.configService = options.configService;
    this.manifestPath = options.manifestPath ?? resolveDefaultManifestPath();
    this.installRoot = options.installRoot ?? getFeaturePackagesPath();
    fs.mkdirSync(this.installRoot, { recursive: true });
    this.manifest = this.loadManifest();
  }

  listPackages(): FeaturePackageCatalogItem[] {
    const installedPackages = this.configService.get('featurePackages');

    return this.manifest.packages.map((pkg) => {
      const state = installedPackages[pkg.id];
      const entryPath = state?.entryPath;
      const installed = Boolean(state?.installed && entryPath && fs.existsSync(entryPath));

      // 先 spread 持久化状态，再 spread manifest——确保 manifest 的 version/displayName 等元数据
      // 是最权威的显示值，不被上一版本的安装状态覆盖。
      return {
        ...state,
        ...pkg,
        installed,
      };
    });
  }

  isManagedModule(module: string): boolean {
    return this.manifest.packages.some((pkg) => pkg.module === module);
  }

  getInstalledEntryPath(module: string): string | null {
    const pkg = this.getPackageByModule(module);
    if (!pkg) {
      return null;
    }

    const state = this.configService.get('featurePackages')[pkg.id];
    if (!state?.installed || !state.entryPath || !fs.existsSync(state.entryPath)) {
      return null;
    }

    return state.entryPath;
  }

  resolveRendererUrl(module: string): string | null {
    const entryPath = this.getInstalledEntryPath(module);
    return entryPath ? pathToFileURL(entryPath).toString() : null;
  }

  async installPackage(id: string): Promise<FeaturePackageInstallResult> {
    const pkg = this.getPackageById(id);
    if (!pkg) {
      throw new Error(`Unknown feature package "${id}"`);
    }

    const targetDir = path.join(this.installRoot, pkg.id, pkg.version);
    fs.rmSync(targetDir, { recursive: true, force: true });
    fs.mkdirSync(targetDir, { recursive: true });

    if (pkg.sourceDirectory) {
      this.copyDirectory(this.resolveManifestRelativePath(pkg.sourceDirectory), targetDir);
    } else if (pkg.files && pkg.files.length > 0) {
      for (const file of pkg.files) {
        const destination = path.join(targetDir, file.path);
        await this.materializeFile(file.source, destination);
      }
    } else {
      throw new Error(`Feature package "${id}" has no installable sources configured`);
    }

    const entryPath = this.resolveEntryFile(targetDir, pkg.module);
    if (!entryPath) {
      throw new Error(
        `Feature package "${id}" is missing entry file under ${targetDir} (expected entries/${pkg.module}/index.html)`,
      );
    }

    const nextState = {
      ...this.configService.get('featurePackages'),
      [pkg.id]: {
        installed: true,
        version: pkg.version,
        installedAt: new Date().toISOString(),
        entryPath,
      },
    };

    this.configService.set('featurePackages', nextState);

    return {
      id: pkg.id,
      module: pkg.module,
      installed: true,
      version: pkg.version,
      installedAt: nextState[pkg.id].installedAt,
      entryPath,
    };
  }

  private resolveEntryFile(targetDir: string, moduleName: string): string | null {
    // Vite feature 构建输出为 entries/<module>/index.html
    // 兼容早期打包产物的 renderer/entries/<module>/index.html。
    const candidates = [
      path.join(targetDir, 'entries', moduleName, 'index.html'),
      path.join(targetDir, 'renderer', 'entries', moduleName, 'index.html'),
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    return null;
  }

  private loadManifest(): FeaturePackageManifestDocument {
    if (!fs.existsSync(this.manifestPath)) {
      return { packages: [] };
    }

    const raw = fs.readFileSync(this.manifestPath, 'utf-8');
    const parsed = JSON.parse(raw) as FeaturePackageManifestDocument;
    return {
      packages: Array.isArray(parsed.packages) ? parsed.packages : [],
    };
  }

  private getPackageById(id: string): FeaturePackageManifestEntry | undefined {
    return this.manifest.packages.find((pkg) => pkg.id === id);
  }

  private getPackageByModule(module: string): FeaturePackageManifestEntry | undefined {
    return this.manifest.packages.find((pkg) => pkg.module === module);
  }

  private resolveManifestRelativePath(location: string): string {
    if (path.isAbsolute(location)) {
      return location;
    }
    return path.resolve(path.dirname(this.manifestPath), location);
  }

  private copyDirectory(sourceDir: string, targetDir: string): void {
    if (!fs.existsSync(sourceDir)) {
      throw new Error(`Feature package source directory does not exist: ${sourceDir}`);
    }

    fs.mkdirSync(targetDir, { recursive: true });

    for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
      const sourcePath = path.join(sourceDir, entry.name);
      const targetPath = path.join(targetDir, entry.name);

      if (entry.isDirectory()) {
        this.copyDirectory(sourcePath, targetPath);
      } else {
        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        fs.copyFileSync(sourcePath, targetPath);
      }
    }
  }

  private async materializeFile(source: string, destination: string): Promise<void> {
    fs.mkdirSync(path.dirname(destination), { recursive: true });

    if (/^https?:\/\//.test(source)) {
      await this.downloadFile(source, destination);
      return;
    }

    if (source.startsWith('file://')) {
      const filePath = new URL(source);
      fs.copyFileSync(filePath, destination);
      return;
    }

    const sourcePath = this.resolveManifestRelativePath(source);
    fs.copyFileSync(sourcePath, destination);
  }

  private async downloadFile(
    source: string,
    destination: string,
    redirectCount = 0,
  ): Promise<void> {
    if (redirectCount > MAX_DOWNLOAD_REDIRECTS) {
      throw new Error(`Feature package download exceeded redirect limit: ${source}`);
    }

    const client = source.startsWith('https://') ? https : http;

    await new Promise<void>((resolve, reject) => {
      const request = client.get(source, (response) => {
        if (
          response.statusCode &&
          response.statusCode >= 300 &&
          response.statusCode < 400 &&
          response.headers.location
        ) {
          response.resume();
          this.downloadFile(response.headers.location, destination, redirectCount + 1)
            .then(resolve)
            .catch(reject);
          return;
        }

        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download feature package file: ${response.statusCode}`));
          return;
        }

        const stream = fs.createWriteStream(destination);
        response.pipe(stream);
        stream.on('finish', () => {
          stream.close();
          resolve();
        });
        stream.on('error', reject);
      });

      request.setTimeout(DOWNLOAD_TIMEOUT_MS, () => {
        request.destroy(new Error(`Feature package download timed out: ${source}`));
      });

      request.on('error', reject);
    });
  }
}
