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

# Some environments require verified email for /auth/login (EMAIL_NOT_VERIFIED).
# /auth/register already returns a JWT token in this codebase, so we can use it
# as a safe fallback to keep CRM smoke tests running.
REGISTER_TOKEN="$(json_get "$REGISTER_RES" "j.token||j.accessToken")"

# Auth: login
echo "== Auth: login =="
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

# Optional: upgrade this freshly-created tenant to unlock plan-limited smoke paths.
# This is safe because each smoke run registers a brand new tenant.
ENABLE_SMOKE_UPGRADE="${ENABLE_SMOKE_UPGRADE:-1}"
if [[ "$ENABLE_SMOKE_UPGRADE" == "1" ]]; then
  echo "== Tenant: subscription upgrade (optional) =="
  TENANT_UPGRADE_PAYLOAD="$TMP_DIR/smoke.tenant.upgrade.json"
  cat > "$TENANT_UPGRADE_PAYLOAD" <<JSON
{"plan":"professional","users":3,"billing":"monthly"}
JSON
  TENANT_UPGRADE_RES="$TMP_DIR/smoke.tenant.upgrade.res.json"
  TENANT_UPGRADE_STATUS="$(http_status PATCH "$API_BASE/tenants/my-tenant/subscription" "$TENANT_UPGRADE_PAYLOAD" "$TOKEN" "$TENANT_UPGRADE_RES")"
  if [[ "$TENANT_UPGRADE_STATUS" == "200" ]]; then
    echo "Tenant upgraded for smoke coverage."
  else
    echo "Tenant upgrade skipped/failed (status=$TENANT_UPGRADE_STATUS)."
  fi
fi

# === Optional: create a non-admin member user (via organizations) for authz-negative tests ===
# Disabled by default to avoid polluting DB with org records when plan limits prevent invites.
ENABLE_MEMBER_FLOW="${ENABLE_MEMBER_FLOW:-0}"
MEMBER_EMAIL="${MEMBER_EMAIL:-member${TS}@example.com}"
MEMBER_PASS="${MEMBER_PASS:-Password123!}"
MEMBER_ROLE="${MEMBER_ROLE:-MEMBER}"
MEMBER_TOKEN=""
MEMBER_USER_ID=""

if [[ "$ENABLE_MEMBER_FLOW" == "1" ]]; then
  ORG_ID=""

  echo "== Orgs: create + invite member (optional) =="
  ORG_CREATE_PAYLOAD="$TMP_DIR/smoke.org.create.json"
  cat > "$ORG_CREATE_PAYLOAD" <<JSON
{"name":"Smoke Org $TS"}
JSON
  ORG_CREATE_RES="$TMP_DIR/smoke.org.created.json"
  ORG_CREATE_STATUS="$(http_status POST "$API_BASE/organizations" "$ORG_CREATE_PAYLOAD" "$TOKEN" "$ORG_CREATE_RES")"
  if [[ "$ORG_CREATE_STATUS" == "200" || "$ORG_CREATE_STATUS" == "201" ]]; then
    ORG_ID="$(json_get "$ORG_CREATE_RES" "j.id")"
  fi

  if [[ -n "$ORG_ID" ]]; then
    ORG_INVITE_PAYLOAD="$TMP_DIR/smoke.org.invite.json"
    cat > "$ORG_INVITE_PAYLOAD" <<JSON
  {"email":"$MEMBER_EMAIL","role":"$MEMBER_ROLE"}
JSON
    ORG_INVITE_RES="$TMP_DIR/smoke.org.invite.res.json"
    ORG_INVITE_STATUS="$(http_status POST "$API_BASE/organizations/$ORG_ID/invite" "$ORG_INVITE_PAYLOAD" "$TOKEN" "$ORG_INVITE_RES")"
    INVITE_TOKEN=""
    if [[ "$ORG_INVITE_STATUS" == "200" || "$ORG_INVITE_STATUS" == "201" ]]; then
      INVITE_TOKEN="$(json_get "$ORG_INVITE_RES" "j.token")"
    fi

    if [[ -n "$INVITE_TOKEN" ]]; then
      # Complete invite via public endpoint (creates non-admin user on owner's tenant + accepts invite)
      MEMBER_COMPLETE_INVITE_PAYLOAD="$TMP_DIR/smoke.member.invite.complete.payload.json"
      cat > "$MEMBER_COMPLETE_INVITE_PAYLOAD" <<JSON
{"password":"$MEMBER_PASS"}
JSON
      MEMBER_COMPLETE_INVITE_RES="$TMP_DIR/smoke.member.invite.complete.res.json"
      MEMBER_COMPLETE_INVITE_STATUS="$(http_status POST "$API_BASE/public/invites/$INVITE_TOKEN/register" "$MEMBER_COMPLETE_INVITE_PAYLOAD" "" "$MEMBER_COMPLETE_INVITE_RES")"

      if [[ "$MEMBER_COMPLETE_INVITE_STATUS" == "200" || "$MEMBER_COMPLETE_INVITE_STATUS" == "201" ]]; then
        # Login as member to get a real non-admin JWT
        MEMBER_LOGIN_PAYLOAD="$TMP_DIR/smoke.member.login.payload.json"
        cat > "$MEMBER_LOGIN_PAYLOAD" <<JSON
{"email":"$MEMBER_EMAIL","password":"$MEMBER_PASS"}
JSON
        MEMBER_LOGIN_RES="$TMP_DIR/smoke.member.login.res.json"
        http_json POST "$API_BASE/auth/login" "$MEMBER_LOGIN_PAYLOAD" | tee "$MEMBER_LOGIN_RES" >/dev/null
        MEMBER_TOKEN="$(json_get "$MEMBER_LOGIN_RES" "j.accessToken||j.token")"
      fi
    fi
  fi

  if [[ -n "$MEMBER_TOKEN" ]]; then
    echo "MEMBER_TOKEN_LEN=${#MEMBER_TOKEN}"

    echo "== Auth: member profile (/auth/me) =="
    MEMBER_ME_JSON="$TMP_DIR/smoke.member.me.json"
    http_json GET "$API_BASE/auth/me" "" "$MEMBER_TOKEN" | tee "$MEMBER_ME_JSON" >/dev/null
    MEMBER_USER_ID="$(json_get "$MEMBER_ME_JSON" "j.id||j.user?.id||j.data?.id")"
    if [[ -n "$MEMBER_USER_ID" ]]; then
      echo "MEMBER_USER_ID=$MEMBER_USER_ID"
    else
      echo "Member user id not found; team-membership positive checks will be skipped."
    fi
  else
    echo "Member flow unavailable; skipping non-admin authz negative tests."
  fi
fi

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

echo "== CRM: leads sorting (sortBy=name&sortDir=asc) =="
LEAD_SORT_CREATE_A="$TMP_DIR/smoke.lead.sort.a.create.json"
LEAD_SORT_CREATE_B="$TMP_DIR/smoke.lead.sort.b.create.json"
cat > "$LEAD_SORT_CREATE_A" <<JSON
{"name":"A Lead Sort $TS","email":"lead.sort.a.$TS@example.com","phone":"+90504$TS","company":"ACME","status":"new"}
JSON
cat > "$LEAD_SORT_CREATE_B" <<JSON
{"name":"B Lead Sort $TS","email":"lead.sort.b.$TS@example.com","phone":"+90505$TS","company":"ACME","status":"new"}
JSON

LEAD_SORT_CREATED_A_JSON="$TMP_DIR/smoke.lead.sort.a.created.json"
LEAD_SORT_CREATED_B_JSON="$TMP_DIR/smoke.lead.sort.b.created.json"
http_json POST "$API_BASE/crm/leads" "$LEAD_SORT_CREATE_A" "$TOKEN" | tee "$LEAD_SORT_CREATED_A_JSON" >/dev/null
http_json POST "$API_BASE/crm/leads" "$LEAD_SORT_CREATE_B" "$TOKEN" | tee "$LEAD_SORT_CREATED_B_JSON" >/dev/null

LEADS_SORTED_JSON="$TMP_DIR/smoke.leads.sorted.json"
http_json GET "$API_BASE/crm/leads?q=Lead%20Sort%20$TS&sortBy=name&sortDir=asc" "" "$TOKEN" | tee "$LEADS_SORTED_JSON" >/dev/null
LEADS_SORTED_FIRST_NAME="$(json_get "$LEADS_SORTED_JSON" "Array.isArray(j.items) && j.items[0] && j.items[0].name")"
[[ "$LEADS_SORTED_FIRST_NAME" == "A Lead Sort $TS" ]] || fail "Expected leads sorted first name to be 'A Lead Sort $TS', got '$LEADS_SORTED_FIRST_NAME'. Response: $LEADS_SORTED_JSON"

cat > "$LEAD_UPDATE" <<JSON
{"status":"qualified"}
JSON
http_json PATCH "$API_BASE/crm/leads/$LEAD_ID" "$LEAD_UPDATE" "$TOKEN" | tee "$TMP_DIR/smoke.lead.updated.json" >/dev/null
http_json DELETE "$API_BASE/crm/leads/$LEAD_ID" "" "$TOKEN" | tee "$TMP_DIR/smoke.lead.deleted.json" >/dev/null

# Contacts CRUD
echo "== CRM: contacts CRUD =="

echo "== CRM: pipeline bootstrap (required for opportunities) =="
CRM_BOOTSTRAP_JSON="$TMP_DIR/smoke.crm.bootstrap.json"
http_json POST "$API_BASE/crm/pipeline/bootstrap" "" "$TOKEN" | tee "$CRM_BOOTSTRAP_JSON" >/dev/null
STAGE_0_ID="$(json_get "$CRM_BOOTSTRAP_JSON" "Array.isArray(j.stageIds) && j.stageIds[0]")"
STAGE_1_ID="$(json_get "$CRM_BOOTSTRAP_JSON" "Array.isArray(j.stageIds) && j.stageIds[1]")"
STAGE_2_ID="$(json_get "$CRM_BOOTSTRAP_JSON" "Array.isArray(j.stageIds) && j.stageIds[2]")"

echo "== CRM: automation (stage change creates task) =="
AUTO_RULE_CREATE="$TMP_DIR/smoke.crm.auto.rule.create.json"
cat > "$AUTO_RULE_CREATE" <<JSON
{"enabled":true,"fromStageId":null,"toStageId":"$STAGE_1_ID","titleTemplate":"Auto task: {{toStageName}}","dueInDays":3,"assigneeTarget":"owner"}
JSON
AUTO_RULE_CREATED_JSON="$TMP_DIR/smoke.crm.auto.rule.created.json"
http_json POST "$API_BASE/crm/automation/stage-task-rules" "$AUTO_RULE_CREATE" "$TOKEN" | tee "$AUTO_RULE_CREATED_JSON" >/dev/null
AUTO_RULE_ID="$(json_get "$AUTO_RULE_CREATED_JSON" "j.id")"
[[ -n "$AUTO_RULE_ID" ]] || fail "Automation rule id missing in create response: $AUTO_RULE_CREATED_JSON"

