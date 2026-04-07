# YClaw

> Extensible desktop ops workspace built with Electron, React, and Vite.

[![License: MIT](https://img.shields.io/badge/license-MIT-0f172a.svg)](./LICENSE)
![Electron](https://img.shields.io/badge/electron-33-1f2937.svg)
![React](https://img.shields.io/badge/react-18-2563eb.svg)
![TypeScript](https://img.shields.io/badge/typescript-5-0f766e.svg)
![Vite](https://img.shields.io/badge/vite-6-7c3aed.svg)

YClaw is a modular desktop workbench for operations-heavy workflows: analytics, automation, embedded browsing, plugin governance, and shared system services. It is structured as an Electron shell with multiple renderer entries, a typed IPC layer, and a plugin-oriented architecture.

The repository is currently in an early open-source friendly stage: core scaffolding, module shells, services, tests, and product docs are present; some production capabilities are still evolving.

## Why YClaw

YClaw targets a practical gap between generic admin panels and heavyweight internal tooling platforms. It treats the desktop shell as an operations cockpit:

- one container for browsing, automation, analysis, and plugin governance
- multiple focused renderer entries instead of forcing everything into one page
- typed boundaries between Electron main process, preload bridge, and React modules
- an architecture that can grow from local tooling into a more extensible desktop platform

## At A Glance

- Docs: [`docs/prd.md`](/Users/huangyu/Desktop/allProject/yclaw/docs/prd.md), [`docs/architecture.md`](/Users/huangyu/Desktop/allProject/yclaw/docs/architecture.md), [`docs/specs.md`](/Users/huangyu/Desktop/allProject/yclaw/docs/specs.md)
- Changelog: [`CHANGELOG.md`](/Users/huangyu/Desktop/allProject/yclaw/CHANGELOG.md)
- Contribution guide: [`CONTRIBUTING.md`](/Users/huangyu/Desktop/allProject/yclaw/CONTRIBUTING.md)
- Code of conduct: [`CODE_OF_CONDUCT.md`](/Users/huangyu/Desktop/allProject/yclaw/CODE_OF_CONDUCT.md)
- Security policy: [`SECURITY.md`](/Users/huangyu/Desktop/allProject/yclaw/SECURITY.md)
- License: [`LICENSE`](/Users/huangyu/Desktop/allProject/yclaw/LICENSE)

## Highlights

- Electron desktop shell with multi-window module management
- React + Vite renderer architecture with multiple entry pages
- Shared IPC bridge and event bus between main and renderer processes
- Built-in module shells for:
  - `workbench`
  - `stock`
  - `automation`
  - `browser`
  - `plugin-center`
- Plugin host and plugin template for future extension points
- System services for config, logging, updates, tray, and local storage
- Test coverage for services, engines, shared utilities, and renderer components

## Current Status

Implemented in this repository today:

- Electron main-process app lifecycle and window management
- Preload + `contextBridge` IPC bridge
- Workbench UI and module navigation shell
- Stock analysis demo page with chart/indicator workflow
- Automation task list/editor/execution panel shell
- Embedded browser session shell with tab/address abstractions
- Plugin center shell with permission review flow
- SQLite-backed database service, config service, log service, tray service, update service
- Unit tests via Vitest

Still evolving:

- Full production-grade automation execution against real pages
- Complete plugin runtime isolation strategy
- Broader production packaging verification across all modules
- End-to-end flows beyond the current unit-focused coverage

## Tech Stack

- Electron 33
- React 18
- Vite 6
- TypeScript 5
- Ant Design 5 + Pro Components
- better-sqlite3
- electron-store
- electron-log
- electron-builder
- Vitest + Testing Library

## Quick Start

### Requirements

- Node.js `>= 18`
- npm
- macOS / Windows / Linux supported by Electron tooling

### Install

```bash
npm install
```

### Run In Development

```bash
npm run dev
```

This starts:

- Vite dev server
- preload TypeScript watch build
- Electron main process through `tsx`

### Build

```bash
npm run build
```

### Package Release Artifacts

```bash
npm run dist
```

Platform-specific packaging is also available:

```bash
npm run dist:mac
npm run dist:win
npm run dist:linux
```

### Test

```bash
npm test
```

### Type Check

```bash
npm run typecheck
```

## Available Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start Vite + preload watcher + Electron development flow |
| `npm run build` | Build renderer entries and main process |
| `npm run build:renderer` | Build Vite renderer bundles |
| `npm run build:main` | Compile Electron main process |
| `npm run lint` | Run ESLint on `src/` and `tests/` |
| `npm run format` | Format TypeScript/CSS files with Prettier |
| `npm test` | Run Vitest test suite |
| `npm run test:coverage` | Run tests with coverage |
| `npm run test:e2e` | Run Playwright tests |
| `npm run pack` | Create unpacked Electron build |
| `npm run dist` | Build distributable app packages |
| `npm run dist:mac` | Build macOS release artifacts |
| `npm run dist:win` | Build Windows release artifacts |
| `npm run dist:linux` | Build Linux release artifacts |

## Quality Gates

Current repository validation baseline:

- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`

The current local baseline is green across all four commands.

Release automation is configured through [release.yml](/Users/huangyu/Desktop/allProject/yclaw/.github/workflows/release.yml) and publishes tagged builds for `v*`.
GitHub release notes are generated from [CHANGELOG.md](/Users/huangyu/Desktop/allProject/yclaw/CHANGELOG.md) through [extract-release-notes.mjs](/Users/huangyu/Desktop/allProject/yclaw/.github/scripts/extract-release-notes.mjs).
Dependency update automation is configured through [dependabot.yml](/Users/huangyu/Desktop/allProject/yclaw/.github/dependabot.yml).

## Project Structure

```text
src/
  main/                 Electron main process
  renderer/
    entries/            Module entry pages
    plugin-host/        Shared plugin host page
    shared/             Shared renderer components/hooks/styles
  shared/               Cross-process types/constants/utils
  engines/              Automation + analytics engines
plugins/
  _template/            Plugin starter template
docs/
  prd.md                Product requirements
  plan.md               Milestones and feasibility notes
  architecture.md       Technical architecture
  structure.md          Intended project structure
  specs.md              Spec breakdown and acceptance criteria
tests/
  unit/                 Unit tests for services/components/engines/shared
scripts/
  dev.ts                Development launcher
```

## Module Overview

### Workbench

The primary operations cockpit. It provides the shared navigation shell, cross-module overview, settings, and the admin-style UI baseline used by the rest of the product.

### Stock

Market/indicator-oriented workspace with K-line rendering, timeframe selection, and technical indicator toggles. The current codebase includes a demo-ready shell and calculation pipeline wiring.

### Automation

Task-oriented flow editor and execution panel. It is designed as the UI companion to the automation engine and retry/flow runner primitives already present in `src/engines/automation/`.

### Browser

Embedded browser workspace for controlled sessions, tabs, address input, and later automation integration through Electron-managed web contents.

### Plugin Center

UI shell for plugin installation, enable/disable, uninstall, permission review, and metadata display. Plugin loading and permission enforcement logic live in the main process.

## Architecture Notes

- Main/renderer communication is routed through Electron IPC.
- Shared constants and type definitions live under `src/shared/`.
- Window management is centralized in [`src/main/windows/WindowManager.ts`](/Users/huangyu/Desktop/allProject/yclaw/src/main/windows/WindowManager.ts).
- Renderer entry resolution is handled through [`src/main/utils/paths.ts`](/Users/huangyu/Desktop/allProject/yclaw/src/main/utils/paths.ts).
- Vite multi-entry build configuration is defined in [`vite.config.ts`](/Users/huangyu/Desktop/allProject/yclaw/vite.config.ts).
- Shared page framing for renderer modules lives in [`src/renderer/shared/components/PageShell.tsx`](/Users/huangyu/Desktop/allProject/yclaw/src/renderer/shared/components/PageShell.tsx).

For deeper background, see:

- [`docs/prd.md`](/Users/huangyu/Desktop/allProject/yclaw/docs/prd.md)
- [`docs/architecture.md`](/Users/huangyu/Desktop/allProject/yclaw/docs/architecture.md)
- [`docs/structure.md`](/Users/huangyu/Desktop/allProject/yclaw/docs/structure.md)
- [`docs/specs.md`](/Users/huangyu/Desktop/allProject/yclaw/docs/specs.md)

## Plugin Development

There is a starter template in [`plugins/_template`](/Users/huangyu/Desktop/allProject/yclaw/plugins/_template) with:

- `plugin.json` manifest
- `src/index.ts` entry
- template `README.md`

The long-term design is permission-aware and plugin-driven, but the current repository should be treated as a controlled host environment, not yet a stable public plugin SDK.

## Testing

The repository currently includes unit coverage for:

- main-process services
- IPC controller and event bus
- browser/tab utilities
- automation and analytics engines
- shared validators, constants, formatters, and logger helpers
- renderer components such as charts, step editor, plugin card, address bar, and tab bar

Test entrypoint:

- [`tests/setup.ts`](/Users/huangyu/Desktop/allProject/yclaw/tests/setup.ts)

## Roadmap

Near-term priorities:

- stabilize the multi-entry desktop shell
- improve real browser/automation integration
- harden plugin permission boundaries
- expand integration and e2e coverage
- continue aligning the repository implementation with the product/spec documents

## Contributing

Issues and pull requests are welcome. If you contribute, prefer:

- small, reviewable changes
- TypeScript-first implementations
- matching existing naming/layout conventions
- adding or updating tests when behavior changes
- keeping docs in sync with actual code

See [`CONTRIBUTING.md`](/Users/huangyu/Desktop/allProject/yclaw/CONTRIBUTING.md) for the contributor workflow and PR expectations.
Community participation is also governed by [`CODE_OF_CONDUCT.md`](/Users/huangyu/Desktop/allProject/yclaw/CODE_OF_CONDUCT.md).

Before opening a PR, a good baseline is:

```bash
npm run typecheck
npm test
npm run build
```

## License

MIT
