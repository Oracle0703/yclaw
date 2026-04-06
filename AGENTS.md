# Repository Guidelines

## Project Structure & Module Organization

This repository is currently a planning workspace. The only committed content lives in `docs/`:

- `docs/prd.md`: product scope and user scenarios
- `docs/plan.md`: feasibility, milestones, and success metrics
- `docs/architecture.md`: process model and system design
- `docs/structure.md`: target directory layout
- `docs/specs.md`: implementation specs and acceptance criteria

When code is scaffolded, follow the planned layout in `docs/structure.md`: `src/main/` for Electron main-process code, `src/renderer/entries/` for Vite multi-entry apps, `src/shared/` for cross-process types/utilities, `src/engines/` for automation and analytics engines, `plugins/` for plugin packages, `resources/` for app assets, `scripts/` for tooling, and `tests/` for unit, integration, and e2e coverage.

## Build, Test, and Development Commands

No runnable build or test scripts are committed yet; there is no `package.json` in this checkout. Until the scaffold lands, treat the docs as the source of truth and keep changes internally consistent.

Once SPEC-001 is implemented, expected commands are:

- `npm run dev`: start Electron + Vite development flow
- `npm run build`: produce production renderer bundles and app artifacts
- `npm run lint`: run ESLint and formatting checks
- `npm test`: run automated tests

Only document commands that actually exist in the repo.

## Coding Style & Naming Conventions

Write new docs in concise Markdown with clear headings and short paragraphs. For planned TypeScript code, follow the naming already defined in `docs/structure.md`: PascalCase for classes and React components (`WindowManager.ts`, `PluginCard.tsx`), camelCase for functions/hooks/stores (`useIpc.ts`, `stockStore.ts`), and kebab-case for directory names such as `plugin-center/`.

## Testing Guidelines

Use `docs/specs.md` acceptance criteria as the baseline for review. Planned test layout is `tests/unit/`, `tests/integration/`, and `tests/e2e/`. Name end-to-end specs `*.spec.ts` and keep test scope aligned to one module or service per file.

## Commit & Pull Request Guidelines

This directory is not a Git checkout, so no local history is available to infer conventions. Use short, imperative commit messages with an optional scope, such as `docs: refine architecture flow` or `specs: add ipc validation criteria`.

Pull requests should summarize intent, list affected docs or modules, link the relevant spec/plan section, and include screenshots or diagrams when updating architecture or UX flows.
