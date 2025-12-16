#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🚀 Stable startup (wrapper)"
echo "ℹ️ Bu repo'da güncel portlar: backend=3001, frontend=5174"

bash "$ROOT_DIR/start-safe.sh"