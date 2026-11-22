# CampusCare API Documentation (v1)

CampusCare lets students report broken or missing campus inventory. Reports are routed to maintenance staff, prioritised by safety urgency, and the time to inspect and resolve each one is tracked.

This document describes the **API contract** of the prototype. All data is mocked in memory and resets when the server restarts.

- **Base URL:** `http://localhost:3000/api/v1`
- **Main resource:** `reports` (supporting resources: `inventory-items`, `metrics`)
- **Format:** JSON (`Content-Type: application/json`), except the HTML greeting page
- **Auth:** `Authorization: Bearer <token>` with predefined mock tokens

---

## 1. Conventions

### 1.1 Mock users and tokens

| User | Role | Token | What they can do |
|---|---|---|---|
| Student A (`user-a`) | `student` | `user-a-token` | Manages only their own reports |
| Student B (`user-b`) | `student` | `user-b-token` | Manages only their own reports |
| Administrator (`admin-1`) | `admin` | `admin-token` | Manages all reports, sees metrics |
| Maintenance Staff 1 (`staff-1`) | `staff` | `staff-token` | Sees and updates the status of reports assigned to them (Buildings A and B) |

`staff-1` is an extension beyond the three required users. It comes from the project proposal and is what makes the status workflow possible. A fifth user, `staff-2` (Building C), exists only as the assignee of some reports and has no token.

Send the token like this:

```http
Authorization: Bearer user-a-token
```

### 1.2 Response envelope

Every JSON response uses an envelope. The HTTP status code always matches it: `2xx` for `success: true`, `4xx`/`5xx` for `success: false`.

**Success**

```json
{
  "success": true,
  "message": "Report created successfully.",
  "data": { "id": "rep_106" }
}
```

- `data` holds the resource, an array of resources, or `null` (for delete).
- List responses add `meta`: `{ "total": 5, "page": 1, "perPage": 10 }`.

