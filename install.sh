#!/usr/bin/env bash
set -euo pipefail

CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/dev-standards"
OPENCODE_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/opencode"
BIN_DIR="$HOME/.local/bin"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo "Installing dev standards"
echo ""

mkdir -p "$CONFIG_DIR/scripts" "$OPENCODE_DIR" "$BIN_DIR"

rm -f "$CONFIG_DIR"/SANTO*_STANDARDS.md
rm -f "$CONFIG_DIR"/scripts/scan-sa*-violations.ts
rm -f "$BIN_DIR"/scan-sa*-violations

cp "$SCRIPT_DIR/CTO_STANDARDS.md" "$CONFIG_DIR/CTO_STANDARDS.md"
cp "$SCRIPT_DIR/AGENTS.md" "$CONFIG_DIR/AGENTS.md"
cp "$SCRIPT_DIR/AGENTS.md" "$OPENCODE_DIR/AGENTS.md"
cp "$SCRIPT_DIR/scripts/scan-cto-violations.ts" "$CONFIG_DIR/scripts/scan-cto-violations.ts"
chmod +x "$CONFIG_DIR/scripts/scan-cto-violations.ts"

ln -sf "$CONFIG_DIR/scripts/scan-cto-violations.ts" "$BIN_DIR/scan-cto-violations"

echo "Installed:"
echo "  $CONFIG_DIR/CTO_STANDARDS.md"
echo "  $CONFIG_DIR/AGENTS.md"
echo "  $OPENCODE_DIR/AGENTS.md"
echo "  $CONFIG_DIR/scripts/scan-cto-violations.ts"
echo "  $BIN_DIR/scan-cto-violations"
echo ""
echo "No git hooks were installed."
echo ""
echo "Use:"
echo "  scan-cto-violations"
echo "  scan-cto-violations --staged"
echo "  scan-cto-violations --fix"
echo ""
