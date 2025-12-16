#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🚀 start-all.sh (wrapper)"
exec bash "$ROOT_DIR/start-dev.sh"