**Error**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request contains invalid or missing fields.",
    "details": [
      { "field": "issueType", "message": "issueType must be one of: BROKEN, MISSING." }
    ]
  }
}
```

- `error.code` is one of the fixed values in the table below, so a frontend can decide what to show without parsing text.
- `details` appears only for validation errors (`VALIDATION_ERROR`).
- Error messages never contain stack traces, SQL, file paths, tokens or other internals. Unexpected failures are logged on the server and returned as a generic `INTERNAL_ERROR`.

### 1.3 Error codes and status codes

| HTTP status | `error.code` | When |
|---:|---|---|
| `400` | `VALIDATION_ERROR` | Invalid, missing or unknown body fields or query parameters |
| `400` | `INVALID_JSON` | Request body is not valid JSON |
| `401` | `UNAUTHORIZED` | Token is missing, malformed or invalid. Response includes `WWW-Authenticate: Bearer` |
| `403` | `FORBIDDEN` | Token is valid, but the user's **role** may not call this endpoint |
| `404` | `NOT_FOUND` | Resource or route does not exist, or the resource belongs to another user |
| `405` | `METHOD_NOT_ALLOWED` | The path exists but not for this HTTP method. Response includes an `Allow` header |
| `409` | `CONFLICT` | Request is valid but clashes with current data or state |
| `413` | `PAYLOAD_TOO_LARGE` | Body larger than 100 KB |
| `500` | `INTERNAL_ERROR` | Unexpected server error (generic message only) |

Success codes used: `200 OK` (read, update, delete) and `201 Created` (create, with a `Location` header).

### 1.4 Order of checks

When several things are wrong at once, the first failing check wins:

1. Route exists? → `404` (unknown path) or `405` (wrong method)
2. Token valid? → `401`
3. Role allowed for this endpoint? → `403`
4. Body is valid JSON? → `400`
5. Resource exists **and the caller may see it**? → `404`
6. Fields valid? → `400`
7. Allowed in the resource's current state / no duplicate? → `409`

### 1.5 Permission matrix

| Endpoint | Student | Staff | Admin |
|---|---|---|---|
| `GET /reports` | own reports | reports assigned to them | all |
| `GET /reports/{id}` | own | assigned to them | any |
| `POST /reports` | yes | `403` | yes |
| `PUT /reports/{id}` | own, only while `PENDING` | `403` | any |
| `DELETE /reports/{id}` | own, only while `PENDING` | `403` | any |
| `PUT /reports/{id}/status` | `403` | assigned to them | any |
| `GET /inventory-items` | yes | yes | yes |
| `GET /metrics/maintenance` | `403` | `403` | yes |
| `GET /me` | yes | yes | yes |
| `GET /health`, `GET /greeting` | public | public | public |

### 1.6 Design decision: `404` instead of `403` for other users' reports

When a regular user asks for a report that belongs to someone else, the API returns **`404 Not Found`**, not `403 Forbidden`.

**Why:** a `403` would confirm that the report exists. With `404`, "this ID does not exist" and "this ID is not yours" look identical (even the message is the same), so users cannot discover which report IDs exist in other people's data. The same rule applies to staff asking for reports not assigned to them.

`403` is still used when the problem is the user's **role** (for example a student calling the staff-only status endpoint, or a non-admin calling metrics), because the endpoint itself is not available to that role and nothing about any individual resource is revealed.

### 1.7 Resource models

**Report**

| Field | Type | Notes |
|---|---|---|
| `id` | string | Server-generated, e.g. `rep_101` |
| `inventoryItem` | object | `{ id, name, building, location }` |
| `issueType` | string | `BROKEN` or `MISSING` |
| `comment` | string or `null` | Optional note, 3–200 characters |
| `status` | string | `PENDING`, `IN_PROGRESS` or `RESOLVED` |
| `priority` | string | `HIGH`, `MEDIUM` or `LOW`, set by (mocked) AI triage |
| `ownerId` | string | User who created the report |
| `assignedTo` | string or `null` | Staff member the report was routed to (by building) |
| `createdAt`, `inspectedAt`, `resolvedAt` | ISO 8601 string or `null` | `inspectedAt` is set when status becomes `IN_PROGRESS`; `resolvedAt` when `RESOLVED` |
| `minutesToInspect`, `minutesToResolve` | number or `null` | Elapsed minutes since `createdAt` |

**Inventory item**: `id`, `name`, `category`, `building`, `location`, `safetyCritical`.

**Mocked AI triage:** safety-critical items → `HIGH`; furniture → `LOW`; everything else → `MEDIUM`. If the AI service is unavailable (simulate with `AI_TRIAGE_ENABLED=false`) reports are still accepted with the default `MEDIUM`.

### 1.8 Mock data for demonstration

| ID | Owner | Item | Issue | Status | Assigned |
|---|---|---|---|---|---|
| `rep_101` | User A | Ceiling light (Bldg A) | BROKEN | PENDING | staff-1 |
| `rep_102` | User A | Projector (Bldg B) | MISSING | IN_PROGRESS | staff-1 |
| `rep_103` | User B | Fire extinguisher (Bldg A) | MISSING | PENDING | staff-1 |
| `rep_104` | User B | Whiteboard (Bldg C) | BROKEN | RESOLVED | staff-2 |
| `rep_105` | User B | Lecture chair (Bldg B) | BROKEN | PENDING | staff-1 |

Non-existent ID for `404` demos: **`rep_999`**. Inventory IDs: `inv_001` to `inv_009`.

---

## 2. Endpoints

### 2.1 `GET /api/v1/reports`: list reports

- **Access:** student, staff, admin (results are limited by role, see 1.5)
- **Headers:** `Authorization: Bearer <token>`
- **Query parameters** (all optional; unknown parameters are rejected):

| Name | Type | Default | Rules |
|---|---|---|---|
| `status` | string | | `PENDING`, `IN_PROGRESS`, `RESOLVED` |
| `priority` | string | | `HIGH`, `MEDIUM`, `LOW` |
| `issueType` | string | | `BROKEN`, `MISSING` |
| `sort` | string | `-createdAt` | `createdAt`, `-createdAt`, `priority`, `-priority` (`-` = descending) |
| `page` | integer | `1` | ≥ 1 |
| `perPage` | integer | `10` | 1–100 |

- **Success:** `200 OK`, `data` is an array of reports, plus `meta`.
- **Errors:**

| Status | Code | Cause |
|---:|---|---|
| 400 | `VALIDATION_ERROR` | Invalid or unknown query parameter |
| 401 | `UNAUTHORIZED` | Missing, malformed or invalid token |

**Example**

```http
GET /api/v1/reports?status=PENDING&perPage=1 HTTP/1.1
Authorization: Bearer user-a-token
```

```json
{
  "success": true,
  "message": "Reports retrieved successfully.",
  "data": [
    {
      "id": "rep_101",
      "inventoryItem": { "id": "inv_001", "name": "Ceiling light", "building": "Building A", "location": "Room 204" },
      "issueType": "BROKEN",
      "comment": "Flickers all the time",
      "status": "PENDING",
      "priority": "MEDIUM",
      "ownerId": "user-a",
      "assignedTo": "staff-1",
      "createdAt": "2026-11-12T09:15:00.000Z",
      "inspectedAt": null,
      "resolvedAt": null,
      "minutesToInspect": null,
      "minutesToResolve": null
    }
  ],
  "meta": { "total": 1, "page": 1, "perPage": 1 }
}
```

---

### 2.2 `GET /api/v1/reports/{id}`: get one report

- **Access:** student (own), staff (assigned), admin (any)
- **Headers:** `Authorization: Bearer <token>`
- **Path parameter:** `id`: report ID, e.g. `rep_101`
- **Success:** `200 OK`, `data` is one report.
- **Errors:**

| Status | Code | Cause |
|---:|---|---|
| 401 | `UNAUTHORIZED` | Missing, malformed or invalid token |
| 404 | `NOT_FOUND` | The ID does not exist, **or** the report belongs to another user (see 1.6) |

**Example**

```http
GET /api/v1/reports/rep_103 HTTP/1.1
Authorization: Bearer user-a-token
```

```http
HTTP/1.1 404 Not Found
```

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Report \"rep_103\" was not found."
  }
}
```

