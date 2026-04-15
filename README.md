# YClaw

> Extensible desktop ops workspace built with Electron, React, and Vite.

[![License: MIT](https://img.shields.io/badge/license-MIT-0f172a.svg)](./LICENSE)
![Electron](https://img.shields.io/badge/electron-33-1f2937.svg)
![React](https://img.shields.io/badge/react-18-2563eb.svg)
![TypeScript](https://img.shields.io/badge/typescript-5-0f766e.svg)
![Vite](https://img.shields.io/badge/vite-6-7c3aed.svg)

YClaw is a modular desktop workbench for operations-heavy workflows: analytics, automation, embedded browsing, AI assistant, plugin governance, and shared system services. It is structured as an Electron shell with 6 renderer entries, a typed IPC layer (60+ channels), an AI service layer, and a plugin-oriented architecture.

Core capabilities are implemented: main-process services, multi-window management, IPC bridge, automation/analytics engines, AI assistant (LLM + tool calling), command palette, and broad unit/regression test coverage.

## Automation Browser Ops V1

This branch now includes a first productized pass of the automation + browser ops loop:

- task list, batch list, result table, export flow, and failed-batch retry entry
- browser intervention panel with breakpoint/session context and manual resume
- session registry, extraction template service, template manager, and recorder panel
- execution alert view backed by structured execution logs
- Playwright acceptance coverage for manual start, export, and intervention resume

Current known limits:

- full task CRUD/product editing flow is not finished yet
- scheduler and recorder are minimal production skeletons, not the final hardened implementation
- captcha handling remains manual-only
- Playwright coverage runs against Vite renderer entries with mocked preload, not packaged Electron binaries

## Why YClaw

YClaw targets a practical gap between generic admin panels and heavyweight internal tooling platforms. It treats the desktop shell as an operations cockpit:

- one container for browsing, automation, analysis, and plugin governance
- multiple focused renderer entries instead of forcing everything into one page
- typed boundaries between Electron main process, preload bridge, and React modules
- an architecture that can grow from local tooling into a more extensible desktop platform

## At A Glance

- Docs: [docs/prd.md](docs/prd.md), [docs/architecture.md](docs/architecture.md), [docs/specs.md](docs/specs.md)
- Changelog: [CHANGELOG.md](CHANGELOG.md)
- Contribution guide: [CONTRIBUTING.md](CONTRIBUTING.md)
- Code of conduct: [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
- Security policy: [SECURITY.md](SECURITY.md)
- License: [LICENSE](LICENSE)

## Highlights

- Electron desktop shell with multi-window module management (WindowManager, up to 10 windows)
- React + Vite renderer architecture with **6 independent entry pages**
- Typed IPC bridge (60+ channels) with rate limiting (100/s) and EventBus
- **AI assistant**: LLM service layer (OpenAI / Ollama), tool registry, context manager, chat panel (Ctrl+J)
- **Command palette** (Ctrl+K) with fuzzy search and command registry
- Built-in module entries:
  - `workbench` — operations cockpit with KPI dashboard
  - `stock` — K-line charts + technical indicators (MA/MACD/RSI/BOLL)
  - `automation` — task flow editor + execution panel
  - `browser` — multi-tab browser session console backed by main-process WebContentsView
  - `plugin-center` — local plugin management + permission review
  - `plugin-host` — shared plugin runtime with restricted preload APIs
- Shared UI components: PageShell, TitleBar, GlobalLoading, Sparkline, RingGauge, TaskTimeline
- Plugin host with three-level permission model (L1/L2/L3)
- System services: SQLite (WAL mode), config, logging (7-day rotation), tray, auto-update
- Automation engine: 5 actions (click/input/scroll/extract/screenshot), flow runner with breakpoint resume
- Analytics engine: DataSourceManager (REST/WebSocket), IndicatorLibrary
- Automation Browser Ops V1 scaffold: batches, results, intervention, sessions, templates, recorder, alerts
- Test coverage: unit and regression suites across services, engines, components, shared utilities, and scripts

## Current Status

Implemented and tested:

- Electron main-process app lifecycle and multi-window management (up to 10)
- Preload + `contextBridge` IPC bridge with 60+ typed channels
- IPC Controller with rate limiting (100 req/s) and EventBus fan-out
- AI service layer: AIService, ContextManager, ToolRegistry, LLMProvider (OpenAI/Ollama)
- AI Chat Panel (Ctrl+J) with Zustand state management
- Command Palette (Ctrl+K) with fuzzy search and command registry
- Workbench UI with module navigation, KPI cards, AI assistant integration
- Stock analysis module with K-line chart and indicator workflow
- Automation task list/editor/execution panel with step editor
- Browser session console with multi-tab management, navigation state, and configurable session partitions
- Automation Browser Ops V1: batch tracking, result export, session binding, template CRUD, recorder import, alert aggregation
- Plugin center with local install, enable/disable, uninstall confirmation, permission review flow, and three-level permission model
- SQLite database service (WAL mode), config service, log service (7-day rotation), tray, auto-update
- Automation engine: 5 operations, flow runner with retry + breakpoint resume
- Analytics engine: DataSourceManager, IndicatorLibrary (MA/MACD/RSI/BOLL)
- Shared components: PageShell, TitleBar, ErrorBoundary, GlobalLoading, AppProviders, Sparkline, RingGauge, TaskTimeline
- Comprehensive unit and regression tests across core services and renderer components

Still evolving:

- Full production-grade automation execution against real pages
- Complete plugin runtime isolation (V1.5 target)
- End-to-end test coverage for packaged Electron runtime
- Automation Browser Ops V1 hardening: full task CRUD, stronger scheduler recovery, richer recorder semantics
- Production packaging verification across all platforms

## Tech Stack

- Electron 33
- React 18
- Vite 6
- TypeScript 5.7
- Ant Design 5 + Pro Components
- Zustand 5 (state management)
- better-sqlite3 (SQLite with WAL)
- electron-builder
- Vitest 2 + @testing-library/react + happy-dom

## Quick Start

### Requirements

- Node.js `>= 20.19.0`
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

### End-to-End Acceptance

```bash
npm run test:e2e -- --grep automation-browser-ops
```

### Type Check

```bash
npm run typecheck
```

## Available Scripts

| Command                  | Description                                              |
| ------------------------ | -------------------------------------------------------- |
| `npm run dev`            | Start Vite + preload watcher + Electron development flow |
| `npm run build`          | Build renderer entries and main process                  |
| `npm run build:renderer` | Build Vite renderer bundles                              |
| `npm run build:main`     | Compile Electron main process                            |
| `npm run lint`           | Run ESLint on `src/` and `tests/`                        |
| `npm run format`         | Format TypeScript/CSS files with Prettier                |
| `npm test`               | Run Vitest test suite                                    |
| `npm run test:coverage`  | Run tests with coverage                                  |
| `npm run test:e2e`       | Run Playwright tests                                     |
| `npm run pack`           | Create unpacked Electron build                           |
| `npm run dist`           | Build distributable app packages                         |
| `npm run dist:mac`       | Build macOS release artifacts                            |
| `npm run dist:win`       | Build Windows release artifacts                          |
| `npm run dist:linux`     | Build Linux release artifacts                            |

## Quality Gates

Current repository validation baseline:

- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`

The current local baseline is green across all four commands.

Release automation is configured through [release.yml](.github/workflows/release.yml) and publishes tagged builds for `v*`.
GitHub release notes are generated from [CHANGELOG.md](CHANGELOG.md) through [extract-release-notes.mjs](.github/scripts/extract-release-notes.mjs).
Dependency update automation is configured through [dependabot.yml](.github/dependabot.yml).

## Project Structure

```text
src/
  main/                 Electron main process
    ai/                 AI service layer (AIService, ContextManager, ToolRegistry, LLMProvider)
    browser/            TabManager (browser session and WebContentsView management)
    ipc/                IPC Controller + EventBus
    plugin-loader/      Plugin scanning + permission checking
    services/           DB, Config, Log, Tray, Update services
    windows/            WindowManager + preload
  renderer/
    entries/            6 module entry pages
      workbench/        Main operations cockpit
      stock/            Stock analysis module
      automation/       Task automation module
      browser/          Browser session console
      plugin-center/    Plugin management module
    plugin-host/        Sandboxed plugin runtime
    shared/             Shared renderer components/hooks/styles
      components/       PageShell, TitleBar, CommandPalette, AIChatPanel, Sparkline, etc.
      hooks/            useIpc, useEventBus, useLoading
  shared/               Cross-process types/constants/utils
    types/              IPC, plugin, task, stock, config, browser, AI types
    constants/          60+ IPC channels, permissions, events
  engines/              Automation + analytics engines
plugins/
  _template/            Plugin starter template
docs/
  prd.md                Product requirements
  plan.md               Milestones and feasibility notes
  architecture.md       Technical architecture
  structure.md          Project structure
  specs.md              Spec breakdown (SPEC-001 ~ SPEC-022)
  specs-enhancements.md Enhancement specs (SPEC-023 ~ SPEC-028)
tests/
  unit/                 Unit and regression tests
    components/         UI component + regression tests
    services/           Service layer tests (including AI)
    engines/            Engine tests
    shared/             Shared utility tests
scripts/
  dev.ts                Development launcher
```

## Module Overview

### Workbench

The primary operations cockpit. It provides the shared navigation shell, cross-module overview, settings, CommandPalette (Ctrl+K), AI Chat Panel (Ctrl+J), and the admin-style UI baseline used by the rest of the product.

### Stock

Market/indicator-oriented workspace with K-line rendering, timeframe selection, and technical indicator toggles (MA, MACD, RSI, BOLL). Powered by IndicatorLibrary and DataSourceManager engines.

### Automation

Task-oriented flow editor and execution panel. It is designed as the UI companion to the automation engine and retry/flow runner primitives already present in `src/engines/automation/`.

### Browser

Browser session console with multi-tab management (TabManager, up to 20 tabs), address bar, navigation state, and WebViewContainer metadata. The main process owns WebContentsView instances; the renderer intentionally presents a controlled session console rather than pretending to embed the native view directly.

### Plugin Center

UI for local plugin installation, enable/disable, uninstall confirmation, permission review, and metadata display. Plugin loading and permission enforcement logic live in the main process.

## Architecture Notes

- Main/renderer communication is routed through Electron IPC (60+ typed channels).
- Shared constants and type definitions live under `src/shared/`.
- AI service layer provides LLM integration with tool calling (task_list, system_status, navigate).
- Window management is centralized in [src/main/windows/WindowManager.ts](src/main/windows/WindowManager.ts).
- Renderer entry resolution is handled through [src/main/utils/paths.ts](src/main/utils/paths.ts).
- Vite multi-entry build configuration is defined in [vite.config.ts](vite.config.ts).
- Shared page framing for renderer modules lives in [src/renderer/shared/components/PageShell.tsx](src/renderer/shared/components/PageShell.tsx).
- Path aliases: `@shared`, `@main`, `@renderer`, `@engines`.

For deeper background, see:

- [docs/prd.md](docs/prd.md)
- [docs/architecture.md](docs/architecture.md)
- [docs/structure.md](docs/structure.md)
- [docs/specs.md](docs/specs.md)

## Plugin Development

There is a starter template in [plugins/\_template](plugins/_template) with:

- `plugin.json` manifest
- `src/index.ts` entry
- template `README.md`

The long-term design is permission-aware and plugin-driven, but the current repository should be treated as a controlled host environment, not yet a stable public plugin SDK.

## Testing

The repository includes comprehensive unit and regression coverage:

- Main-process services: ConfigService, LogService, DatabaseService, TrayService, UpdateService
- AI service layer: AIService, ContextManager, ToolRegistry
- IPC controller and EventBus
- Browser/tab management: TabManager, WindowManager
- Automation engines: AutomationEngine, FlowRunner, RetryPolicy, SelectorGenerator
- Analytics engines: DataSourceManager, IndicatorLibrary
- Shared validators, constants, formatters, and logger helpers
- Renderer components: KLineChart, StepEditor, ExecutionPanel, PluginCard, PermissionDialog, AddressBar, TabBar, Sparkline, RingGauge, TaskTimeline, CommandRegistry, WebViewContainer
- Regression tests: BrowserApp, Loading

Test entrypoint:

- [tests/setup.ts](tests/setup.ts)

## Roadmap

Near-term priorities:

- Production-grade automation execution against real pages
- Plugin runtime isolation upgrade (V1.5: per-plugin process)
- End-to-end test coverage with Playwright
- AI assistant: streaming responses, more tool integrations
- Production packaging verification across all platforms

## Contributing

Issues and pull requests are welcome. If you contribute, prefer:

- small, reviewable changes
- TypeScript-first implementations
- matching existing naming/layout conventions
- adding or updating tests when behavior changes
- keeping docs in sync with actual code

See [CONTRIBUTING.md](CONTRIBUTING.md) for the contributor workflow and PR expectations.
Community participation is also governed by [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

Before opening a PR, a good baseline is:

```bash
npm run typecheck
npm test
npm run build
```

## License

MIT
