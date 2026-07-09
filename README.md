# Dev Standards

Small global instructions for handling CTO-style reviews with Codex, opencode, and Claude Code.

## Setup

Run this once on a machine. It clones or updates this repo and installs the latest standards, scanner, and global agent instructions.

```sh
bash -lc 'mkdir -p ~/projects; if [ -d ~/projects/dev-standards/.git ]; then git -C ~/projects/dev-standards pull; else git clone https://github.com/srinivassivakumar/dev-standards.git ~/projects/dev-standards; fi; bash ~/projects/dev-standards/install.sh'
```

This does not install git hooks and does not copy standards files into project repos.

## Daily Use

When CTO comments, paste the comment and use this short prompt:

```text
<paste comment>

Fix this branch using CTO standards.
```

The installed agent instructions automatically handle the rest:

- decide whether CTO's comment is reusable or PR-specific
- if reusable, update both `~/.config/dev-standards/CTO_STANDARDS.md` and `/home/sri/projects/dev-standards/CTO_STANDARDS.md`
- commit and push `/home/sri/projects/dev-standards` when standards change
- skip standards updates for PR-specific comments
- run relevant project checks
- run `git status --short` before committing or pushing the project branch
- remove/exclude dev-standards traces from the project repo
- avoid committing `AGENTS.md`, `CTO_STANDARDS.md`, scanner scripts, copied dev-standards files, `~/.config/dev-standards` files, or CTO-only `CLAUDE.md` edits
- commit and push only the project changes required for the branch

## Useful Commands

Check that the setup is installed:

```sh
test -f ~/.config/dev-standards/CTO_STANDARDS.md && command -v scan-cto-violations && echo "CTO setup ready"
```

This confirms the global standards file exists and the scanner command is available.

Run a read-only CTO scan in the current repo:

```sh
scan-cto-violations
```

This reports common CTO issues, such as DB mocks, inline seed SQL in tests, and unnecessary test/tool comments. It does not change files.