---

### 2.3 `POST /api/v1/reports`: create a report

- **Access:** student, admin (staff get `403`)
- **Headers:** `Authorization: Bearer <token>`, `Content-Type: application/json`
- **Body parameters:**

| Field | Type | Required | Rules |
|---|---|---|---|
| `inventoryItemId` | string | yes | Must be an existing inventory item (`GET /inventory-items`) |
| `issueType` | string | yes | `BROKEN` or `MISSING` |
| `comment` | string | no | 3–200 characters after trimming |

Any other field (for example `ownerId`, `status`, `priority`) is rejected: the server decides those values. The owner is always the caller.

- **Success:** `201 Created` with a `Location` header (`/api/v1/reports/{id}`). The report starts as `PENDING`, gets a priority from triage, and is routed to the staff member responsible for the item's building.
- **Errors:**

| Status | Code | Cause |
|---:|---|---|
| 400 | `INVALID_JSON` | Body is not valid JSON |
| 400 | `VALIDATION_ERROR` | Missing, wrongly typed, out-of-range or unknown fields; inventory item does not exist; body is not an object |
| 401 | `UNAUTHORIZED` | Missing, malformed or invalid token |
| 403 | `FORBIDDEN` | Caller is staff |
| 409 | `CONFLICT` | The caller already has an open (not `RESOLVED`) report for the same item and issue type |

**Example: success**

```http
POST /api/v1/reports HTTP/1.1
Authorization: Bearer user-a-token
Content-Type: application/json

{ "inventoryItemId": "inv_002", "issueType": "BROKEN", "comment": "Exit sign is dark" }
```

```http
HTTP/1.1 201 Created
Location: /api/v1/reports/rep_106
```

```json
{
  "success": true,
  "message": "Report created successfully.",
  "data": {
    "id": "rep_106",
    "inventoryItem": { "id": "inv_002", "name": "Emergency exit sign", "building": "Building A", "location": "Ground floor corridor" },
    "issueType": "BROKEN",
    "comment": "Exit sign is dark",
    "status": "PENDING",
    "priority": "HIGH",
    "ownerId": "user-a",
    "assignedTo": "staff-1",
    "createdAt": "2026-11-13T20:15:00.000Z",
    "inspectedAt": null,
    "resolvedAt": null,
    "minutesToInspect": null,
    "minutesToResolve": null
  }
}
```

**Example: validation error**

```http
POST /api/v1/reports HTTP/1.1
Authorization: Bearer user-a-token
Content-Type: application/json

{ "issueType": "EXPLODED", "comment": "x", "ownerId": "user-b" }
```

