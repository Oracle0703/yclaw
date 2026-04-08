# Contributing

Thanks for contributing to YClaw.

## Before You Start

- Read [`README.md`](/Users/huangyu/Desktop/allProject/yclaw/README.md) for project scope and commands.
- Check [`CHANGELOG.md`](/Users/huangyu/Desktop/allProject/yclaw/CHANGELOG.md) to understand the current repository baseline.
- Check the product and architecture docs under [`docs/`](/Users/huangyu/Desktop/allProject/yclaw/docs).
- Review [`CODE_OF_CONDUCT.md`](/Users/huangyu/Desktop/allProject/yclaw/CODE_OF_CONDUCT.md) before participating in issues or pull requests.
- Keep changes aligned with the current implementation, not only the long-term plan.

## Development Setup

```bash
npm install
npm run dev
```

Useful validation commands:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Contribution Guidelines

- Prefer small, focused pull requests.
- Keep TypeScript strictness intact.
- Reuse shared renderer primitives instead of duplicating page layout code.
- Update docs when behavior, architecture, or supported commands change.
- Update [`CHANGELOG.md`](/Users/huangyu/Desktop/allProject/yclaw/CHANGELOG.md) when a user-facing capability, workflow, or repository baseline changes materially.
- Add or update tests when changing logic in services, engines, IPC, or reusable UI components.

## Commit Style

Short, imperative commits are preferred. Examples:

- `docs: expand readme`
- `build: add renderer entries`
- `ui: tighten page shell spacing`
- `tests: fix window manager mocks`

## Pull Requests

A good PR should include:

- what changed
- why it changed
- affected modules or files
- screenshots for UI changes when relevant
- validation performed (`lint`, `typecheck`, `test`, `build`)

All participation in the repository is governed by [`CODE_OF_CONDUCT.md`](/Users/huangyu/Desktop/allProject/yclaw/CODE_OF_CONDUCT.md).

## Scope Expectations

Good first contributions:

- documentation fixes
- test improvements
- UI consistency cleanup
- small service or IPC bug fixes
- plugin template improvements

Changes that benefit from an issue or discussion first:

- architecture shifts across multiple processes
- plugin permission model changes
- build-system refactors
- large UX rewrites across all modules
