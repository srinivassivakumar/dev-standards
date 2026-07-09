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

Or use this single command from any shell. If the setup already exists, it prints that it is ready. If it is missing, it clones or updates `dev-standards` and runs the installer:

```sh
bash -lc 'test -f ~/.config/dev-standards/SANTOSH_STANDARDS.md && command -v scan-santosh-violations >/dev/null && echo "Santosh checks already set up" || { mkdir -p ~/projects; if [ -d ~/projects/dev-standards/.git ]; then git -C ~/projects/dev-standards pull; else git clone https://github.com/srinivassivakumar/dev-standards.git ~/projects/dev-standards; fi; bash ~/projects/dev-standards/install.sh; }'
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
4. If reusable, update both the installed standards file and the source repo standards file.
5. Commit and push `/home/sri/projects/dev-standards` so the rule is reusable later.
6. If PR-specific, fix only the branch and do not update standards.
7. Run tests and checks.
8. Run `git status --short` in the project repo and remove any dev-standards traces.
9. Commit and push only the project changes required for the branch.

Useful prompt:

```text
Santosh commented:

<paste comment>

Fix this branch using Santosh standards.

If this comment is a reusable review rule, update both:
- ~/.config/dev-standards/SANTOSH_STANDARDS.md
- /home/sri/projects/dev-standards/SANTOSH_STANDARDS.md

Then commit and push /home/sri/projects/dev-standards.

If it is PR-specific, do not update standards.

Run checks.

Before committing or pushing the fixed branch:
- Run git status --short.
- Remove any dev-standards traces from the project repo.
- Do not commit AGENTS.md, SANTOSH_STANDARDS.md, scan-santosh-violations.ts, copied dev-standards scripts, ~/.config/dev-standards files, or Santosh-only CLAUDE.md edits.

Then commit and push only the project changes required for this branch.
```

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
