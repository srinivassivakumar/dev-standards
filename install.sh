#!/usr/bin/env bash
set -euo pipefail

CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/dev-standards"
BIN_DIR="$HOME/.local/bin"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo "Installing dev standards"
echo ""

mkdir -p "$CONFIG_DIR/scripts" "$BIN_DIR"

cp "$SCRIPT_DIR/SANTOSH_STANDARDS.md" "$CONFIG_DIR/SANTOSH_STANDARDS.md"
cp "$SCRIPT_DIR/scripts/scan-santosh-violations.ts" "$CONFIG_DIR/scripts/scan-santosh-violations.ts"
chmod +x "$CONFIG_DIR/scripts/scan-santosh-violations.ts"

ln -sf "$CONFIG_DIR/scripts/scan-santosh-violations.ts" "$BIN_DIR/scan-santosh-violations"

echo "Installed:"
echo "  $CONFIG_DIR/SANTOSH_STANDARDS.md"
echo "  $CONFIG_DIR/scripts/scan-santosh-violations.ts"
echo "  $BIN_DIR/scan-santosh-violations"
echo ""
echo "No git hooks were installed."
echo ""
echo "Use:"
echo "  scan-santosh-violations"
echo "  scan-santosh-violations --staged"
echo "  scan-santosh-violations --fix"
echo ""
