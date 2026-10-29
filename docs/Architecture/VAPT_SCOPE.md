# Aceolution Finance — VAPT scope & engagement brief

Last updated: 2026-10-28  
Owner: Aceolution Finance team  
Related: [`AUTH_LIVE_DEMO_STORES.md`](./AUTH_LIVE_DEMO_STORES.md) · [`INTERNAL_VAPT_CHECKLIST.md`](./INTERNAL_VAPT_CHECKLIST.md) (runbook if no vendor) · Microsoft [Cloud Unified Penetration Testing Rules of Engagement](https://www.microsoft.com/en-us/msrc/pentest-rules-of-engagement)

## 1. Targets (in scope)

| Asset | URL |
|-------|-----|
| Web (Azure Static Web Apps) | https://finance.aceolution.com/ |
| API (Azure App Service) | https://ace-finance-api-f5hnhhd6c3bvffhj.southindia-01.azurewebsites.net/ |
| API health | https://ace-finance-api-f5hnhhd6c3bvffhj.southindia-01.azurewebsites.net/health |
| Swagger (if enabled on env) | https://ace-finance-api-f5hnhhd6c3bvffhj.southindia-01.azurewebsites.net/api/docs |
| Demo / docs guides (password-gated) | https://finance.aceolution.com/demo-guide/ · `/docs-guide/` · `/architecture/` |

**Hosting note:** Customer testing of *your* Azure App Service / web apps does **not** require Microsoft pre-approval, but **must** follow Microsoft ROE (no DoS, no other tenants, no Microsoft infrastructure attacks).

## 2. Application model (tester briefing)

- **Microsoft-first login:** Sign in with Microsoft · Demo Access · Use password instead  
- **Live vs Demo isolation:** separate MongoDB DBs (`ace_finance` / `ace_finance_demo`) + Azure blob containers; JWT `store` claim (`live` \| `demo`)  
- **Workspace picker:** same email in both stores → Choose Live/Demo (role shown per store)  
- **Roles:** `ADMIN` · `APPROVER` · `PROCESSOR` · `REQUESTER` (Requester/Approver project-scoped via `assignedProjects`)  
- **Duplicate invoices:** hard block at submit (same file hash / invoice # — request not created); soft “potential duplicate” warning needs confirm  

Prefer **Demo Access** / **Demo workspace** for destructive tests. Keep Live read-mostly with agreed test accounts only.

## 3. Hardening already applied (re-test after deploy)

- CORS allowlist (`FRONTEND_URL` + optional `CORS_ORIGINS`) — not `*`; localhost not allowed in production; `credentials: true` for httpOnly cookies  
- Helmet on API; SWA `staticwebapp.config.json` security headers + CSP (frontend)  
- Global rate limit + stricter `@Throttle` on login / OTP / forgot-reset / demo / seed / guide-pack  
- `ValidationPipe` + class-validator on auth + expense body DTOs  
- Session: httpOnly cookie `ace_af_token` (SameSite=None in prod cross-site) **or** Bearer; FE does **not** store JWT in `localStorage`  
- Microsoft callback sets cookie and redirects `?ms_ok=1` (no access token in URL); legacy `#ms_token` only for older builds  
- `POST /expenses` requires JWT; requester email bound from token; ACL/catalogs validated before Azure upload; orphan blob cleanup on failure  
- Upload MIME/ext filter **plus** magic-byte check (PDF/JPEG/PNG/GIF/WEBP)  
- `GET /expenses` + stats: REQUESTER = own only; APPROVER = assigned projects; ADMIN/PROCESSOR = all  
- Invoice / payment-receipt / delete ACL via `assertCanViewExpense`  
- `GET /expenses/:id` requires JWT + ACL — **no anonymous public track** (no status/existence oracle)  
- Duplicate messages generic (no peer name/id oracle)  
- JWT strategy rejects challenge / `ms_oauth` / `workspace_choice` tokens as Bearer sessions  
- Demo guide unlock via `POST /auth/verify-demo-access` (code not in JS bundle; never `NEXT_PUBLIC_*`)  
- Guide passwords via `GET /auth/demo-guide-pack` only with `X-Demo-Access-Code` (not baked into FE)  
- Demo Access requires access code + persona password  
- Catalogs `/active` + FX convert require JWT; Swagger off in production unless `ENABLE_API_DOCS=true`  
- Health JSON: `status` / `service` / `timestamp` only (no store topology)  
- Forgot-password + password login: no Microsoft / inactive / existence enumeration  
- `POST /auth/seed` requires `X-Seed-Secret` + throttle; prod boot seed skipped unless `ALLOW_BOOT_SEED=true`  
- Boot assert: live ≠ demo Mongo URI and blob containers  
- Architecture PDF not published as a public static URL (`/architecture/*` → 404 on SWA)

## 4. In-scope test themes

1. Authn / authz — Microsoft OAuth callback, JWT, password + OTP/TOTP, forgot-password (password accounts only)  
2. Demo Access (`GET /auth/demo-accounts`, `POST /auth/demo-login`) — session must stay in demo store; access-code gate  
3. Workspace choice (`POST /auth/select-workspace`) — no cross-store data leakage  
4. Role & project RBAC — approver cannot see other projects; requester cannot approve/pay  
5. IDOR on expenses, invoices, payment receipts  
6. File upload / download (type, size, path traversal, auth on blobs)  
7. Admin user management — `isDemo` / Demo Access toggle  
8. Duplicate-detection bypass attempts (hard vs soft)  
9. Security headers, CORS, httpOnly cookie session + credentialed CORS  
10. Information disclosure (errors, Swagger, health, guides gate, demo-guide-pack)  
11. Rate limiting / auth brute-force resistance  
12. File magic-byte / content-type spoofing  
13. Anonymous expense ID enumeration (expect 401, not status leak)  

## 5. Out of scope

- Denial of service / flood / stress that affects Azure shared capacity  
- Attacks on other Azure customers, Microsoft control plane, or Entra tenant outside Aceolution’s app registration  
- Social engineering of Aceolution staff outside agreed channels  
- Use of real employee PII beyond the agreed test accounts  
- Physical / wireless / source-code review unless separately contracted  

## 6. Test windows & contacts

| Item | Value |
|------|--------|
| Proposed window | _[fill: dates / IST hours]_ |
| Primary contact | _[fill: name, email, phone]_ |
| Escalation | _[fill]_ |
| Emergency stop | Email/call primary — testing pauses immediately |

Please send source IPs (or ranges) used for scanning **before** the window starts.

## 7. Access for testers

- App + API URLs above (no VPN required)  
- Demo guide access code: shared separately by Aceolution (same as client demo guide; set as `DEMO_ACCESS_CODE` on API)  
- Test accounts: shared separately (prefer Demo Access personas for write tests)  
- Postman collection (optional): `ace_finance_backend/postman/Aceolution-Finance.postman_collection.json`  

## 8. Deliverables expected from vendor

1. Executive summary  
2. Findings with severity (CVSS or agreed scale), evidence, reproduction steps  
3. Affected URL/endpoint and recommended fix  
4. Retest after remediation (optional second phase)  

## 9. Pre-flight (Aceolution — before kickoff)

- [ ] **Commit + push + deploy** latest FE+BE security hardening (cookie session, throttles, no public expense track, demo-guide-pack)  
- [ ] Frontend SWA build has **no** `NEXT_PUBLIC_DEMO_GUIDE_ACCESS_PASSWORD`  
- [ ] API `FRONTEND_URL=https://finance.aceolution.com` (required for cookie SameSite / CORS)  
- [ ] API deployed with `MONGODB_URI` + `MONGODB_URI_DEMO` and live + demo blob containers  
- [ ] `DEMO_ACCESS_CODE` set on API; `SEED_SECRET` unset or rotated after seed; `ENABLE_API_DOCS` not true in prod  
- [ ] `GET /health?format=json` → `status: ok` (no store names)  
- [ ] After Microsoft login, land on `?ms_ok=1` and stay signed in (cookie); DevTools Application shows no `ace_finance_token` in localStorage  
- [ ] Demo Access list loads on `/login/` (with access code); guide accounts load only after unlock  
- [ ] Unauthenticated `GET /expenses/{id}` → 401 (not a public status body)  
- [ ] Admin can Choose Live / Demo; Demo badge visible  
- [ ] Microsoft login works for a test `@aceolution.*` account (if in scope)  
- [ ] Vendor IPs allowlisted only if WAF/App Gateway rules require it  
- [ ] Stakeholders notified of test window  

## 9. Copy-paste scope one-liner

> VAPT of Aceolution Finance web + API on Azure (finance.aceolution.com and the southindia App Service API), covering auth (Microsoft / Demo Access / password / workspace), Live–Demo store isolation, RBAC/project scope, expense IDOR, file handling, admin Demo Access controls, and duplicate-invoice controls — excluding DoS and Microsoft ROE-prohibited activities; destructive testing preferred on Demo store.