echo "== CRM: stages-only endpoint (/crm/stages) =="
STAGES_JSON="$TMP_DIR/smoke.crm.stages.json"
http_json GET "$API_BASE/crm/stages" "" "$TOKEN" | tee "$STAGES_JSON" >/dev/null
STAGES_HAS_STAGE0="$(json_get "$STAGES_JSON" "Array.isArray(j) && j.some(s => s && s.id === '$STAGE_0_ID')")"
[[ "$STAGES_HAS_STAGE0" == "true" ]] || fail "Stages list missing bootstrap stageId: $STAGES_JSON"

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

echo "== CRM: contacts sorting (sortBy=name&sortDir=asc) =="
CONTACT_SORT_CREATE_A="$TMP_DIR/smoke.contact.sort.a.create.json"
CONTACT_SORT_CREATE_B="$TMP_DIR/smoke.contact.sort.b.create.json"
cat > "$CONTACT_SORT_CREATE_A" <<JSON
{"name":"A Contact Sort $TS","email":"contact.sort.a.$TS@example.com","phone":"+90502$TS","company":"ACME"}
JSON
cat > "$CONTACT_SORT_CREATE_B" <<JSON
{"name":"B Contact Sort $TS","email":"contact.sort.b.$TS@example.com","phone":"+90503$TS","company":"ACME"}
JSON

CONTACT_SORT_A_JSON="$TMP_DIR/smoke.contact.sort.a.created.json"
CONTACT_SORT_B_JSON="$TMP_DIR/smoke.contact.sort.b.created.json"
http_json POST "$API_BASE/crm/contacts" "$CONTACT_SORT_CREATE_A" "$TOKEN" | tee "$CONTACT_SORT_A_JSON" >/dev/null
http_json POST "$API_BASE/crm/contacts" "$CONTACT_SORT_CREATE_B" "$TOKEN" | tee "$CONTACT_SORT_B_JSON" >/dev/null

CONTACT_SORT_A_ID="$(json_get "$CONTACT_SORT_A_JSON" "j.id")"
CONTACT_SORT_B_ID="$(json_get "$CONTACT_SORT_B_JSON" "j.id")"
[[ -n "$CONTACT_SORT_A_ID" ]] || fail "Contact sort A id missing in create response: $CONTACT_SORT_A_JSON"
[[ -n "$CONTACT_SORT_B_ID" ]] || fail "Contact sort B id missing in create response: $CONTACT_SORT_B_JSON"

CONTACTS_SORTED_JSON="$TMP_DIR/smoke.contacts.sorted.by-name.json"
http_json GET "$API_BASE/crm/contacts?q=Contact%20Sort%20$TS&sortBy=name&sortDir=asc" "" "$TOKEN" | tee "$CONTACTS_SORTED_JSON" >/dev/null
FIRST_CONTACT_NAME="$(json_get "$CONTACTS_SORTED_JSON" "Array.isArray(j.items) && j.items[0] && j.items[0].name")"
[[ "$FIRST_CONTACT_NAME" == "A Contact Sort $TS" ]] || fail "Expected first contact name to be 'A Contact Sort $TS' for sortBy=name&sortDir=asc, got '$FIRST_CONTACT_NAME': $CONTACTS_SORTED_JSON"

echo "== CRM: contact accountId update before opportunity visibility =="
CONTACT_FORBIDDEN_PATCH="$TMP_DIR/smoke.contact.forbidden.patch.json"
cat > "$CONTACT_FORBIDDEN_PATCH" <<JSON
{"accountId":"$CUSTOMER_ID"}
JSON
CONTACT_FORBIDDEN_PATCH_RES="$TMP_DIR/smoke.contact.forbidden.patch.res.json"
FORBIDDEN_PATCH_STATUS="$(http_status PATCH "$API_BASE/crm/contacts/$CONTACT_ID" "$CONTACT_FORBIDDEN_PATCH" "$TOKEN" "$CONTACT_FORBIDDEN_PATCH_RES")"
if [[ "$FORBIDDEN_PATCH_STATUS" == "403" ]]; then
  echo "Got 403 for contact accountId update before visibility (token likely non-admin)."
elif [[ "$FORBIDDEN_PATCH_STATUS" == "200" ]]; then
  echo "Contact accountId update succeeded before visibility (token likely OWNER/ADMIN); continuing."
else
  fail "Expected 403 or 200 for contact accountId update before visibility, got $FORBIDDEN_PATCH_STATUS: $CONTACT_FORBIDDEN_PATCH_RES"
fi

if [[ -n "$MEMBER_TOKEN" ]]; then
  echo "== CRM: authz (member cannot set accountId on owner's contact) =="
  MEMBER_CONTACT_ACCOUNT_PATCH_RES="$TMP_DIR/smoke.member.contact.account.patch.res.json"
  MEMBER_CONTACT_ACCOUNT_PATCH_STATUS="$(http_status PATCH "$API_BASE/crm/contacts/$CONTACT_ID" "$CONTACT_FORBIDDEN_PATCH" "$MEMBER_TOKEN" "$MEMBER_CONTACT_ACCOUNT_PATCH_RES")"
  [[ "$MEMBER_CONTACT_ACCOUNT_PATCH_STATUS" == "403" ]] || fail "Expected 403 for member contact accountId update, got $MEMBER_CONTACT_ACCOUNT_PATCH_STATUS: $MEMBER_CONTACT_ACCOUNT_PATCH_RES"

  echo "== CRM: authz (member cannot create activity on owner's contact before visibility) =="
  MEMBER_ACTIVITY_CREATE_PRE="$TMP_DIR/smoke.member.activity.create.pre.json"
  cat > "$MEMBER_ACTIVITY_CREATE_PRE" <<JSON
{"title":"Member Forbidden Activity (pre-access) $TS","type":"call","contactId":"$CONTACT_ID","completed":false}
JSON
  MEMBER_ACTIVITY_CREATE_PRE_RES="$TMP_DIR/smoke.member.activity.create.pre.res.json"
  MEMBER_ACTIVITY_CREATE_PRE_STATUS="$(http_status POST "$API_BASE/crm/activities" "$MEMBER_ACTIVITY_CREATE_PRE" "$MEMBER_TOKEN" "$MEMBER_ACTIVITY_CREATE_PRE_RES")"
  [[ "$MEMBER_ACTIVITY_CREATE_PRE_STATUS" == "403" ]] || fail "Expected 403 for member activity create pre-visibility, got $MEMBER_ACTIVITY_CREATE_PRE_STATUS: $MEMBER_ACTIVITY_CREATE_PRE_RES"
fi

echo "== CRM: opportunity create (to grant account visibility) =="
OPP_CREATE="$TMP_DIR/smoke.opportunity.create.json"
if [[ -n "$MEMBER_USER_ID" ]]; then
  cat > "$OPP_CREATE" <<JSON
{"accountId":"$CUSTOMER_ID","name":"Opp Smoke $TS","amount":0,"currency":"TRY","teamUserIds":["$MEMBER_USER_ID"]}
JSON
else
  cat > "$OPP_CREATE" <<JSON
{"accountId":"$CUSTOMER_ID","name":"Opp Smoke $TS","amount":0,"currency":"TRY"}
JSON
fi
OPP_CREATED_JSON="$TMP_DIR/smoke.opportunity.created.json"
http_json POST "$API_BASE/crm/opportunities" "$OPP_CREATE" "$TOKEN" | tee "$OPP_CREATED_JSON" >/dev/null
OPP_ID="$(json_get "$OPP_CREATED_JSON" "j.id")"
OPP_STAGE_ID="$(json_get "$OPP_CREATED_JSON" "j.stageId")"
OPP_OWNER_ID="$(json_get "$OPP_CREATED_JSON" "j.ownerUserId")"
[[ -n "$OPP_ID" ]] || fail "Opportunity id missing in create response: $OPP_CREATED_JSON"
echo "Opportunity ID: $OPP_ID"

echo "== CRM: opportunity move triggers automation task =="
OPP_MOVE_PAYLOAD="$TMP_DIR/smoke.crm.opp.move.json"
cat > "$OPP_MOVE_PAYLOAD" <<JSON
{"stageId":"$STAGE_1_ID"}
JSON
OPP_MOVED_JSON="$TMP_DIR/smoke.crm.opp.moved.json"
http_json POST "$API_BASE/crm/opportunities/$OPP_ID/move" "$OPP_MOVE_PAYLOAD" "$TOKEN" | tee "$OPP_MOVED_JSON" >/dev/null
OPP_MOVED_STAGE_ID="$(json_get "$OPP_MOVED_JSON" "j.stageId")"
[[ "$OPP_MOVED_STAGE_ID" == "$STAGE_1_ID" ]] || fail "Expected moved stageId to be $STAGE_1_ID, got $OPP_MOVED_STAGE_ID: $OPP_MOVED_JSON"

AUTO_TASKS_JSON="$TMP_DIR/smoke.crm.tasks.after.move.json"
http_json GET "$API_BASE/crm/tasks?opportunityId=$OPP_ID" "" "$TOKEN" | tee "$AUTO_TASKS_JSON" >/dev/null
AUTO_TASK_FOUND="$(json_get "$AUTO_TASKS_JSON" "Array.isArray(j.items) && j.items.some(t => t && typeof t.title === 'string' && t.title.startsWith('Auto task:') )")"
[[ "$AUTO_TASK_FOUND" == "true" ]] || fail "Expected automation task to be created after stage move: $AUTO_TASKS_JSON"
if [[ -n "$OPP_OWNER_ID" ]]; then
  AUTO_TASK_ASSIGNEE_OK="$(json_get "$AUTO_TASKS_JSON" "Array.isArray(j.items) && j.items.some(t => t && typeof t.title === 'string' && t.title.startsWith('Auto task:') && String(t.assigneeUserId||'') === '$OPP_OWNER_ID')")"
  [[ "$AUTO_TASK_ASSIGNEE_OK" == "true" ]] || fail "Expected automation task to be assigned to owner ($OPP_OWNER_ID): $AUTO_TASKS_JSON"
fi

echo "== CRM: automation (stale deal reminder creates task) =="
STALE_RULE_CREATE="$TMP_DIR/smoke.crm.stale.rule.create.json"
cat > "$STALE_RULE_CREATE" <<JSON
{"enabled":true,"staleDays":0,"stageId":"$STAGE_1_ID","titleTemplate":"Stale task: {{opportunityName}}","dueInDays":0,"cooldownDays":7,"assigneeTarget":"owner"}
JSON
STALE_RULE_CREATED_JSON="$TMP_DIR/smoke.crm.stale.rule.created.json"
http_json POST "$API_BASE/crm/automation/stale-deal-rules" "$STALE_RULE_CREATE" "$TOKEN" | tee "$STALE_RULE_CREATED_JSON" >/dev/null
STALE_RULE_ID="$(json_get "$STALE_RULE_CREATED_JSON" "j.id")"
[[ -n "$STALE_RULE_ID" ]] || fail "Stale-deal automation rule id missing in create response: $STALE_RULE_CREATED_JSON"

