# Dev Standards

Small global instructions for handling Santosh-style reviews with Codex, opencode, and Claude Code.

## Setup

Run this once on a machine. It clones or updates this repo and installs the latest standards, scanner, and global agent instructions.

```sh
bash -lc 'mkdir -p ~/projects; if [ -d ~/projects/dev-standards/.git ]; then git -C ~/projects/dev-standards pull; else git clone https://github.com/srinivassivakumar/dev-standards.git ~/projects/dev-standards; fi; bash ~/projects/dev-standards/install.sh'
```

This does not install git hooks and does not copy standards files into project repos.

## Daily Use

When Santosh comments, paste the comment and use this short prompt:

```text
<paste comment>

Fix this branch using Santosh standards.
```

The installed agent instructions automatically handle the rest:

- decide whether Santosh's comment is reusable or PR-specific
- if reusable, update both `~/.config/dev-standards/SANTOSH_STANDARDS.md` and `/home/sri/projects/dev-standards/SANTOSH_STANDARDS.md`
- commit and push `/home/sri/projects/dev-standards` when standards change
- skip standards updates for PR-specific comments
- run relevant project checks
- run `git status --short` before committing or pushing the project branch
- remove/exclude dev-standards traces from the project repo
- avoid committing `AGENTS.md`, `SANTOSH_STANDARDS.md`, scanner scripts, copied dev-standards files, `~/.config/dev-standards` files, or Santosh-only `CLAUDE.md` edits
- commit and push only the project changes required for the branch

## Optional Scanner

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

## Check Setup

```sh
test -f ~/.config/dev-standards/SANTOSH_STANDARDS.md && command -v scan-santosh-violations && echo "Santosh setup ready"
```

Project repos do not need `AGENTS.md` or `CLAUDE.md` unless you explicitly want to version agent instructions there.
