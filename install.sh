#!/usr/bin/env bash
set -euo pipefail

OPENDIR="${XDG_CONFIG_HOME:-$HOME/.config}/opencode"
BINDIR="$HOME/.local/bin"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo "========================================="
echo "  Santosh Standards — Installer"
echo "========================================="
echo ""

if [ "$SCRIPT_DIR" != "$OPENDIR" ]; then
  echo "Mode: repo install (source: $SCRIPT_DIR)"
  echo ""

  echo "Creating $OPENDIR ..."
  mkdir -p "$OPENDIR/scripts" "$OPENDIR/git-hooks"

  echo "Installing config files..."
  for f in SANTOSH_STANDARDS.md AGENTS.md opencode.jsonc; do
    if [ -f "$SCRIPT_DIR/$f" ]; then
      cp "$SCRIPT_DIR/$f" "$OPENDIR/$f"
      echo "  $f"
    fi
  done

  echo "Installing scripts..."
  for f in update-santosh-rules.ts scan-santosh-violations.ts check-santosh-feedback.ts sync-santosh-rules.ts; do
    if [ -f "$SCRIPT_DIR/scripts/$f" ]; then
      cp "$SCRIPT_DIR/scripts/$f" "$OPENDIR/scripts/$f"
      echo "  scripts/$f"
    fi
  done

  echo "Installing hooks..."
  for f in pre-push post-checkout; do
    if [ -f "$SCRIPT_DIR/git-hooks/$f" ]; then
      cp "$SCRIPT_DIR/git-hooks/$f" "$OPENDIR/git-hooks/$f"
      chmod +x "$OPENDIR/git-hooks/$f"
      echo "  git-hooks/$f"
    fi
  done

  chmod +x "$OPENDIR/scripts/"*.ts 2>/dev/null || true
else
  echo "Mode: local install (source: $OPENDIR)"
  echo ""
fi

echo "Creating symlinks in $BINDIR ..."
mkdir -p "$BINDIR"

for script in update-santosh-rules check-santosh-feedback sync-santosh-rules; do
  if [ -f "$OPENDIR/scripts/$script.ts" ]; then
    ln -sf "$OPENDIR/scripts/$script.ts" "$BINDIR/$script"
    echo "  $BINDIR/$script -> $OPENDIR/scripts/$script.ts"
  fi
done

echo ""
echo "Setting git hooks path..."
git config --global core.hooksPath "$OPENDIR/git-hooks"
echo "  core.hooksPath = $OPENDIR/git-hooks"

echo ""
echo "========================================="
echo "  Install complete"
echo "========================================="
echo ""
echo "  Rules file: $OPENDIR/SANTOSH_STANDARDS.md"
echo "  Hooks dir:  $OPENDIR/git-hooks/"
echo ""
echo "  On every git push, the hooks will:"
echo "    1. Fetch new Santosh comments & update rules"
echo "    2. Scan code for mock/SQL/comment violations"
echo "    3. Block push if Santosh has unresolved feedback"
echo ""
echo "  Share this setup: put these files in a GitHub repo"
echo "  and friends run:"
echo "    curl -fsSL https://raw.githubusercontent.com/<user>/dev-standards/main/install.sh | bash"
echo ""