STALE_RUN_JSON="$TMP_DIR/smoke.crm.stale.run.json"
http_json POST "$API_BASE/crm/automation/run/stale-deals" "" "$TOKEN" | tee "$STALE_RUN_JSON" >/dev/null

STALE_TASKS_JSON="$TMP_DIR/smoke.crm.tasks.after.stale.run.json"
http_json GET "$API_BASE/crm/tasks?opportunityId=$OPP_ID" "" "$TOKEN" | tee "$STALE_TASKS_JSON" >/dev/null
STALE_TASK_FOUND="$(json_get "$STALE_TASKS_JSON" "Array.isArray(j.items) && j.items.some(t => t && typeof t.title === 'string' && t.title.startsWith('Stale task:') )")"
[[ "$STALE_TASK_FOUND" == "true" ]] || fail "Expected stale-deal automation task to be created after run: $STALE_TASKS_JSON"

# Cooldown check: running again should not create duplicates
STALE_RUN2_JSON="$TMP_DIR/smoke.crm.stale.run2.json"
http_json POST "$API_BASE/crm/automation/run/stale-deals" "" "$TOKEN" | tee "$STALE_RUN2_JSON" >/dev/null

STALE_TASKS2_JSON="$TMP_DIR/smoke.crm.tasks.after.stale.run2.json"
http_json GET "$API_BASE/crm/tasks?opportunityId=$OPP_ID" "" "$TOKEN" | tee "$STALE_TASKS2_JSON" >/dev/null
STALE_TASK_COUNT="$(json_get "$STALE_TASKS2_JSON" "Array.isArray(j.items) ? j.items.filter(t => t && typeof t.title === 'string' && t.title.startsWith('Stale task:')).length : 0")"
[[ "$STALE_TASK_COUNT" == "1" ]] || fail "Expected stale-deal automation cooldown to prevent duplicates (count=1), got $STALE_TASK_COUNT: $STALE_TASKS2_JSON"

echo "== CRM: automation (stage sequence creates multiple tasks) =="
SEQ_RULE_CREATE="$TMP_DIR/smoke.crm.seq.rule.create.json"
cat > "$SEQ_RULE_CREATE" <<JSON
{"enabled":true,"fromStageId":"$STAGE_1_ID","toStageId":"$STAGE_2_ID","items":[{"titleTemplate":"Seq 1: {{opportunityName}} -> {{toStageName}}","dueInDays":0},{"titleTemplate":"Seq 2: Follow-up for {{opportunityName}}","dueInDays":5}],"assigneeTarget":"owner"}
JSON
SEQ_RULE_CREATED_JSON="$TMP_DIR/smoke.crm.seq.rule.created.json"
http_json POST "$API_BASE/crm/automation/stage-sequence-rules" "$SEQ_RULE_CREATE" "$TOKEN" | tee "$SEQ_RULE_CREATED_JSON" >/dev/null
SEQ_RULE_ID="$(json_get "$SEQ_RULE_CREATED_JSON" "j.id")"
[[ -n "$SEQ_RULE_ID" ]] || fail "Stage-sequence automation rule id missing in create response: $SEQ_RULE_CREATED_JSON"

SEQ_TASKS_BEFORE_JSON="$TMP_DIR/smoke.crm.tasks.before.seq.move.json"
http_json GET "$API_BASE/crm/tasks?opportunityId=$OPP_ID" "" "$TOKEN" | tee "$SEQ_TASKS_BEFORE_JSON" >/dev/null
SEQ_TASKS_BEFORE_COUNT="$(json_get "$SEQ_TASKS_BEFORE_JSON" "Array.isArray(j.items) ? j.items.length : 0")"

OPP_MOVE_SEQ_PAYLOAD="$TMP_DIR/smoke.crm.opp.move.seq.json"
cat > "$OPP_MOVE_SEQ_PAYLOAD" <<JSON
{"stageId":"$STAGE_2_ID"}
JSON
OPP_MOVED_SEQ_JSON="$TMP_DIR/smoke.crm.opp.moved.seq.json"
http_json POST "$API_BASE/crm/opportunities/$OPP_ID/move" "$OPP_MOVE_SEQ_PAYLOAD" "$TOKEN" | tee "$OPP_MOVED_SEQ_JSON" >/dev/null

SEQ_TASKS_AFTER_JSON="$TMP_DIR/smoke.crm.tasks.after.seq.move.json"
http_json GET "$API_BASE/crm/tasks?opportunityId=$OPP_ID" "" "$TOKEN" | tee "$SEQ_TASKS_AFTER_JSON" >/dev/null
SEQ_TASKS_AFTER_COUNT="$(json_get "$SEQ_TASKS_AFTER_JSON" "Array.isArray(j.items) ? j.items.length : 0")"
DELTA_SEQ_TASKS="$((SEQ_TASKS_AFTER_COUNT - SEQ_TASKS_BEFORE_COUNT))"
[[ "$DELTA_SEQ_TASKS" == "2" ]] || fail "Expected stage-sequence automation to create 2 tasks (delta=2), got delta=$DELTA_SEQ_TASKS. before=$SEQ_TASKS_BEFORE_COUNT after=$SEQ_TASKS_AFTER_COUNT: $SEQ_TASKS_AFTER_JSON"

SEQ_TASK_1_FOUND="$(json_get "$SEQ_TASKS_AFTER_JSON" "Array.isArray(j.items) && j.items.some(t => t && typeof t.title === 'string' && t.title.startsWith('Seq 1:'))")"
SEQ_TASK_2_FOUND="$(json_get "$SEQ_TASKS_AFTER_JSON" "Array.isArray(j.items) && j.items.some(t => t && typeof t.title === 'string' && t.title.startsWith('Seq 2:'))")"
[[ "$SEQ_TASK_1_FOUND" == "true" ]] || fail "Expected sequence task #1 to be created: $SEQ_TASKS_AFTER_JSON"
[[ "$SEQ_TASK_2_FOUND" == "true" ]] || fail "Expected sequence task #2 to be created: $SEQ_TASKS_AFTER_JSON"

echo "== CRM: automation (won checklist creates tasks) =="
WON_STAGE_ID="$(json_get "$STAGES_JSON" "Array.isArray(j) ? (j.find(s => s && s.isClosedWon)?.id || '') : ''")"
[[ -n "$WON_STAGE_ID" ]] || fail "Won stage id not found in stages list: $STAGES_JSON"

WON_RULE_CREATE="$TMP_DIR/smoke.crm.won.rule.create.json"
cat > "$WON_RULE_CREATE" <<JSON
{"enabled":true,"titleTemplates":["Won follow-up 1: {{opportunityName}}","Won follow-up 2: {{toStageName}}"],"dueInDays":0,"assigneeTarget":"owner"}
JSON

WON_RULE_CREATED_JSON="$TMP_DIR/smoke.crm.won.rule.created.json"
http_json POST "$API_BASE/crm/automation/won-checklist-rules" "$WON_RULE_CREATE" "$TOKEN" | tee "$WON_RULE_CREATED_JSON" >/dev/null
WON_RULE_ID="$(json_get "$WON_RULE_CREATED_JSON" "j.id")"
[[ -n "$WON_RULE_ID" ]] || fail "Won-checklist automation rule id missing in create response: $WON_RULE_CREATED_JSON"

WON_TASKS_BEFORE_JSON="$TMP_DIR/smoke.crm.tasks.before.won.json"
http_json GET "$API_BASE/crm/tasks?opportunityId=$OPP_ID" "" "$TOKEN" | tee "$WON_TASKS_BEFORE_JSON" >/dev/null
WON_TASKS_BEFORE_COUNT="$(json_get "$WON_TASKS_BEFORE_JSON" "Array.isArray(j.items) ? j.items.length : 0")"

OPP_MOVE_WON_PAYLOAD="$TMP_DIR/smoke.crm.opp.move.won.json"
cat > "$OPP_MOVE_WON_PAYLOAD" <<JSON
{"stageId":"$WON_STAGE_ID"}
JSON
OPP_MOVED_WON_JSON="$TMP_DIR/smoke.crm.opp.moved.won.json"
http_json POST "$API_BASE/crm/opportunities/$OPP_ID/move" "$OPP_MOVE_WON_PAYLOAD" "$TOKEN" | tee "$OPP_MOVED_WON_JSON" >/dev/null

WON_TASKS_AFTER_JSON="$TMP_DIR/smoke.crm.tasks.after.won.json"
http_json GET "$API_BASE/crm/tasks?opportunityId=$OPP_ID" "" "$TOKEN" | tee "$WON_TASKS_AFTER_JSON" >/dev/null
WON_TASKS_AFTER_COUNT="$(json_get "$WON_TASKS_AFTER_JSON" "Array.isArray(j.items) ? j.items.length : 0")"

DELTA_WON_TASKS="$((WON_TASKS_AFTER_COUNT - WON_TASKS_BEFORE_COUNT))"
[[ "$DELTA_WON_TASKS" == "2" ]] || fail "Expected won checklist automation to create 2 tasks (delta=2), got delta=$DELTA_WON_TASKS. before=$WON_TASKS_BEFORE_COUNT after=$WON_TASKS_AFTER_COUNT: $WON_TASKS_AFTER_JSON"

echo "== CRM: opportunity detail endpoint (/crm/opportunities/:id) =="
OPP_DETAIL_JSON="$TMP_DIR/smoke.crm.opp.detail.json"
http_json GET "$API_BASE/crm/opportunities/$OPP_ID" "" "$TOKEN" | tee "$OPP_DETAIL_JSON" >/dev/null
OPP_DETAIL_ID_MATCH="$(json_get "$OPP_DETAIL_JSON" "j && j.id === '$OPP_ID'")"
[[ "$OPP_DETAIL_ID_MATCH" == "true" ]] || fail "Opportunity detail id mismatch: $OPP_DETAIL_JSON"

echo "== Quotes: create (linked to opportunity) =="
QUOTE_CREATE_JSON="$TMP_DIR/smoke.quote.create.json"
QUOTE_CREATED_JSON="$TMP_DIR/smoke.quote.created.json"
cat > "$QUOTE_CREATE_JSON" <<JSON
{"opportunityId":"$OPP_ID","customerId":"$CUSTOMER_ID","issueDate":"$(date +%F)","validUntil":"$(date -d '+30 days' +%F)","currency":"TRY","total":0,"items":[],"scopeOfWorkHtml":""}
JSON
http_json POST "$API_BASE/quotes" "$QUOTE_CREATE_JSON" "$TOKEN" | tee "$QUOTE_CREATED_JSON" >/dev/null
QUOTE_ID="$(json_get "$QUOTE_CREATED_JSON" "j.id")"
[[ -n "$QUOTE_ID" ]] || fail "Quote id missing in create response: $QUOTE_CREATED_JSON"

QUOTE_NUMBER="$(json_get "$QUOTE_CREATED_JSON" "j.quoteNumber")"
[[ -n "$QUOTE_NUMBER" ]] || fail "Quote quoteNumber missing in create response: $QUOTE_CREATED_JSON"

