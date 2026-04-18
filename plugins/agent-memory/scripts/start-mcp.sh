#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGE_DIR="$(cd "$SCRIPT_DIR/../../../packages/agent-memory" && pwd)"
DIST_ENTRY="$PACKAGE_DIR/dist/index.js"

if [ ! -d "$PACKAGE_DIR/node_modules" ]; then
  (cd "$PACKAGE_DIR" && npm install --prefer-offline >&2)
fi

if [ ! -f "$DIST_ENTRY" ] || find "$PACKAGE_DIR/src" -type f -newer "$DIST_ENTRY" | grep -q .; then
  (cd "$PACKAGE_DIR" && npm run build >&2)
fi

exec node "$DIST_ENTRY"
