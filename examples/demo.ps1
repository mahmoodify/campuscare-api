# CampusCare API demo walkthrough for PowerShell (same steps as demo.sh).
#   1. Start the server in another PowerShell window:   npm start
#   2. From the project folder, run this script:
#        powershell -ExecutionPolicy Bypass -File examples\demo.ps1
#      Wait for Enter after every request (handy when recording a video):
#        powershell -ExecutionPolicy Bypass -File examples\demo.ps1 -Pause
#      Use another server address:
#        powershell -ExecutionPolicy Bypass -File examples\demo.ps1 -BaseUrl http://localhost:4000
# Restart the server before re-running (the mock data resets on restart).

param(
  [switch]$Pause,
  [string]$BaseUrl = "http://localhost:3000"
)

$global:ApiBase = $BaseUrl
. (Join-Path $PSScriptRoot "api.ps1")

function heading($text) {
  Write-Host ""
  Write-Host "== $text ==" -ForegroundColor Yellow
}

# step "<title>" METHOD PATH [TOKEN] [JSON BODY]
function step($title, $method, $path, $token, $body) {
  Write-Host ""
  Write-Host "# $title" -ForegroundColor Cyan
  $line = "$method /api/v1$path"
  if ($token) { $line = "$line  (Authorization: Bearer $token)" }
  Write-Host "> $line"
  if ($body) { Write-Host "  body: $body" }
  api $method $path $token $body
  if ($Pause) { Read-Host "Press Enter for the next request" | Out-Null }
}

try {
  Invoke-WebRequest "$($global:ApiBase)/api/v1/health" -UseBasicParsing | Out-Null
}
catch {
  Write-Host "Cannot reach the server at $($global:ApiBase). Start it first with: npm start" -ForegroundColor Red
  exit 1
}

heading "1. HTML greeting page (open $($global:ApiBase)/api/v1/greeting in a browser)"
$g = Invoke-WebRequest "$($global:ApiBase)/api/v1/greeting" -UseBasicParsing
Write-Host "HTTP $($g.StatusCode)  Content-Type: $($g.Headers['Content-Type'])"

heading "2. Authentication: 401"
step "No token" GET "/reports"
step "Invalid token" GET "/reports" "wrong-token"

heading "3. Reading resources (GET) and ownership"
step "User A lists own reports" GET "/reports" "user-a-token"
step "User A reads own report" GET "/reports/rep_101" "user-a-token"
step "User A reads User B's report -> 404" GET "/reports/rep_103" "user-a-token"
step "User B reads User A's report -> 404" GET "/reports/rep_101" "user-b-token"
step "Admin reads any report" GET "/reports/rep_103" "admin-token"
step "Admin lists all reports (filter + sort + paging)" GET "/reports?status=PENDING&sort=-priority&perPage=3" "admin-token"
step "Non-existent ID -> 404" GET "/reports/rep_999" "admin-token"

heading "4. Creating (POST), validation errors and conflicts"
step "Create report -> 201" POST "/reports" "user-a-token" '{"inventoryItemId":"inv_002","issueType":"BROKEN","comment":"Exit sign is dark"}'
step "Duplicate -> 409" POST "/reports" "user-a-token" '{"inventoryItemId":"inv_002","issueType":"BROKEN","comment":"Exit sign is dark"}'
step "Validation errors -> 400" POST "/reports" "user-a-token" '{"issueType":"EXPLODED","comment":"x","ownerId":"user-b"}'
step "Malformed JSON -> 400" POST "/reports" "user-a-token" '{"inventoryItemId":'
step "Staff cannot create -> 403" POST "/reports" "staff-token" '{"inventoryItemId":"inv_001","issueType":"BROKEN"}'

heading "5. Updating (PUT)"
step "User A updates own pending report" PUT "/reports/rep_101" "user-a-token" '{"inventoryItemId":"inv_001","issueType":"MISSING","comment":"The bulb was removed"}'
step "User A updates User B's report -> 404" PUT "/reports/rep_103" "user-a-token" '{"inventoryItemId":"inv_003","issueType":"BROKEN"}'
step "User A edits in-progress report -> 409" PUT "/reports/rep_102" "user-a-token" '{"inventoryItemId":"inv_004","issueType":"BROKEN"}'
step "Admin updates any report" PUT "/reports/rep_102" "admin-token" '{"inventoryItemId":"inv_004","issueType":"BROKEN"}'

heading "6. Status workflow (staff) and role checks"
step "Student changes status -> 403" PUT "/reports/rep_101/status" "user-a-token" '{"status":"IN_PROGRESS"}'
step "Staff skips a step -> 409" PUT "/reports/rep_101/status" "staff-token" '{"status":"RESOLVED"}'
step "Staff starts inspection" PUT "/reports/rep_101/status" "staff-token" '{"status":"IN_PROGRESS"}'
step "Staff resolves" PUT "/reports/rep_101/status" "staff-token" '{"status":"RESOLVED"}'
step "Staff reopens resolved report -> 409" PUT "/reports/rep_101/status" "staff-token" '{"status":"PENDING"}'

heading "7. Deleting (DELETE)"
step "User B deletes User A's report -> 404" DELETE "/reports/rep_102" "user-b-token"
step "User B withdraws own pending report" DELETE "/reports/rep_105" "user-b-token"
step "Deleting it again -> 404" DELETE "/reports/rep_105" "user-b-token"
step "Admin deletes any report" DELETE "/reports/rep_103" "admin-token"

heading "8. Admin metrics and other errors"
step "Metrics as admin" GET "/metrics/maintenance" "admin-token"
step "Metrics as student -> 403" GET "/metrics/maintenance" "user-a-token"
step "Unsupported method -> 405" DELETE "/reports" "admin-token"
step "Unknown route -> 404" GET "/unicorns" "admin-token"