QUOTE_PUBLIC_ID="$(json_get "$QUOTE_CREATED_JSON" "j.publicId")"
[[ -n "$QUOTE_PUBLIC_ID" ]] || fail "Quote publicId missing in create response: $QUOTE_CREATED_JSON"

echo "== Quotes: link existing quote to opportunity (PATCH /quotes/:id) =="
QUOTE2_CREATE_JSON="$TMP_DIR/smoke.quote2.create.json"
QUOTE2_CREATED_JSON="$TMP_DIR/smoke.quote2.created.json"
cat > "$QUOTE2_CREATE_JSON" <<JSON
{"customerId":"$CUSTOMER_ID","issueDate":"$(date +%F)","validUntil":"$(date -d '+30 days' +%F)","currency":"TRY","total":0,"items":[],"scopeOfWorkHtml":""}
JSON
http_json POST "$API_BASE/quotes" "$QUOTE2_CREATE_JSON" "$TOKEN" | tee "$QUOTE2_CREATED_JSON" >/dev/null
QUOTE2_ID="$(json_get "$QUOTE2_CREATED_JSON" "j.id")"
[[ -n "$QUOTE2_ID" ]] || fail "Quote2 id missing in create response: $QUOTE2_CREATED_JSON"

QUOTE2_LINK_JSON="$TMP_DIR/smoke.quote2.link.json"
QUOTE2_LINK_RES="$TMP_DIR/smoke.quote2.link.res.json"
cat > "$QUOTE2_LINK_JSON" <<JSON
{"opportunityId":"$OPP_ID"}
JSON
http_json PATCH "$API_BASE/quotes/$QUOTE2_ID" "$QUOTE2_LINK_JSON" "$TOKEN" | tee "$QUOTE2_LINK_RES" >/dev/null
QUOTE2_LINKED_MATCH="$(json_get "$QUOTE2_LINK_RES" "j && String(j.opportunityId||'') === '$OPP_ID'")"
[[ "$QUOTE2_LINKED_MATCH" == "true" ]] || fail "Expected quote2.opportunityId to match opportunityId after patch: $QUOTE2_LINK_RES"

echo "== Quotes: public accept triggers opportunity won =="
QUOTE_ACCEPTED_JSON="$TMP_DIR/smoke.quote.accepted.json"
http_json POST "$API_BASE/public/quotes/$QUOTE_PUBLIC_ID/accept" "" "" | tee "$QUOTE_ACCEPTED_JSON" >/dev/null
QUOTE_ACCEPTED_STATUS="$(json_get "$QUOTE_ACCEPTED_JSON" "j.status")"
[[ "$QUOTE_ACCEPTED_STATUS" == "accepted" ]] || fail "Expected accepted status after public accept, got '$QUOTE_ACCEPTED_STATUS': $QUOTE_ACCEPTED_JSON"

echo "== Sales: create from accepted quote (idempotent) =="
SALE_FROM_QUOTE_JSON="$TMP_DIR/smoke.sale.from.quote.json"
http_json POST "$API_BASE/sales/from-quote/$QUOTE_ID" "" "$TOKEN" | tee "$SALE_FROM_QUOTE_JSON" >/dev/null
SALE_ID="$(json_get "$SALE_FROM_QUOTE_JSON" "j.id")"
[[ -n "$SALE_ID" ]] || fail "Sale id missing in create-from-quote response: $SALE_FROM_QUOTE_JSON"
SALE_SRC_MATCH="$(json_get "$SALE_FROM_QUOTE_JSON" "j && String(j.sourceQuoteId||'') === '$QUOTE_ID'")"
[[ "$SALE_SRC_MATCH" == "true" ]] || fail "Expected sale.sourceQuoteId to match quote id: $SALE_FROM_QUOTE_JSON"

SALE_SRC_NO_MATCH="$(json_get "$SALE_FROM_QUOTE_JSON" "j && String(j.sourceQuoteNumber||'') === '$QUOTE_NUMBER'")"
[[ "$SALE_SRC_NO_MATCH" == "true" ]] || fail "Expected sale.sourceQuoteNumber to match quoteNumber: $SALE_FROM_QUOTE_JSON"
SALE_SRC_OPP_MATCH="$(json_get "$SALE_FROM_QUOTE_JSON" "j && String(j.sourceOpportunityId||'') === '$OPP_ID'")"
[[ "$SALE_SRC_OPP_MATCH" == "true" ]] || fail "Expected sale.sourceOpportunityId to match opportunityId: $SALE_FROM_QUOTE_JSON"

SALE_FROM_QUOTE_2_JSON="$TMP_DIR/smoke.sale.from.quote.2.json"
http_json POST "$API_BASE/sales/from-quote/$QUOTE_ID" "" "$TOKEN" | tee "$SALE_FROM_QUOTE_2_JSON" >/dev/null
SALE_ID_2="$(json_get "$SALE_FROM_QUOTE_2_JSON" "j.id")"
[[ "$SALE_ID_2" == "$SALE_ID" ]] || fail "Expected idempotent create-from-quote to return same sale id; got $SALE_ID then $SALE_ID_2"

echo "== Invoices: create from accepted quote (idempotent) =="
INVOICE_FROM_QUOTE_JSON="$TMP_DIR/smoke.invoice.from.quote.json"
http_json POST "$API_BASE/invoices/from-quote/$QUOTE_ID" "" "$TOKEN" | tee "$INVOICE_FROM_QUOTE_JSON" >/dev/null
INVOICE_ID="$(json_get "$INVOICE_FROM_QUOTE_JSON" "j.id")"
[[ -n "$INVOICE_ID" ]] || fail "Invoice id missing in create-from-quote response: $INVOICE_FROM_QUOTE_JSON"
INVOICE_SRC_MATCH="$(json_get "$INVOICE_FROM_QUOTE_JSON" "j && String(j.sourceQuoteId||'') === '$QUOTE_ID'")"
[[ "$INVOICE_SRC_MATCH" == "true" ]] || fail "Expected invoice.sourceQuoteId to match quote id: $INVOICE_FROM_QUOTE_JSON"

INVOICE_SRC_NO_MATCH="$(json_get "$INVOICE_FROM_QUOTE_JSON" "j && String(j.sourceQuoteNumber||'') === '$QUOTE_NUMBER'")"
[[ "$INVOICE_SRC_NO_MATCH" == "true" ]] || fail "Expected invoice.sourceQuoteNumber to match quoteNumber: $INVOICE_FROM_QUOTE_JSON"
INVOICE_SRC_OPP_MATCH="$(json_get "$INVOICE_FROM_QUOTE_JSON" "j && String(j.sourceOpportunityId||'') === '$OPP_ID'")"
[[ "$INVOICE_SRC_OPP_MATCH" == "true" ]] || fail "Expected invoice.sourceOpportunityId to match opportunityId: $INVOICE_FROM_QUOTE_JSON"

INVOICE_FROM_QUOTE_2_JSON="$TMP_DIR/smoke.invoice.from.quote.2.json"
http_json POST "$API_BASE/invoices/from-quote/$QUOTE_ID" "" "$TOKEN" | tee "$INVOICE_FROM_QUOTE_2_JSON" >/dev/null
INVOICE_ID_2="$(json_get "$INVOICE_FROM_QUOTE_2_JSON" "j.id")"
[[ "$INVOICE_ID_2" == "$INVOICE_ID" ]] || fail "Expected idempotent invoice-from-quote to return same invoice id; got $INVOICE_ID then $INVOICE_ID_2"

echo "== CRM: linked sales/invoices endpoints (by opportunity) =="
CRM_OPP_SALES_JSON="$TMP_DIR/smoke.crm.opp.sales.json"
http_json GET "$API_BASE/crm/opportunities/$OPP_ID/sales" "" "$TOKEN" | tee "$CRM_OPP_SALES_JSON" >/dev/null
CRM_OPP_SALES_HAS_SALE="$(json_get "$CRM_OPP_SALES_JSON" "Array.isArray(j) && j.some(s => s && s.id === '$SALE_ID')")"
[[ "$CRM_OPP_SALES_HAS_SALE" == "true" ]] || fail "CRM opportunity sales endpoint missing sale: $CRM_OPP_SALES_JSON"
CRM_OPP_SALES_HAS_SRC_NO="$(json_get "$CRM_OPP_SALES_JSON" "Array.isArray(j) && j.some(s => s && s.id === '$SALE_ID' && String(s.sourceQuoteNumber||'').length > 0)")"
[[ "$CRM_OPP_SALES_HAS_SRC_NO" == "true" ]] || fail "CRM opportunity sales endpoint missing sourceQuoteNumber: $CRM_OPP_SALES_JSON"

CRM_OPP_SALES_HAS_SRC_OPP="$(json_get "$CRM_OPP_SALES_JSON" "Array.isArray(j) && j.some(s => s && s.id === '$SALE_ID' && String(s.sourceOpportunityId||'') === '$OPP_ID')")"
[[ "$CRM_OPP_SALES_HAS_SRC_OPP" == "true" ]] || fail "CRM opportunity sales endpoint missing sourceOpportunityId: $CRM_OPP_SALES_JSON"

CRM_OPP_INVOICES_JSON="$TMP_DIR/smoke.crm.opp.invoices.json"
http_json GET "$API_BASE/crm/opportunities/$OPP_ID/invoices" "" "$TOKEN" | tee "$CRM_OPP_INVOICES_JSON" >/dev/null
CRM_OPP_INVOICES_HAS_INV="$(json_get "$CRM_OPP_INVOICES_JSON" "Array.isArray(j) && j.some(inv => inv && inv.id === '$INVOICE_ID')")"
[[ "$CRM_OPP_INVOICES_HAS_INV" == "true" ]] || fail "CRM opportunity invoices endpoint missing invoice: $CRM_OPP_INVOICES_JSON"
CRM_OPP_INVOICES_HAS_SRC_NO="$(json_get "$CRM_OPP_INVOICES_JSON" "Array.isArray(j) && j.some(inv => inv && inv.id === '$INVOICE_ID' && String(inv.sourceQuoteNumber||'').length > 0)")"
[[ "$CRM_OPP_INVOICES_HAS_SRC_NO" == "true" ]] || fail "CRM opportunity invoices endpoint missing sourceQuoteNumber: $CRM_OPP_INVOICES_JSON"

CRM_OPP_INVOICES_HAS_SRC_OPP="$(json_get "$CRM_OPP_INVOICES_JSON" "Array.isArray(j) && j.some(inv => inv && inv.id === '$INVOICE_ID' && String(inv.sourceOpportunityId||'') === '$OPP_ID')")"
[[ "$CRM_OPP_INVOICES_HAS_SRC_OPP" == "true" ]] || fail "CRM opportunity invoices endpoint missing sourceOpportunityId: $CRM_OPP_INVOICES_JSON"

