# Aceolution Finance — Auth, Live / Demo stores (for docs & VAPT)

Last updated: 2026-10-28

Use this as the source of truth before client demos, documentation screenshots, and **VAPT** scoping.

## Hosting (Azure)

| Layer | Live URL |
|-------|----------|
| Web app | https://finance.aceolution.com/ |
| API | https://ace-finance-api-f5hnhhd6c3bvffhj.southindia-01.azurewebsites.net/ |
| Demo guide | https://finance.aceolution.com/demo-guide/ (access code from team) |
| Architecture page | https://finance.aceolution.com/architecture/ (same unlock as demo guide) |
| Full docs | https://finance.aceolution.com/docs-guide/#architecture |

Microsoft allows customer penetration testing of **your** Azure App Service / web apps without pre-approval, subject to the [Cloud Unified Penetration Testing Rules of Engagement](https://www.microsoft.com/en-us/msrc/pentest-rules-of-engagement) (no DoS, no other tenants, etc.).

## Two data stores (isolation)

| | Live | Demo |
|---|------|------|
| MongoDB | `ace_finance` (`MONGODB_URI`) | `ace_finance_demo` (`MONGODB_URI_DEMO`) |
| Azure Blob | `ace-finance-files` | `ace-finance-files-demo` |
| Purpose | Real company work | Training / client demos |
| JWT claim | `store: "live"` | `store: "demo"` |

Every authenticated API request uses the store from the JWT (`store` / `isDemo`). Demo sessions must never read or write live data (and vice versa).

Health: `GET /health?format=json` reports both store connections.

## Login page (`/login/`)

Main screen (**Microsoft-first**):

1. **Sign in with Microsoft** — primary for `@aceolution.*` staff (company MFA)  
2. **Demo Access** — dynamic list of active `isDemo` users in the **demo** DB  
3. **Use password instead** — admin / legacy / no-Microsoft accounts  

Flow: home → (Microsoft **or** Demo Access **or** password) → optional OTP/TOTP on password path → **Choose Workspace** if email exists in Live and Demo (role on each card) → dashboard with Live/Demo badge.

### Microsoft

- Resolves / creates users in the **live** DB first (new users → `REQUESTER`).  
- Company MFA covers Ace OTP/TOTP (no Ace authenticator step).  
- If the same email also exists as an **active** user in the **demo** DB (or Live **ADMIN** with no demo row yet), the app shows **Choose Workspace** with **role per store**.  
- Example: Live `REQUESTER` + Demo `ADMIN` → picker shows both roles.  
- Once `microsoftId` is linked, **password login and forgot-password are blocked** for that account.

### Password (`Use password instead`)

- Always authenticates against **live** first.  
- Microsoft-linked accounts are rejected (must use Microsoft).  
- Demo personas (`isDemo`) cannot use this path (use Demo Access).  
- Non-admin: Email OTP (+ Authenticator when enrolled).  
- Admin: password (optional TOTP if enabled).  
- If the email exists in Live **and** Demo (or Live ADMIN opening Demo), show **Choose Workspace** with roles.

### Demo Access

- `GET /auth/demo-accounts` — public list of active `isDemo` users in demo DB (dynamic).  
- `POST /auth/demo-login` `{ email }` — one-click session in demo store (password optional).  
- Admin (Demo workspace) → Users → **Show on Demo Access login** toggles `isDemo` → list updates automatically.  
- Turning `isDemo` off or deactivating the user removes them from the list.

### Forgot password

- For **password** accounts only (live).  
- **Not** for Microsoft-linked users.  
- **Not** the primary path for Demo Access personas.

## Workspace badges

After login, UI shows **Live** / **Demo workspace** (header + sidebar) so testers know which store they are in.

## Roles (same in both stores; data separate)

`ADMIN` | `APPROVER` | `PROCESSOR` | `REQUESTER`

Project scoping applies to Requester / Approver via `assignedProjects`.

## Duplicate invoice detection

- **Hard duplicate** (same invoice file SHA-256, or same invoice # in project / matching details): submit is **auto-blocked** (HTTP 400). No expense is created — this is not a Rejected workflow status.
- **Potential duplicate** (same project + category + amount ±1 day): warning modal; requester must confirm to continue.
- Full detail: `aceolution_finance_architecture.md` §6 · in-app `/docs-guide/#duplicates`

## Suggested VAPT scope (Ace Finance)

Full engagement brief (targets, checklist, deliverables): **[`VAPT_SCOPE.md`](./VAPT_SCOPE.md)**.

**In scope**

- Web + API URLs above  
- Microsoft OAuth callback / JWT issuance  
- Password + 2FA + forgot-password (password users only)  
- Demo Access list + demo-login  
- Workspace choice + store isolation (demo token vs live APIs)  
- Role / project access control, expense IDOR, file download/upload  
- Admin user management `isDemo` toggle affecting Demo Access list  
- Duplicate invoice hard-block / potential-duplicate controls  

**Out of scope / forbidden by Microsoft ROE**

- DoS / flood  
- Attacking other Azure customers or Microsoft control plane  
- Using production PII beyond agreed test accounts  

**Preferred test data**

- Use **Demo** workspace / Demo Access for destructive tests  
- Keep Live tests read-mostly with dedicated test accounts  

## Related docs to keep in sync

- This folder is the **backend** git copy. Mirror edits to `ace_finance_frontend/docs/Architecture/`.
- Architecture index: [`README.md`](./README.md) · full spec: [`aceolution_finance_architecture.md`](./aceolution_finance_architecture.md) · [`VAPT_SCOPE.md`](./VAPT_SCOPE.md)
- Backend README: [`../../README.md`](../../README.md)
- Web: https://finance.aceolution.com/architecture/ · https://finance.aceolution.com/docs-guide/#architecture
- Frontend twin: `ace_finance_frontend/docs/Architecture/` + docs-guide section 0