```http
HTTP/1.1 400 Bad Request
```

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request contains invalid or missing fields.",
    "details": [
      { "field": "ownerId", "message": "Unknown or read-only field \"ownerId\". Allowed fields: inventoryItemId, issueType, comment." },
      { "field": "inventoryItemId", "message": "inventoryItemId is required." },
      { "field": "issueType", "message": "issueType must be one of: BROKEN, MISSING." },
      { "field": "comment", "message": "comment must contain between 3 and 200 characters when provided." }
    ]
  }
}
```

**Example: conflict** (sending the same valid request twice)

```json
{
  "success": false,
  "error": {
    "code": "CONFLICT",
    "message": "You already have an open report (rep_106) for this item with the same issue type. Update or delete it instead of creating a duplicate."
  }
}
```

---

### 2.4 `PUT /api/v1/reports/{id}`: update a report

`PUT` replaces the writable part of the report, so send all required fields. An omitted `comment` is cleared. The priority is recalculated and the report is re-routed to match the new item.

- **Access:** student (own report, only while `PENDING`), admin (any report, any status). Staff get `403`: they change status through `PUT /reports/{id}/status`.
- **Headers:** `Authorization: Bearer <token>`, `Content-Type: application/json`
- **Path parameter:** `id`
- **Body parameters:** same fields and rules as `POST /reports` (`inventoryItemId` and `issueType` required, `comment` optional).
- **Success:** `200 OK`, `data` is the updated report. Repeating the same request gives the same result (idempotent).
- **Errors:**

| Status | Code | Cause |
|---:|---|---|
| 400 | `INVALID_JSON`, `VALIDATION_ERROR` | Bad body (see 2.3) |
| 401 | `UNAUTHORIZED` | Missing, malformed or invalid token |
| 403 | `FORBIDDEN` | Caller is staff |
| 404 | `NOT_FOUND` | ID does not exist or belongs to another user |
| 409 | `CONFLICT` | A student edits a report that is no longer `PENDING`, or the update would duplicate another open report of the same owner |

**Example**

```http
PUT /api/v1/reports/rep_101 HTTP/1.1
Authorization: Bearer user-a-token
Content-Type: application/json

{ "inventoryItemId": "inv_001", "issueType": "MISSING", "comment": "The bulb was removed" }
```

```json
{
  "success": true,
  "message": "Report updated successfully.",
  "data": {
    "id": "rep_101",
    "inventoryItem": { "id": "inv_001", "name": "Ceiling light", "building": "Building A", "location": "Room 204" },
    "issueType": "MISSING",
    "comment": "The bulb was removed",
    "status": "PENDING",
    "priority": "MEDIUM",
    "ownerId": "user-a",
    "assignedTo": "staff-1",
    "createdAt": "2026-11-12T09:15:00.000Z",
    "inspectedAt": null,
    "resolvedAt": null,
    "minutesToInspect": null,
    "minutesToResolve": null
  }
}
```

**Example: conflict** (`PUT /reports/rep_102` as Student A, report is already in progress)

```json
{
  "success": false,
  "error": {
    "code": "CONFLICT",
    "message": "This report is already \"IN_PROGRESS\" and can no longer be edited. Only pending reports can be changed by their owner."
  }
}
```

---

### 2.5 `DELETE /api/v1/reports/{id}`: delete a report

- **Access:** student (own report, only while `PENDING`), admin (any). Staff get `403`.
- **Headers:** `Authorization: Bearer <token>`
- **Path parameter:** `id`
- **Success:** `200 OK`, `data` is `null`.
- **Errors:**

| Status | Code | Cause |
|---:|---|---|
| 401 | `UNAUTHORIZED` | Missing, malformed or invalid token |
| 403 | `FORBIDDEN` | Caller is staff |
| 404 | `NOT_FOUND` | ID does not exist (including already deleted) or belongs to another user |
| 409 | `CONFLICT` | A student deletes a report that is no longer `PENDING` |

**Example**

```http
DELETE /api/v1/reports/rep_101 HTTP/1.1
Authorization: Bearer user-a-token
```

```json
{
  "success": true,
  "message": "Report deleted successfully.",
  "data": null
}
```

---

### 2.6 `PUT /api/v1/reports/{id}/status`: change report status

Used by maintenance staff to record progress. Allowed transitions: `PENDING → IN_PROGRESS → RESOLVED`. Moving to `IN_PROGRESS` records `inspectedAt`; moving to `RESOLVED` records `resolvedAt`. Sending the status the report already has is a harmless `200`.

- **Access:** staff (only reports assigned to them), admin (any). Students get `403`.
- **Headers:** `Authorization: Bearer <token>`, `Content-Type: application/json`
- **Path parameter:** `id`
- **Body parameters:**

| Field | Type | Required | Rules |
|---|---|---|---|
| `status` | string | yes | `PENDING`, `IN_PROGRESS` or `RESOLVED`, and a valid next step |

- **Success:** `200 OK`, `data` is the updated report.
- **Errors:**

| Status | Code | Cause |
|---:|---|---|
| 400 | `INVALID_JSON`, `VALIDATION_ERROR` | Bad body or invalid `status` value |
| 401 | `UNAUTHORIZED` | Missing, malformed or invalid token |
| 403 | `FORBIDDEN` | Caller is a student |
| 404 | `NOT_FOUND` | ID does not exist, or staff member is not assigned to it |
| 409 | `CONFLICT` | Invalid transition (skipping a step, or reopening a resolved report) |

**Example**

```http
PUT /api/v1/reports/rep_101/status HTTP/1.1
Authorization: Bearer staff-token
Content-Type: application/json

