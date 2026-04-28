# Repository Guidelines

## Project Structure & Module Organization

This repository is an active Electron + React + Vite + TypeScript codebase, not a planning-only workspace.

Core code and docs currently live in:

- `src/main/`: Electron main-process bootstrap, IPC, browser/session management, services, repositories
- `src/renderer/entries/`: Vite multi-entry renderer apps (`workbench`, `stock`, `automation`, `browser`, `data-center`, `plugin-center`)
- `src/renderer/shared/`: shared renderer components, hooks, styles, API wrappers
- `src/renderer/plugin-host/`: plugin host renderer entry and bridge
- `src/shared/`: cross-process types, constants, serialization, utilities
- `src/cli/`: `yclaw` CLI entrypoints
- `src/mcp/`: MCP server/client and shared protocol definitions
- `src/runner/`: headless runner CLI, browser adapter, daemon runtime
- `src/engines/`: automation and analytics engines
- `scripts/`: dev/build/dist helper scripts
- `tests/`: unit, integration, fixtures, and e2e coverage
- `docs/`: overview, product, architecture, specs, plans, design, reviews

Follow the actual layout documented in `docs/architecture/structure.md` and the implementation audit in `docs/overview/implementation-audit.md`.

## Build, Test, and Development Commands

The repository contains a committed `package.json` with runnable scripts. Use only commands that actually exist in the repo.

Common commands:

- `npm run dev`: start the Electron + Vite + TypeScript watch-based dev flow
- `npm run build`: build core renderer, feature packs, and main process
- `npm run lint`: run ESLint
- `npm run typecheck`: run TypeScript type checking
- `npm test`: run Vitest
- `npm run test:e2e`: run Playwright end-to-end tests
- `npm run yclaw -- ...`: invoke the project CLI (Task-as-Code, MCP, runner commands)

## Coding Style & Naming Conventions

Write new docs in concise Markdown with clear headings and short paragraphs. For TypeScript code, follow the naming already used in the repo: PascalCase for classes and React components (`WindowManager.ts`, `PluginCard.tsx`), camelCase for functions/hooks/stores (`useIpc.ts`, `stockStore.ts`), and kebab-case for directory names such as `plugin-center/`.

## Testing Guidelines

Use the relevant spec in `docs/specs/` plus `docs/overview/current-status.md` as the baseline for review. Current test layout includes `tests/unit/`, `tests/integration/`, `tests/e2e/`, and `tests/fixtures/`. Name end-to-end specs `*.spec.ts` and keep test scope aligned to one module or service per file.

## Commit & Pull Request Guidelines

This directory is a Git checkout. Use short, imperative commit messages with an optional scope, such as `docs: refine architecture flow` or `specs: add ipc validation criteria`.

Pull requests should summarize intent, list affected docs or modules, link the relevant spec/plan section, and include screenshots or diagrams when updating architecture or UX flows.