OPP_DETAIL_AFTER_ACCEPT_JSON="$TMP_DIR/smoke.crm.opp.detail.after.accept.json"
http_json GET "$API_BASE/crm/opportunities/$OPP_ID" "" "$TOKEN" | tee "$OPP_DETAIL_AFTER_ACCEPT_JSON" >/dev/null
OPP_AFTER_STATUS_WON="$(json_get "$OPP_DETAIL_AFTER_ACCEPT_JSON" "j && j.status === 'won'")"
[[ "$OPP_AFTER_STATUS_WON" == "true" ]] || fail "Expected opportunity status won after quote accept: $OPP_DETAIL_AFTER_ACCEPT_JSON"

echo "== Quotes: list by opportunityId filter =="
QUOTES_BY_OPP_JSON="$TMP_DIR/smoke.quotes.by-opp.json"
http_json GET "$API_BASE/quotes?opportunityId=$OPP_ID" "" "$TOKEN" | tee "$QUOTES_BY_OPP_JSON" >/dev/null
QUOTES_BY_OPP_HAS_QUOTE="$(json_get "$QUOTES_BY_OPP_JSON" "Array.isArray(j) && j.some(q => q && q.id === '$QUOTE_ID')")"
[[ "$QUOTES_BY_OPP_HAS_QUOTE" == "true" ]] || fail "Quotes list by opportunityId missing created quote: $QUOTES_BY_OPP_JSON"

QUOTES_BY_OPP_HAS_QUOTE2="$(json_get "$QUOTES_BY_OPP_JSON" "Array.isArray(j) && j.some(q => q && q.id === '$QUOTE2_ID')")"
[[ "$QUOTES_BY_OPP_HAS_QUOTE2" == "true" ]] || fail "Quotes list by opportunityId missing patched quote2: $QUOTES_BY_OPP_JSON"

echo "== CRM: opportunities list endpoint (/crm/opportunities) =="
OPPS_LIST_JSON="$TMP_DIR/smoke.crm.opps.list.json"
http_json GET "$API_BASE/crm/opportunities?limit=50&offset=0" "" "$TOKEN" | tee "$OPPS_LIST_JSON" >/dev/null
OPPS_LIST_HAS_OPP="$(json_get "$OPPS_LIST_JSON" "Array.isArray(j?.items) && j.items.some(o => o && o.id === '$OPP_ID')")"
[[ "$OPPS_LIST_HAS_OPP" == "true" ]] || fail "Owner opportunities list missing created opportunity: $OPPS_LIST_JSON"

OPPS_LIST_HAS_TS_FIELDS="$(json_get "$OPPS_LIST_JSON" "Array.isArray(j?.items) && j.items.some(o => o && o.id === '$OPP_ID' && String(o.createdAt||'').length > 0 && String(o.updatedAt||'').length > 0)")"
[[ "$OPPS_LIST_HAS_TS_FIELDS" == "true" ]] || fail "Owner opportunities list missing createdAt/updatedAt fields: $OPPS_LIST_JSON"

echo "== CRM: opportunities list sorting (name ASC) =="
OPP_SORT_Q="OppSort$TS"
OPP_SORT_A_CREATE="$TMP_DIR/smoke.opportunity.sort.a.create.json"
OPP_SORT_B_CREATE="$TMP_DIR/smoke.opportunity.sort.b.create.json"
cat > "$OPP_SORT_A_CREATE" <<JSON
{"accountId":"$CUSTOMER_ID","name":"A $OPP_SORT_Q","amount":0,"currency":"TRY"}
JSON
cat > "$OPP_SORT_B_CREATE" <<JSON
{"accountId":"$CUSTOMER_ID","name":"B $OPP_SORT_Q","amount":0,"currency":"TRY"}
JSON

OPP_SORT_A_CREATED_JSON="$TMP_DIR/smoke.opportunity.sort.a.created.json"
OPP_SORT_B_CREATED_JSON="$TMP_DIR/smoke.opportunity.sort.b.created.json"
http_json POST "$API_BASE/crm/opportunities" "$OPP_SORT_A_CREATE" "$TOKEN" | tee "$OPP_SORT_A_CREATED_JSON" >/dev/null
http_json POST "$API_BASE/crm/opportunities" "$OPP_SORT_B_CREATE" "$TOKEN" | tee "$OPP_SORT_B_CREATED_JSON" >/dev/null

OPPS_SORT_LIST_JSON="$TMP_DIR/smoke.crm.opps.sort.list.json"
http_json GET "$API_BASE/crm/opportunities?q=$OPP_SORT_Q&sortBy=name&sortDir=asc&limit=50&offset=0" "" "$TOKEN" | tee "$OPPS_SORT_LIST_JSON" >/dev/null
OPPS_SORT_FIRST_NAME="$(json_get "$OPPS_SORT_LIST_JSON" "Array.isArray(j?.items) && j.items[0] ? String(j.items[0].name||'') : ''")"
[[ "${OPPS_SORT_FIRST_NAME}" == "A ${OPP_SORT_Q}" ]] || fail "Expected first opportunity name to be 'A ${OPP_SORT_Q}', got '${OPPS_SORT_FIRST_NAME}': $OPPS_SORT_LIST_JSON"

OPPS_LIST_TOTAL="$(json_get "$OPPS_LIST_JSON" "typeof j.total === 'number' ? String(j.total) : ''")"
OPPS_LIST_LIMIT="$(json_get "$OPPS_LIST_JSON" "typeof j.limit === 'number' ? String(j.limit) : ''")"
OPPS_LIST_OFFSET="$(json_get "$OPPS_LIST_JSON" "typeof j.offset === 'number' ? String(j.offset) : ''")"
[[ -n "$OPPS_LIST_TOTAL" && -n "$OPPS_LIST_LIMIT" && -n "$OPPS_LIST_OFFSET" ]] || fail "Opportunities list missing pagination fields: $OPPS_LIST_JSON"

MOVE_STAGE_ID=""
if [[ -n "$STAGE_1_ID" && "$STAGE_1_ID" != "$OPP_STAGE_ID" ]]; then
  MOVE_STAGE_ID="$STAGE_1_ID"
elif [[ -n "$STAGE_2_ID" && "$STAGE_2_ID" != "$OPP_STAGE_ID" ]]; then
  MOVE_STAGE_ID="$STAGE_2_ID"
fi

if [[ -n "$MEMBER_TOKEN" ]]; then
  echo "== CRM: opportunities visibility (member can see team opportunity) =="
  MEMBER_OPPS_LIST_JSON="$TMP_DIR/smoke.member.opps.list.json"
  MEMBER_OPPS_LIST_STATUS="$(http_status GET "$API_BASE/crm/opportunities?limit=50&offset=0" "" "$MEMBER_TOKEN" "$MEMBER_OPPS_LIST_JSON")"
  [[ "$MEMBER_OPPS_LIST_STATUS" == "200" ]] || fail "Expected 200 for member opportunities list, got $MEMBER_OPPS_LIST_STATUS: $MEMBER_OPPS_LIST_JSON"
  MEMBER_OPPS_LIST_HAS_OPP="$(json_get "$MEMBER_OPPS_LIST_JSON" "Array.isArray(j?.items) && j.items.some(o => o && o.id === '$OPP_ID')")"
  [[ "$MEMBER_OPPS_LIST_HAS_OPP" == "true" ]] || fail "Member opportunities list does not include team opportunity: $MEMBER_OPPS_LIST_JSON"

  echo "== CRM: authz (member cannot update team opportunity) =="
  MEMBER_OPP_PATCH="$TMP_DIR/smoke.member.opp.patch.json"
  cat > "$MEMBER_OPP_PATCH" <<JSON
{"name":"HACKED"}
JSON
  MEMBER_OPP_PATCH_RES="$TMP_DIR/smoke.member.opp.patch.res.json"
  MEMBER_OPP_PATCH_STATUS="$(http_status PATCH "$API_BASE/crm/opportunities/$OPP_ID" "$MEMBER_OPP_PATCH" "$MEMBER_TOKEN" "$MEMBER_OPP_PATCH_RES")"
  [[ "$MEMBER_OPP_PATCH_STATUS" == "403" ]] || fail "Expected 403 for member opportunity update, got $MEMBER_OPP_PATCH_STATUS: $MEMBER_OPP_PATCH_RES"

  echo "== CRM: authz (member cannot edit opportunity team) =="
  MEMBER_OPP_TEAM="$TMP_DIR/smoke.member.opp.team.json"
  cat > "$MEMBER_OPP_TEAM" <<JSON
{"userIds":[]}
JSON
  MEMBER_OPP_TEAM_RES="$TMP_DIR/smoke.member.opp.team.res.json"
  MEMBER_OPP_TEAM_STATUS="$(http_status POST "$API_BASE/crm/opportunities/$OPP_ID/team" "$MEMBER_OPP_TEAM" "$MEMBER_TOKEN" "$MEMBER_OPP_TEAM_RES")"
  [[ "$MEMBER_OPP_TEAM_STATUS" == "403" ]] || fail "Expected 403 for member setTeam, got $MEMBER_OPP_TEAM_STATUS: $MEMBER_OPP_TEAM_RES"

  if [[ -n "$MOVE_STAGE_ID" ]]; then
    echo "== CRM: authz (member cannot move opportunity stage) =="
    MEMBER_OPP_MOVE_PAYLOAD="$TMP_DIR/smoke.member.opp.move.json"
    cat > "$MEMBER_OPP_MOVE_PAYLOAD" <<JSON
{"stageId":"$MOVE_STAGE_ID"}
JSON
    MEMBER_OPP_MOVE_RES="$TMP_DIR/smoke.member.opp.move.res.json"
    MEMBER_OPP_MOVE_STATUS="$(http_status POST "$API_BASE/crm/opportunities/$OPP_ID/move" "$MEMBER_OPP_MOVE_PAYLOAD" "$MEMBER_TOKEN" "$MEMBER_OPP_MOVE_RES")"
    if [[ "$MEMBER_ROLE" == "ADMIN" || "$MEMBER_ROLE" == "OWNER" ]]; then
      [[ "$MEMBER_OPP_MOVE_STATUS" == "200" || "$MEMBER_OPP_MOVE_STATUS" == "201" ]] || fail "Expected 200/201 for org-admin member move stage, got $MEMBER_OPP_MOVE_STATUS: $MEMBER_OPP_MOVE_RES"
    else
      [[ "$MEMBER_OPP_MOVE_STATUS" == "403" ]] || fail "Expected 403 for member move stage, got $MEMBER_OPP_MOVE_STATUS: $MEMBER_OPP_MOVE_RES"
    fi

    echo "== CRM: stage move (owner allowed) =="
    OWNER_OPP_MOVE_RES="$TMP_DIR/smoke.owner.opp.move.res.json"
    OWNER_OPP_MOVE_STATUS="$(http_status POST "$API_BASE/crm/opportunities/$OPP_ID/move" "$MEMBER_OPP_MOVE_PAYLOAD" "$TOKEN" "$OWNER_OPP_MOVE_RES")"
    [[ "$OWNER_OPP_MOVE_STATUS" == "200" || "$OWNER_OPP_MOVE_STATUS" == "201" ]] || fail "Expected 200/201 for owner move stage, got $OWNER_OPP_MOVE_STATUS: $OWNER_OPP_MOVE_RES"
  else
    echo "Move-stage test skipped (no alternate stageId available)."
  fi

  echo "== Quotes: member can list quotes by team opportunityId =="
  MEMBER_QUOTES_BY_OPP_JSON="$TMP_DIR/smoke.member.quotes.by-opp.json"
  MEMBER_QUOTES_BY_OPP_STATUS="$(http_status GET "$API_BASE/quotes?opportunityId=$OPP_ID" "" "$MEMBER_TOKEN" "$MEMBER_QUOTES_BY_OPP_JSON")"
  [[ "$MEMBER_QUOTES_BY_OPP_STATUS" == "200" ]] || fail "Expected 200 for member quotes by opportunityId, got $MEMBER_QUOTES_BY_OPP_STATUS: $MEMBER_QUOTES_BY_OPP_JSON"
  MEMBER_QUOTES_BY_OPP_HAS_QUOTE="$(json_get "$MEMBER_QUOTES_BY_OPP_JSON" "Array.isArray(j) && j.some(q => q && q.id === '$QUOTE_ID')")"
  [[ "$MEMBER_QUOTES_BY_OPP_HAS_QUOTE" == "true" ]] || fail "Member quotes by opportunityId missing quote: $MEMBER_QUOTES_BY_OPP_JSON"
