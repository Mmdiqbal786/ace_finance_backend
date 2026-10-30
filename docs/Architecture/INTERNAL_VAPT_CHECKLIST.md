# Aceolution Finance — Internal VAPT checklist & documentation guide

Last updated: 2026-10-29  
Owner: Aceolution Finance team  
Related: [`VAPT_SCOPE.md`](./VAPT_SCOPE.md) · [`AUTH_LIVE_DEMO_STORES.md`](./AUTH_LIVE_DEMO_STORES.md) · [`BACKUP_AND_RESTORE.md`](./BACKUP_AND_RESTORE.md)

> **What this is:** Step-by-step **internal security verification** you can run without a third-party vendor.  
> **What this is not:** A certified external penetration test. Say “internal VAPT / security verification” to management. Hire a vendor later if a client/audit needs a formal certificate.

---

## 1. Rules before you start

| Do | Don’t |
|----|--------|
| Prefer **Demo** workspace / Demo Access for create/approve/pay tests | DoS, flood, stress Azure shared capacity |
| Use agreed test accounts only | Attack other Aceolution apps or Azure tenants |
| Record pass/fail + screenshot/note for each ID | Put real employee PII in test data |
| Pause if Live data is at risk — escalate | Social-engineer staff outside agreed channels |
| Follow [Microsoft cloud pen-test ROE](https://www.microsoft.com/en-us/msrc/pentest-rules-of-engagement) | Probe Microsoft control plane / Entra outside our app |

**Backup ≠ VAPT.** Backup = recover data. VAPT = test the **web + API** for security gaps. Azure Portal IAM / Backup vault are out of this checklist (ops), except where the **app** exposes files/data.

---

## 2. Targets (copy into your report)

| Asset | URL |
|-------|-----|
| Web | https://finance.aceolution.com/ |
| API | https://ace-finance-api-f5hnhhd6c3bvffhj.southindia-01.azurewebsites.net/ |
| Health | https://ace-finance-api-f5hnhhd6c3bvffhj.southindia-01.azurewebsites.net/health |
| Demo guide | https://finance.aceolution.com/demo-guide/ |
| Docs guide | https://finance.aceolution.com/docs-guide/ |

Swagger: only if enabled (`ENABLE_API_DOCS=true`). Prefer **off** in production.

---

## 3. How to document (do this every run)

### 3.1 Folder layout (local — do not commit secrets)

```text
vapt-evidence/
  YYYY-MM-DD-internal-vapt/
    00-report.md                 ← filled report (section 6)
    screenshots/
      A01-health.png
      A02-anon-expense-401.png
      ...
    notes.txt                    ← freeform notes / API status codes
```

Keep evidence on your machine or a private OneDrive folder. **Do not** commit passwords, tokens, or `DEMO_ACCESS_CODE` to git.

### 3.2 Result marks

| Mark | Meaning |
|------|---------|
| **PASS** | Expected secure behaviour observed |
| **FAIL** | Unexpected access, leak, or missing control |
| **N/A** | Not applicable this run (say why) |
| **BLOCKED** | Could not test (missing account / env) |

For each FAIL: severity (**Critical / High / Medium / Low / Info**), short evidence, recommended fix, owner, status (Open / Fixed / Retest).

### 3.3 Evidence naming

`{ID}-{short-slug}.png` — e.g. `B03-demo-without-code.png`

---

## 4. Pre-flight (15–30 min)

Complete before checklist execution. Tick in the report.

- [ ] P1 — Stakeholders told of test window (date/time IST)
- [ ] P2 — Latest FE + BE security build is **live** (finance.aceolution.com + API)
- [ ] P3 — API `FRONTEND_URL=https://finance.aceolution.com`
- [ ] P4 — Live + Demo Mongo + blob containers configured; boot asserts distinct stores
- [ ] P5 — `DEMO_ACCESS_CODE` set on API; guide password **not** in frontend env as `NEXT_PUBLIC_*`
- [ ] P6 — `ENABLE_API_DOCS` not true in prod (or note if temporarily on)
- [ ] P7 — Test accounts ready (Admin / Approver / Processor / Requester) — prefer **Demo**
- [ ] P8 — Browser: normal window + one private window (for “logged out” checks)
- [ ] P9 — Optional: Postman collection smoke (`ace_finance_backend/postman/`)

---

## 5. Checklist — how to run each item

Use **Demo** unless the row says Live. Replace `{expenseId}` with a real Demo expense id you create.

### A — Health, disclosure, headers

| ID | Check | Steps | Pass if |
|----|--------|-------|---------|
| A01 | Health JSON minimal | Browser or curl: `GET .../health?format=json` | Body has `status` / `service` / `timestamp` only — **no** Mongo/store topology |
| A02 | Security headers (web) | DevTools → Network → document for `/` → Response headers | Sensible CSP / frame / XSS-related headers present (SWA config) |
| A03 | Swagger off in prod | Open `.../api/docs` | 404 / unavailable unless intentionally enabled |

### B — Anonymous / unauthenticated

| ID | Check | Steps | Pass if |
|----|--------|-------|---------|
| B01 | Expense by id (no login) | Logged out → `GET /expenses/{id}` (API or crafted URL) | **401** — no status/existence detail |
| B02 | Catalogs / FX without JWT | Logged out → `/projects/active`, `/categories/active`, `/countries/active`, FX convert | **401** |
| B03 | Demo guide without code | Open `/demo-guide/` → try unlock without / wrong code | Blocked; no account list |
| B04 | Docs / architecture gate | Open `/docs-guide/`, `/architecture/` without unlock | Gated or redirect to unlock flow |
| B05 | Forgot-password enumeration | Submit unknown + known emails (password accounts) | Same generic success/message pattern — no “user exists” |

### C — Authentication

| ID | Check | Steps | Pass if |
|----|--------|-------|---------|
| C01 | Password login bad creds | Wrong password on password account | Generic error; no user/Microsoft hint leak |
| C02 | Demo Access needs code + password | Demo Access with missing/wrong code | Rejected |
| C03 | Demo Access success | Valid code + persona | Lands in **Demo** workspace / badge |
| C04 | Microsoft login (if in scope) | Sign in with `@aceolution.*` test user | Session works; URL not leaving long-lived token in hash for current build (`?ms_ok=1` style) |
| C05 | Token storage | DevTools → Application | **No** JWT in `localStorage` as primary session; cookie and/or sessionStorage per design |
| C06 | Workspace choice | Account in Live + Demo → Choose Live vs Demo | Correct store; no cross mix of expenses |
| C07 | Logout | Logout → hit API with old session | Unauthorized |
| C08 | Challenge tokens as Bearer | If you capture a 2FA/challenge response token, do **not** use it as a normal session | API rejects challenge / workspace_choice style tokens as Bearer |

### D — Live vs Demo isolation

| ID | Check | Steps | Pass if |
|----|--------|-------|---------|
| D01 | Demo create not in Live | Demo: create expense → switch Live → search that invoice # / id | Not visible in Live |
| D02 | Live not writable via Demo session | Stay Demo session; confirm APIs stay demo-scoped (Demo badge; demo data only) | No Live rows in Demo lists |
| D03 | Blobs isolation | Open invoice attachment in Demo | URL/content is demo container data only |

### E — RBAC / IDOR (Demo)

| ID | Check | Steps | Pass if |
|----|--------|-------|---------|
| E01 | Requester own only | Requester A list + open own expense | OK |
| E02 | Requester peer expense | Requester A opens Requester B expense id (API/UI) | Denied / not found — no full peer record |
| E03 | Approver project scope | Approver for project X opens expense on project Y | Denied |
| E04 | Requester cannot approve/pay | Requester calls approve / process actions | **403** |
| E05 | Approver cannot process pay | Approver tries processor pay actions | **403** (unless role allows) |
| E06 | Admin / Processor breadth | Admin or Processor list | Sees allowed Demo set; still Demo-only |

### F — Uploads & files (Demo)

| ID | Check | Steps | Pass if |
|----|--------|-------|---------|
| F01 | Allowed types | Upload valid PDF/JPEG/PNG within size limit | Accepted |
| F02 | Bad extension / type | Upload disallowed type (e.g. `.exe` / mismatched content) | Rejected (MIME/ext and/or magic bytes) |
| F03 | Oversized file | File over max (5 MB) | Rejected |
| F04 | Download ACL | User without view rights tries invoice/receipt URL or API | Denied |
| F05 | Path / id tampering | Change expense id or file id in download request to another user’s | Denied |

### G — Business rules (Demo)

| ID | Check | Steps | Pass if |
|----|--------|-------|---------|
| G01 | Hard duplicate | Resubmit same invoice file hash / same invoice # | Hard block; request not created |
| G02 | Soft duplicate | Trigger potential-duplicate path | Warning + confirm required; no peer name/id oracle in message |
| G03 | Submit binds requester | Create expense as Requester | Email/user from token — cannot spoof another requester via body |

### H — Admin & Demo Access controls (Demo)

| ID | Check | Steps | Pass if |
|----|--------|-------|---------|
| H01 | Create user / Demo flag | Admin creates user; Demo Access toggle if applicable | Behaves per product rules; Demo users stay demo |
| H02 | Non-admin user admin APIs | Requester hits user-admin endpoints | **403** |
| H03 | Seed endpoint | `POST /auth/seed` without secret | Rejected / throttled |

### I — Rate limiting (careful — few attempts only)

| ID | Check | Steps | Pass if |
|----|--------|-------|---------|
| I01 | Login throttle | ~10–20 failed logins in a short window (stop early) | **429** or clear throttle — **do not** continue flooding |
| I02 | OTP / forgot throttle | Few rapid resend/forgot calls | Throttled |

### J — CORS / session (spot check)

| ID | Check | Steps | Pass if |
|----|--------|-------|---------|
| J01 | Credentialed API from app origin | Normal use from finance.aceolution.com | Works |
| J02 | Random origin | From browser console on another origin, credentialed call to API (or note preflight) | Blocked / no `*` with credentials |

---

## 6. Execution steps (day-of runbook)

1. Fill **Section 4** pre-flight; create evidence folder.  
2. Run **A → B** logged out (private window).  
3. Unlock Demo guide; log in as **Requester (Demo)** → **C, D, E, F, G**.  
4. Switch roles (Approver → Processor → Admin) for remaining **E / H**.  
5. Light **I** only (no DoS).  
6. Spot **J**.  
7. Fill report (below); list FAILs with severity.  
8. Fix Critical/High before claiming “ready”; retest those IDs.  
9. Email summary to manager (Rajiv) + keep evidence privately.

**Timebox:** ~½–1 day for a careful first pass; retest fixes in 1–2 hours.

### Automated retest (API)

```bash
cd ace_finance_backend
set BASE_URL=https://ace-finance-api-f5hnhhd6c3bvffhj.southindia-01.azurewebsites.net
set DEMO_ACCESS_CODE=Aceolution_2024
set TEST_STORE=demo
npm run test:api:vapt
```

Covers automatable checklist IDs (authz, IDOR→404, uploads, duplicates, Swagger off, CORS, demo gate, etc.).  
**Still human:** C04 full Microsoft MFA in browser; A02 SWA document headers. Optional: `RUN_THROTTLE=1` for I01/I02.

---

## 7. Report template (copy into `00-report.md`)

```markdown
# Aceolution Finance — Internal VAPT report

| Field | Value |
|-------|--------|
| Date (IST) | |
| Tester | Iqbal Ahamed |
| Reviewer (optional) | |
| Build / deploy notes | FE + BE live as of … |
| Scope | Web + API per VAPT_SCOPE.md |
| Store used | Demo (primary) / Live (read-only notes) |
| Vendor | None — internal verification |

## Executive summary
- Overall: Ready for internal sign-off / Needs fixes / Blocked
- Critical: # | High: # | Medium: # | Low: # | Info: #
- One paragraph for management.

## Pre-flight
| ID | Result | Notes |
|----|--------|-------|
| P1 | | |
| … | | |

## Results
| ID | Result | Evidence file | Notes |
|----|--------|---------------|-------|
| A01 | PASS/FAIL | screenshots/A01-….png | |
| … | | | |

## Findings (FAILs only)
### F-1 — Title
- Severity:
- ID(s):
- Evidence:
- Risk:
- Recommendation:
- Status: Open / Fixed / Retest PASS

## Retest log
| Date | IDs | Result |
|------|-----|--------|

## Sign-off
- Tester: _____________ Date: _____________
- Manager (optional): _____________ Date: _____________

Disclaimer: Internal security verification only. Not a third-party certified penetration test.
```

---

## 8. What to tell management

**If no vendor:**  
We completed an **internal VAPT checklist** on production URLs (Demo for write tests), documented pass/fail with evidence, and fixed/retested gaps. This is **not** a vendor certificate; we can engage an external firm later if a client requires it.

**Backup vs VAPT (one line):**  
Backup protects recovery of DB/files/API config; VAPT tests whether the Finance web/API can be abused. Both are done as separate tracks.

---

## 9. Out of scope (do not mark FAIL for these)

- Azure Portal role assignments, Backup vault configuration, App Service backup jobs  
- MongoDB Atlas portal settings (except app-visible data leaks)  
- Frontend “backup” (git only)  
- DoS / load testing  
- Source-code audit (unless separately requested)  
- Other company products (HRMS, etc.)

---

## 10. After the run — hygiene

- [ ] Rotate any test passwords if shared broadly  
- [ ] Confirm `SEED_SECRET` not left enabled casually in prod  
- [ ] Confirm Swagger still off  
- [ ] Store report + screenshots in private location  
- [ ] Optionally update ticket / email Rajiv with executive summary only (no secrets)
