# Dev Standards

Small, shareable agent instructions for Santosh-style reviews.

## What To Share

Copy one or both files into a repo:

- `AGENTS.md` for agents that read agent instructions
- `CLAUDE.md` for Claude Code

Both files are self-contained. Friends do not need your global config.

## Optional Global Install

Install the reusable standards file and manual scanner:

```sh
./install.sh
```

This creates:

```text
~/.config/dev-standards/SANTOSH_STANDARDS.md
~/.config/dev-standards/scripts/scan-santosh-violations.ts
~/.local/bin/scan-santosh-violations
```

No git hooks are installed.

## Daily Workflow

When Santosh comments on a PR:

1. Paste the comment to your agent.
2. Ask it to fix the branch using the Santosh standards.
3. Ask it whether the comment is a reusable new rule.
4. If reusable, update `~/.config/dev-standards/SANTOSH_STANDARDS.md`.
5. If PR-specific, fix only the branch.
6. Run tests and checks.
7. Push.

Useful prompt:

```text
Santosh commented:

<paste comment>

Fix this branch. Also check if this is a new reusable Santosh rule.
If yes, update ~/.config/dev-standards/SANTOSH_STANDARDS.md.
If it is only PR-specific, do not update the standards.
```

## Manual Scanner

Run a read-only scan:

```sh
scan-santosh-violations
```

Scan staged files only:

```sh
scan-santosh-violations --staged
```

Remove comment violations explicitly:

```sh
scan-santosh-violations --fix
```

The scanner checks for:

- DB mocks in tests
- fake SQL helpers
- inline `CREATE TABLE` in tests
- inline `INSERT INTO` seed data in tests
- direct SQL clients in tests
- unnecessary comments in test/tool files

## Why It Is Simple

This repo avoids global pre-push hooks, automatic PR-comment scraping, and automatic file edits during `git push`. The standards are guidance first; the scanner is optional.
