# Backend API automated testing

HTTP scenarios against a running API (`BASE_URL`, default `http://localhost:3001`). **Does not change server source** — only calls APIs.

## Commands

| Command | When to use |
|---------|-------------|
| `npm run test:api:smoke` | Fast check (health, negatives, auth/roles, RBAC, catalog, dashboards, FX, notifications) |
| `npm run test:api:system` | **Pre-push gate** — smoke + catalog-crud + expense-flow + changes-flow |
| `npm run test:api:full` | system + users-crud |
| `npm run test:api:vapt` | **Internal VAPT automation** — smoke auth gates + full automatable security checklist |
| `npm run test:api:all` | full + vapt |
| `npm run postman:verify -- <scenario>` | Single scenario (e.g. `expense-flow`, `vapt`, `rbac`) |
| `npm run postman:verify -- list` | List scenarios / suites |
| `npm run postman:generate` | Rebuild `Aceolution-Finance.postman_collection.json` from the Swagger samples |

## Env

```bash
# default
set BASE_URL=http://localhost:3001

# Azure live (Demo store writes — still use carefully)
set BASE_URL=https://ace-finance-api-f5hnhhd6c3bvffhj.southindia-01.azurewebsites.net
set DEMO_ACCESS_CODE=Aceolution_2024
set TEST_STORE=demo

# Optional
set EXPECT_API_DOCS=true   # only when Swagger is intentionally on (local)
set RUN_THROTTLE=1         # opt-in I01/I02 rate-limit probes (leaves login hot ~1 min)
```

Logins used (seeded accounts) — runner uses **Demo Access** for personas and admin **password → select Demo**:

| Role | Email | Password / path |
|------|-------|-----------------|
| ADMIN | `finance@aceolution.com` | `Admin@1234` → workspace **demo** |
| REQUESTER | `requester.gac@acefinance.com` | Demo Access + `Requester@1234` |
| REQUESTER (peer) | `requester.news@acefinance.com` | Demo Access (IDOR checks) |
| APPROVER | `approver.media@acefinance.com` | Demo Access + `Approver@1234` |
| PROCESSOR | `alisha.processor@acefinance.com` | Demo Access + `Processor@1234` |

### VAPT automation vs human residual

| Layer | Command | Covers |
|-------|---------|--------|
| API | `npm run test:api:vapt` | Authz, IDOR→404, uploads, duplicates, Swagger off, CORS, demo gate, … |
| UI | (frontend) `npm run test:e2e` / `test:e2e:vapt` | A02 headers, B03/B04 gates, Demo Access C03/C05/C07, Microsoft OAuth **start** |

**C04 fresh MFA:** frontend `npm run test:e2e:mfa` with `MS_E2E_PASSWORD` — forces `?prompt=login` and waits for Authenticator number-match (headed).

**Postman collection:** regenerate after API guide changes with `npm run postman:generate` (needs local `nest build`). Live `/api/docs` stays **404** in production — use Postman file or local Swagger with `ENABLE_API_DOCS=true`.

Also in Postman **Authentication**: Microsoft status, List Demo Access accounts, Demo Access login, Select workspace, Check duplicate (Expenses). Catalogs / FX / expense submit require **Bearer**.

Write scenarios submit expenses on project `Google Art and culture (GAC)` (requester must stay assigned to it). Duplicate invoice # / same file → hard 400 (not created).

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

| Page | Path | Live prod |
|------|------|-----------|
| API home | `/` (`/api` redirects here) | OK |
| Swagger UI | `/api/docs` | **404** (disabled) |
| OpenAPI JSON | `/api/docs-json` | **404** (disabled) |
| Health JSON | `/health?format=json` | OK |
| Health page (browser) | `/health` | OK |

- Local (docs on): set `ENABLE_API_DOCS=true` → `http://localhost:3001/api/docs`
- Live: prefer Postman collection + `test:api:vapt`; do not expect Swagger UI

## Warning — shared database

Local API uses a **shared Atlas DB** (`MONGODB_URI` in `.env`). Prefer a dedicated test DB for CI. Do not run `system` / `full` against live casually.

## Pre-push

1. Start API locally (`npm run start:dev`).
2. Run `npm run test:api:system`.
3. Push only if the suite exits 0.