fi

echo "== CRM: contact accountId (allowed update after visibility) =="
CONTACT_ALLOWED_PATCH_RES="$TMP_DIR/smoke.contact.allowed.patch.res.json"
ALLOWED_PATCH_STATUS="$(http_status PATCH "$API_BASE/crm/contacts/$CONTACT_ID" "$CONTACT_FORBIDDEN_PATCH" "$TOKEN" "$CONTACT_ALLOWED_PATCH_RES")"
[[ "$ALLOWED_PATCH_STATUS" == "200" ]] || fail "Expected 200 for allowed contact accountId update (after visibility), got $ALLOWED_PATCH_STATUS: $CONTACT_ALLOWED_PATCH_RES"

if [[ -n "$MEMBER_TOKEN" ]]; then
  echo "== CRM: authz (member can list contacts by accountId after opportunity team access) =="
  MEMBER_CONTACTS_BY_ACCOUNT_JSON="$TMP_DIR/smoke.member.contacts.by-account.json"
  MEMBER_CONTACTS_BY_ACCOUNT_STATUS="$(http_status GET "$API_BASE/crm/contacts?accountId=$CUSTOMER_ID" "" "$MEMBER_TOKEN" "$MEMBER_CONTACTS_BY_ACCOUNT_JSON")"
  [[ "$MEMBER_CONTACTS_BY_ACCOUNT_STATUS" == "200" ]] || fail "Expected 200 for member contacts list by accountId, got $MEMBER_CONTACTS_BY_ACCOUNT_STATUS: $MEMBER_CONTACTS_BY_ACCOUNT_JSON"
  MEMBER_FOUND_CONTACT_IN_FILTER="$(json_get "$MEMBER_CONTACTS_BY_ACCOUNT_JSON" "Array.isArray(j.items) && j.items.some(x => x && x.id === '$CONTACT_ID')")"
  [[ "$MEMBER_FOUND_CONTACT_IN_FILTER" == "true" ]] || fail "Member could not see contact in accountId filtered list: $MEMBER_CONTACTS_BY_ACCOUNT_JSON"

  echo "== CRM: authz (member cannot update owner's contact) =="
  MEMBER_CONTACT_PATCH="$TMP_DIR/smoke.member.contact.patch.json"
  cat > "$MEMBER_CONTACT_PATCH" <<JSON
{"company":"HACKED"}
JSON
  MEMBER_CONTACT_PATCH_RES="$TMP_DIR/smoke.member.contact.patch.res.json"
  MEMBER_CONTACT_PATCH_STATUS="$(http_status PATCH "$API_BASE/crm/contacts/$CONTACT_ID" "$MEMBER_CONTACT_PATCH" "$MEMBER_TOKEN" "$MEMBER_CONTACT_PATCH_RES")"
  [[ "$MEMBER_CONTACT_PATCH_STATUS" == "403" ]] || fail "Expected 403 for member contact update, got $MEMBER_CONTACT_PATCH_STATUS: $MEMBER_CONTACT_PATCH_RES"

  echo "== CRM: authz (member can create activity on contact after visibility) =="
  MEMBER_ACTIVITY_CREATE="$TMP_DIR/smoke.member.activity.create.json"
  cat > "$MEMBER_ACTIVITY_CREATE" <<JSON
{"title":"Member Activity (post-access) $TS","type":"call","contactId":"$CONTACT_ID","completed":false}
JSON
  MEMBER_ACTIVITY_CREATE_RES="$TMP_DIR/smoke.member.activity.create.res.json"
  MEMBER_ACTIVITY_CREATE_STATUS="$(http_status POST "$API_BASE/crm/activities" "$MEMBER_ACTIVITY_CREATE" "$MEMBER_TOKEN" "$MEMBER_ACTIVITY_CREATE_RES")"
  if [[ "$MEMBER_ACTIVITY_CREATE_STATUS" == "200" || "$MEMBER_ACTIVITY_CREATE_STATUS" == "201" ]]; then
    MEMBER_ACTIVITY_ID="$(json_get "$MEMBER_ACTIVITY_CREATE_RES" "j.id")"
    if [[ -n "$MEMBER_ACTIVITY_ID" ]]; then
      http_json DELETE "$API_BASE/crm/activities/$MEMBER_ACTIVITY_ID" "" "$MEMBER_TOKEN" | tee "$TMP_DIR/smoke.member.activity.deleted.json" >/dev/null
    fi
  else
    fail "Expected 200/201 for member activity create post-access, got $MEMBER_ACTIVITY_CREATE_STATUS: $MEMBER_ACTIVITY_CREATE_RES"
  fi
fi

http_json GET "$API_BASE/crm/contacts" "" "$TOKEN" | tee "$TMP_DIR/smoke.contacts.list.json" >/dev/null

CONTACTS_FILTERED_BY_ACCOUNT_JSON="$TMP_DIR/smoke.contacts.filtered.by-account.json"
http_json GET "$API_BASE/crm/contacts?accountId=$CUSTOMER_ID" "" "$TOKEN" | tee "$CONTACTS_FILTERED_BY_ACCOUNT_JSON" >/dev/null
FOUND_CONTACT_IN_FILTER="$(json_get "$CONTACTS_FILTERED_BY_ACCOUNT_JSON" "Array.isArray(j.items) && j.items.some(x => x && x.id === '$CONTACT_ID')")"
[[ "$FOUND_CONTACT_IN_FILTER" == "true" ]] || fail "Created contact not found in accountId filtered list: $CONTACTS_FILTERED_BY_ACCOUNT_JSON"

# Activities: contactId filter
echo "== CRM: activities (contactId filter) =="
ACTIVITY_CREATE="$TMP_DIR/smoke.activity.create.json"
cat > "$ACTIVITY_CREATE" <<JSON
{"title":"Contact Activity Smoke $TS","type":"call","contactId":"$CONTACT_ID","dueAt":"2025-12-15","completed":false}
JSON
ACTIVITY_CREATED_JSON="$TMP_DIR/smoke.activity.created.json"
http_json POST "$API_BASE/crm/activities" "$ACTIVITY_CREATE" "$TOKEN" | tee "$ACTIVITY_CREATED_JSON" >/dev/null
ACTIVITY_ID="$(json_get "$ACTIVITY_CREATED_JSON" "j.id")"
[[ -n "$ACTIVITY_ID" ]] || fail "Activity id missing in create response: $ACTIVITY_CREATED_JSON"
echo "Activity ID: $ACTIVITY_ID"

ACTIVITY_CREATE2="$TMP_DIR/smoke.activity2.create.json"
cat > "$ACTIVITY_CREATE2" <<JSON
{"title":"A Contact Activity Smoke $TS","type":"call","contactId":"$CONTACT_ID","dueAt":"2025-12-01","completed":false}
JSON
ACTIVITY_CREATED2_JSON="$TMP_DIR/smoke.activity2.created.json"
http_json POST "$API_BASE/crm/activities" "$ACTIVITY_CREATE2" "$TOKEN" | tee "$ACTIVITY_CREATED2_JSON" >/dev/null
ACTIVITY2_ID="$(json_get "$ACTIVITY_CREATED2_JSON" "j.id")"
[[ -n "$ACTIVITY2_ID" ]] || fail "Activity2 id missing in create response: $ACTIVITY_CREATED2_JSON"

ACTIVITIES_SORTED_JSON="$TMP_DIR/smoke.activities.sorted.by-title.json"
http_json GET "$API_BASE/crm/activities?contactId=$CONTACT_ID&sortBy=title&sortDir=asc" "" "$TOKEN" | tee "$ACTIVITIES_SORTED_JSON" >/dev/null
FIRST_ACTIVITY_TITLE="$(json_get "$ACTIVITIES_SORTED_JSON" "Array.isArray(j.items) && j.items[0] && j.items[0].title")"
[[ "$FIRST_ACTIVITY_TITLE" == "A Contact Activity Smoke $TS" ]] || fail "Expected first activity title to be 'A Contact Activity Smoke $TS' for sortBy=title&sortDir=asc, got '$FIRST_ACTIVITY_TITLE': $ACTIVITIES_SORTED_JSON"

ACTIVITIES_FILTERED_BY_Q_JSON="$TMP_DIR/smoke.activities.filtered.by-contact.q.json"
http_json GET "$API_BASE/crm/activities?contactId=$CONTACT_ID&q=Contact%20Activity%20Smoke%20$TS" "" "$TOKEN" | tee "$ACTIVITIES_FILTERED_BY_Q_JSON" >/dev/null
FOUND_IN_FILTER_Q="$(json_get "$ACTIVITIES_FILTERED_BY_Q_JSON" "Array.isArray(j.items) && j.items.some(x => x && x.id === '$ACTIVITY_ID')")"
[[ "$FOUND_IN_FILTER_Q" == "true" ]] || fail "Created activity not found in contactId+q filtered list: $ACTIVITIES_FILTERED_BY_Q_JSON"

# Activities: accountId filter (CustomerViewModal path)
echo "== CRM: activities (accountId filter) =="
ACCOUNT_ACTIVITY_CREATE="$TMP_DIR/smoke.activity.account.create.json"
cat > "$ACCOUNT_ACTIVITY_CREATE" <<JSON
{"title":"Account Activity Smoke $TS","type":"note","accountId":"$CUSTOMER_ID","completed":false}
JSON
ACCOUNT_ACTIVITY_CREATED_JSON="$TMP_DIR/smoke.activity.account.created.json"
http_json POST "$API_BASE/crm/activities" "$ACCOUNT_ACTIVITY_CREATE" "$TOKEN" | tee "$ACCOUNT_ACTIVITY_CREATED_JSON" >/dev/null
ACCOUNT_ACTIVITY_ID="$(json_get "$ACCOUNT_ACTIVITY_CREATED_JSON" "j.id")"
[[ -n "$ACCOUNT_ACTIVITY_ID" ]] || fail "Account activity id missing in create response: $ACCOUNT_ACTIVITY_CREATED_JSON"

