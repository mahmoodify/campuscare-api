# CampusCare API helper for PowerShell (Windows PowerShell 5.1 and PowerShell 7+).
#
# Load it once per PowerShell window, from the project folder:
#     . .\examples\api.ps1
# (note the dot and the space at the start). If PowerShell says running scripts is
# disabled, run this first (no administrator rights needed, lasts for this window only):
#     Set-ExecutionPolicy -Scope Process Bypass
#
# Usage:   api METHOD PATH [TOKEN] [JSON_BODY]
#   api GET /reports
#   api GET /reports user-a-token
#   api POST /reports user-a-token '{"inventoryItemId":"inv_002","issueType":"BROKEN"}'
#   api DELETE /reports/rep_105 user-b-token
#
# It prints the HTTP status (green = success, red = error) and then the JSON response.
# Unlike plain Invoke-RestMethod, it does not stop with an exception on 4xx errors,
# so 401, 403, 404, 409 and so on are shown exactly like the successful ones.
#
# To use another server address:   $global:ApiBase = "http://localhost:4000"

if (-not $global:ApiBase) { $global:ApiBase = "http://localhost:3000" }

function api {
  param(
    [Parameter(Mandatory = $true)][string]$Method,
    [Parameter(Mandatory = $true)][string]$Path,
    [string]$Token,
    [string]$Body
  )

  $headers = @{}
  if ($Token) { $headers["Authorization"] = "Bearer $Token" }

  $params = @{
    Uri             = "$($global:ApiBase)/api/v1$Path"
    Method          = $Method
    Headers         = $headers
    UseBasicParsing = $true
  }
  if ($Body) {
    $params["Body"] = $Body
    $params["ContentType"] = "application/json"
  }

  try {
    $r = Invoke-WebRequest @params
    $code = [int]$r.StatusCode
    $text = $r.Content
    $location = [string]$r.Headers["Location"]
  }
  catch {
    if (-not $_.Exception.Response) {
      Write-Host "Cannot reach the server at $($global:ApiBase). Is 'npm start' running?" -ForegroundColor Red
      return
    }
    $code = [int]$_.Exception.Response.StatusCode
    $text = $_.ErrorDetails.Message
    $location = ""
    if (-not $text) { $text = $_.Exception.Message }
  }

  $color = if ($code -lt 300) { "Green" } else { "Red" }
  Write-Host ""
  Write-Host "HTTP $code" -ForegroundColor $color
  if ($location) { Write-Host "Location: $location" }
  Write-Host $text
}
