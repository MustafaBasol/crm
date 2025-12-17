#!/usr/bin/env bash
set -euo pipefail

# Ensures the local Postgres cluster is up when the project is configured to use
# the devcontainer's built-in Postgres on 127.0.0.1:5432.
#
# This script is intentionally conservative:
# - It only acts for DATABASE_HOST in {127.0.0.1,localhost} and DATABASE_PORT=5432.
# - It uses non-interactive sudo (sudo -n). If that isn't allowed, it fails early.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

read_env_value() {
  local file="$1"
  local key="$2"

  if [[ ! -f "$file" ]]; then
    return 1
  fi

  # Read last occurrence to mimic typical dotenv behavior
  local val
  val="$(grep -E "^\s*${key}\s*=" "$file" | tail -n 1 | sed -E 's/^\s*[^=]+\s*=\s*//; s/\s*$//; s/^"|"$//g; s/^\x27|\x27$//g')"
  if [[ -n "$val" ]]; then
    echo "$val"
    return 0
  fi

  return 1
}

ENV_FILE="${BACKEND_ENV_FILE:-$BACKEND_DIR/.env}"

DB_HOST="${DATABASE_HOST:-}"
DB_PORT="${DATABASE_PORT:-}"

if [[ -z "$DB_HOST" ]]; then
  DB_HOST="$(read_env_value "$ENV_FILE" "DATABASE_HOST" || true)"
fi
if [[ -z "$DB_PORT" ]]; then
  DB_PORT="$(read_env_value "$ENV_FILE" "DATABASE_PORT" || true)"
fi

# Only ensure for the devcontainer local cluster default
if [[ "$DB_HOST" != "127.0.0.1" && "$DB_HOST" != "localhost" ]]; then
  exit 0
fi
if [[ "$DB_PORT" != "5432" ]]; then
  exit 0
fi

if ! command -v pg_lsclusters >/dev/null 2>&1; then
  echo "ℹ️  pg_lsclusters bulunamadı; local cluster yönetimi atlandı."
  exit 0
fi

if ! sudo -n true >/dev/null 2>&1; then
  echo "❌ sudo şifresiz (non-interactive) çalışmıyor. Postgres cluster'ı otomatik başlatılamıyor."
  echo "   Çözüm: sudo yetkisi verin veya Postgres'i Docker üzerinden çalıştırın."
  exit 1
fi

LINE="$(sudo -n pg_lsclusters | awk '$3==5432 {print; exit 0}')"
if [[ -z "$LINE" ]]; then
  # No cluster on 5432
  exit 0
fi

CLUSTER_VER="$(awk '{print $1}' <<<"$LINE")"
CLUSTER_NAME="$(awk '{print $2}' <<<"$LINE")"
CLUSTER_STATUS="$(awk '{print $4}' <<<"$LINE")"

if [[ "$CLUSTER_STATUS" == "online" ]]; then
  echo "✅ Postgres cluster online: ${CLUSTER_VER}/${CLUSTER_NAME} (5432)"
  exit 0
fi

if [[ "$CLUSTER_STATUS" == "down" ]]; then
  echo "⏳ Postgres cluster down; başlatılıyor: ${CLUSTER_VER}/${CLUSTER_NAME} (5432)"
  sudo -n pg_ctlcluster "$CLUSTER_VER" "$CLUSTER_NAME" start

  LINE2="$(sudo -n pg_lsclusters | awk '$3==5432 {print; exit 0}')"
  STATUS2="$(awk '{print $4}' <<<"$LINE2")"
  if [[ "$STATUS2" == "online" ]]; then
    echo "✅ Postgres cluster online: ${CLUSTER_VER}/${CLUSTER_NAME} (5432)"
    exit 0
  fi

  echo "❌ Postgres cluster başlatılamadı (status=$STATUS2)."
  exit 1
fi

echo "ℹ️  Postgres cluster status=$CLUSTER_STATUS; otomatik aksiyon alınmadı."
exit 0