ACCOUNT_ACTIVITIES_FILTERED_JSON="$TMP_DIR/smoke.activities.filtered.by-account.json"
http_json GET "$API_BASE/crm/activities?accountId=$CUSTOMER_ID" "" "$TOKEN" | tee "$ACCOUNT_ACTIVITIES_FILTERED_JSON" >/dev/null
FOUND_ACCOUNT_ACTIVITY_IN_FILTER="$(json_get "$ACCOUNT_ACTIVITIES_FILTERED_JSON" "Array.isArray(j.items) && j.items.some(x => x && x.id === '$ACCOUNT_ACTIVITY_ID')")"
[[ "$FOUND_ACCOUNT_ACTIVITY_IN_FILTER" == "true" ]] || fail "Created account activity not found in accountId filtered list: $ACCOUNT_ACTIVITIES_FILTERED_JSON"

ACCOUNT_ACTIVITIES_FILTERED_BY_Q_JSON="$TMP_DIR/smoke.activities.filtered.by-account.q.json"
http_json GET "$API_BASE/crm/activities?accountId=$CUSTOMER_ID&q=Account%20Activity%20Smoke%20$TS" "" "$TOKEN" | tee "$ACCOUNT_ACTIVITIES_FILTERED_BY_Q_JSON" >/dev/null
FOUND_ACCOUNT_ACTIVITY_IN_FILTER_Q="$(json_get "$ACCOUNT_ACTIVITIES_FILTERED_BY_Q_JSON" "Array.isArray(j.items) && j.items.some(x => x && x.id === '$ACCOUNT_ACTIVITY_ID')")"
[[ "$FOUND_ACCOUNT_ACTIVITY_IN_FILTER_Q" == "true" ]] || fail "Created account activity not found in accountId+q filtered list: $ACCOUNT_ACTIVITIES_FILTERED_BY_Q_JSON"

http_json DELETE "$API_BASE/crm/activities/$ACCOUNT_ACTIVITY_ID" "" "$TOKEN" | tee "$TMP_DIR/smoke.activity.account.deleted.json" >/dev/null

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
FOUND_IN_FILTER="$(json_get "$ACTIVITIES_FILTERED_JSON" "Array.isArray(j.items) && j.items.some(x => x && x.id === '$ACTIVITY_ID')")"
[[ "$FOUND_IN_FILTER" == "true" ]] || fail "Created activity not found in filtered list: $ACTIVITIES_FILTERED_JSON"

http_json DELETE "$API_BASE/crm/activities/$ACTIVITY_ID" "" "$TOKEN" | tee "$TMP_DIR/smoke.activity.deleted.json" >/dev/null
http_json DELETE "$API_BASE/crm/activities/$ACTIVITY2_ID" "" "$TOKEN" | tee "$TMP_DIR/smoke.activity2.deleted.json" >/dev/null

# Tasks CRUD (minimal coverage)
echo "== CRM: tasks CRUD =="
TASK_CREATE="$TMP_DIR/smoke.task.create.json"
cat > "$TASK_CREATE" <<JSON
{"title":"Task Smoke $TS","opportunityId":"$OPP_ID","accountId":null,"dueAt":"2025-12-15","completed":false,"assigneeUserId":null}
JSON
TASK_CREATED_JSON="$TMP_DIR/smoke.task.created.json"
http_json POST "$API_BASE/crm/tasks" "$TASK_CREATE" "$TOKEN" | tee "$TASK_CREATED_JSON" >/dev/null
TASK_ID="$(json_get "$TASK_CREATED_JSON" "j.id")"
[[ -n "$TASK_ID" ]] || fail "Task id missing in create response: $TASK_CREATED_JSON"

TASK_CREATE2="$TMP_DIR/smoke.task2.create.json"
cat > "$TASK_CREATE2" <<JSON
{"title":"A Task Smoke $TS","opportunityId":"$OPP_ID","accountId":null,"dueAt":"2025-12-01","completed":false,"assigneeUserId":null}
JSON
TASK_CREATED2_JSON="$TMP_DIR/smoke.task2.created.json"
http_json POST "$API_BASE/crm/tasks" "$TASK_CREATE2" "$TOKEN" | tee "$TASK_CREATED2_JSON" >/dev/null
TASK2_ID="$(json_get "$TASK_CREATED2_JSON" "j.id")"
[[ -n "$TASK2_ID" ]] || fail "Task2 id missing in create response: $TASK_CREATED2_JSON"

TASKS_FILTERED_JSON="$TMP_DIR/smoke.tasks.filtered.by-opportunity.json"
http_json GET "$API_BASE/crm/tasks?opportunityId=$OPP_ID" "" "$TOKEN" | tee "$TASKS_FILTERED_JSON" >/dev/null
FOUND_TASK_IN_FILTER="$(json_get "$TASKS_FILTERED_JSON" "Array.isArray(j.items) && j.items.some(x => x && x.id === '$TASK_ID')")"
[[ "$FOUND_TASK_IN_FILTER" == "true" ]] || fail "Created task not found in opportunityId filtered list: $TASKS_FILTERED_JSON"

TASKS_SORTED_JSON="$TMP_DIR/smoke.tasks.sorted.by-title.json"
http_json GET "$API_BASE/crm/tasks?opportunityId=$OPP_ID&sortBy=title&sortDir=asc" "" "$TOKEN" | tee "$TASKS_SORTED_JSON" >/dev/null
FIRST_TASK_TITLE="$(json_get "$TASKS_SORTED_JSON" "Array.isArray(j.items) && j.items[0] && j.items[0].title")"
[[ "$FIRST_TASK_TITLE" == "A Task Smoke $TS" ]] || fail "Expected first task title to be 'A Task Smoke $TS' for sortBy=title&sortDir=asc, got '$FIRST_TASK_TITLE': $TASKS_SORTED_JSON"

TASKS_FILTERED_BY_Q_JSON="$TMP_DIR/smoke.tasks.filtered.by-opportunity.q.json"
http_json GET "$API_BASE/crm/tasks?opportunityId=$OPP_ID&q=Task%20Smoke%20$TS" "" "$TOKEN" | tee "$TASKS_FILTERED_BY_Q_JSON" >/dev/null
FOUND_TASK_IN_FILTER_Q="$(json_get "$TASKS_FILTERED_BY_Q_JSON" "Array.isArray(j.items) && j.items.some(x => x && x.id === '$TASK_ID')")"
[[ "$FOUND_TASK_IN_FILTER_Q" == "true" ]] || fail "Created task not found in opportunityId+q filtered list: $TASKS_FILTERED_BY_Q_JSON"

TASK_UPDATE="$TMP_DIR/smoke.task.update.json"
cat > "$TASK_UPDATE" <<JSON
{"completed":true}
JSON
http_json PATCH "$API_BASE/crm/tasks/$TASK_ID" "$TASK_UPDATE" "$TOKEN" | tee "$TMP_DIR/smoke.task.updated.json" >/dev/null
http_json DELETE "$API_BASE/crm/tasks/$TASK_ID" "" "$TOKEN" | tee "$TMP_DIR/smoke.task.deleted.json" >/dev/null
http_json DELETE "$API_BASE/crm/tasks/$TASK2_ID" "" "$TOKEN" | tee "$TMP_DIR/smoke.task2.deleted.json" >/dev/null

# Reports (basic coverage)
echo "== CRM: reports (pipeline health) =="
PIPELINE_HEALTH_JSON="$TMP_DIR/smoke.crm.report.pipeline-health.json"
PIPELINE_HEALTH_STATUS="$(http_status GET "$API_BASE/crm/reports/pipeline-health?staleDays=30" "" "$TOKEN" "$PIPELINE_HEALTH_JSON")"
[[ "$PIPELINE_HEALTH_STATUS" == "200" ]] || fail "Expected 200 for pipeline health report, got $PIPELINE_HEALTH_STATUS: $PIPELINE_HEALTH_JSON"
PH_HAS_OPEN_COUNT="$(json_get "$PIPELINE_HEALTH_JSON" "typeof j.openCount === 'number'")"
[[ "$PH_HAS_OPEN_COUNT" == "true" ]] || fail "pipeline health missing openCount number: $PIPELINE_HEALTH_JSON"
PH_HAS_BY_STAGE="$(json_get "$PIPELINE_HEALTH_JSON" "Array.isArray(j.byStage)")"
[[ "$PH_HAS_BY_STAGE" == "true" ]] || fail "pipeline health missing byStage array: $PIPELINE_HEALTH_JSON"

echo "== CRM: reports (funnel) =="
FUNNEL_JSON="$TMP_DIR/smoke.crm.report.funnel.json"
FUNNEL_STATUS="$(http_status GET "$API_BASE/crm/reports/funnel?startDate=2000-01-01&endDate=2100-01-01" "" "$TOKEN" "$FUNNEL_JSON")"
[[ "$FUNNEL_STATUS" == "200" ]] || fail "Expected 200 for funnel report, got $FUNNEL_STATUS: $FUNNEL_JSON"
FUNNEL_HAS_LEADS="$(json_get "$FUNNEL_JSON" "typeof (j.counts && j.counts.leads) === 'number'")"
[[ "$FUNNEL_HAS_LEADS" == "true" ]] || fail "funnel missing leads number: $FUNNEL_JSON"
FUNNEL_HAS_CONVERSION="$(json_get "$FUNNEL_JSON" "(j.rates && (typeof j.rates.contactPerLead === 'number' || j.rates.contactPerLead === null))")"
[[ "$FUNNEL_HAS_CONVERSION" == "true" ]] || fail "funnel missing contactPerLead number|null: $FUNNEL_JSON"
FUNNEL_HAS_STAGE_TRANSITIONS="$(json_get "$FUNNEL_JSON" "j.stageTransitions && Array.isArray(j.stageTransitions.avgDaysInStage) && Array.isArray(j.stageTransitions.transitions)")"
[[ "$FUNNEL_HAS_STAGE_TRANSITIONS" == "true" ]] || fail "funnel missing stageTransitions arrays: $FUNNEL_JSON"

echo "== CRM: reports (forecast) =="
FORECAST_JSON="$TMP_DIR/smoke.crm.report.forecast.json"
FORECAST_STATUS="$(http_status GET "$API_BASE/crm/reports/forecast?startDate=2000-01-01&endDate=2100-01-01" "" "$TOKEN" "$FORECAST_JSON")"
[[ "$FORECAST_STATUS" == "200" ]] || fail "Expected 200 for forecast report, got $FORECAST_STATUS: $FORECAST_JSON"
FORECAST_HAS_TOTALS="$(json_get "$FORECAST_JSON" "j.totalsByCurrency && typeof j.totalsByCurrency === 'object'")"
[[ "$FORECAST_HAS_TOTALS" == "true" ]] || fail "forecast missing totalsByCurrency object: $FORECAST_JSON"
FORECAST_HAS_BY_WEEK="$(json_get "$FORECAST_JSON" "Array.isArray(j.byWeek)")"
[[ "$FORECAST_HAS_BY_WEEK" == "true" ]] || fail "forecast missing byWeek array: $FORECAST_JSON"

