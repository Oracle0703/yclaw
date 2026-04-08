# Security Policy

## Supported Versions

YClaw is still evolving rapidly. Security fixes should be assumed to land on the latest mainline code first.

| Version | Supported |
| --- | --- |
| `main` branch | Yes |
| older snapshots and local forks | No guarantee |

## Reporting A Vulnerability

If you discover a security issue, do not open a public issue with exploit details.

Please report:

- what component is affected
- how the issue can be reproduced
- the potential impact
- any suggested mitigation if available

Preferred handling:

- use a private maintainer contact channel when available
- keep details private until the issue is understood and a fix or mitigation exists

## Response Expectations

Best effort goals for maintainers:

- acknowledge receipt within a reasonable timeframe
- assess severity and affected scope
- work toward a fix or mitigation on the active code line
- disclose publicly after a fix is available when appropriate

## Scope Notes

Areas that should be treated as security-sensitive in this repository include:

- Electron main/preload boundaries
- IPC handlers and validation
- plugin loading and permission enforcement
- embedded browser session handling
- local persistence, logs, and update flows
