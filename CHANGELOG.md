# Changelog

All notable changes to YClaw will be documented in this file.

The project aims to follow Keep a Changelog principles and semantic version tags for published releases.

When a Git tag like `v1.0.0` is published, the release workflow looks for `## [v1.0.0]` first, then `## [1.0.0]`, and falls back to `## [Unreleased]` if no versioned section exists yet.

## [Unreleased]

### Added

- open-source baseline documents: `README`, `LICENSE`, `CONTRIBUTING`, `CODE_OF_CONDUCT`, `SECURITY`
- GitHub issue templates and pull request template
- CI workflow for lint, typecheck, test, and build verification
- tag-driven release workflow for cross-platform desktop packaging
- shared `PageShell` renderer layout to unify page header and content framing

### Changed

- refined workbench and module layouts for denser, cleaner operations UI
- tightened menu and content shell spacing across stock, automation, browser, plugin center, and settings
- hardened test stability by removing nondeterministic tab mock IDs
- normalized `package-lock.json` package sources back to the public npm registry for GitHub Actions compatibility
- corrected Electron packaging inputs so runtime dependencies are included in release artifacts

### Fixed

- flaky `TabManager` unit test caused by random duplicate mock tab IDs
- multi-entry Vite build coverage for renderer entry pages
- stale main-process `warmupTimers` references in app bootstrap
- release-time builder config issues caused by missing icon files and excluded runtime dependencies

## [v1.0.0]

Initial public baseline release.

### Added

- multi-entry Electron desktop shell with workbench, stock, automation, browser, and plugin center modules
- shared renderer page shell and improved module layout consistency
- unit test coverage for services, engines, shared utilities, and reusable renderer components
- GitHub CI, release automation, issue templates, contribution guides, and repository community files

### Changed

- normalized dependency source URLs for GitHub Actions compatibility
- prepared cross-platform packaging workflow for tagged releases

### Fixed

- flaky tab manager test mocks caused by nondeterministic tab IDs
- builder configuration issues that excluded runtime dependencies from packaged artifacts