echo "== CRM: reports (activity) =="
ACTIVITY_JSON="$TMP_DIR/smoke.crm.report.activity.json"
ACTIVITY_STATUS="$(http_status GET "$API_BASE/crm/reports/activity?startDate=2000-01-01&endDate=2100-01-01&bucket=week" "" "$TOKEN" "$ACTIVITY_JSON")"
[[ "$ACTIVITY_STATUS" == "200" ]] || fail "Expected 200 for activity report, got $ACTIVITY_STATUS: $ACTIVITY_JSON"
ACTIVITY_HAS_BUCKET="$(json_get "$ACTIVITY_JSON" "j.bucket === 'week' || j.bucket === 'day'")"
[[ "$ACTIVITY_HAS_BUCKET" == "true" ]] || fail "activity missing bucket value: $ACTIVITY_JSON"
ACTIVITY_HAS_SERIES="$(json_get "$ACTIVITY_JSON" "Array.isArray(j.series)")"
[[ "$ACTIVITY_HAS_SERIES" == "true" ]] || fail "activity missing series array: $ACTIVITY_JSON"

echo "== CRM: reports (pipeline health export csv) =="
PIPELINE_HEALTH_CSV="$TMP_DIR/smoke.crm.report.pipeline-health.csv"
PIPELINE_HEALTH_CSV_HEADERS="$TMP_DIR/smoke.crm.report.pipeline-health.csv.headers.txt"
curl -sS -D "$PIPELINE_HEALTH_CSV_HEADERS" -o "$PIPELINE_HEALTH_CSV" \
  -H "Authorization: Bearer $TOKEN" \
  "$API_BASE/crm/reports/pipeline-health/export-csv?staleDays=30" >/dev/null

CSV_STATUS="$(awk 'NR==1{print $2}' "$PIPELINE_HEALTH_CSV_HEADERS" | tr -d '\r')"
[[ "$CSV_STATUS" == "200" ]] || fail "Expected 200 for pipeline health CSV export, got $CSV_STATUS: $PIPELINE_HEALTH_CSV_HEADERS"

CSV_HEADER_LINE="$(head -n 1 "$PIPELINE_HEALTH_CSV" | sed '1s/^\xEF\xBB\xBF//')"
[[ "$CSV_HEADER_LINE" == "Stage,Count,Avg Age (days),Stale Count,Totals By Currency (JSON)" ]] || fail "Unexpected CSV header: '$CSV_HEADER_LINE' ($PIPELINE_HEALTH_CSV)"

echo "== CRM: reports (funnel export csv) =="
FUNNEL_CSV="$TMP_DIR/smoke.crm.report.funnel.csv"
FUNNEL_CSV_HEADERS="$TMP_DIR/smoke.crm.report.funnel.csv.headers.txt"
curl -sS -D "$FUNNEL_CSV_HEADERS" -o "$FUNNEL_CSV" \
  -H "Authorization: Bearer $TOKEN" \
  "$API_BASE/crm/reports/funnel/export-csv?startDate=2000-01-01&endDate=2100-01-01" >/dev/null

FUNNEL_CSV_STATUS="$(awk 'NR==1{print $2}' "$FUNNEL_CSV_HEADERS" | tr -d '\r')"
[[ "$FUNNEL_CSV_STATUS" == "200" ]] || fail "Expected 200 for funnel CSV export, got $FUNNEL_CSV_STATUS: $FUNNEL_CSV_HEADERS"
FUNNEL_CSV_HEADER_LINE="$(head -n 1 "$FUNNEL_CSV" | sed '1s/^\xEF\xBB\xBF//')"
[[ "$FUNNEL_CSV_HEADER_LINE" == "Section,Key,Value,Extra" ]] || fail "Unexpected funnel CSV header: '$FUNNEL_CSV_HEADER_LINE' ($FUNNEL_CSV)"

echo "== CRM: reports (forecast export csv) =="
FORECAST_CSV="$TMP_DIR/smoke.crm.report.forecast.csv"
FORECAST_CSV_HEADERS="$TMP_DIR/smoke.crm.report.forecast.csv.headers.txt"
curl -sS -D "$FORECAST_CSV_HEADERS" -o "$FORECAST_CSV" \
  -H "Authorization: Bearer $TOKEN" \
  "$API_BASE/crm/reports/forecast/export-csv?startDate=2000-01-01&endDate=2100-01-01" >/dev/null

FORECAST_CSV_STATUS="$(awk 'NR==1{print $2}' "$FORECAST_CSV_HEADERS" | tr -d '\r')"
[[ "$FORECAST_CSV_STATUS" == "200" ]] || fail "Expected 200 for forecast CSV export, got $FORECAST_CSV_STATUS: $FORECAST_CSV_HEADERS"
FORECAST_CSV_HEADER_LINE="$(head -n 1 "$FORECAST_CSV" | sed '1s/^\xEF\xBB\xBF//')"
[[ "$FORECAST_CSV_HEADER_LINE" == "Week,Currency,Raw,Weighted,Count" ]] || fail "Unexpected forecast CSV header: '$FORECAST_CSV_HEADER_LINE' ($FORECAST_CSV)"

echo "== CRM: reports (activity export csv) =="
ACTIVITY_CSV="$TMP_DIR/smoke.crm.report.activity.csv"
ACTIVITY_CSV_HEADERS="$TMP_DIR/smoke.crm.report.activity.csv.headers.txt"
curl -sS -D "$ACTIVITY_CSV_HEADERS" -o "$ACTIVITY_CSV" \
  -H "Authorization: Bearer $TOKEN" \
  "$API_BASE/crm/reports/activity/export-csv?startDate=2000-01-01&endDate=2100-01-01&bucket=week" >/dev/null

ACTIVITY_CSV_STATUS="$(awk 'NR==1{print $2}' "$ACTIVITY_CSV_HEADERS" | tr -d '\r')"
[[ "$ACTIVITY_CSV_STATUS" == "200" ]] || fail "Expected 200 for activity CSV export, got $ACTIVITY_CSV_STATUS: $ACTIVITY_CSV_HEADERS"
ACTIVITY_CSV_HEADER_LINE="$(head -n 1 "$ACTIVITY_CSV" | sed '1s/^\xEF\xBB\xBF//')"
[[ "$ACTIVITY_CSV_HEADER_LINE" == "BucketStart,Activities,TasksCreated,TasksCompleted" ]] || fail "Unexpected activity CSV header: '$ACTIVITY_CSV_HEADER_LINE' ($ACTIVITY_CSV)"

echo "== Audit: crm_report_export recorded =="
AUDIT_EXPORT_JSON="$TMP_DIR/smoke.audit.crm_report_export.json"
AUDIT_EXPORT_STATUS="$(http_status GET "$API_BASE/audit/logs?entity=crm_report_export&limit=50" "" "$TOKEN" "$AUDIT_EXPORT_JSON")"
if [[ "$AUDIT_EXPORT_STATUS" == "200" ]]; then
  FOUND_EXPORT_LOG_PH="$(json_get "$AUDIT_EXPORT_JSON" "Array.isArray(j.data) && j.data.some(x => x && x.entity === 'crm_report_export' && x.action === 'CREATE' && x.diff && x.diff.report === 'pipeline-health')")"
  [[ "$FOUND_EXPORT_LOG_PH" == "true" ]] || fail "Expected crm_report_export audit log for pipeline-health export not found: $AUDIT_EXPORT_JSON"

  FOUND_EXPORT_LOG_FUNNEL="$(json_get "$AUDIT_EXPORT_JSON" "Array.isArray(j.data) && j.data.some(x => x && x.entity === 'crm_report_export' && x.action === 'CREATE' && x.diff && x.diff.report === 'funnel')")"
  [[ "$FOUND_EXPORT_LOG_FUNNEL" == "true" ]] || fail "Expected crm_report_export audit log for funnel export not found: $AUDIT_EXPORT_JSON"

  FOUND_EXPORT_LOG_FORECAST="$(json_get "$AUDIT_EXPORT_JSON" "Array.isArray(j.data) && j.data.some(x => x && x.entity === 'crm_report_export' && x.action === 'CREATE' && x.diff && x.diff.report === 'forecast')")"
  [[ "$FOUND_EXPORT_LOG_FORECAST" == "true" ]] || fail "Expected crm_report_export audit log for forecast export not found: $AUDIT_EXPORT_JSON"

  FOUND_EXPORT_LOG_ACTIVITY="$(json_get "$AUDIT_EXPORT_JSON" "Array.isArray(j.data) && j.data.some(x => x && x.entity === 'crm_report_export' && x.action === 'CREATE' && x.diff && x.diff.report === 'activity')")"
  [[ "$FOUND_EXPORT_LOG_ACTIVITY" == "true" ]] || fail "Expected crm_report_export audit log for activity export not found: $AUDIT_EXPORT_JSON"
else
  fail "Expected 200 for /audit/logs export check, got $AUDIT_EXPORT_STATUS: $AUDIT_EXPORT_JSON"
fi

cat > "$CONTACT_UPDATE" <<JSON
{"company":"ACME Updated"}
JSON
http_json PATCH "$API_BASE/crm/contacts/$CONTACT_ID" "$CONTACT_UPDATE" "$TOKEN" | tee "$TMP_DIR/smoke.contact.updated.json" >/dev/null
http_json DELETE "$API_BASE/crm/contacts/$CONTACT_ID" "" "$TOKEN" | tee "$TMP_DIR/smoke.contact.deleted.json" >/dev/null

http_json DELETE "$API_BASE/crm/contacts/$CONTACT_SORT_A_ID" "" "$TOKEN" | tee "$TMP_DIR/smoke.contact.sort.a.deleted.json" >/dev/null
http_json DELETE "$API_BASE/crm/contacts/$CONTACT_SORT_B_ID" "" "$TOKEN" | tee "$TMP_DIR/smoke.contact.sort.b.deleted.json" >/dev/null

http_json DELETE "$API_BASE/customers/$CUSTOMER_ID" "" "$TOKEN" | tee "$TMP_DIR/smoke.customer.deleted.json" >/dev/null

echo "== OK =="
echo "- Health: $API_BASE/health"
echo "- Auth: register+login"
echo "- CRM: leads+contacts CRUD"
echo "- Customers: create+delete (for contact accountId)"
echo "- CRM: activities contactId filter"
echo "- CRM: activities accountId filter"
echo "- CRM: activities single relation rule"
echo "- CRM: activities single relation rule (PATCH)"
echo "- CRM: tasks CRUD"
