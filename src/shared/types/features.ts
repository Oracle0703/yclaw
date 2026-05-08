export interface FeaturePackageFile {
  path: string;
  source: string;
}

export interface FeaturePackageManifestEntry {
  id: string;
  module: string;
  displayName: string;
  version: string;
  description?: string;
  sourceDirectory?: string;
  files?: FeaturePackageFile[];
}

export interface FeaturePackageManifestDocument {
  packages: FeaturePackageManifestEntry[];
}

export interface FeaturePackageInstallState {
  installed: boolean;
  version?: string;
  installedAt?: string;
  entryPath?: string;
}

export type FeaturePackageCatalogItem = FeaturePackageManifestEntry &
  Omit<FeaturePackageInstallState, 'version'> & {
    installed: boolean;
  };

export interface FeaturePackageInstallResult extends FeaturePackageInstallState {
  id: string;
  module: string;
}
