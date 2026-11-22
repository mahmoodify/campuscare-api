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
