# CampusCare API (Assignment 2 prototype)

A REST API prototype for **CampusCare**, a campus web and mobile app where students report broken or missing university inventory (for example a broken light in Building A). Reports are routed to the right maintenance staff, prioritised by safety urgency, and the time to inspect and resolve each issue is tracked for administrators.

This prototype implements the API contract with **mocked in-memory data**, **token-based authentication** and **role-based authorization**. There is no real database yet.

- **Main resource:** `reports` (with `inventory-items` and `metrics` as supporting resources)
- **Full API documentation:** [docs/API.md](docs/API.md)
- **Example requests:** [examples/requests.http](examples/requests.http), [Postman collection](postman/CampusCare.postman_collection.json), [examples/demo.sh](examples/demo.sh)

## Requirements

- **Node.js 18 or newer** (developed on Node 22)
- No other dependencies. The prototype uses only Node's built-in modules, so there is nothing to download and **no `npm install` is needed**.

> **Why Node.js and not Spring Boot?** The project proposal plans a Spring Boot backend for the final system. For this prototype the same API contract is built in plain Node.js so that it runs anywhere with a single command. Endpoints, status codes, validation rules and response formats are framework-independent and can be ported to Spring Boot unchanged.

## Install and run

```bash
git clone <your-repository-url>
cd campuscare-api
npm start
```

The server starts on **http://localhost:3000**. Open the HTML greeting page in a browser:

**http://localhost:3000/api/v1/greeting** (the root URL `/` redirects there)

| Setting | How | Default |
|---|---|---|
| Port | `PORT=4000 npm start` | `3000` |
| Simulate the AI triage service being down | `AI_TRIAGE_ENABLED=false npm start` | enabled |

Other commands:

```bash
npm test            # run the automated test suite (73 tests, no server needed)
npm run dev         # start with auto-restart on file changes
npm run postman     # regenerate the Postman collection
bash examples/demo.sh   # scripted walkthrough of every feature (server must be running)
```

> **Mock data resets on restart.** All data lives in memory. Every time the server restarts it returns to the initial data in [src/data/seed.js](src/data/seed.js). Restart the server before repeating the demo.

## Mock users and tokens

Send the token in the `Authorization` header: `Authorization: Bearer user-a-token`

| User | Role | Token | Permissions |
|---|---|---|---|
| Student A | student | `user-a-token` | Manages only their own reports |
| Student B | student | `user-b-token` | Manages only their own reports |
| Administrator | admin | `admin-token` | Manages all reports, sees metrics |
| Maintenance Staff 1 *(extra)* | staff | `staff-token` | Sees and updates status of reports assigned to them |

The staff role is not required by the assignment. It comes from the project proposal and powers the status workflow.

## Try it

```bash
# Without a token -> 401
curl -i http://localhost:3000/api/v1/reports

# Student A lists their own reports
curl -H "Authorization: Bearer user-a-token" http://localhost:3000/api/v1/reports

# Student A tries to read Student B's report -> 404
curl -H "Authorization: Bearer user-a-token" http://localhost:3000/api/v1/reports/rep_103

# Create a report
curl -X POST http://localhost:3000/api/v1/reports \
  -H "Authorization: Bearer user-a-token" -H "Content-Type: application/json" \
  -d '{"inventoryItemId":"inv_002","issueType":"BROKEN","comment":"Exit sign is dark"}'
```

## Endpoints

| Method | Path | Who | Description |
|---|---|---|---|
| `GET` | `/api/v1/greeting` | public | HTML page: project, team, endpoints, status |
| `GET` | `/api/v1/health` | public | Health check |
| `GET` | `/api/v1/me` | any user | Who the token belongs to |
| `GET` | `/api/v1/inventory-items` | any user | Preset items students can report |
| `GET` | `/api/v1/reports` | any user | List reports (students: own, staff: assigned, admin: all) |
| `GET` | `/api/v1/reports/{id}` | any user | Get one report |
| `POST` | `/api/v1/reports` | student, admin | Create a report |
| `PUT` | `/api/v1/reports/{id}` | student (own, pending), admin | Update a report |
| `DELETE` | `/api/v1/reports/{id}` | student (own, pending), admin | Delete a report |
| `PUT` | `/api/v1/reports/{id}/status` | staff (assigned), admin | Change status (records inspection and resolution time) |
| `GET` | `/api/v1/metrics/maintenance` | admin | Average inspection/resolution time, open reports per building |

Details, parameters, validation rules and every error response are in [docs/API.md](docs/API.md).

## Design decisions

- **Resource-oriented URLs:** plural nouns (`/reports`), the HTTP method carries the action. The one extra path, `/reports/{id}/status`, treats the status as a sub-resource instead of using a verb like `/resolveReport`.
- **Response envelope:** every JSON response has `success` and either `data` (plus `meta` for lists) or `error` with a fixed `code`, a readable `message` and, for validation errors, a `details` list. The status code always matches the envelope.
- **`404` instead of `403` for other users' reports.** When a regular user asks for a report that belongs to someone else, the API answers `404 Not Found`, identical to a report that does not exist. A `403` would confirm that the ID exists and let users probe other people's data. `403` is reserved for role problems (for example a student calling the staff-only status endpoint or the admin-only metrics endpoint). See [section 1.6 of the API docs](docs/API.md).
- **No internals in errors:** unexpected failures are logged on the server and the client receives only a generic `INTERNAL_ERROR`. Unknown body fields and query parameters are rejected with `400`, which also stops clients from setting server-controlled fields like `ownerId` or `status`.
- **Mocked AI triage:** a simple rule (safety-critical item → `HIGH`, furniture → `LOW`, otherwise `MEDIUM`) stands in for the GPT-4o-mini call. If the "AI" is disabled, reports still get the default `MEDIUM`.
- **Routing:** each report is assigned to the staff member responsible for the item's building.

## Project structure

```
src/
  server.js            starts the HTTP server
  app.js               request pipeline: route -> 401 -> 403 -> body -> handler -> errors
  auth.js              bearer-token authentication and role check
  validation.js        body and query validation
  errors.js, http.js   error types, JSON envelope helpers
  store.js             in-memory store
  data/seed.js         mock users, inventory and reports
  data/team.js         team details shown on the greeting page
  services/            report logic (ownership, routing, status) and mock AI triage
  routes/              one file per group of endpoints (the greeting page lives here too)
test/api.test.js       integration tests (node:test, 73 tests)
docs/API.md            API documentation
examples/              requests.http and demo.sh
postman/               generated Postman collection
scripts/               Postman collection generator
```

## Team and git history

See [CONTRIBUTORS.md](CONTRIBUTORS.md) for members, student IDs and responsibilities.

### `git shortlog -sn --all`

```text
    20  mahmoodify
    18  Kamal-Mustafayev
     5  Mahmud Aliyev
     4  Kamal Mustafayev
```

### Who worked on which part

| Member | Parts of the system |
|---|---|
| Mahmud Aliyev | Project setup, JSON response envelope, bearer-token authentication and role checks, report ownership logic, reports list/get/create endpoints, health and current-user endpoints, HTML greeting page, API conventions and reports documentation |
| Kamal Mustafayev | Mock data and in-memory store, validation rules, mock AI triage, report update/delete and status workflow, inventory and metrics endpoints, example requests, Postman collection, README |
