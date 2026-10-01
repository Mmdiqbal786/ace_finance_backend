# Backend API automated testing

HTTP scenarios against a running API (`BASE_URL`, default `http://localhost:3001`). **Does not change server source** — only calls APIs.

## Commands

| Command | When to use |
|---------|-------------|
| `npm run test:api:smoke` | Fast read-only check (health + Swagger, negatives, auth/roles, RBAC, catalog, dashboards, FX, notifications) |
| `npm run test:api:system` | **Pre-push gate** — smoke + catalog-crud + expense-flow + changes-flow |
| `npm run test:api:full` | system + users-crud |
| `npm run postman:verify -- <scenario>` | Single scenario (e.g. `expense-flow`, `rbac`) |
| `npm run postman:verify -- list` | List scenarios / suites |
| `npm run postman:generate` | Rebuild `Aceolution-Finance.postman_collection.json` from the Swagger samples |

## Env

```bash
# default
set BASE_URL=http://localhost:3001

# Azure live (writes to shared DB — use carefully)
set BASE_URL=https://ace-finance-api-f5hnhhd6c3bvffhj.southindia-01.azurewebsites.net
```

Logins used (seeded demo accounts):

| Role | Email | Password |
|------|-------|----------|
| ADMIN | `finance@aceolution.com` | `Admin@1234` |
| REQUESTER | `requester.gac@acefinance.com` | `Requester@1234` |
| APPROVER | `approver.media@acefinance.com` | `Approver@1234` |
| PROCESSOR | `alisha.processor@acefinance.com` | `Processor@1234` |

Write scenarios submit expenses on project `Google Art and culture (GAC)` (requester must stay assigned to it).

## Emails during API tests (important)

The API has no test-mode email switch — **write scenarios send real emails** (new request, approved, paid, changes requested, rejected, welcome mail for `users-crud`).

- `smoke` is read-only → no emails
- `users-crud` creates users on `@example.com` so welcome mail never reaches a real inbox

## Cleanup

After **every** write scenario (pass or fail), the runner deletes what it created via the API (expenses, catalog items, users).

- Log: `CLEANUP removed N/M test record(s)`
- `SKIP_CLEANUP=1` — keep data for debugging
- Test records are prefixed `[API TEST]` / `API Test` so leftovers are easy to spot
- Seed accounts and existing catalog data are never touched

## Postman

- Import `postman/Aceolution-Finance.postman_collection.json` — single file, no environment needed
- Switch target by setting collection variable `baseUrl` (`{{baseUrlLocal}}` / `{{baseUrlAzure}}` values are provided)
- Run **Authentication → Login** first — its Tests script saves `accessToken` for every other request
- Create / list requests save ids (`expenseId`, `userId`, `projectId`, …) for the follow-up requests
- Every request has saved examples (success + standard errors)

## Swagger + API pages

| Page | Path |
|------|------|
| API home | `/` (`/api` redirects here) |
| Swagger UI (branded) | `/api/docs` (`/docs` redirects here) |
| OpenAPI spec page + JSON download | `/api/openapi` |
| OpenAPI JSON | `/api/docs-json` |
| Health page in a browser (API, database, uptime) | `/health` (also `/status`) |
| Health JSON (monitors, curl, Postman, tests) | `/health` — non-browser clients get JSON automatically; `?format=json` forces it |
| Server down preview | `/status/unavailable` |

- Local: `http://localhost:3001/api/docs`
- Live: `https://ace-finance-api-f5hnhhd6c3bvffhj.southindia-01.azurewebsites.net/api/docs`

## Warning — shared database

Local API uses a **shared Atlas DB** (`MONGODB_URI` in `.env`). Prefer a dedicated test DB for CI. Do not run `system` / `full` against live casually.

## Pre-push

1. Start API locally (`npm run start:dev`).
2. Run `npm run test:api:system`.
3. Push only if the suite exits 0.
