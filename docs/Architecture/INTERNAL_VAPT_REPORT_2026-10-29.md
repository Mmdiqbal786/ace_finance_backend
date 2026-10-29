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
- Critical: **0** · High: **0** (Swagger fixed) · Medium: **0** · Low: **0** (F-2 fixed in code — retest after API deploy) · Info: **0** (F-3 fixed in code — retest after API deploy)
- Microsoft login **C04** verified end-to-end (Entra password + Authenticator MFA → Choose Workspace → Live dashboard).

## Pre-flight

| ID | Result | Notes |
|----|--------|-------|
| P1 | PASS | Internal run window 2026-10-29 IST (team-owned) |
| P2 | PASS | Live web + API reachable |
| P3 | PASS | CORS ACAO `https://finance.aceolution.com` from credentialed API |
| P4 | PASS | Admin dual Live+Demo workspace; demo-login `store=demo` |
| P5 | PASS | Demo access code accepted by API + demo-guide UI |
| P6 | PASS | `ENABLE_API_DOCS=false`, `NODE_ENV=production`; `/api/docs` → 404 |
| P7 | PASS | Requester / Processor / Admin (Demo) paths used |
| P8 | PASS | Browser + API clients used |
| P9 | PASS | Equivalent REST client used (Postman optional) |

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
| C04 | **PASS** | Full E2E: Entra password + Authenticator number-match MFA → API callback → Choose Workspace → Live `/dashboard/` as REQUESTER (`iqbal@aceolution.com`). Redirect params use short `ms_ok`-style success (no long-lived token in hash). |
| C05 | **PASS** | JWT in `sessionStorage`; not in `localStorage` |
| C06 | **PASS** | Admin Choose Workspace Live+Demo; API isolation live=0 vs demo=39 expenses; bad store → 400 |
| C07 | **PASS** | UI Sign Out → confirm → `/login`; `ace_finance_token` cleared |
| C08 | **PASS** | `workspaceToken` as Bearer → **401**; OTP `challengeToken` (`purpose:login_2fa`) as Bearer → **401** |
| D01–D03 | **PASS** | Demo badge + JWT demo; Live UI pick → **Live** label + JWT `store=live`; counts differ Live vs Demo |
| E01 | **PASS** | Own expense GET → 200 |
| E02 | **PASS** | Peer expense → 403 (pre-fix); post-deploy expect **404** same as missing (F-2) |
| E03 | **PASS** | Approver project scope 403 / 200 as expected |
| E04 | **PASS** | Requester cannot approve/process → 403 |
| E05 | **PASS** | Processor cannot approve → 403; cannot pay PENDING → 400 status guard |
| E06 | **PASS** | Demo Processor list = 39 expenses; Demo Admin list = 39; Demo-scoped only |
| F01 | **PASS** | Valid PDF → 201 |
| F02 | **PASS** | Magic-byte / exe reject → 400 |
| F03 | **PASS** | Oversized → 413 |
| F04 | **PASS** | Own `GET /expenses/:id/invoice` → 200 |
| F05 | **PASS** | Peer invoice → **403**; anon → **401** (peer → **404** after F-2 deploy) |
| G01 | **PASS** | Hard duplicate file → 400 |
| G02 | **PASS** | Matching-details duplicate → 400 (no peer oracle) |
| G03 | **PASS** | Spoofed requester email ignored (JWT-bound) |
| H01 | **PASS** | Admin Demo created `isDemo` requester; non-admin create → **403**; temp user deleted |
| H02 | **PASS** | Requester `/users` → 403 |
| H03 | **PASS** | Seed without secret → 403 |
| I01 | **PASS** | Auth throttle → 429 |
| I02 | **PASS** | Forgot-password → **429** on 6th call; resend-otp → **429** after burst |
| J01 | **PASS** | Credentialed `/auth/me` from app origin → 200; ACAO `https://finance.aceolution.com` |
| J02 | **PASS** | Evil Origin CORS not reflected |

## Findings

### F-1 — Swagger enabled in production
- **Severity:** High → **Fixed** (App Settings + restart; code gate `api-docs-enabled.ts`)

### F-2 — Authenticated expense ID existence oracle (403 vs 404)
- **Severity:** Low → **Fixed in code** (`findOneForViewer` / invoice+receipt load return same 404 as missing)
- **Status:** Pending live retest after API deploy (pre-deploy peer=403, missing=404)

### F-3 — Demo-guide error mentions `X-Demo-Access-Code`
- **Severity:** Info → **Fixed in code** (generic unlock message in `demo-access.util.ts`)
- **Status:** Pending live retest after API deploy (pre-deploy still named header)

## Residual (not a checklist N/A)

- None for checklist coverage. After API deploy: retest F-2 (peer GET → 404) and F-3 (wrong code message without header name).

## Retest log

| Date | IDs | Result |
|------|-----|--------|
| 2026-10-29 | Core auth/RBAC/headers/Swagger | PASS |
| 2026-10-29 | F/G uploads & duplicates, E05, C05 | PASS |
| 2026-10-29 | C04 redirect, C06 picker | PASS |
| 2026-10-29 | C07 logout, C08 purpose JWT, F04/F05 invoice IDOR, D Live UI | PASS |
| 2026-10-29 | C04 full Microsoft MFA → workspace → Live dashboard | PASS |
| 2026-10-29 | E06, H01, I02, J01 + pre-flight P1/P3/P4/P7/P9 | PASS |
| 2026-10-29 | F-2 / F-3 code fixes | Pending deploy retest |

## Sign-off

- Tester: Iqbal Ahamed _____________ Date: 2026-10-29
- Manager (optional): _____________ Date: _____________

**Disclaimer:** Internal security verification only. Not a third-party certified penetration test.

## Evidence location

`vapt-evidence/2026-10-29-internal-vapt/` (local; do not commit secrets/tokens)
