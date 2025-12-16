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

http_status() {
  # Usage: http_status METHOD URL [DATA_FILE] [AUTH_TOKEN] [OUT_FILE]
  # Writes response body to OUT_FILE (if provided) and prints HTTP status code.
  local method="$1"
  local url="$2"
  local data_file="${3:-}"
  local auth_token="${4:-}"
  local out_file="${5:-}"

  local out_flag=()
  if [[ -n "$out_file" ]]; then
    out_flag=(-o "$out_file")
  else
    out_flag=(-o /dev/null)
  fi

  if [[ -n "$data_file" ]]; then
    if [[ -n "$auth_token" ]]; then
      curl -sS -X "$method" "$url" \
        -H "Authorization: Bearer $auth_token" \
        -H 'Content-Type: application/json' \
        --data-binary "@$data_file" \
        "${out_flag[@]}" \
        -w '%{http_code}'
    else
      curl -sS -X "$method" "$url" \
        -H 'Content-Type: application/json' \
        --data-binary "@$data_file" \
        "${out_flag[@]}" \
        -w '%{http_code}'
    fi
  else
    if [[ -n "$auth_token" ]]; then
      curl -sS -X "$method" "$url" \
        -H "Authorization: Bearer $auth_token" \
        "${out_flag[@]}" \
        -w '%{http_code}'
    else
      curl -sS -X "$method" "$url" \
        "${out_flag[@]}" \
        -w '%{http_code}'
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

echo "== CRM: pipeline bootstrap (required for opportunities) =="
http_json POST "$API_BASE/crm/pipeline/bootstrap" "" "$TOKEN" | tee "$TMP_DIR/smoke.crm.bootstrap.json" >/dev/null

echo "== Customers: create (for contact accountId) =="
CUSTOMER_CREATE="$TMP_DIR/smoke.customer.create.json"
cat > "$CUSTOMER_CREATE" <<JSON
{"name":"Customer Smoke $TS"}
JSON
CUSTOMER_CREATED_JSON="$TMP_DIR/smoke.customer.created.json"
http_json POST "$API_BASE/customers" "$CUSTOMER_CREATE" "$TOKEN" | tee "$CUSTOMER_CREATED_JSON" >/dev/null
CUSTOMER_ID="$(json_get "$CUSTOMER_CREATED_JSON" "j.id")"
[[ -n "$CUSTOMER_ID" ]] || fail "Customer id missing in create response: $CUSTOMER_CREATED_JSON"
echo "Customer ID: $CUSTOMER_ID"

echo "== CRM: opportunity create (to grant account visibility) =="
OPP_CREATE="$TMP_DIR/smoke.opportunity.create.json"
cat > "$OPP_CREATE" <<JSON
{"accountId":"$CUSTOMER_ID","name":"Opp Smoke $TS","amount":0,"currency":"TRY"}
JSON
OPP_CREATED_JSON="$TMP_DIR/smoke.opportunity.created.json"
http_json POST "$API_BASE/crm/opportunities" "$OPP_CREATE" "$TOKEN" | tee "$OPP_CREATED_JSON" >/dev/null
OPP_ID="$(json_get "$OPP_CREATED_JSON" "j.id")"
[[ -n "$OPP_ID" ]] || fail "Opportunity id missing in create response: $OPP_CREATED_JSON"
echo "Opportunity ID: $OPP_ID"

CONTACT_CREATE="$TMP_DIR/smoke.contact.create.json"
CONTACT_UPDATE="$TMP_DIR/smoke.contact.update.json"
cat > "$CONTACT_CREATE" <<JSON
{"name":"Contact Smoke $TS","email":"contact.$TS@example.com","phone":"+90501$TS","company":"ACME","accountId":"$CUSTOMER_ID"}
JSON
CONTACT_CREATED_JSON="$TMP_DIR/smoke.contact.created.json"
http_json POST "$API_BASE/crm/contacts" "$CONTACT_CREATE" "$TOKEN" | tee "$CONTACT_CREATED_JSON" >/dev/null
CONTACT_ID="$(json_get "$CONTACT_CREATED_JSON" "j.id")"
[[ -n "$CONTACT_ID" ]] || fail "Contact id missing in create response: $CONTACT_CREATED_JSON"

echo "Contact ID: $CONTACT_ID"
http_json GET "$API_BASE/crm/contacts" "" "$TOKEN" | tee "$TMP_DIR/smoke.contacts.list.json" >/dev/null

CONTACTS_FILTERED_BY_ACCOUNT_JSON="$TMP_DIR/smoke.contacts.filtered.by-account.json"
http_json GET "$API_BASE/crm/contacts?accountId=$CUSTOMER_ID" "" "$TOKEN" | tee "$CONTACTS_FILTERED_BY_ACCOUNT_JSON" >/dev/null
FOUND_CONTACT_IN_FILTER="$(json_get "$CONTACTS_FILTERED_BY_ACCOUNT_JSON" "Array.isArray(j) && j.some(x => x && x.id === '$CONTACT_ID')")"
[[ "$FOUND_CONTACT_IN_FILTER" == "true" ]] || fail "Created contact not found in accountId filtered list: $CONTACTS_FILTERED_BY_ACCOUNT_JSON"

# Activities: contactId filter
echo "== CRM: activities (contactId filter) =="
ACTIVITY_CREATE="$TMP_DIR/smoke.activity.create.json"
cat > "$ACTIVITY_CREATE" <<JSON
{"title":"Contact Activity Smoke $TS","type":"call","contactId":"$CONTACT_ID","completed":false}
JSON
ACTIVITY_CREATED_JSON="$TMP_DIR/smoke.activity.created.json"
http_json POST "$API_BASE/crm/activities" "$ACTIVITY_CREATE" "$TOKEN" | tee "$ACTIVITY_CREATED_JSON" >/dev/null
ACTIVITY_ID="$(json_get "$ACTIVITY_CREATED_JSON" "j.id")"
[[ -n "$ACTIVITY_ID" ]] || fail "Activity id missing in create response: $ACTIVITY_CREATED_JSON"
echo "Activity ID: $ACTIVITY_ID"

echo "== CRM: activities (single relation rule) =="
ACTIVITY_INVALID_CREATE="$TMP_DIR/smoke.activity.invalid.create.json"
cat > "$ACTIVITY_INVALID_CREATE" <<JSON
{"title":"Invalid Activity Smoke $TS","contactId":"$CONTACT_ID","opportunityId":"11111111-1111-1111-1111-111111111111"}
JSON
ACTIVITY_INVALID_RES="$TMP_DIR/smoke.activity.invalid.create.res.json"
INVALID_STATUS="$(http_status POST "$API_BASE/crm/activities" "$ACTIVITY_INVALID_CREATE" "$TOKEN" "$ACTIVITY_INVALID_RES")"
[[ "$INVALID_STATUS" == "400" ]] || fail "Expected 400 for invalid activity payload (multiple relations), got $INVALID_STATUS: $ACTIVITY_INVALID_RES"

ACTIVITY_INVALID_PATCH="$TMP_DIR/smoke.activity.invalid.patch.json"
cat > "$ACTIVITY_INVALID_PATCH" <<JSON
{"opportunityId":"11111111-1111-1111-1111-111111111111"}
JSON
ACTIVITY_INVALID_PATCH_RES="$TMP_DIR/smoke.activity.invalid.patch.res.json"
INVALID_PATCH_STATUS="$(http_status PATCH "$API_BASE/crm/activities/$ACTIVITY_ID" "$ACTIVITY_INVALID_PATCH" "$TOKEN" "$ACTIVITY_INVALID_PATCH_RES")"
[[ "$INVALID_PATCH_STATUS" == "400" ]] || fail "Expected 400 for invalid activity PATCH (adding second relation), got $INVALID_PATCH_STATUS: $ACTIVITY_INVALID_PATCH_RES"

ACTIVITIES_FILTERED_JSON="$TMP_DIR/smoke.activities.filtered.by-contact.json"
http_json GET "$API_BASE/crm/activities?contactId=$CONTACT_ID" "" "$TOKEN" | tee "$ACTIVITIES_FILTERED_JSON" >/dev/null
FOUND_IN_FILTER="$(json_get "$ACTIVITIES_FILTERED_JSON" "Array.isArray(j) && j.some(x => x && x.id === '$ACTIVITY_ID')")"
[[ "$FOUND_IN_FILTER" == "true" ]] || fail "Created activity not found in filtered list: $ACTIVITIES_FILTERED_JSON"

http_json DELETE "$API_BASE/crm/activities/$ACTIVITY_ID" "" "$TOKEN" | tee "$TMP_DIR/smoke.activity.deleted.json" >/dev/null

cat > "$CONTACT_UPDATE" <<JSON
{"company":"ACME Updated"}
JSON
http_json PATCH "$API_BASE/crm/contacts/$CONTACT_ID" "$CONTACT_UPDATE" "$TOKEN" | tee "$TMP_DIR/smoke.contact.updated.json" >/dev/null
http_json DELETE "$API_BASE/crm/contacts/$CONTACT_ID" "" "$TOKEN" | tee "$TMP_DIR/smoke.contact.deleted.json" >/dev/null

http_json DELETE "$API_BASE/customers/$CUSTOMER_ID" "" "$TOKEN" | tee "$TMP_DIR/smoke.customer.deleted.json" >/dev/null

echo "== OK =="
echo "- Health: $API_BASE/health"
echo "- Auth: register+login"
echo "- CRM: leads+contacts CRUD"
echo "- Customers: create+delete (for contact accountId)"
echo "- CRM: activities contactId filter"
echo "- CRM: activities single relation rule"
echo "- CRM: activities single relation rule (PATCH)"