{ "status": "IN_PROGRESS" }
```

```json
{
  "success": true,
  "message": "Report status changed to \"IN_PROGRESS\".",
  "data": {
    "id": "rep_101",
    "inventoryItem": { "id": "inv_001", "name": "Ceiling light", "building": "Building A", "location": "Room 204" },
    "issueType": "BROKEN",
    "comment": "Flickers all the time",
    "status": "IN_PROGRESS",
    "priority": "MEDIUM",
    "ownerId": "user-a",
    "assignedTo": "staff-1",
    "createdAt": "2026-11-12T09:15:00.000Z",
    "inspectedAt": "2026-11-13T20:20:00.000Z",
    "resolvedAt": null,
    "minutesToInspect": 1625,
    "minutesToResolve": null
  }
}
```

**Example: conflict** (`{ "status": "RESOLVED" }` on a `PENDING` report)

```json
{
  "success": false,
  "error": {
    "code": "CONFLICT",
    "message": "Cannot change status from \"PENDING\" to \"RESOLVED\". The only allowed next status is \"IN_PROGRESS\"."
  }
}
```

**Example: forbidden** (same request with `user-a-token`)

```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Your role \"student\" is not allowed to perform this action. Allowed roles: staff, admin."
  }
}
```

---

### 2.7 `GET /api/v1/inventory-items`: list reportable items

The preset list students pick from (no typing needed).

- **Access:** any signed-in user
- **Headers:** `Authorization: Bearer <token>`
- **Query parameters:** `building` (string, case-insensitive exact match, 1–50 characters), `page` (default 1), `perPage` (default 10, max 100)
- **Success:** `200 OK`, `data` is an array of items, plus `meta`.
- **Errors:** `400 VALIDATION_ERROR` (bad or unknown query parameter), `401 UNAUTHORIZED`.

**Example**

```http
GET /api/v1/inventory-items?building=Building%20C&perPage=2 HTTP/1.1
Authorization: Bearer user-b-token
```

```json
{
  "success": true,
  "message": "Inventory items retrieved successfully.",
  "data": [
    { "id": "inv_007", "name": "Stair handrail", "category": "structure", "building": "Building C", "location": "Main staircase", "safetyCritical": true },
    { "id": "inv_008", "name": "Laboratory microscope", "category": "equipment", "building": "Building C", "location": "Lab 3", "safetyCritical": false }
  ],
  "meta": { "total": 3, "page": 1, "perPage": 2 }
}
```

---

### 2.8 `GET /api/v1/metrics/maintenance`: maintenance metrics

Average inspection and resolution time and open reports per building.

- **Access:** admin only
- **Headers:** `Authorization: Bearer <token>`
- **Success:** `200 OK`
- **Errors:** `401 UNAUTHORIZED`, `403 FORBIDDEN` (student or staff)

**Example**

```http
GET /api/v1/metrics/maintenance HTTP/1.1
Authorization: Bearer admin-token
```

```json
{
  "success": true,
  "message": "Maintenance metrics retrieved successfully.",
  "data": {
    "totalReports": 5,
    "byStatus": { "PENDING": 3, "IN_PROGRESS": 1, "RESOLVED": 1 },
    "averageMinutesToInspect": 37.5,
    "averageMinutesToResolve": 210,
    "openReportsByBuilding": [
      { "building": "Building A", "open": 2 },
      { "building": "Building B", "open": 2 }
    ]
  }
}
```

---

### 2.9 `GET /api/v1/me`: current user

- **Access:** any signed-in user
- **Headers:** `Authorization: Bearer <token>`
- **Success:** `200 OK` with `{ id, name, role }` (staff also have `buildings`)
- **Errors:** `401 UNAUTHORIZED`

```json
{
  "success": true,
  "message": "Current user retrieved successfully.",
  "data": { "id": "user-a", "name": "Student A", "role": "student" }
}
```

---

### 2.10 `GET /api/v1/health`: health check

- **Access:** public (no token)
- **Success:** `200 OK`

```json
{
  "success": true,
  "message": "The API is running.",
  "data": { "status": "UP", "version": "v1", "uptimeSeconds": 42 }
}
```

---

### 2.11 `GET /api/v1/greeting`: HTML greeting page

- **Access:** public (no token)
- **Response:** `200 OK`, `Content-Type: text/html; charset=utf-8`. **This endpoint returns an HTML page, not JSON.** Open `http://localhost:3000/api/v1/greeting` in a browser (the root URL `/` redirects here).
- **Page contents:** project name and description, team members (name, student ID, contribution), a list of every endpoint (method, path, access, description), and the API status and version. The layout is responsive for desktop and mobile.

