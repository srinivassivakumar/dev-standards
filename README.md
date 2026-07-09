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

Or use this single command from any shell. It clones or updates `dev-standards` and reinstalls the standards, scanner, and global agent instructions:

```sh
bash -lc 'mkdir -p ~/projects; if [ -d ~/projects/dev-standards/.git ]; then git -C ~/projects/dev-standards pull; else git clone https://github.com/srinivassivakumar/dev-standards.git ~/projects/dev-standards; fi; bash ~/projects/dev-standards/install.sh'
```

This creates:

```text
~/.config/dev-standards/SANTOSH_STANDARDS.md
~/.config/dev-standards/AGENTS.md
~/.config/opencode/AGENTS.md
~/.config/dev-standards/scripts/scan-santosh-violations.ts
~/.local/bin/scan-santosh-violations
```

No git hooks are installed.

## Daily Workflow

When Santosh comments on a PR:

1. Make sure the one-command setup above has been run on the machine.
2. Paste Santosh's comment to your agent.
3. Ask it to fix the branch using the Santosh standards.

Useful prompt:

```text
<paste comment>

Fix this branch using Santosh standards.
```

The installed agent instructions handle reusable-rule updates, standards repo pushes, project checks, project branch pushes, and dev-standards trace cleanup automatically.

## Check Setup

Check that the global standards file exists:

```sh
test -f ~/.config/dev-standards/SANTOSH_STANDARDS.md && echo "standards installed"
```

Check that the scanner command is available:

```sh
command -v scan-santosh-violations
```

Run the scanner:

```sh
scan-santosh-violations
```

Check that global git hooks are not installed:

```sh
git config --global --get core.hooksPath || echo "no global hooks"
```

Check that a repo has agent files:

```sh
ls AGENTS.md CLAUDE.md
```

Project repos do not need these files unless you explicitly want to version agent instructions there.

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
