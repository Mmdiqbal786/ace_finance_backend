# Aceolution Finance — Internal VAPT report

| Field | Value |
|-------|--------|
| Date (IST) | 2026-10-29 |
| Tester | Iqbal Ahamed (assisted run) |
| Reviewer (optional) | |
| Build / deploy notes | Live FE `finance.aceolution.com` + API southindia App Service |
| Scope | Web + API per `VAPT_SCOPE.md` / `INTERNAL_VAPT_CHECKLIST.md` |
| Store used | **Demo** (primary API tests) |
| Vendor | None — internal verification |

## Executive summary

- **Overall:** Ready for internal sign-off after Swagger fix (retested).
- Critical: **0** · High: **0** (A03 fixed) · Medium: **0** · Low: **1** · Info: **2**
- Auth gates, anonymous expense access, catalog/FX JWT requirements, Demo Access code, RBAC/IDOR, requester cannot approve/pay, admin users API blocked for requester, security headers, health payload, forgot-password generic messaging, and rate limiting behaved as designed.
- **Fixed 2026-10-29:** Azure App Settings `ENABLE_API_DOCS=false` + `NODE_ENV=production`; API restarted; `GET /api/docs` → **404**. Code hardened so Azure stays docs-off unless explicitly enabled.

## Pre-flight

| ID | Result | Notes |
|----|--------|-------|
| P2 | PASS | Live web + API reachable |
| P5 | PASS | Demo access code accepted by API + demo-guide UI |
| P6 | **PASS** | Retest: `ENABLE_API_DOCS=false`, `NODE_ENV=production`; `/api/docs` → 404 |
| P8 | PASS | Browser + API clients used |

## Results

| ID | Result | Evidence / notes |
|----|--------|------------------|
| A01 | **PASS** | `GET /health?format=json` → keys `status,service,timestamp` only; `status=ok` |
| A02 | **PASS** | Web response: CSP present, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, HSTS present |
| A03 | **PASS** | Retest after fix: `GET /api/docs` → **404**; health still `ok` |
| B01 | **PASS** | Unauthenticated `GET /expenses/{id}` → **401** |
| B02 | **PASS** | `/projects/active`, `/categories/active`, `/countries/active`, FX → **401** without JWT |
| B03 | **PASS** | Demo guide shows password gate; wrong code rejected; correct code unlocks content. API: demo-accounts without code **401**; guide-pack without header **401** |
| B04 | **INFO** | `/docs-guide/` loads (gated via demo unlock flow). `/architecture/` and architecture PDF → **404** on SWA (PDF not public — OK; confirm intentional if architecture *page* should open after unlock) |
| B05 | **PASS** | Forgot-password unknown vs known demo email → same **201** generic message |
| C01 | **PASS** | Password login unknown vs known-bad → both **401**, identical generic body |
| C02 | **PASS** | `verify-demo-access` wrong code **401**; correct code **201** `{ok:true}` |
| C03 | **PASS** | `demo-login` with access code → **201**, JWT `store:"demo"`, `isDemo:true` |
| C05 | **N/A** | Browser DevTools localStorage not fully audited this run (API uses Bearer `access_token`) |
| C06 | **N/A** | Dual-store workspace picker not exercised (Demo Access personas) |
| C07 | **N/A** | Logout UI not run |
| C08 | **N/A** | Challenge-token misuse not run |
| D01–D03 | **PASS** (partial) | Demo JWT claims `store=demo`; expense list for Demo requester only `@acefinance.com` personas; no Live switch test this run |
| E01 | **PASS** | Own expense `GET /expenses/EXP-…` → **200** |
| E02 | **PASS** | Other requester → **403** (no body leak) |
| E03 | **PASS** | Approver Systems on GAC expense → **403**; Approver Media (has GAC) → **200** |
| E04 | **PASS** | Requester `PATCH .../approve` and `.../process` → **403** |
| E05–E06 | **N/A** | Processor pay path / admin breadth not fully run |
| F01–F05 | **N/A** | Upload/download magic-byte tests not run this pass (manual follow-up) |
| G01–G03 | **N/A** | Duplicate submit not re-run (existing demo data shows hard/soft duplicate fields present) |
| H02 | **PASS** | Requester `GET /users` → **403** |
| H03 | **PASS** | `POST /auth/seed` without secret → **403** |
| I01 | **PASS** | Repeated `demo-login` / auth traffic → **429** ThrottlerException |
| J02 | **PASS** | OPTIONS from `evil.example` → **204**, no `Access-Control-Allow-Origin` echo |

## Findings

### F-1 — Swagger / OpenAPI UI enabled in production
- **Severity:** High
- **ID(s):** A03, P6
- **Evidence:** `GET https://ace-finance-api-…/api/docs` returns **200** with Swagger UI
- **Risk:** Attack surface documentation (routes, schemas, examples) exposed publicly
- **Recommendation:** Ensure `ENABLE_API_DOCS` is unset/false on App Service; confirm docs route disabled; redeploy; retest A03 → expect 404/unavailable
- **Status:** **Fixed** (2026-10-29) — App Settings + restart; code gate hardened in `api-docs-enabled.ts` (deploy on next BE push)

### F-2 — Authenticated expense ID existence oracle (404 vs 403)
- **Severity:** Low
- **ID(s):** E02 vs missing id
- **Evidence:** Peer/valid expense → **403**; nonexistent `EXP-…` → **404`
- **Risk:** Authenticated users can distinguish existing vs non-existing expense IDs (no data body on 403)
- **Recommendation:** Optionally normalize unauthorized + missing to the same status (e.g. always 404) after ACL
- **Status:** Open (accept risk or fix later)

### F-3 — Demo-guide error text mentions `X-Demo-Access-Code`
- **Severity:** Info
- **ID(s):** B03
- **Evidence:** Wrong unlock password UI message references header name
- **Risk:** Minor implementation detail disclosure
- **Recommendation:** Soften copy to “Invalid access password”
- **Status:** Open (optional)

### F-4 — `/architecture/` returns 404 on live SWA
- **Severity:** Info
- **ID(s):** B04
- **Evidence:** `/architecture`, `/architecture/`, PDF path → 404 (aligns with “PDF not public”; confirm Next architecture page routing)
- **Recommendation:** If product expects gated `/architecture/` page, fix SWA rewrite; if intentional block, update VAPT/docs wording
- **Status:** Open (clarify)

## Not tested this run (follow-up)

- File upload type/size/magic bytes (F*)
- Hard/soft duplicate create flows (G*)
- Microsoft OAuth callback / Live workspace switch (C04, C06, D full)
- Processor payment ACL (E05)
- Token storage DevTools walkthrough (C05)
- Full CORS credentialed cross-origin from browser console (J01 spot only)

## Retest log

| Date | IDs | Result |
|------|-----|--------|
| 2026-10-29 | A01–A02, B01–B03, B05, C01–C03, E01–E04, H02–H03, I01, J02 | PASS |
| 2026-10-29 | A03 after `ENABLE_API_DOCS=false` + restart | **PASS** (404) |

## Sign-off

- Tester: Iqbal Ahamed _____________ Date: 2026-10-29
- Manager (optional): _____________ Date: _____________

**Disclaimer:** Internal security verification only. Not a third-party certified penetration test.

## Evidence location

Private/local folder (do not commit secrets): `vapt-evidence/2026-10-29-internal-vapt/`  
Raw API snips may contain tokens — treat as confidential; rotate demo session by waiting for JWT expiry if needed.
