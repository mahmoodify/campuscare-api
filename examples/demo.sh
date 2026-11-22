#!/usr/bin/env bash
# CampusCare API demo walkthrough: covers everything the demo video must show.
#   1. Start the server in another terminal:   npm start
#   2. Run this script:                        bash examples/demo.sh
# Restart the server before re-running (the mock data resets on restart).
#
# BASE_URL can be overridden, e.g.  BASE_URL=http://localhost:4000 bash examples/demo.sh

BASE_URL="${BASE_URL:-http://localhost:3000}"
API="$BASE_URL/api/v1"
PRETTY=cat
command -v jq >/dev/null 2>&1 && PRETTY="jq ."

bold() { printf '\n\033[1m== %s ==\033[0m\n' "$1"; }

# call "<title>" METHOD PATH [TOKEN] [JSON BODY]
call() {
  local title="$1" method="$2" path="$3" token="$4" body="$5"
  local args=(-s -X "$method" -o /tmp/campuscare_demo_body -w '%{http_code}' "$API$path")
  [ -n "$token" ] && args+=(-H "Authorization: Bearer $token")
  [ -n "$body" ] && args+=(-H "Content-Type: application/json" -d "$body")
  printf '\n\033[36m# %s\033[0m\n' "$title"
  printf '$ %s %s%s\n' "$method" "/api/v1$path" "${token:+  (Authorization: Bearer $token)}"
  [ -n "$body" ] && printf '  body: %s\n' "$body"
  local code
  code=$(curl "${args[@]}")
  printf 'HTTP %s\n' "$code"
  $PRETTY < /tmp/campuscare_demo_body
  echo
}

bold "1. HTML greeting page (open $API/greeting in a browser)"
curl -s -o /dev/null -D - "$API/greeting" | grep -iE '^(HTTP|content-type)'

bold "2. Authentication: 401"
call "No token" GET /reports
call "Invalid token" GET /reports wrong-token

bold "3. Reading resources (GET) and ownership"
call "User A lists own reports" GET /reports user-a-token
call "User A reads own report" GET /reports/rep_101 user-a-token
call "User A reads User B's report -> 404" GET /reports/rep_103 user-a-token
call "User B reads User A's report -> 404" GET /reports/rep_101 user-b-token
call "Admin reads any report" GET /reports/rep_103 admin-token
call "Admin lists all reports (filter + sort + paging)" GET "/reports?status=PENDING&sort=-priority&perPage=3" admin-token
call "Non-existent ID -> 404" GET /reports/rep_999 admin-token

bold "4. Creating (POST), validation errors and conflicts"
call "Create report -> 201" POST /reports user-a-token '{"inventoryItemId":"inv_002","issueType":"BROKEN","comment":"Exit sign is dark"}'
call "Duplicate -> 409" POST /reports user-a-token '{"inventoryItemId":"inv_002","issueType":"BROKEN","comment":"Exit sign is dark"}'
call "Validation errors -> 400" POST /reports user-a-token '{"issueType":"EXPLODED","comment":"x","ownerId":"user-b"}'
call "Malformed JSON -> 400" POST /reports user-a-token '{"inventoryItemId":'
call "Staff cannot create -> 403" POST /reports staff-token '{"inventoryItemId":"inv_001","issueType":"BROKEN"}'

bold "5. Updating (PUT)"
call "User A updates own pending report" PUT /reports/rep_101 user-a-token '{"inventoryItemId":"inv_001","issueType":"MISSING","comment":"The bulb was removed"}'
call "User A updates User B's report -> 404" PUT /reports/rep_103 user-a-token '{"inventoryItemId":"inv_003","issueType":"BROKEN"}'
call "User A edits in-progress report -> 409" PUT /reports/rep_102 user-a-token '{"inventoryItemId":"inv_004","issueType":"BROKEN"}'
call "Admin updates any report" PUT /reports/rep_102 admin-token '{"inventoryItemId":"inv_004","issueType":"BROKEN"}'

bold "6. Status workflow (staff) and role checks"
call "Student changes status -> 403" PUT /reports/rep_101/status user-a-token '{"status":"IN_PROGRESS"}'
call "Staff skips a step -> 409" PUT /reports/rep_101/status staff-token '{"status":"RESOLVED"}'
call "Staff starts inspection" PUT /reports/rep_101/status staff-token '{"status":"IN_PROGRESS"}'
call "Staff resolves" PUT /reports/rep_101/status staff-token '{"status":"RESOLVED"}'
call "Staff reopens resolved report -> 409" PUT /reports/rep_101/status staff-token '{"status":"PENDING"}'

bold "7. Deleting (DELETE)"
call "User B deletes User A's report -> 404" DELETE /reports/rep_102 user-b-token
call "User B withdraws own pending report" DELETE /reports/rep_105 user-b-token
call "Deleting it again -> 404" DELETE /reports/rep_105 user-b-token
call "Admin deletes any report" DELETE /reports/rep_103 admin-token

bold "8. Admin metrics and other errors"
call "Metrics as admin" GET /metrics/maintenance admin-token
call "Metrics as student -> 403" GET /metrics/maintenance user-a-token
call "Unsupported method -> 405" DELETE /reports admin-token
call "Unknown route -> 404" GET /unicorns admin-token

rm -f /tmp/campuscare_demo_body
