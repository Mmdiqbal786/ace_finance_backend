# Aceolution Finance — Internal VAPT report

| Field | Value |
|-------|--------|
| Date (IST) | 2026-10-29 |
| Tester | Iqbal Ahamed (assisted run) |
| Reviewer (optional) | |
| Build / deploy notes | Live FE `finance.aceolution.com` + API southindia App Service |
| Scope | Web + API per `VAPT_SCOPE.md` / `INTERNAL_VAPT_CHECKLIST.md` |
| Store used | Demo + Live (Admin workspace picker) |
| Vendor | None — internal verification |

## Executive summary

- **Overall:** **Complete** for internal sign-off — all checklist IDs exercised; **no remaining N/A**.
- Critical: **0** · High: **0** (Swagger fixed) · Medium: **0** · Low: **1** (accept or fix later) · Info: **1** (optional copy tweak)
- **Only human residual:** finishing Microsoft **password + MFA** after Entra redirect (C04 redirect itself **PASS**). Automation cannot complete company MFA.

## Pre-flight

| ID | Result | Notes |
|----|--------|-------|
| P2 | PASS | Live web + API reachable |
| P5 | PASS | Demo access code accepted by API + demo-guide UI |
| P6 | PASS | `ENABLE_API_DOCS=false`, `NODE_ENV=production`; `/api/docs` → 404 |
| P8 | PASS | Browser + API clients used |

## Results

| ID | Result | Evidence / notes |
|----|--------|------------------|
| A01 | **PASS** | Health JSON keys only `status,service,timestamp` |
| A02 | **PASS** | CSP, `X-Frame-Options: DENY`, `nosniff`, HSTS |
| A03 | **PASS** | `/api/docs` → **404** after App Setting fix |
| B01 | **PASS** | Anon expense GET → **401** |
| B02 | **PASS** | Catalogs + FX without JWT → **401** |
| B03 | **PASS** | Demo-guide gate; wrong code rejected; API pack gated |
| B04 | **PASS** | `/architecture/*` → **404** by design (`staticwebapp.config.json`); architecture covered via gated docs/demo guides |
| B05 | **PASS** | Forgot-password generic for unknown vs known |
| C01 | **PASS** | Bad password login generic **401** |
| C02 | **PASS** | Demo access verify wrong/right codes |
| C03 | **PASS** | Demo-login JWT `store:demo` |
| C04 | **PASS** | Microsoft button / `GET /auth/microsoft/login` → **302** Entra authorize (correct tenant, client_id, prod callback, `ms_oauth` state). Browser lands on Microsoft Sign-in. *MFA completion = staff only* |
| C05 | **PASS** | JWT in `sessionStorage`; not in `localStorage` |
| C06 | **PASS** | Admin Choose Workspace Live+Demo; API isolation live=0 vs demo=39 expenses; bad store → 400 |
| C07 | **PASS** | UI Sign Out → confirm → `/login`; `ace_finance_token` cleared |
| C08 | **PASS** | `workspaceToken` as Bearer → **401**; OTP `challengeToken` (`purpose:login_2fa`) as Bearer → **401** |
| D01–D03 | **PASS** | Demo badge + JWT demo; Live UI pick → **Live** label + JWT `store=live`; counts differ Live vs Demo |
| E01 | **PASS** | Own expense GET → 200 |
| E02 | **PASS** | Peer expense → 403 |
| E03 | **PASS** | Approver project scope 403 / 200 as expected |
| E04 | **PASS** | Requester cannot approve/process → 403 |
| E05 | **PASS** | Processor cannot approve → 403; cannot pay PENDING → 400 status guard |
| F01 | **PASS** | Valid PDF → 201 |
| F02 | **PASS** | Magic-byte / exe reject → 400 |
| F03 | **PASS** | Oversized → 413 |
| F04 | **PASS** | Own `GET /expenses/:id/invoice` → 200 |
| F05 | **PASS** | Peer invoice → **403**; anon → **401** |
| G01 | **PASS** | Hard duplicate file → 400 |
| G02 | **PASS** | Matching-details duplicate → 400 (no peer oracle) |
| G03 | **PASS** | Spoofed requester email ignored (JWT-bound) |
| H02 | **PASS** | Requester `/users` → 403 |
| H03 | **PASS** | Seed without secret → 403 |
| I01 | **PASS** | Auth throttle → 429 |
| J02 | **PASS** | Evil Origin CORS not reflected |

## Findings

### F-1 — Swagger enabled in production
- **Severity:** High → **Fixed** (App Settings + restart; code gate `api-docs-enabled.ts`)

### F-2 — Authenticated expense ID existence oracle (403 vs 404)
- **Severity:** Low
- **Status:** Open (accept risk) — no data body on 403

### F-3 — Demo-guide error mentions `X-Demo-Access-Code`
- **Severity:** Info
- **Status:** Open (optional copy soften)

## Residual (not a checklist N/A)

- Staff completes one Microsoft MFA login end-to-end if a screenshot of post-callback session is required for auditors.

## Retest log

| Date | IDs | Result |
|------|-----|--------|
| 2026-10-29 | Core auth/RBAC/headers/Swagger | PASS |
| 2026-10-29 | F/G uploads & duplicates, E05, C05 | PASS |
| 2026-10-29 | C04 redirect, C06 picker | PASS |
| 2026-10-29 | C07 logout, C08 purpose JWT, F04/F05 invoice IDOR, D Live UI | PASS |

## Sign-off

- Tester: Iqbal Ahamed _____________ Date: 2026-10-29
- Manager (optional): _____________ Date: _____________

**Disclaimer:** Internal security verification only. Not a third-party certified penetration test.

## Evidence location

`vapt-evidence/2026-10-29-internal-vapt/` (local; do not commit secrets/tokens)
