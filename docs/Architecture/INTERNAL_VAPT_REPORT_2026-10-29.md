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
- Critical: **0** · High: **0** (Swagger fixed) · Medium: **0** · Low: **0** · Info: **0**
- Microsoft login **C04** verified end-to-end (Entra password + Authenticator MFA → Choose Workspace → Live dashboard), including automated fresh challenge via `?prompt=login` (`npm run test:e2e:mfa`, 2026-10-30).
- Automated retest: backend `npm run test:api:vapt` · frontend `npm run test:e2e` + `test:e2e:mfa` (Playwright). Postman collection + docs-guide VAPT notes refreshed for JWT-gated catalogs/FX and Swagger-off prod. No residual gaps.

### Closure status (this run)

| Check | Status |
|-------|--------|
| Checklist IDs marked **N/A** | **0** — every in-scope ID is **PASS** |
| Open findings waiting on a fix | **0** — F-1 / F-2 / F-3 are **Fixed** + live retest **PASS** |
| Unfinished security items | **0** — residual **None** |

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
| C04 | **PASS** | Full E2E: Entra password + Authenticator number-match MFA → API callback → Choose Workspace → Live `/dashboard/` as REQUESTER (`iqbal@aceolution.com`). Redirect params use short `ms_ok`-style success (no long-lived token in hash). Automated retest 2026-10-30: `GET /auth/microsoft/login?prompt=login` + headed `npm run test:e2e:mfa` → Authenticator number-match → Live dashboard (**PASS**). |
| C05 | **PASS** | JWT in `sessionStorage`; not in `localStorage` |
| C06 | **PASS** | Admin Choose Workspace Live+Demo; API isolation live=0 vs demo=39 expenses; bad store → 400 |
| C07 | **PASS** | UI Sign Out → confirm → `/login`; `ace_finance_token` cleared |
| C08 | **PASS** | `workspaceToken` as Bearer → **401**; OTP `challengeToken` (`purpose:login_2fa`) as Bearer → **401** |
| D01–D03 | **PASS** | Demo badge + JWT demo; Live UI pick → **Live** label + JWT `store=live`; counts differ Live vs Demo |
| E01 | **PASS** | Own expense GET → 200 |
| E02 | **PASS** | Peer expense → **404** (same as missing; F-2 fix live) |
| E03 | **PASS** | Approver project scope 403 / 200 as expected |
| E04 | **PASS** | Requester cannot approve/process → 403 |
| E05 | **PASS** | Processor cannot approve → 403; cannot pay PENDING → 400 status guard |
| E06 | **PASS** | Demo Processor list = 39 expenses; Demo Admin list = 39; Demo-scoped only |
| F01 | **PASS** | Valid PDF → 201 |
| F02 | **PASS** | Magic-byte / exe reject → 400 |
| F03 | **PASS** | Oversized → 413 |
| F04 | **PASS** | Own `GET /expenses/:id/invoice` → 200 |
| F05 | **PASS** | Peer invoice → **404**; anon → **401** |
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
- **Severity:** Low → **Fixed** (`findOneForViewer` / invoice+receipt → same **404** as missing)
- **Status:** Retest PASS on live (`59c5d68` Active) — peer GET + invoice **404**, missing **404**

### F-3 — Demo-guide error mentions `X-Demo-Access-Code`
- **Severity:** Info → **Fixed** (generic unlock message in `demo-access.util.ts`)
- **Status:** Retest PASS on live — wrong code returns unlock message **without** header name

## Residual (not a checklist N/A)

- **None.** No open N/A rows. No unfinished security item waiting on another fix.
- Fresh Entra MFA each CI/local run needs a human Authenticator tap by design (`prompt=login`); covered by headed `npm run test:e2e:mfa` (PASS 2026-10-30). That is expected Entra behavior, not a product or test gap.

## Retest log

| Date | IDs | Result |
|------|-----|--------|
| 2026-10-29 | Core auth/RBAC/headers/Swagger | PASS |
| 2026-10-29 | F/G uploads & duplicates, E05, C05 | PASS |
| 2026-10-29 | C04 redirect, C06 picker | PASS |
| 2026-10-29 | C07 logout, C08 purpose JWT, F04/F05 invoice IDOR, D Live UI | PASS |
| 2026-10-29 | C04 full Microsoft MFA → workspace → Live dashboard | PASS |
| 2026-10-29 | E06, H01, I02, J01 + pre-flight P1/P3/P4/P7/P9 | PASS |
| 2026-10-29 | F-2 / F-3 live retest after `59c5d68` | PASS |
| 2026-10-30 | C04 forced `prompt=login` + Authenticator → Live dashboard (`test:e2e:mfa`) | PASS |

## Sign-off

- Tester: Iqbal Ahamed _____________ Date: 2026-10-29 (MFA automation close-out 2026-10-30)
- Manager (optional): _____________ Date: _____________

**Disclaimer:** Internal security verification only. Not a third-party certified penetration test.

## Evidence location

`vapt-evidence/2026-10-29-internal-vapt/` (local; do not commit secrets/tokens)
