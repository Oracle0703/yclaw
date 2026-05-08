import { createRequire } from 'module';

const requireFromHere = createRequire(import.meta.url);
const { ensureElectronNativeDeps } = requireFromHere('./ensure-electron-native-deps.cjs') as {
  ensureElectronNativeDeps: (rootDir: string) => void;
};

export { ensureElectronNativeDeps };
