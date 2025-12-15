#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:3001}"
API_PREFIX="${API_PREFIX:-/api}"
API_BASE="$BASE_URL$API_PREFIX"

TMP_DIR="${TMP_DIR:-/workspaces/crm/.tmp}"
mkdir -p "$TMP_DIR"

TS="$(date +%s)"
EMAIL="${EMAIL:-smoke${TS}@example.com}"
PASS="${PASS:-Password123!}"
FIRST_NAME="${FIRST_NAME:-Test}"
LAST_NAME="${LAST_NAME:-User}"

REGISTER_PAYLOAD="$TMP_DIR/smoke.register.payload.json"
LOGIN_PAYLOAD="$TMP_DIR/smoke.login.payload.json"
REGISTER_RES="$TMP_DIR/smoke.register.json"
LOGIN_RES="$TMP_DIR/smoke.login.json"
TOKEN_FILE="$TMP_DIR/smoke.token.txt"

json_get() {
  # Usage: json_get <file> <js-expr>
  # Example: json_get login.json "j.token||j.accessToken"
  node -e "const j=require(process.argv[1]); const v=(${2}); process.stdout.write(v?String(v):'')" "$1"
}

http_json() {
  # Usage: http_json METHOD URL [DATA_FILE] [AUTH_TOKEN]
  local method="$1"
  local url="$2"
  local data_file="${3:-}"
  local auth_token="${4:-}"

  if [[ -n "$data_file" ]]; then
    if [[ -n "$auth_token" ]]; then
      curl -sS -X "$method" "$url" \
        -H "Authorization: Bearer $auth_token" \
        -H 'Content-Type: application/json' \
        --data-binary "@$data_file"
    else
      curl -sS -X "$method" "$url" \
        -H 'Content-Type: application/json' \
        --data-binary "@$data_file"
    fi
  else
    if [[ -n "$auth_token" ]]; then
      curl -sS -X "$method" "$url" \
        -H "Authorization: Bearer $auth_token"
    else
      curl -sS -X "$method" "$url"
    fi
  fi
}

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

echo "== Health =="
http_json GET "$API_BASE/health" | tee "$TMP_DIR/smoke.health.json" >/dev/null

echo "== Auth: register ($EMAIL) =="
cat > "$REGISTER_PAYLOAD" <<JSON
{"email":"$EMAIL","password":"$PASS","firstName":"$FIRST_NAME","lastName":"$LAST_NAME"}
JSON
http_json POST "$API_BASE/auth/register" "$REGISTER_PAYLOAD" | tee "$REGISTER_RES" >/dev/null

# Auth: login
echo "== Auth: login =="
cat > "$LOGIN_PAYLOAD" <<JSON
{"email":"$EMAIL","password":"$PASS"}
JSON
http_json POST "$API_BASE/auth/login" "$LOGIN_PAYLOAD" | tee "$LOGIN_RES" >/dev/null

TOKEN="$(json_get "$LOGIN_RES" "j.accessToken||j.token")"
[[ -n "$TOKEN" ]] || fail "Token not found in login response: $LOGIN_RES"

echo -n "$TOKEN" > "$TOKEN_FILE"
echo "TOKEN_LEN=${#TOKEN} (saved to $TOKEN_FILE)"

# Leads CRUD
echo "== CRM: leads CRUD =="
LEAD_CREATE="$TMP_DIR/smoke.lead.create.json"
LEAD_UPDATE="$TMP_DIR/smoke.lead.update.json"
cat > "$LEAD_CREATE" <<JSON
{"name":"Lead Smoke $TS","email":"lead.$TS@example.com","phone":"+90500$TS","company":"ACME","status":"new"}
JSON
LEAD_CREATED_JSON="$TMP_DIR/smoke.lead.created.json"
http_json POST "$API_BASE/crm/leads" "$LEAD_CREATE" "$TOKEN" | tee "$LEAD_CREATED_JSON" >/dev/null
LEAD_ID="$(json_get "$LEAD_CREATED_JSON" "j.id")"
[[ -n "$LEAD_ID" ]] || fail "Lead id missing in create response: $LEAD_CREATED_JSON"

echo "Lead ID: $LEAD_ID"
http_json GET "$API_BASE/crm/leads" "" "$TOKEN" | tee "$TMP_DIR/smoke.leads.list.json" >/dev/null

cat > "$LEAD_UPDATE" <<JSON
{"status":"qualified"}
JSON
http_json PATCH "$API_BASE/crm/leads/$LEAD_ID" "$LEAD_UPDATE" "$TOKEN" | tee "$TMP_DIR/smoke.lead.updated.json" >/dev/null
http_json DELETE "$API_BASE/crm/leads/$LEAD_ID" "" "$TOKEN" | tee "$TMP_DIR/smoke.lead.deleted.json" >/dev/null

# Contacts CRUD
echo "== CRM: contacts CRUD =="
CONTACT_CREATE="$TMP_DIR/smoke.contact.create.json"
CONTACT_UPDATE="$TMP_DIR/smoke.contact.update.json"
cat > "$CONTACT_CREATE" <<JSON
{"name":"Contact Smoke $TS","email":"contact.$TS@example.com","phone":"+90501$TS","company":"ACME"}
JSON
CONTACT_CREATED_JSON="$TMP_DIR/smoke.contact.created.json"
http_json POST "$API_BASE/crm/contacts" "$CONTACT_CREATE" "$TOKEN" | tee "$CONTACT_CREATED_JSON" >/dev/null
CONTACT_ID="$(json_get "$CONTACT_CREATED_JSON" "j.id")"
[[ -n "$CONTACT_ID" ]] || fail "Contact id missing in create response: $CONTACT_CREATED_JSON"

echo "Contact ID: $CONTACT_ID"
http_json GET "$API_BASE/crm/contacts" "" "$TOKEN" | tee "$TMP_DIR/smoke.contacts.list.json" >/dev/null

cat > "$CONTACT_UPDATE" <<JSON
{"company":"ACME Updated"}
JSON
http_json PATCH "$API_BASE/crm/contacts/$CONTACT_ID" "$CONTACT_UPDATE" "$TOKEN" | tee "$TMP_DIR/smoke.contact.updated.json" >/dev/null
http_json DELETE "$API_BASE/crm/contacts/$CONTACT_ID" "" "$TOKEN" | tee "$TMP_DIR/smoke.contact.deleted.json" >/dev/null

echo "== OK =="
echo "- Health: $API_BASE/health"
echo "- Auth: register+login"
echo "- CRM: leads+contacts CRUD"
