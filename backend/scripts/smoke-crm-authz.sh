#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/smoke-lib.sh"
smoke_ensure_base_url

API_PREFIX="${API_PREFIX:-/api}"
API_BASE="$BASE_URL$API_PREFIX"

TMP_DIR="${TMP_DIR:-/workspaces/crm/.tmp}"
mkdir -p "$TMP_DIR"

TS="$(date +%s)"
EMAIL="${EMAIL:-smoke-authz${TS}@example.com}"
PASS="${PASS:-Password123!}"
FIRST_NAME="${FIRST_NAME:-Test}"
LAST_NAME="${LAST_NAME:-User}"

ENABLE_SMOKE_UPGRADE="${ENABLE_SMOKE_UPGRADE:-1}"
ENABLE_MEMBER_FLOW="${ENABLE_MEMBER_FLOW:-1}"

MEMBER_EMAIL="${MEMBER_EMAIL:-member-authz${TS}@example.com}"
MEMBER_PASS="${MEMBER_PASS:-Password123!}"
MEMBER_ROLE="${MEMBER_ROLE:-MEMBER}"

json_get() {
  node -e "const j=require(process.argv[1]); const v=(${2}); process.stdout.write(v?String(v):'')" "$1"
}

http_json() {
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
http_json GET "$API_BASE/health" | tee "$TMP_DIR/smoke-authz.health.json" >/dev/null

echo "== Auth: register ($EMAIL) =="
REGISTER_PAYLOAD="$TMP_DIR/smoke-authz.register.payload.json"
REGISTER_RES="$TMP_DIR/smoke-authz.register.json"
cat > "$REGISTER_PAYLOAD" <<JSON
{"email":"$EMAIL","password":"$PASS","firstName":"$FIRST_NAME","lastName":"$LAST_NAME"}
JSON
http_json POST "$API_BASE/auth/register" "$REGISTER_PAYLOAD" | tee "$REGISTER_RES" >/dev/null
REGISTER_TOKEN="$(json_get "$REGISTER_RES" "j.token||j.accessToken")"

echo "== Auth: login =="
LOGIN_PAYLOAD="$TMP_DIR/smoke-authz.login.payload.json"
LOGIN_RES="$TMP_DIR/smoke-authz.login.json"
cat > "$LOGIN_PAYLOAD" <<JSON
{"email":"$EMAIL","password":"$PASS"}
JSON
http_json POST "$API_BASE/auth/login" "$LOGIN_PAYLOAD" | tee "$LOGIN_RES" >/dev/null

TOKEN="$(json_get "$LOGIN_RES" "j.accessToken||j.token")"
if [[ -z "$TOKEN" ]]; then
  LOGIN_MSG="$(json_get "$LOGIN_RES" "j.message")"
  if [[ "$LOGIN_MSG" == "EMAIL_NOT_VERIFIED" && -n "$REGISTER_TOKEN" ]]; then
    echo "Login blocked by EMAIL_NOT_VERIFIED; using register token fallback."
    TOKEN="$REGISTER_TOKEN"
  elif [[ -n "$REGISTER_TOKEN" ]]; then
    echo "Login did not return token; using register token fallback."
    TOKEN="$REGISTER_TOKEN"
  else
    fail "Token not found in login/register responses: $LOGIN_RES / $REGISTER_RES"
  fi
fi

if [[ "$ENABLE_SMOKE_UPGRADE" == "1" ]]; then
  echo "== Tenant: subscription upgrade (optional) =="
  TENANT_UPGRADE_PAYLOAD="$TMP_DIR/smoke-authz.tenant.upgrade.json"
  TENANT_UPGRADE_RES="$TMP_DIR/smoke-authz.tenant.upgrade.res.json"
  cat > "$TENANT_UPGRADE_PAYLOAD" <<JSON
{"plan":"professional","users":3,"billing":"monthly"}
JSON
  TENANT_UPGRADE_STATUS="$(http_status PATCH "$API_BASE/tenants/my-tenant/subscription" "$TENANT_UPGRADE_PAYLOAD" "$TOKEN" "$TENANT_UPGRADE_RES")"
  if [[ "$TENANT_UPGRADE_STATUS" == "200" ]]; then
    echo "Tenant upgraded for smoke coverage."
  else
    echo "Tenant upgrade skipped/failed (status=$TENANT_UPGRADE_STATUS)."
  fi
fi

MEMBER_TOKEN=""
MEMBER_USER_ID=""
ORG_ID=""

if [[ "$ENABLE_MEMBER_FLOW" == "1" ]]; then
  echo "== Orgs: create + invite member (authz) =="
  ORG_CREATE_PAYLOAD="$TMP_DIR/smoke-authz.org.create.json"
  ORG_CREATE_RES="$TMP_DIR/smoke-authz.org.created.json"
  cat > "$ORG_CREATE_PAYLOAD" <<JSON
{"name":"Smoke Authz Org $TS"}
JSON
  ORG_CREATE_STATUS="$(http_status POST "$API_BASE/organizations" "$ORG_CREATE_PAYLOAD" "$TOKEN" "$ORG_CREATE_RES")"
  if [[ "$ORG_CREATE_STATUS" == "200" || "$ORG_CREATE_STATUS" == "201" ]]; then
    ORG_ID="$(json_get "$ORG_CREATE_RES" "j.id")"
  fi

  if [[ -n "$ORG_ID" ]]; then
    ORG_INVITE_PAYLOAD="$TMP_DIR/smoke-authz.org.invite.json"
    ORG_INVITE_RES="$TMP_DIR/smoke-authz.org.invite.res.json"
    cat > "$ORG_INVITE_PAYLOAD" <<JSON
{"email":"$MEMBER_EMAIL","role":"$MEMBER_ROLE"}
JSON
    ORG_INVITE_STATUS="$(http_status POST "$API_BASE/organizations/$ORG_ID/invite" "$ORG_INVITE_PAYLOAD" "$TOKEN" "$ORG_INVITE_RES")"
    INVITE_TOKEN=""
    if [[ "$ORG_INVITE_STATUS" == "200" || "$ORG_INVITE_STATUS" == "201" ]]; then
      INVITE_TOKEN="$(json_get "$ORG_INVITE_RES" "j.token")"
    fi

    if [[ -n "$INVITE_TOKEN" ]]; then
      MEMBER_COMPLETE_INVITE_PAYLOAD="$TMP_DIR/smoke-authz.member.invite.complete.payload.json"
      MEMBER_COMPLETE_INVITE_RES="$TMP_DIR/smoke-authz.member.invite.complete.res.json"
      cat > "$MEMBER_COMPLETE_INVITE_PAYLOAD" <<JSON
{"password":"$MEMBER_PASS"}
JSON
      MEMBER_COMPLETE_INVITE_STATUS="$(http_status POST "$API_BASE/public/invites/$INVITE_TOKEN/register" "$MEMBER_COMPLETE_INVITE_PAYLOAD" "" "$MEMBER_COMPLETE_INVITE_RES")"

      if [[ "$MEMBER_COMPLETE_INVITE_STATUS" == "200" || "$MEMBER_COMPLETE_INVITE_STATUS" == "201" ]]; then
        MEMBER_LOGIN_PAYLOAD="$TMP_DIR/smoke-authz.member.login.payload.json"
        MEMBER_LOGIN_RES="$TMP_DIR/smoke-authz.member.login.res.json"
        cat > "$MEMBER_LOGIN_PAYLOAD" <<JSON
{"email":"$MEMBER_EMAIL","password":"$MEMBER_PASS"}
JSON
        http_json POST "$API_BASE/auth/login" "$MEMBER_LOGIN_PAYLOAD" | tee "$MEMBER_LOGIN_RES" >/dev/null
        MEMBER_TOKEN="$(json_get "$MEMBER_LOGIN_RES" "j.accessToken||j.token")"
      fi
    fi
  fi

  if [[ -n "$MEMBER_TOKEN" ]]; then
    echo "MEMBER_TOKEN_LEN=${#MEMBER_TOKEN}"
    MEMBER_ME_JSON="$TMP_DIR/smoke-authz.member.me.json"
    http_json GET "$API_BASE/auth/me" "" "$MEMBER_TOKEN" | tee "$MEMBER_ME_JSON" >/dev/null
    MEMBER_USER_ID="$(json_get "$MEMBER_ME_JSON" "j.id||j.user?.id||j.data?.id")"
    if [[ -n "$MEMBER_USER_ID" ]]; then
      echo "MEMBER_USER_ID=$MEMBER_USER_ID"
    else
      echo "Member user id not found; team visibility checks will be skipped."
    fi
  else
    echo "Member flow unavailable; skipping member authz checks."
  fi
fi

echo "== CRM: pipeline bootstrap (required for opportunities) =="
CRM_BOOTSTRAP_JSON="$TMP_DIR/smoke-authz.crm.bootstrap.json"
http_json POST "$API_BASE/crm/pipeline/bootstrap" "" "$TOKEN" | tee "$CRM_BOOTSTRAP_JSON" >/dev/null
STAGE_1_ID="$(json_get "$CRM_BOOTSTRAP_JSON" "Array.isArray(j.stageIds) && j.stageIds[1]")"
STAGE_2_ID="$(json_get "$CRM_BOOTSTRAP_JSON" "Array.isArray(j.stageIds) && j.stageIds[2]")"

echo "== Customers + Contacts: setup (owner) =="
CUSTOMER_CREATE="$TMP_DIR/smoke-authz.customer.create.json"
CUSTOMER_CREATED_JSON="$TMP_DIR/smoke-authz.customer.created.json"
cat > "$CUSTOMER_CREATE" <<JSON
{"name":"Customer Authz Smoke $TS"}
JSON
http_json POST "$API_BASE/customers" "$CUSTOMER_CREATE" "$TOKEN" | tee "$CUSTOMER_CREATED_JSON" >/dev/null
CUSTOMER_ID="$(json_get "$CUSTOMER_CREATED_JSON" "j.id")"
[[ -n "$CUSTOMER_ID" ]] || fail "Customer id missing in create response: $CUSTOMER_CREATED_JSON"

CONTACT_CREATE="$TMP_DIR/smoke-authz.contact.create.json"
CONTACT_CREATED_JSON="$TMP_DIR/smoke-authz.contact.created.json"
cat > "$CONTACT_CREATE" <<JSON
{"name":"Contact Authz Smoke $TS","email":"contact.authz.$TS@example.com","phone":"+90501$TS","company":"ACME"}
JSON
http_json POST "$API_BASE/crm/contacts" "$CONTACT_CREATE" "$TOKEN" | tee "$CONTACT_CREATED_JSON" >/dev/null
CONTACT_ID="$(json_get "$CONTACT_CREATED_JSON" "j.id")"
[[ -n "$CONTACT_ID" ]] || fail "Contact id missing in create response: $CONTACT_CREATED_JSON"

CONTACT_ACCOUNT_PATCH="$TMP_DIR/smoke-authz.contact.account.patch.json"
cat > "$CONTACT_ACCOUNT_PATCH" <<JSON
{"accountId":"$CUSTOMER_ID"}
JSON

if [[ -n "$MEMBER_TOKEN" ]]; then
  echo "== Authz: member cannot set accountId on owner's contact (pre-visibility) =="
  MEMBER_CONTACT_ACCOUNT_PATCH_RES="$TMP_DIR/smoke-authz.member.contact.account.patch.res.json"
  MEMBER_CONTACT_ACCOUNT_PATCH_STATUS="$(http_status PATCH "$API_BASE/crm/contacts/$CONTACT_ID" "$CONTACT_ACCOUNT_PATCH" "$MEMBER_TOKEN" "$MEMBER_CONTACT_ACCOUNT_PATCH_RES")"
  [[ "$MEMBER_CONTACT_ACCOUNT_PATCH_STATUS" == "403" ]] || fail "Expected 403 for member contact accountId update, got $MEMBER_CONTACT_ACCOUNT_PATCH_STATUS: $MEMBER_CONTACT_ACCOUNT_PATCH_RES"

  echo "== Authz: member cannot create activity on owner's contact (pre-visibility) =="
  MEMBER_ACTIVITY_CREATE_PRE="$TMP_DIR/smoke-authz.member.activity.create.pre.json"
  MEMBER_ACTIVITY_CREATE_PRE_RES="$TMP_DIR/smoke-authz.member.activity.create.pre.res.json"
  cat > "$MEMBER_ACTIVITY_CREATE_PRE" <<JSON
{"title":"Member Forbidden Activity (pre-access) $TS","type":"call","contactId":"$CONTACT_ID","completed":false}
JSON
  MEMBER_ACTIVITY_CREATE_PRE_STATUS="$(http_status POST "$API_BASE/crm/activities" "$MEMBER_ACTIVITY_CREATE_PRE" "$MEMBER_TOKEN" "$MEMBER_ACTIVITY_CREATE_PRE_RES")"
  [[ "$MEMBER_ACTIVITY_CREATE_PRE_STATUS" == "403" ]] || fail "Expected 403 for member activity create pre-visibility, got $MEMBER_ACTIVITY_CREATE_PRE_STATUS: $MEMBER_ACTIVITY_CREATE_PRE_RES"
fi

echo "== CRM: opportunity create (owner; grants team visibility) =="
OPP_CREATE="$TMP_DIR/smoke-authz.opportunity.create.json"
OPP_CREATED_JSON="$TMP_DIR/smoke-authz.opportunity.created.json"
if [[ -n "$MEMBER_USER_ID" ]]; then
  cat > "$OPP_CREATE" <<JSON
{"accountId":"$CUSTOMER_ID","name":"Opp Authz Smoke $TS","amount":0,"currency":"TRY","teamUserIds":["$MEMBER_USER_ID"]}
JSON
else
  cat > "$OPP_CREATE" <<JSON
{"accountId":"$CUSTOMER_ID","name":"Opp Authz Smoke $TS","amount":0,"currency":"TRY"}
JSON
fi
http_json POST "$API_BASE/crm/opportunities" "$OPP_CREATE" "$TOKEN" | tee "$OPP_CREATED_JSON" >/dev/null
OPP_ID="$(json_get "$OPP_CREATED_JSON" "j.id")"
OPP_STAGE_ID="$(json_get "$OPP_CREATED_JSON" "j.stageId")"
[[ -n "$OPP_ID" ]] || fail "Opportunity id missing in create response: $OPP_CREATED_JSON"

MOVE_STAGE_ID=""
if [[ -n "$STAGE_1_ID" && "$STAGE_1_ID" != "$OPP_STAGE_ID" ]]; then
  MOVE_STAGE_ID="$STAGE_1_ID"
elif [[ -n "$STAGE_2_ID" && "$STAGE_2_ID" != "$OPP_STAGE_ID" ]]; then
  MOVE_STAGE_ID="$STAGE_2_ID"
fi

if [[ -n "$MEMBER_TOKEN" ]]; then
  echo "== Authz: member can see board opportunity (team visibility) =="
  MEMBER_BOARD_JSON="$TMP_DIR/smoke-authz.member.board.json"
  MEMBER_BOARD_STATUS="$(http_status GET "$API_BASE/crm/board" "" "$MEMBER_TOKEN" "$MEMBER_BOARD_JSON")"
  [[ "$MEMBER_BOARD_STATUS" == "200" ]] || fail "Expected 200 for member board, got $MEMBER_BOARD_STATUS: $MEMBER_BOARD_JSON"
  MEMBER_BOARD_HAS_OPP="$(json_get "$MEMBER_BOARD_JSON" "Array.isArray(j?.opportunities) && j.opportunities.some(o => o && o.id === '$OPP_ID')")"
  [[ "$MEMBER_BOARD_HAS_OPP" == "true" ]] || fail "Member board does not include team opportunity: $MEMBER_BOARD_JSON"

  echo "== Authz: member cannot update opportunity fields =="
  MEMBER_OPP_PATCH="$TMP_DIR/smoke-authz.member.opp.patch.json"
  MEMBER_OPP_PATCH_RES="$TMP_DIR/smoke-authz.member.opp.patch.res.json"
  cat > "$MEMBER_OPP_PATCH" <<JSON
{"name":"HACKED"}
JSON
  MEMBER_OPP_PATCH_STATUS="$(http_status PATCH "$API_BASE/crm/opportunities/$OPP_ID" "$MEMBER_OPP_PATCH" "$MEMBER_TOKEN" "$MEMBER_OPP_PATCH_RES")"
  [[ "$MEMBER_OPP_PATCH_STATUS" == "403" ]] || fail "Expected 403 for member opportunity update, got $MEMBER_OPP_PATCH_STATUS: $MEMBER_OPP_PATCH_RES"

  echo "== Authz: member cannot edit opportunity team =="
  MEMBER_OPP_TEAM="$TMP_DIR/smoke-authz.member.opp.team.json"
  MEMBER_OPP_TEAM_RES="$TMP_DIR/smoke-authz.member.opp.team.res.json"
  cat > "$MEMBER_OPP_TEAM" <<JSON
{"userIds":[]}
JSON
  MEMBER_OPP_TEAM_STATUS="$(http_status POST "$API_BASE/crm/opportunities/$OPP_ID/team" "$MEMBER_OPP_TEAM" "$MEMBER_TOKEN" "$MEMBER_OPP_TEAM_RES")"
  [[ "$MEMBER_OPP_TEAM_STATUS" == "403" ]] || fail "Expected 403 for member setTeam, got $MEMBER_OPP_TEAM_STATUS: $MEMBER_OPP_TEAM_RES"

  if [[ -n "$MOVE_STAGE_ID" ]]; then
    echo "== Authz: stage move is role-gated (team membership alone is not enough) =="
    MEMBER_OPP_MOVE_PAYLOAD="$TMP_DIR/smoke-authz.member.opp.move.json"
    MEMBER_OPP_MOVE_RES="$TMP_DIR/smoke-authz.member.opp.move.res.json"
    cat > "$MEMBER_OPP_MOVE_PAYLOAD" <<JSON
{"stageId":"$MOVE_STAGE_ID"}
JSON
    MEMBER_OPP_MOVE_STATUS="$(http_status POST "$API_BASE/crm/opportunities/$OPP_ID/move" "$MEMBER_OPP_MOVE_PAYLOAD" "$MEMBER_TOKEN" "$MEMBER_OPP_MOVE_RES")"

    if [[ "$MEMBER_ROLE" == "ADMIN" || "$MEMBER_ROLE" == "OWNER" ]]; then
      [[ "$MEMBER_OPP_MOVE_STATUS" == "200" || "$MEMBER_OPP_MOVE_STATUS" == "201" ]] || fail "Expected 200/201 for org ADMIN/OWNER move stage, got $MEMBER_OPP_MOVE_STATUS: $MEMBER_OPP_MOVE_RES"
    else
      [[ "$MEMBER_OPP_MOVE_STATUS" == "403" ]] || fail "Expected 403 for member move stage (team member stage move asla), got $MEMBER_OPP_MOVE_STATUS: $MEMBER_OPP_MOVE_RES"
    fi

    echo "== Authz: owner can move stage =="
    OWNER_OPP_MOVE_RES="$TMP_DIR/smoke-authz.owner.opp.move.res.json"
    OWNER_OPP_MOVE_STATUS="$(http_status POST "$API_BASE/crm/opportunities/$OPP_ID/move" "$MEMBER_OPP_MOVE_PAYLOAD" "$TOKEN" "$OWNER_OPP_MOVE_RES")"
    [[ "$OWNER_OPP_MOVE_STATUS" == "200" || "$OWNER_OPP_MOVE_STATUS" == "201" ]] || fail "Expected 200/201 for owner move stage, got $OWNER_OPP_MOVE_STATUS: $OWNER_OPP_MOVE_RES"
  else
    echo "Move-stage test skipped (no alternate stageId available)."
  fi
fi

echo "== Authz: owner can set contact accountId (after visibility context) =="
CONTACT_ALLOWED_PATCH_RES="$TMP_DIR/smoke-authz.contact.account.patch.res.json"
ALLOWED_PATCH_STATUS="$(http_status PATCH "$API_BASE/crm/contacts/$CONTACT_ID" "$CONTACT_ACCOUNT_PATCH" "$TOKEN" "$CONTACT_ALLOWED_PATCH_RES")"
[[ "$ALLOWED_PATCH_STATUS" == "200" ]] || fail "Expected 200 for owner contact accountId update, got $ALLOWED_PATCH_STATUS: $CONTACT_ALLOWED_PATCH_RES"

if [[ -n "$MEMBER_TOKEN" ]]; then
  echo "== Authz: member can list contacts by accountId after team access =="
  MEMBER_CONTACTS_BY_ACCOUNT_JSON="$TMP_DIR/smoke-authz.member.contacts.by-account.json"
  MEMBER_CONTACTS_BY_ACCOUNT_STATUS="$(http_status GET "$API_BASE/crm/contacts?accountId=$CUSTOMER_ID" "" "$MEMBER_TOKEN" "$MEMBER_CONTACTS_BY_ACCOUNT_JSON")"
  [[ "$MEMBER_CONTACTS_BY_ACCOUNT_STATUS" == "200" ]] || fail "Expected 200 for member contacts list by accountId, got $MEMBER_CONTACTS_BY_ACCOUNT_STATUS: $MEMBER_CONTACTS_BY_ACCOUNT_JSON"
  MEMBER_FOUND_CONTACT_IN_FILTER="$(json_get "$MEMBER_CONTACTS_BY_ACCOUNT_JSON" "Array.isArray(j) && j.some(x => x && x.id === '$CONTACT_ID')")"
  [[ "$MEMBER_FOUND_CONTACT_IN_FILTER" == "true" ]] || fail "Member could not see contact in accountId filtered list: $MEMBER_CONTACTS_BY_ACCOUNT_JSON"

  echo "== Authz: member cannot update owner's contact =="
  MEMBER_CONTACT_PATCH="$TMP_DIR/smoke-authz.member.contact.patch.json"
  MEMBER_CONTACT_PATCH_RES="$TMP_DIR/smoke-authz.member.contact.patch.res.json"
  cat > "$MEMBER_CONTACT_PATCH" <<JSON
{"company":"HACKED"}
JSON
  MEMBER_CONTACT_PATCH_STATUS="$(http_status PATCH "$API_BASE/crm/contacts/$CONTACT_ID" "$MEMBER_CONTACT_PATCH" "$MEMBER_TOKEN" "$MEMBER_CONTACT_PATCH_RES")"
  [[ "$MEMBER_CONTACT_PATCH_STATUS" == "403" ]] || fail "Expected 403 for member contact update, got $MEMBER_CONTACT_PATCH_STATUS: $MEMBER_CONTACT_PATCH_RES"

  echo "== Authz: member can create activity on contact after visibility =="
  MEMBER_ACTIVITY_CREATE="$TMP_DIR/smoke-authz.member.activity.create.json"
  MEMBER_ACTIVITY_CREATE_RES="$TMP_DIR/smoke-authz.member.activity.create.res.json"
  cat > "$MEMBER_ACTIVITY_CREATE" <<JSON
{"title":"Member Activity (post-access) $TS","type":"call","contactId":"$CONTACT_ID","completed":false}
JSON
  MEMBER_ACTIVITY_CREATE_STATUS="$(http_status POST "$API_BASE/crm/activities" "$MEMBER_ACTIVITY_CREATE" "$MEMBER_TOKEN" "$MEMBER_ACTIVITY_CREATE_RES")"
  if [[ "$MEMBER_ACTIVITY_CREATE_STATUS" == "200" || "$MEMBER_ACTIVITY_CREATE_STATUS" == "201" ]]; then
    MEMBER_ACTIVITY_ID="$(json_get "$MEMBER_ACTIVITY_CREATE_RES" "j.id")"
    if [[ -n "$MEMBER_ACTIVITY_ID" ]]; then
      http_json DELETE "$API_BASE/crm/activities/$MEMBER_ACTIVITY_ID" "" "$MEMBER_TOKEN" | tee "$TMP_DIR/smoke-authz.member.activity.deleted.json" >/dev/null
    fi
  else
    fail "Expected 200/201 for member activity create post-access, got $MEMBER_ACTIVITY_CREATE_STATUS: $MEMBER_ACTIVITY_CREATE_RES"
  fi
fi

# Cleanup best-effort: contact + customer + org
http_json DELETE "$API_BASE/crm/contacts/$CONTACT_ID" "" "$TOKEN" | tee "$TMP_DIR/smoke-authz.contact.deleted.json" >/dev/null || true
http_json DELETE "$API_BASE/customers/$CUSTOMER_ID" "" "$TOKEN" | tee "$TMP_DIR/smoke-authz.customer.deleted.json" >/dev/null || true
if [[ -n "$ORG_ID" ]]; then
  http_json DELETE "$API_BASE/organizations/$ORG_ID" "" "$TOKEN" | tee "$TMP_DIR/smoke-authz.org.deleted.json" >/dev/null || true
fi

echo "== OK =="
echo "- Health: $API_BASE/health"
echo "- Auth: register+login"
echo "- CRM authz: contacts/account visibility + member restrictions + stage move policy"