---

## 3. Other behaviour

- **`405 Method Not Allowed`:** for example `DELETE /api/v1/reports` or `POST /api/v1/reports/rep_101`. The `Allow` header lists the supported methods.
- **`404` for unknown routes:** returns the normal JSON error envelope.
- **CORS:** enabled for all origins, so the Expo web app can call the API during development. `OPTIONS` requests answer `204`.

---

## 4. Trying the API from a terminal

Start the server with `npm start` and use a second terminal window. Every request below works with the mock tokens `user-a-token`, `user-b-token`, `staff-token` and `admin-token` (see section 1.1).

### 4.1 macOS, Linux, Git Bash (curl)

```bash
BASE=http://localhost:3000/api/v1

curl -i $BASE/reports                                                    # 401, no token
curl -H "Authorization: Bearer user-a-token" $BASE/reports               # list own reports
curl -H "Authorization: Bearer user-a-token" $BASE/reports/rep_101       # get one
curl -X POST $BASE/reports -H "Authorization: Bearer user-a-token" -H "Content-Type: application/json" \
  -d '{"inventoryItemId":"inv_002","issueType":"BROKEN","comment":"Exit sign is dark"}'
curl -X PUT $BASE/reports/rep_101 -H "Authorization: Bearer user-a-token" -H "Content-Type: application/json" \
  -d '{"inventoryItemId":"inv_001","issueType":"MISSING","comment":"The bulb was removed"}'
curl -X PUT $BASE/reports/rep_101/status -H "Authorization: Bearer staff-token" -H "Content-Type: application/json" \
  -d '{"status":"IN_PROGRESS"}'
curl -X DELETE -H "Authorization: Bearer user-b-token" $BASE/reports/rep_105
curl -H "Authorization: Bearer admin-token" $BASE/metrics/maintenance
```

### 4.2 Windows PowerShell

In Windows PowerShell, `curl` is an alias for `Invoke-WebRequest`, so the commands in 4.1 do not work there. Use the helper `examples/api.ps1`, which sends the request, adds the `Authorization` header and shows the status code and JSON body (also for 4xx and 5xx responses, which plain `Invoke-RestMethod` reports as exceptions):

```powershell
. .\examples\api.ps1      # once per window; if scripts are blocked: Set-ExecutionPolicy -Scope Process Bypass

api GET /reports                                         # 401, no token
api GET /reports user-a-token                            # list own reports
api GET /reports/rep_101 user-a-token                    # get one
api POST /reports user-a-token '{"inventoryItemId":"inv_002","issueType":"BROKEN","comment":"Exit sign is dark"}'
api PUT /reports/rep_101 user-a-token '{"inventoryItemId":"inv_001","issueType":"MISSING","comment":"The bulb was removed"}'
api PUT /reports/rep_101/status staff-token '{"status":"IN_PROGRESS"}'
api DELETE /reports/rep_105 user-b-token
api GET /metrics/maintenance admin-token
```

The pattern is `api METHOD PATH [TOKEN] [JSON_BODY]`; the path is relative to `/api/v1`. Put the JSON in single quotes. To use another server address, set `$global:ApiBase = "http://localhost:4000"` before loading the helper.

The HTML greeting page is opened in a browser (`http://localhost:3000/api/v1/greeting`), not in the terminal. Without a browser: `Invoke-WebRequest http://localhost:3000/api/v1/greeting -UseBasicParsing | Select-Object -ExpandProperty Content`.

The complete walkthrough of all features is in `examples/demo.sh` (bash) and `examples/demo.ps1` (PowerShell); see [examples/README.md](../examples/README.md).
