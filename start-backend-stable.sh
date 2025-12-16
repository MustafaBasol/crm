#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🚀 Backend stable (wrapper)"
exec bash "$ROOT_DIR/keep-backend-alive.sh"